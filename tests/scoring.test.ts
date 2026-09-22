import { describe, it, expect } from 'vitest';
import { ScenarioSchema } from '../src/bench/scenario.js';
import { canonicalArgs, requestGroups, scoreRun } from '../src/bench/scoring.js';
import type { ScenarioRunResult, ToolCallRecord, TurnRecord } from '../src/bench/types.js';

function turn(responseId: number, completed: boolean, extra: Partial<TurnRecord> = {}): TurnRecord {
  return {
    responseId,
    kind: 'response_required',
    requestedAt: 0,
    chunks: completed ? [{ at: 100, content: 'Okay.', content_complete: true, end_call: false, transfer_number: null, digit_to_press: null }] : [],
    completedAt: completed ? 100 : null,
    superseded: false,
    supersededAt: null,
    supersededBy: null,
    timedOut: !completed,
    ...extra,
  };
}
function call(responseId: number, name: string, args: Record<string, unknown>): ToolCallRecord {
  return { tool_call_id: `${name}-${responseId}`, name, arguments: JSON.stringify(args), parsedArguments: args, at: 50, responseId, result: null };
}
function result(partial: Partial<ScenarioRunResult>): ScenarioRunResult {
  return {
    scenario: 's', run: 1, callId: 'c', url: 'ws://x', config: null,
    begin: { received: true, content: 'Hi.', ms: 10 },
    turns: [], toolCalls: [], violations: [],
    keepalive: { enabled: false, sent: 0, echoed: 0, missed: 0 },
    agentUtterances: ['Okay.'], durationMs: 500,
    ...partial,
  };
}
const scenario = ScenarioSchema.parse({
  name: 's', description: 'd', turns: [{ user: 'a' }],
  expect: { tool_calls: [{ name: 'book_appointment', args: { date: '2026-09-24', time: '15:00' } }], forbidden_tools: ['end_call'], agent_text_contains: ['okay'] },
});

describe('scoreRun', () => {
  it('passes a clean run', () => {
    const s = scoreRun(scenario, result({ turns: [turn(1, true)], toolCalls: [call(1, 'book_appointment', { date: '2026-09-24', time: '15:00', message: 'One moment.' })] }));
    expect(s).toMatchObject({ completeRequested: 1, completeReceived: 1, toolMissing: 0, toolUnnecessary: 0, toolDuplicate: 0, violations: 0, textMissing: 0, mustCompleteOk: true });
    expect(s.findings).toEqual([]);
  });

  it('flags a missing begin message and a turn that never completed', () => {
    const s = scoreRun(scenario, result({ begin: { received: false, content: '', ms: null }, turns: [turn(1, false)], toolCalls: [call(1, 'book_appointment', { date: '2026-09-24', time: '15:00' })] }));
    expect(s.findings.map((f) => f.code)).toEqual(['no_begin_message', 'content_complete_missing']);
    expect(s.mustCompleteOk).toBe(false);
    expect(s.completeReceived).toBe(0);
  });

  it('flags a completed turn that ran a tool but said nothing (silent_tool_turn, Retell best-practice page)', () => {
    const silent = turn(1, true, { chunks: [{ at: 100, content: '', content_complete: true, end_call: false, transfer_number: null, digit_to_press: null }] });
    const s = scoreRun(scenario, result({ turns: [silent], toolCalls: [call(1, 'book_appointment', { date: '2026-09-24', time: '15:00' })] }));
    expect(s.findings.map((f) => f.code)).toEqual(['silent_tool_turn']);
    expect(s.mustCompleteOk).toBe(true);
  });

  it('counts missing, unnecessary (forbidden or unexpected), and duplicate tool calls', () => {
    const turns = [turn(1, true, { superseded: true, supersededBy: 2, completedAt: null, chunks: [] }), turn(2, true)];
    const toolCalls = [
      call(1, 'book_appointment', { date: '2026-09-24', time: '14:00', message: 'a' }),
      call(2, 'book_appointment', { date: '2026-09-24', time: '14:00', message: 'b' }),
      call(2, 'end_call', { message: 'bye' }),
      call(2, 'transfer_call', { number: '1' }),
    ];
    const s = scoreRun(scenario, result({ turns, toolCalls }));
    expect(s.toolMissing).toBe(1);
    expect(s.toolUnnecessary).toBe(2);
    expect(s.toolDuplicate).toBe(1);
    expect(s.findings.filter((f) => f.code === 'tool_duplicate')[0].message).toContain('1→2');
  });

  it('lists a call with the expected name but other arguments as tool_args_mismatch (informational)', () => {
    const s = scoreRun(scenario, result({ turns: [turn(1, true)], toolCalls: [call(1, 'book_appointment', { date: '2026-09-24', time: '14:00' })] }));
    expect(s.findings.map((f) => f.code)).toEqual(['tool_missing', 'tool_args_mismatch']);
    expect(s).toMatchObject({ toolMissing: 1, toolUnnecessary: 0, toolDuplicate: 0, mustCompleteOk: true });
  });

  it('does not call the same args a duplicate across separate caller requests', () => {
    const toolCalls = [call(1, 'book_appointment', { date: '2026-09-24', time: '15:00' }), call(2, 'book_appointment', { date: '2026-09-24', time: '15:00' })];
    const s = scoreRun(scenario, result({ turns: [turn(1, true), turn(2, true)], toolCalls }));
    expect(s.toolDuplicate).toBe(0);
  });

  it('reports violations, missed keepalives, missing text, markdown, and stale chunks', () => {
    const stale = turn(1, false, { superseded: true, supersededAt: 60, supersededBy: 2, chunks: [{ at: 80, content: 'late', content_complete: false, end_call: false, transfer_number: null, digit_to_press: null }] });
    const s = scoreRun(
      scenario,
      result({
        turns: [stale, turn(2, true)],
        toolCalls: [call(2, 'book_appointment', { date: '2026-09-24', time: '15:00' })],
        violations: [{ code: 'schema', message: 'bad', raw: '{}', at: 5 }],
        keepalive: { enabled: true, sent: 3, echoed: 1, missed: 2 },
        agentUtterances: ['**Sure**, here is a list:'],
      }),
    );
    expect(s.findings.map((f) => f.code).sort()).toEqual(['agent_text_missing', 'keepalive_missed', 'protocol_violation', 'stale_chunks', 'voice_markdown']);
    expect(s.violations).toBe(1);
    expect(s.textMissing).toBe(1);
    expect(s.mustCompleteOk).toBe(true);
  });
});

describe('helpers', () => {
  it('canonicalArgs drops message and sorts keys', () => {
    expect(canonicalArgs(call(1, 'x', { time: '14:00', message: 'hi', date: '2026-09-24' }))).toBe(canonicalArgs(call(2, 'x', { date: '2026-09-24', time: '14:00' })));
  });
  it('requestGroups chains superseded turns', () => {
    const turns = [turn(1, false, { superseded: true, supersededBy: 2 }), turn(2, false, { superseded: true, supersededBy: 3 }), turn(3, true), turn(4, true)];
    expect(requestGroups(turns)).toEqual([[1, 2, 3], [4]]);
  });
});
