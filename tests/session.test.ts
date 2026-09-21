import { describe, it, expect, afterAll } from 'vitest';
import { BookingStore } from '../src/server/booking.js';
import { BEGIN_MESSAGE } from '../src/server/tools.js';
import { buildMessages, REMINDER_NOTE } from '../src/server/session.js';
import { startReferenceServer, callIdFromUrl, type ReferenceServer } from '../src/server/reference.js';
import { connectRaw } from './helpers/raw-client.js';
import { fakeLlm, type FakeLlmStep } from './helpers/fake-llm.js';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const req = (id: number, user: string) => ({ interaction_type: 'response_required', response_id: id, transcript: [{ role: 'agent', content: BEGIN_MESSAGE }, { role: 'user', content: user }] });

describe('buildMessages', () => {
  it('maps the transcript to alternating messages starting with a user turn', () => {
    const m = buildMessages([{ role: 'agent', content: 'Hi.' }, { role: 'user', content: 'Book me.' }, { role: 'user', content: 'At 2pm.' }], 'response_required');
    expect(m).toEqual([{ role: 'user', content: '[Call connected.]' }, { role: 'assistant', content: 'Hi.' }, { role: 'user', content: 'Book me. At 2pm.' }]);
  });
  it('appends the reminder note for reminder_required', () => {
    const m = buildMessages([{ role: 'user', content: 'Hello?' }, { role: 'agent', content: 'Hi.' }], 'reminder_required');
    expect(m[m.length - 1]).toEqual({ role: 'user', content: REMINDER_NOTE });
  });
});

describe('callIdFromUrl', () => {
  it('takes the last path segment (api-notes §2)', () => {
    expect(callIdFromUrl('/llm-websocket/call_abc')).toBe('call_abc');
    expect(callIdFromUrl('/llm-websocket/call_abc/')).toBe('call_abc');
    expect(callIdFromUrl(undefined)).toBe('unknown-call');
  });

  it('returns unknown-call instead of throwing on an unparsable request path (security H1)', () => {
    expect(callIdFromUrl('//')).toBe('unknown-call');
  });
});

describe('reference session over the wire', () => {
  const servers: ReferenceServer[] = [];
  afterAll(async () => {
    for (const s of servers) await s.close();
  });
  async function boot(steps: FakeLlmStep[], bookings = new BookingStore(), logs: string[] = []) {
    const llm = fakeLlm(steps);
    const srv = await startReferenceServer({ port: 0, deps: { llm, bookings, log: (l) => logs.push(l) } });
    servers.push(srv);
    const c = await connectRaw(`${srv.url}/call-x`);
    await c.waitFor((f) => f.response_id === 0);
    return { c, llm, bookings, logs };
  }

  it('sends config first, then the begin message, and echoes ping_pong', async () => {
    const { c } = await boot([{ textChunks: [], chunkDelayMs: 0, toolUses: [] }]);
    expect(c.frames[0]).toEqual({ response_type: 'config', config: { auto_reconnect: true, call_details: true } });
    expect(c.frames[1]).toEqual({ response_type: 'response', response_id: 0, content: BEGIN_MESSAGE, content_complete: true });
    c.send({ interaction_type: 'ping_pong', timestamp: 1703302407333 });
    expect(await c.waitFor((f) => f.response_type === 'ping_pong')).toEqual({ response_type: 'ping_pong', timestamp: 1703302407333 });
    await c.close();
  });

  it('streams text chunks under the requested response_id and closes with content_complete', async () => {
    const { c } = await boot([{ textChunks: ['Sure, ', 'two pm works.'], chunkDelayMs: 0, toolUses: [] }]);
    c.send(req(1, 'Two pm?'));
    await c.waitFor((f) => f.response_id === 1 && f.content_complete === true);
    const mine = c.frames.filter((f) => f.response_type === 'response' && f.response_id === 1);
    expect(mine.map((f) => [f.content, f.content_complete])).toEqual([['Sure, ', false], ['two pm works.', false], ['', true]]);
    await c.close();
  });

  it('runs a tool: speaks the message, emits invocation and result, streams the follow-up, books idempotently', async () => {
    const tool = { id: 't1', name: 'book_appointment', input: { date: '2026-09-24', time: '14:00', message: 'One moment while I book that.' } };
    const { c, bookings } = await boot([
      { textChunks: [], chunkDelayMs: 0, toolUses: [tool] },
      { textChunks: ['You are all set.'], chunkDelayMs: 0, toolUses: [] },
      { textChunks: [], chunkDelayMs: 0, toolUses: [tool] },
      { textChunks: ['Still booked.'], chunkDelayMs: 0, toolUses: [] },
    ]);
    c.send(req(1, 'Book September 24th at 2pm.'));
    await c.waitFor((f) => f.response_id === 1 && f.content_complete === true);
    const seq = c.frames.slice(2).map((f) => f.response_type);
    expect(seq).toEqual(['response', 'tool_call_invocation', 'tool_call_result', 'response', 'response']);
    expect(c.frames[2]).toMatchObject({ response_id: 1, content: 'One moment while I book that. ', content_complete: false });
    expect(c.frames[3]).toMatchObject({ name: 'book_appointment', arguments: JSON.stringify({ date: '2026-09-24', time: '14:00' }) });
    expect(c.frames[4]).toMatchObject({ tool_call_id: c.frames[3].tool_call_id, successful: true });
    expect(String(c.frames[4].content)).toContain('Booked');
    expect(bookings.size).toBe(1);
    c.send(req(2, 'Book September 24th at 2pm again.'));
    await c.waitFor((f) => f.response_id === 2 && f.content_complete === true);
    const secondResult = c.frames.filter((f) => f.response_type === 'tool_call_result')[1];
    expect(String(secondResult.content)).toContain('Already booked');
    expect(bookings.size).toBe(1);
    await c.close();
  });

  it('stops streaming a stale response when a newer response_id arrives, but still completes it', async () => {
    // Chunks for id 3 at 200, 400, 600, 800 ms; id 4 arrives at ~300 ms, so one stale chunk is expected (±1 margin).
    const { c } = await boot([
      { textChunks: ['one ', 'two ', 'three ', 'four.'], chunkDelayMs: 200, toolUses: [] },
      { textChunks: ['Fresh answer.'], chunkDelayMs: 0, toolUses: [] },
    ]);
    c.send(req(3, 'Slow question'));
    await wait(300);
    c.send(req(4, 'Never mind'));
    await c.waitFor((f) => f.response_id === 4 && f.content_complete === true);
    await c.waitFor((f) => f.response_id === 3 && f.content_complete === true, 1500);
    const stale = c.frames.filter((f) => f.response_id === 3 && f.content !== '');
    expect(stale.length).toBeLessThanOrEqual(2);
    expect(c.frames.find((f) => f.response_id === 4 && f.content === 'Fresh answer.')).toBeTruthy();
    await c.close();
  });

  it('still sends content_complete when the provider throws (finally block, api-notes §8)', async () => {
    const { c } = await boot([{ textChunks: [], chunkDelayMs: 0, toolUses: [], fail: true }]);
    c.send(req(5, 'Anything'));
    expect(await c.waitFor((f) => f.response_id === 5 && f.content_complete === true)).toEqual({ response_type: 'response', response_id: 5, content: '', content_complete: true });
    await c.close();
  });

  it('end_call: speaks the goodbye and sets end_call on the completing frame', async () => {
    const { c } = await boot([{ textChunks: [], chunkDelayMs: 0, toolUses: [{ id: 't9', name: 'end_call', input: { message: 'Goodbye!' } }] }]);
    c.send(req(6, 'Bye'));
    const done = await c.waitFor((f) => f.response_id === 6 && f.content_complete === true);
    expect(done).toEqual({ response_type: 'response', response_id: 6, content: '', content_complete: true, end_call: true });
    expect(c.frames.find((f) => f.response_id === 6 && f.content === 'Goodbye! ')).toBeTruthy();
    expect(c.frames.find((f) => f.response_type === 'tool_call_invocation' && f.name === 'end_call')).toBeTruthy();
    await c.close();
  });

  it('logs and ignores a second tool use in one turn (reference-server limit)', async () => {
    const bookTool = { id: 't1', name: 'book_appointment', input: { date: '2026-09-24', time: '14:00', message: 'One moment while I book that.' } };
    const endCallTool = { id: 't2', name: 'end_call', input: { message: 'Bye.' } };
    const { c, logs } = await boot(
      [
        { textChunks: [], chunkDelayMs: 0, toolUses: [bookTool, endCallTool] },
        { textChunks: ['Done.'], chunkDelayMs: 0, toolUses: [] },
      ],
      new BookingStore(),
      [],
    );
    c.send(req(7, 'Book September 24th at 2pm and hang up.'));
    const done = await c.waitFor((f) => f.response_id === 7 && f.content_complete === true);
    const invocations = c.frames.filter((f) => f.response_type === 'tool_call_invocation');
    expect(invocations).toHaveLength(1);
    expect(invocations[0]).toMatchObject({ name: 'book_appointment' });
    expect(done.end_call).toBeUndefined();
    expect(logs.some((l) => l.includes('returned 2 tool uses'))).toBe(true);
    await c.close();
  });

  it('separates streamed text from the tool message with a space when the text has no trailing whitespace', async () => {
    const bookTool = { id: 't1', name: 'book_appointment', input: { date: '2026-09-24', time: '14:00', message: 'One moment while I book that.' } };
    const { c } = await boot([
      { textChunks: ['I will book that.'], chunkDelayMs: 0, toolUses: [bookTool] },
      { textChunks: ['You are all set.'], chunkDelayMs: 0, toolUses: [] },
    ]);
    c.send(req(8, 'Book September 24th at 2pm.'));
    await c.waitFor((f) => f.response_id === 8 && f.content_complete === true);
    const mine = c.frames.filter((f) => f.response_type === 'response' && f.response_id === 8);
    const content = mine.map((f) => f.content).join('');
    expect(content).toBe('I will book that. One moment while I book that. You are all set.');
    await c.close();
  });
});
