import { describe, it, expect, afterAll } from 'vitest';
import { startFakeServer, script, reply, type FakeScript, type FakeServer } from '../src/server/fake.js';
import { BenchClient } from '../src/bench/client.js';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('BenchClient', () => {
  const servers: FakeServer[] = [];
  afterAll(async () => {
    for (const s of servers) await s.close();
  });
  async function boot(s: FakeScript) {
    const srv = await startFakeServer({ port: 0, script: s });
    servers.push(srv);
    return srv;
  }

  it('records the begin message and a completed turn with chunks', async () => {
    const srv = await boot(script({ byResponseId: { 1: reply({ chunks: [{ text: 'One. ', delayMs: 5 }, { text: 'Two.', delayMs: 5 }] }) } }));
    const c = await BenchClient.connect({ url: srv.url, callId: 'call-a' });
    expect(await c.waitForBegin()).toBe(true);
    expect(c.begin).toMatchObject({ received: true, content: 'Hello, how can I help?' });
    const turn = c.requestResponse('response_required', 1, [{ role: 'user', content: 'hi' }]);
    await c.waitForComplete(1, 1000);
    expect(turn.chunks.map((ch) => ch.content)).toEqual(['One. ', 'Two.', '']);
    expect(turn.completedAt).not.toBeNull();
    expect(turn.timedOut).toBe(false);
    expect(c.agentTextFor(1)).toBe('One. Two.');
    expect(c.violations).toEqual([]);
    await c.close();
  });

  it('times out without completion and does not treat the next request as a supersede', async () => {
    const srv = await boot(script({ byResponseId: { 1: reply({ chunks: [{ text: 'Sure. ', delayMs: 5 }], complete: false }) } }));
    const c = await BenchClient.connect({ url: srv.url, callId: 'call-b' });
    await c.waitForBegin();
    c.requestResponse('response_required', 1, []);
    const t1 = await c.waitForComplete(1, 100);
    expect(t1.timedOut).toBe(true);
    expect(t1.completedAt).toBeNull();
    c.requestResponse('response_required', 2, []);
    expect(t1.superseded).toBe(false);
    await c.waitForComplete(2, 500);
    await c.close();
  });

  it('marks the earlier turn superseded when a newer id is requested while it is open', async () => {
    // id 1 completes at ~200 ms; id 2 is requested at ~50 ms, well before that.
    const srv = await boot(script({ fallback: reply({ chunks: [{ text: 'a. ', delayMs: 100 }, { text: 'b.', delayMs: 100 }] }) }));
    const c = await BenchClient.connect({ url: srv.url, callId: 'call-c' });
    await c.waitForBegin();
    const t1 = c.requestResponse('response_required', 1, []);
    await wait(50);
    const t2 = c.requestResponse('response_required', 2, []);
    await c.waitForComplete(2, 1000);
    expect(t1.superseded).toBe(true);
    expect(t1.supersededBy).toBe(2);
    expect(t1.supersededAt).not.toBeNull();
    expect(t2.superseded).toBe(false);
    await c.close();
  });

  it('drops a frame whose content_complete is a string and records a schema violation', async () => {
    const srv = await boot(
      script({
        byResponseId: {
          1: reply({ rawFrames: [{ response_type: 'response', response_id: 1, content: 'bad', content_complete: 'true' }], chunks: [{ text: 'ok.', delayMs: 5 }] }),
        },
      }),
    );
    const c = await BenchClient.connect({ url: srv.url, callId: 'call-d' });
    await c.waitForBegin();
    const turn = c.requestResponse('response_required', 1, []);
    await c.waitForComplete(1, 1000);
    expect(c.violations.map((v) => v.code)).toEqual(['schema']);
    expect(turn.chunks.map((ch) => ch.content)).toEqual(['ok.', '']);
    await c.close();
  });

  it('flags a missing response_type but still records the chunk', async () => {
    const srv = await boot(script({ byResponseId: { 1: reply({ rawFrames: [{ response_id: 1, content: 'no type. ', content_complete: false }], chunks: [{ text: 'ok.', delayMs: 5 }] }) } }));
    const c = await BenchClient.connect({ url: srv.url, callId: 'call-e' });
    await c.waitForBegin();
    const turn = c.requestResponse('response_required', 1, []);
    await c.waitForComplete(1, 1000);
    expect(c.violations.map((v) => v.code)).toEqual(['missing_response_type']);
    expect(turn.chunks[0].content).toBe('no type. ');
    await c.close();
  });

  it('flags a chunk for an unrequested response_id and mutually exclusive actions', async () => {
    const srv = await boot(
      script({
        byResponseId: {
          1: reply({
            rawFrames: [
              { response_type: 'response', response_id: 7, content: 'x', content_complete: true },
              { response_type: 'response', response_id: 1, content: 'bye ', content_complete: false, end_call: true, transfer_number: '+14155550100' },
            ],
            chunks: [{ text: 'ok.', delayMs: 5 }],
          }),
        },
      }),
    );
    const c = await BenchClient.connect({ url: srv.url, callId: 'call-f' });
    await c.waitForBegin();
    c.requestResponse('response_required', 1, []);
    await c.waitForComplete(1, 1000);
    expect(c.violations.map((v) => v.code).sort()).toEqual(['exclusive_actions', 'wrong_response_id']);
    await c.close();
  });

  it('attributes tool_call_invocation and tool_call_result to the live response_id', async () => {
    const srv = await boot(
      script({
        byResponseId: {
          1: reply({ chunks: [{ text: 'Booked.', delayMs: 5 }], toolCalls: [{ name: 'book_appointment', arguments: { date: '2026-09-24', time: '14:00' }, result: 'ok', afterChunk: 0 }] }),
        },
      }),
    );
    const c = await BenchClient.connect({ url: srv.url, callId: 'call-g' });
    await c.waitForBegin();
    c.requestResponse('response_required', 1, []);
    await c.waitForComplete(1, 1000);
    expect(c.toolCalls).toHaveLength(1);
    expect(c.toolCalls[0]).toMatchObject({ name: 'book_appointment', responseId: 1, parsedArguments: { date: '2026-09-24', time: '14:00' } });
    expect(c.toolCalls[0].result).toMatchObject({ content: 'ok', successful: true });
    await c.close();
  });

  it('sends call_details and keepalives when config asks for them, and counts echoes', async () => {
    const srv = await boot(script({ config: { auto_reconnect: true, call_details: true } }));
    const c = await BenchClient.connect({ url: srv.url, callId: 'call-h', pingIntervalMs: 100, pingTimeoutMs: 400 });
    await c.waitForBegin();
    await wait(350); // pings at 100, 200, 300 ms: 3 expected, ±1 margin; every echo is due long before the 400 ms timeout
    expect(c.config).toEqual({ auto_reconnect: true, call_details: true });
    expect(c.keepalive.enabled).toBe(true);
    expect(c.keepalive.sent).toBeGreaterThanOrEqual(2);
    expect(c.keepalive.sent).toBeLessThanOrEqual(4);
    expect(c.keepalive.echoed).toBeGreaterThanOrEqual(c.keepalive.sent - 1);
    expect(c.keepalive.missed).toBe(0);
    const details = srv.received.find((f) => (f as { interaction_type: string }).interaction_type === 'call_details') as { call: { call_id: string } };
    expect(details.call.call_id).toBe('call-h');
    await c.close();
  });

  it('counts a missed keepalive when the server never echoes', async () => {
    const srv = await boot(script({ config: { auto_reconnect: true }, echoPing: false }));
    const c = await BenchClient.connect({ url: srv.url, callId: 'call-i', pingIntervalMs: 100, pingTimeoutMs: 150 });
    await c.waitForBegin();
    await wait(400); // pings at 100, 200, 300 ms; misses fire at 250 and 350 ms: 2 expected, ±1 margin
    expect(c.keepalive.missed).toBeGreaterThanOrEqual(1);
    expect(c.keepalive.echoed).toBe(0);
    await c.close();
  });

  it('reports no begin message when the server never sends response_id 0', async () => {
    const srv = await boot(script({ begin: null }));
    const c = await BenchClient.connect({ url: srv.url, callId: 'call-j', beginTimeoutMs: 100 });
    expect(await c.waitForBegin()).toBe(false);
    expect(c.begin.received).toBe(false);
    await c.close();
  });
});
