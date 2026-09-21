import { writeFileSync } from 'node:fs';
import type { BenchArgs } from './args.js';
import { aggregate, formatTable, type BenchReport, type ScenarioScore } from './report.js';
import { runScenario } from './runner.js';
import { loadScenarios } from './scenario.js';
import type { ScenarioRunResult } from './types.js';

export async function runBench(args: BenchArgs, log: (line: string) => void): Promise<BenchReport> {
  const scenarios = loadScenarios(args.scenarios);
  log(`retell-llm-bench: ${scenarios.length} scenario(s) x ${args.runs} run(s) against ${args.url}`);
  const raw: ScenarioRunResult[] = [];
  const scores: ScenarioScore[] = [];
  for (const scenario of scenarios) {
    const results: ScenarioRunResult[] = [];
    for (let run = 1; run <= args.runs; run += 1) {
      const r = await runScenario(scenario, { url: args.url, run });
      results.push(r);
      raw.push(r);
      log(`  ${scenario.name} run ${run}: ${r.turns.length} turn(s), ${r.toolCalls.length} tool call(s), ${r.violations.length} violation(s), ${Math.round(r.durationMs)} ms`);
    }
    scores.push(aggregate(scenario, results));
  }
  const report: BenchReport = { generatedAt: new Date().toISOString(), url: args.url, runsPerScenario: args.runs, scenarios: scores, raw };
  log('');
  log(formatTable(scores));
  const findings = scores.flatMap((s) => s.findings.map((f) => `  ${s.scenario}: ${f.code}: ${f.message}`));
  if (findings.length > 0) {
    log('');
    log('findings:');
    for (const f of findings) log(f);
  }
  if (args.json) {
    writeFileSync(args.json, JSON.stringify(report, null, 2));
    log('');
    log(`wrote ${args.json}`);
  }
  return report;
}
