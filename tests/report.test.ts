import { describe, it, expect } from 'vitest';
import { ScenarioSchema } from '../src/bench/scenario.js';
import { aggregate, formatTable, renderMarkdown, COLUMNS, type ScenarioScore } from '../src/bench/report.js';
import type { ScenarioRunResult } from '../src/bench/types.js';

function run(runNo: number, ttfsMs: number, completed = true): ScenarioRunResult {
  return {
    scenario: 's', run: runNo, callId: `c${runNo}`, url: 'ws://x', config: null,
    begin: { received: true, content: 'Hi.', ms: 5 },
    turns: [{ responseId: 1, kind: 'response_required', requestedAt: 0, chunks: [{ at: ttfsMs, content: 'Okay.', content_complete: completed, end_call: false, transfer_number: null, digit_to_press: null }], completedAt: completed ? ttfsMs : null, superseded: false, supersededAt: null, supersededBy: null, timedOut: !completed }],
    toolCalls: [], violations: [], keepalive: { enabled: false, sent: 0, echoed: 0, missed: 0 }, agentUtterances: ['Okay.'], durationMs: 100,
  };
}
const scenario = ScenarioSchema.parse({ name: 's', description: 'd', turns: [{ user: 'a' }], expect: {} });

describe('aggregate', () => {
  it('pools TTFS across runs and sums counts', () => {
    const score = aggregate(scenario, [run(1, 100), run(2, 300), run(3, 200, false)]);
    expect(score).toMatchObject({ scenario: 's', runs: 3, ttfsP50: 200, ttfsP90: 300, completeRequested: 3, completeReceived: 2, mustCompleteOk: false });
    expect(score.findings).toHaveLength(1);
    expect(score.findings[0].message.startsWith('run 3:')).toBe(true);
    expect(score.transcriptDiffs.map((t) => t.run)).toEqual([1, 2, 3]);
    expect(score.transcriptDiffs[0].diff).toBe('--- expected\n+++ actual\n+Okay.');
  });
});

describe('formatTable and renderMarkdown', () => {
  const scores: ScenarioScore[] = [
    { scenario: 'book-appointment', runs: 3, ttfsP50: 812.4, ttfsP90: 1200, completeReceived: 3, completeRequested: 3, toolMissing: 0, toolUnnecessary: 0, toolDuplicate: 0, violations: 0, textMissing: 0, mustCompleteOk: true, findings: [], transcriptDiffs: [{ run: 1, diff: '--- expected\n+++ actual\n Okay.' }] },
    { scenario: 'x', runs: 1, ttfsP50: null, ttfsP90: null, completeReceived: 0, completeRequested: 1, toolMissing: 1, toolUnnecessary: 0, toolDuplicate: 0, violations: 2, textMissing: 0, mustCompleteOk: false, findings: [{ code: 'tool_missing', message: 'run 1: expected end_call', responseId: null }], transcriptDiffs: [] },
  ];
  it('prints a padded table with the fixed columns', () => {
    const table = formatTable(scores);
    const lines = table.split('\n');
    expect(lines[0].replace(/\s+/g, ' ').trim()).toBe(COLUMNS.join(' '));
    expect(lines[2]).toContain('book-appointment');
    expect(lines[2]).toContain('812 ms');
    expect(lines[3]).toContain('FAIL');
    expect(lines[3]).toContain('-');
  });
  it('renders markdown with a table and a findings list', () => {
    const md = renderMarkdown({ generatedAt: '2026-09-19T00:00:00.000Z', url: 'ws://127.0.0.1:3217/llm-websocket', runsPerScenario: 3, scenarios: scores, raw: [] });
    expect(md).toContain(`| ${COLUMNS.join(' | ')} |`);
    expect(md).toContain('| book-appointment | 3 | 812 ms | 1200 ms | 3/3 | 0 | 0 | 0 | 0 | 0 | ok |');
    expect(md).toContain('- `x` tool_missing: run 1: expected end_call');
    expect(md).toContain('do not edit by hand');
    expect(md).toContain('## Transcript diffs');
    expect(md).toContain('### book-appointment run 1\n\n~~~diff\n--- expected\n+++ actual\n Okay.\n~~~');
  });
});
