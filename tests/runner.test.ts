import { describe, it, expect, afterAll } from 'vitest';
import { startFakeServer, script, reply, type FakeServer } from '../src/server/fake.js';
import { ScenarioSchema } from '../src/bench/scenario.js';
import { runScenario } from '../src/bench/runner.js';
import { scoreRun } from '../src/bench/scoring.js';
import { firstSentenceMs } from '../src/bench/metrics.js';

const scenario = ScenarioSchema.parse({
  name: 'runner-test',
  description: 'inline',
  turn_timeout_ms: 300,
  turns: [{ user: 'Book me September 24th at 2pm.' }, { user: 'Move it to 3pm.', interrupt: { after_ms: 50, user: 'No wait, 4pm.' } }, { reminder: true }],
  expect: {
    tool_calls: [{ name: 'book_appointment', args: { date: '2026-09-24', time: '16:00' } }],
    forbidden_tools: ['end_call'],
    must_complete: true,
    agent_text_contains: ['booked'],
  },
});

const good = script({
  config: { auto_reconnect: true, call_details: true },
  byResponseId: {
    1: reply({ chunks: [{ text: 'Sure, ', delayMs: 20 }, { text: 'booked for two. ', delayMs: 20 }], toolCalls: [{ name: 'book_appointment', arguments: { date: '2026-09-24', time: '14:00', message: 'One moment.' }, result: 'ok', afterChunk: 0 }] }),
    2: reply({ chunks: [{ text: 'Moving it ', delayMs: 100 }, { text: 'to three.', delayMs: 100 }], toolCalls: [{ name: 'book_appointment', arguments: { date: '2026-09-24', time: '15:00' }, result: 'ok', afterChunk: 0 }] }),
    3: reply({ chunks: [{ text: 'Done, four it is.', delayMs: 20 }], toolCalls: [{ name: 'book_appointment', arguments: { date: '2026-09-24', time: '16:00' }, result: 'ok', afterChunk: 0 }] }),
    4: reply({ chunks: [{ text: 'Are you still there?', delayMs: 20 }] }),
  },
});

const bad = script({
  byResponseId: {
    1: reply({ chunks: [{ text: 'Sure. ', delayMs: 10 }], complete: false }),
    2: reply({ chunks: [{ text: 'a', delayMs: 100 }], toolCalls: [{ name: 'book_appointment', arguments: { date: '2026-09-24', time: '15:00' }, result: 'ok', afterChunk: 0 }] }),
    3: reply({
      chunks: [{ text: 'ok.', delayMs: 10 }],
      toolCalls: [
        { name: 'book_appointment', arguments: { date: '2026-09-24', time: '15:00', message: 'again' }, result: 'ok', afterChunk: 0 },
        { name: 'end_call', arguments: {}, result: 'x', afterChunk: 0 },
      ],
      rawFrames: [{ response_type: 'response', response_id: 3, content: 'bad', content_complete: 'true' }],
    }),
    4: reply({ chunks: [{ text: 'Hello?', delayMs: 10 }] }),
  },
});

describe('runScenario', () => {
  const servers: FakeServer[] = [];
  afterAll(async () => {
    for (const s of servers) await s.close();
  });

  it('plays user turns, an interruption that supersedes, and a reminder; clean server scores clean', async () => {
    const srv = await startFakeServer({ port: 0, script: good });
    servers.push(srv);
    const r = await runScenario(scenario, { url: srv.url, run: 1, pingIntervalMs: 100, pingTimeoutMs: 400 });
    expect(r.callId.startsWith('bench-runner-test-1-')).toBe(true);
    expect(r.begin.received).toBe(true);
    expect(r.turns.map((t) => t.responseId)).toEqual([1, 2, 3, 4]);
    expect(r.turns.map((t) => t.kind)).toEqual(['response_required', 'response_required', 'response_required', 'reminder_required']);
    expect(r.turns[1]).toMatchObject({ superseded: true, supersededBy: 3 });
    expect(r.turns.filter((t) => !t.superseded).every((t) => t.completedAt !== null)).toBe(true);
    expect(r.toolCalls.map((c) => c.responseId)).toEqual([1, 2, 3]);
    expect(r.agentUtterances).toEqual(['Hello, how can I help?', 'Sure, booked for two.', 'Done, four it is.', 'Are you still there?']);
    expect(r.keepalive.enabled).toBe(true);
    expect(r.keepalive.missed).toBe(0);
    const ttfs = firstSentenceMs(r.turns[0]);
    expect(ttfs).not.toBeNull();
    expect(ttfs as number).toBeGreaterThanOrEqual(35);
    expect(ttfs as number).toBeLessThan(1000);
    const transcriptFrames = srv.received.filter((f) => (f as { interaction_type: string }).interaction_type === 'update_only') as { turntaking?: string }[];
    expect(transcriptFrames.length).toBe(9);
    expect(transcriptFrames.filter((f) => f.turntaking === 'agent_turn').length).toBe(3);
    const s = scoreRun(scenario, r);
    expect(s).toMatchObject({ completeRequested: 3, completeReceived: 3, toolMissing: 0, toolUnnecessary: 0, toolDuplicate: 0, violations: 0, textMissing: 0, mustCompleteOk: true });
    // The fake books 14:00 and 15:00 on the way to the expected 16:00; those are informational tool_args_mismatch lines, not failures.
    expect(s.findings.filter((f) => f.code !== 'tool_args_mismatch')).toEqual([]);
    expect(s.findings.filter((f) => f.code === 'tool_args_mismatch')).toHaveLength(2);
  });

  it('reports exact findings for a misbehaving server', async () => {
    const srv = await startFakeServer({ port: 0, script: bad });
    servers.push(srv);
    const r = await runScenario(scenario, { url: srv.url, run: 2 });
    expect(r.turns[0]).toMatchObject({ timedOut: true, superseded: false, completedAt: null });
    const s = scoreRun(scenario, r);
    expect(s).toMatchObject({ completeRequested: 3, completeReceived: 2, toolMissing: 1, toolUnnecessary: 1, toolDuplicate: 1, violations: 1, textMissing: 1, mustCompleteOk: false });
    // Both 15:00 bookings are also informational tool_args_mismatch lines (expected 16:00); filtered out of the exact list.
    expect(s.findings.filter((f) => f.code !== 'tool_args_mismatch').map((f) => f.code).sort()).toEqual(['agent_text_missing', 'content_complete_missing', 'protocol_violation', 'tool_duplicate', 'tool_missing', 'tool_unnecessary']);
  });

  it('flags a server that runs a tool and says nothing for the turn (silent_tool_turn, api-notes §8)', async () => {
    const silentScenario = ScenarioSchema.parse({
      name: 'silent-test',
      description: 'inline',
      turn_timeout_ms: 300,
      turns: [{ user: 'Book me September 24th at 4pm.' }],
      expect: { tool_calls: [{ name: 'book_appointment', args: { date: '2026-09-24', time: '16:00' } }] },
    });
    const silent = script({
      byResponseId: { 1: reply({ chunks: [], toolCalls: [{ name: 'book_appointment', arguments: { date: '2026-09-24', time: '16:00' }, result: 'ok', afterChunk: 0 }] }) },
    });
    const srv = await startFakeServer({ port: 0, script: silent });
    servers.push(srv);
    const r = await runScenario(silentScenario, { url: srv.url, run: 1 });
    expect(r.turns[0].completedAt).not.toBeNull();
    expect(r.turns[0].chunks.map((c) => c.content)).toEqual(['']);
    expect(r.toolCalls).toHaveLength(1);
    const s = scoreRun(silentScenario, r);
    expect(s.findings.map((f) => f.code)).toEqual(['silent_tool_turn']);
  });

  it('times an interrupt from the agent\'s first chunk (after_first_chunk_ms)', async () => {
    const fcScenario = ScenarioSchema.parse({
      name: 'interrupt-fc-test',
      description: 'inline',
      turn_timeout_ms: 1000,
      turns: [{ user: 'x', interrupt: { after_first_chunk_ms: 50, user: 'y' } }],
      expect: {},
    });
    const fc = script({
      byResponseId: {
        1: reply({ chunks: [{ text: 'a. ', delayMs: 100 }, { text: 'b. ', delayMs: 100 }, { text: 'c.', delayMs: 100 }] }),
        2: reply({ chunks: [{ text: 'Sure thing.', delayMs: 10 }] }),
      },
    });
    const srv = await startFakeServer({ port: 0, script: fc });
    servers.push(srv);
    const r = await runScenario(fcScenario, { url: srv.url, run: 1 });
    expect(r.turns[0]).toMatchObject({ superseded: true, supersededBy: 2 });
    expect(r.turns[0].chunks.some((c) => c.content.length > 0)).toBe(true);
    const firstIdx = r.agentUtterances.indexOf('a.');
    expect(firstIdx).toBeGreaterThan(-1);
    const secondIdx = r.agentUtterances.findIndex((u) => u.includes('Sure thing.'));
    expect(secondIdx).toBeGreaterThan(firstIdx);
  });
});
