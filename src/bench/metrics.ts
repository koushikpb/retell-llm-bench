import type { ScenarioRunResult, TurnRecord } from './types.js';

// api-notes §8: "the number that matters is time to first token plus the time to finish that first sentence".
export const SENTENCE_END = /[.!?]["')\]]?\s*$/;

export function firstSentenceMs(turn: TurnRecord): number | null {
  let text = '';
  for (const chunk of turn.chunks) {
    text += chunk.content;
    if (chunk.content_complete || SENTENCE_END.test(text)) {
      return text.trim().length === 0 ? null : chunk.at - turn.requestedAt;
    }
  }
  return null;
}

export function ttfsSamples(result: ScenarioRunResult): number[] {
  // Time to first sentence is defined from the response_required send (the spec's metrics definition);
  // reminder_required turns are excluded so their nudge latency doesn't land in ttfs p50/p90.
  return result.turns
    .filter((t) => !t.superseded && t.kind === 'response_required')
    .map(firstSentenceMs)
    .filter((ms): ms is number => ms !== null);
}

export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.max(0, Math.min(sorted.length - 1, rank - 1))];
}
