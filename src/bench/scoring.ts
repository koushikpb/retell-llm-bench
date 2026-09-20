import type { ExpectedToolCall, Scenario } from './scenario.js';
import type { ScenarioRunResult, ToolCallRecord, TurnRecord } from './types.js';

export type FindingCode =
  | 'no_begin_message'
  | 'content_complete_missing'
  | 'silent_tool_turn'
  | 'tool_missing'
  | 'tool_unnecessary'
  | 'tool_args_mismatch'
  | 'tool_duplicate'
  | 'protocol_violation'
  | 'keepalive_missed'
  | 'agent_text_missing'
  | 'voice_markdown'
  | 'stale_chunks';

export interface Finding { code: FindingCode; message: string; responseId: number | null }

export interface RunScore {
  scenario: string;
  run: number;
  completeRequested: number;
  completeReceived: number;
  toolMissing: number;
  toolUnnecessary: number;
  toolDuplicate: number;
  violations: number;
  textMissing: number;
  mustCompleteOk: boolean;
  findings: Finding[];
}

// api-notes §8: "No markdown, no bullet lists, no emoji, no headers."
export const VOICE_MARKDOWN = /(\*\*|__|^\s*[-*#]\s|`)/m;

export function canonicalArgs(call: ToolCallRecord): string {
  const args: Record<string, unknown> = { ...(call.parsedArguments ?? {}) };
  delete args.message;
  return JSON.stringify(Object.keys(args).sort().map((k) => [k, args[k]]));
}

function matches(expected: ExpectedToolCall, call: ToolCallRecord): boolean {
  if (call.name !== expected.name) return false;
  const args = call.parsedArguments ?? {};
  return Object.entries(expected.args).every(([k, v]) => String(args[k]) === String(v));
}

// A caller request = a turn plus the turn(s) that superseded it (api-notes §1, §8 "runs twice for one request").
export function requestGroups(turns: TurnRecord[]): number[][] {
  const groups: number[][] = [];
  for (const t of turns) {
    const prev = groups[groups.length - 1];
    const prevTurn = prev ? turns.find((x) => x.responseId === prev[prev.length - 1]) : undefined;
    if (prev && prevTurn && prevTurn.supersededBy === t.responseId) prev.push(t.responseId);
    else groups.push([t.responseId]);
  }
  return groups;
}

export function scoreRun(scenario: Scenario, result: ScenarioRunResult): RunScore {
  const findings: Finding[] = [];
  if (!result.begin.received) {
    findings.push({ code: 'no_begin_message', message: 'no response with response_id 0 before the first turn (api-notes §3)', responseId: 0 });
  }
  const live = result.turns.filter((t) => !t.superseded);
  for (const t of live) {
    if (t.completedAt === null) {
      findings.push({ code: 'content_complete_missing', message: `response_id ${t.responseId} never received content_complete: true; Retell would leave the turn hanging (api-notes §5)`, responseId: t.responseId });
    }
  }
  // api-notes §8: "Without a parameter carrying something to say, the agent goes silent exactly when the caller is waiting."
  for (const t of live) {
    if (t.completedAt === null) continue;
    const ranTool = result.toolCalls.some((c) => c.responseId === t.responseId);
    const spoke = t.chunks.some((c) => c.content.trim().length > 0 && c.at <= (t.completedAt as number));
    if (ranTool && !spoke) {
      findings.push({ code: 'silent_tool_turn', message: `response_id ${t.responseId} ran a tool but sent no spoken content before content_complete; the caller hears silence (api-notes §8)`, responseId: t.responseId });
    }
  }
  for (const t of result.turns.filter((x) => x.superseded)) {
    const stale = t.chunks.filter((c) => c.content.length > 0 && t.supersededAt !== null && c.at > t.supersededAt).length;
    if (stale > 0) findings.push({ code: 'stale_chunks', message: `${stale} content chunk(s) for superseded response_id ${t.responseId} arrived after the newer request (info; api-notes §8)`, responseId: t.responseId });
  }

  const expectedNames = new Set(scenario.expect.tool_calls.map((e) => e.name));
  let toolMissing = 0;
  for (const e of scenario.expect.tool_calls) {
    if (!result.toolCalls.some((c) => matches(e, c))) {
      toolMissing += 1;
      findings.push({ code: 'tool_missing', message: `expected ${e.name} ${JSON.stringify(e.args)} was never invoked`, responseId: null });
    }
  }
  let toolUnnecessary = 0;
  for (const c of result.toolCalls) {
    const forbidden = scenario.expect.forbidden_tools.includes(c.name);
    if (forbidden || !expectedNames.has(c.name)) {
      toolUnnecessary += 1;
      findings.push({ code: 'tool_unnecessary', message: `${forbidden ? 'forbidden' : 'unexpected'} tool ${c.name} ${c.arguments} invoked`, responseId: c.responseId });
    } else if (!scenario.expect.tool_calls.some((e) => matches(e, c))) {
      // Right tool, wrong arguments (e.g. the pre-interrupt slot got booked): informational, listed but not a column.
      findings.push({ code: 'tool_args_mismatch', message: `${c.name} ${c.arguments} invoked, but no expected ${c.name} entry matches these arguments (info)`, responseId: c.responseId });
    }
  }
  let toolDuplicate = 0;
  for (const group of requestGroups(result.turns)) {
    const seen = new Map<string, number>();
    for (const c of result.toolCalls.filter((x) => group.includes(x.responseId))) {
      const key = `${c.name}:${canonicalArgs(c)}`;
      const n = (seen.get(key) ?? 0) + 1;
      seen.set(key, n);
      if (n > 1) {
        toolDuplicate += 1;
        findings.push({ code: 'tool_duplicate', message: `${c.name} ${canonicalArgs(c)} invoked ${n} times for one caller request (response_ids ${group.join('→')}); key the write on call id + args (api-notes §8)`, responseId: c.responseId });
      }
    }
  }

  for (const v of result.violations) findings.push({ code: 'protocol_violation', message: `${v.code}: ${v.message}`, responseId: null });
  if (result.keepalive.missed > 0) {
    findings.push({ code: 'keepalive_missed', message: `${result.keepalive.missed} ping_pong echo(es) missed; Retell closes after 5 s without one (api-notes §5)`, responseId: null });
  }

  const agentText = result.agentUtterances.join(' ');
  let textMissing = 0;
  for (const s of scenario.expect.agent_text_contains) {
    if (!agentText.toLowerCase().includes(s.toLowerCase())) {
      textMissing += 1;
      findings.push({ code: 'agent_text_missing', message: `agent never said "${s}"`, responseId: null });
    }
  }
  if (VOICE_MARKDOWN.test(agentText)) {
    findings.push({ code: 'voice_markdown', message: 'agent text contains markdown; voice output must have no markdown, lists, or headers (api-notes §8)', responseId: null });
  }

  const completeReceived = live.filter((t) => t.completedAt !== null).length;
  const mustCompleteOk = !scenario.expect.must_complete || (result.begin.received && completeReceived === live.length);
  return {
    scenario: scenario.name,
    run: result.run,
    completeRequested: live.length,
    completeReceived,
    toolMissing,
    toolUnnecessary,
    toolDuplicate,
    violations: result.violations.length,
    textMissing,
    mustCompleteOk,
    findings,
  };
}
