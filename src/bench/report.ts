import { lineDiff } from './diff.js';
import { percentile, ttfsSamples } from './metrics.js';
import type { Scenario } from './scenario.js';
import { scoreRun, type Finding, type RunScore } from './scoring.js';
import type { ScenarioRunResult } from './types.js';

export interface TranscriptDiff { run: number; diff: string }

export interface ScenarioScore {
  scenario: string;
  runs: number;
  ttfsP50: number | null;
  ttfsP90: number | null;
  completeReceived: number;
  completeRequested: number;
  toolMissing: number;
  toolUnnecessary: number;
  toolDuplicate: number;
  violations: number;
  textMissing: number;
  mustCompleteOk: boolean;
  findings: Finding[];
  transcriptDiffs: TranscriptDiff[];
}

export interface BenchReport {
  generatedAt: string;
  url: string;
  runsPerScenario: number;
  scenarios: ScenarioScore[];
  raw: ScenarioRunResult[];
}

export const COLUMNS = ['scenario', 'runs', 'ttfs p50', 'ttfs p90', 'complete', 'missing', 'unnecessary', 'duplicate', 'violations', 'text miss', 'must complete'];

// The begin message is the server's, not the scenario's, so it is left out of the comparison.
function spokenAfterBegin(r: ScenarioRunResult): string[] {
  return r.agentUtterances.filter((u, i) => !(i === 0 && r.begin.received && u === r.begin.content));
}

export function aggregate(scenario: Scenario, results: ScenarioRunResult[]): ScenarioScore {
  const scores = results.map((r) => scoreRun(scenario, r));
  const samples = results.flatMap(ttfsSamples);
  const sum = (pick: (s: RunScore) => number) => scores.reduce((acc, s) => acc + pick(s), 0);
  return {
    scenario: scenario.name,
    runs: results.length,
    ttfsP50: percentile(samples, 50),
    ttfsP90: percentile(samples, 90),
    completeReceived: sum((s) => s.completeReceived),
    completeRequested: sum((s) => s.completeRequested),
    toolMissing: sum((s) => s.toolMissing),
    toolUnnecessary: sum((s) => s.toolUnnecessary),
    toolDuplicate: sum((s) => s.toolDuplicate),
    violations: sum((s) => s.violations),
    textMissing: sum((s) => s.textMissing),
    mustCompleteOk: scores.every((s) => s.mustCompleteOk),
    findings: scores.flatMap((s) => s.findings.map((f) => ({ ...f, message: `run ${s.run}: ${f.message}` }))),
    transcriptDiffs: results.map((r) => ({ run: r.run, diff: lineDiff(scenario.expect.agent_transcript, spokenAfterBegin(r)) })),
  };
}

function rows(scores: ScenarioScore[]): string[][] {
  const ms = (v: number | null) => (v === null ? '-' : `${Math.round(v)} ms`);
  return scores.map((s) => [
    s.scenario,
    String(s.runs),
    ms(s.ttfsP50),
    ms(s.ttfsP90),
    `${s.completeReceived}/${s.completeRequested}`,
    String(s.toolMissing),
    String(s.toolUnnecessary),
    String(s.toolDuplicate),
    String(s.violations),
    String(s.textMissing),
    s.mustCompleteOk ? 'ok' : 'FAIL',
  ]);
}

export function formatTable(scores: ScenarioScore[]): string {
  const body = rows(scores);
  const widths = COLUMNS.map((c, i) => Math.max(c.length, ...body.map((r) => r[i].length)));
  const line = (r: string[]) => r.map((cell, i) => cell.padEnd(widths[i])).join('  ').trimEnd();
  return [line(COLUMNS), widths.map((w) => '-'.repeat(w)).join('  '), ...body.map(line)].join('\n');
}

export function renderMarkdown(report: BenchReport): string {
  const head = `| ${COLUMNS.join(' | ')} |\n| ${COLUMNS.map(() => '---').join(' | ')} |`;
  const body = rows(report.scenarios).map((r) => `| ${r.join(' | ')} |`).join('\n');
  const findings = report.scenarios.flatMap((s) => s.findings.map((f) => `- \`${s.scenario}\` ${f.code}: ${f.message}`));
  // Tilde fences (CommonMark) so the diff text can itself contain backticks.
  const diffs = report.scenarios.flatMap((s) => s.transcriptDiffs.flatMap((t) => [`### ${s.scenario} run ${t.run}`, '', '~~~diff', t.diff, '~~~', '']));
  return [
    '# Results',
    '',
    `Generated ${report.generatedAt} against \`${report.url}\`, ${report.runsPerScenario} run(s) per scenario. Written by \`npm run results\` from the bench's JSON output; do not edit by hand.`,
    '',
    head,
    body,
    '',
    '## Findings',
    '',
    findings.length > 0 ? findings.join('\n') : '- none',
    '',
    '## Transcript diffs',
    '',
    "Expected lines are each scenario's `expect.agent_transcript` (the author's reference wording); actual lines are what the server said after the begin message. Informational: wording drift is shown, not scored.",
    '',
    ...diffs,
  ].join('\n');
}
