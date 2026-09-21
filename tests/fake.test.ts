import { describe, it, expect, afterAll } from 'vitest';
import { startFakeServer, script, reply, type FakeServer } from '../src/server/fake.js';
import { connectRaw } from './helpers/raw-client.js';

describe('fake custom-LLM server', () => {
  const servers: FakeServer[] = [];
  afterAll(async () => {
    for (const s of servers) await s.close();
  });
  async function boot(s = script()) {
    const srv = await startFakeServer({ port: 0, script: s });
    servers.push(srv);
    return srv;
  }

  it('sends config first, then the begin message with response_id 0', async () => {
    const srv = await boot(script({ config: { auto_reconnect: true } }));
    const c = await connectRaw(`${srv.url}/call-1`);
    await c.waitFor((f) => f.response_type === 'response');
    expect(c.frames[0]).toEqual({ response_type: 'config', config: { auto_reconnect: true } });
    expect(c.frames[1]).toEqual({ response_type: 'response', response_id: 0, content: 'Hello, how can I help?', content_complete: true });
    await c.close();
  });

  it('plays chunks, tool frames, and completion for a response_required', async () => {
    const srv = await boot(
      script({
        byResponseId: {
          1: reply({
            chunks: [{ text: 'One. ', delayMs: 5 }, { text: 'Two.', delayMs: 5 }],
            toolCalls: [{ name: 'book_appointment', arguments: { date: '2026-09-24', time: '14:00' }, result: 'booked', afterChunk: 1 }],
          }),
        },
      }),
    );
    const c = await connectRaw(`${srv.url}/call-2`);
    c.send({ interaction_type: 'response_required', response_id: 1, transcript: [{ role: 'user', content: 'book it' }] });
    await c.waitFor((f) => f.response_type === 'response' && f.response_id === 1 && f.content_complete === true);
    expect(c.frames.slice(2).map((f) => f.response_type)).toEqual(['response', 'tool_call_invocation', 'tool_call_result', 'response', 'response']);
    expect(c.frames[3]).toMatchObject({ name: 'book_appointment', arguments: JSON.stringify({ date: '2026-09-24', time: '14:00' }) });
    expect(c.frames[4]).toMatchObject({ tool_call_id: c.frames[3].tool_call_id, content: 'booked', successful: true });
    expect(srv.received).toHaveLength(1);
    await c.close();
  });

  it('stops an old response when a newer response_id arrives', async () => {
    // Chunks for id 1 at 100, 400, 700 ms; id 2 is requested at ~200 ms, so exactly one id-1 chunk is expected (±1 margin).
    const srv = await boot(script({ fallback: reply({ chunks: [{ text: 'a', delayMs: 100 }, { text: 'b', delayMs: 300 }, { text: 'c', delayMs: 300 }] }) }));
    const c = await connectRaw(`${srv.url}/call-3`);
    c.send({ interaction_type: 'response_required', response_id: 1, transcript: [] });
    await new Promise((r) => setTimeout(r, 200));
    c.send({ interaction_type: 'response_required', response_id: 2, transcript: [] });
    await c.waitFor((f) => f.response_id === 2 && f.content_complete === true, 3000);
    expect(c.frames.filter((f) => f.response_id === 1).length).toBeLessThanOrEqual(2);
    expect(c.frames.filter((f) => f.response_id === 2 && f.content_complete === false)).toHaveLength(3);
    await c.close();
  });

  it('picks a reply by regex on the last user utterance, else the fallback', async () => {
    const srv = await boot(
      script({
        matchers: [{ pattern: 'bye', reply: reply({ chunks: [{ text: 'Goodbye.', delayMs: 1 }], endCall: true }) }],
        fallback: reply({ chunks: [{ text: 'Okay.', delayMs: 1 }] }),
      }),
    );
    const c = await connectRaw(`${srv.url}/call-4`);
    c.send({ interaction_type: 'response_required', response_id: 1, transcript: [{ role: 'user', content: 'ok bye now' }] });
    const done1 = await c.waitFor((f) => f.response_id === 1 && f.content_complete === true);
    expect(done1).toMatchObject({ end_call: true });
    c.send({ interaction_type: 'response_required', response_id: 2, transcript: [{ role: 'user', content: 'hello' }] });
    await c.waitFor((f) => f.response_id === 2 && f.content_complete === true);
    expect(c.frames.find((f) => f.response_id === 2 && f.content === 'Okay.')).toBeTruthy();
    await c.close();
  });

  it('plays a late chunk after the completion frame (content sent after content_complete: true)', async () => {
    const srv = await boot(script({ byResponseId: { 1: reply({ chunks: [{ text: 'Done.', delayMs: 5 }], lateChunks: [{ text: 'late', delayMs: 20 }] }) } }));
    const c = await connectRaw(`${srv.url}/call-6`);
    c.send({ interaction_type: 'response_required', response_id: 1, transcript: [] });
    await c.waitFor((f) => f.response_id === 1 && f.content === 'late');
    const mine = c.frames.filter((f) => f.response_type === 'response' && f.response_id === 1);
    expect(mine.map((f) => [f.content, f.content_complete])).toEqual([
      ['Done.', false],
      ['', true],
      ['late', false],
    ]);
    await c.close();
  });

  it('rejects instead of hanging when the port is already in use (security M1)', async () => {
    const srv = await startFakeServer({ port: 0, script: script() });
    await expect(startFakeServer({ port: srv.port, script: script() })).rejects.toThrow();
    await srv.close();
  });

  it('echoes ping_pong with the same timestamp', async () => {
    const srv = await boot();
    const c = await connectRaw(`${srv.url}/call-5`);
    c.send({ interaction_type: 'ping_pong', timestamp: 1703302407333 });
    expect(await c.waitFor((f) => f.response_type === 'ping_pong')).toEqual({ response_type: 'ping_pong', timestamp: 1703302407333 });
    await c.close();
  });
});
