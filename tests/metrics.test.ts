import { describe, it, expect } from 'vitest';
import { firstSentenceMs, percentile, ttfsSamples } from '../src/bench/metrics.js';
import type { ScenarioRunResult, TurnRecord } from '../src/bench/types.js';

function turn(responseId: number, chunks: [number, string, boolean][], extra: Partial<TurnRecord> = {}): TurnRecord {
  return {
    responseId,
    kind: 'response_required',
    requestedAt: 1000,
    chunks: chunks.map(([at, content, content_complete]) => ({ at: 1000 + at, content, content_complete, end_call: false, transfer_number: null, digit_to_press: null })),
    completedAt: chunks.some((c) => c[2]) ? 1000 + chunks[chunks.length - 1][0] : null,
    superseded: false,
    supersededAt: null,
    supersededBy: null,
    timedOut: false,
    ...extra,
  };
}

describe('firstSentenceMs', () => {
  it('measures to the chunk that completes the first sentence', () => {
    expect(firstSentenceMs(turn(1, [[120, "I'm doing great, ", false], [180, 'thank you. ', false], [400, 'How can I help?', false], [410, '', true]]))).toBe(180);
  });
  it('uses the first chunk when the response is one chunk', () => {
    expect(firstSentenceMs(turn(1, [[250, 'Goodbye', true]]))).toBe(250);
  });
  it('uses the completion frame when no punctuation ever arrives', () => {
    expect(firstSentenceMs(turn(1, [[100, 'hmm', false], [300, '', true]]))).toBe(300);
  });
  it('returns null when nothing was said or nothing arrived', () => {
    expect(firstSentenceMs(turn(1, [[100, '', true]]))).toBeNull();
    expect(firstSentenceMs(turn(1, []))).toBeNull();
  });
});

describe('ttfsSamples and percentile', () => {
  it('skips superseded turns and pools the rest', () => {
    const result = { turns: [turn(1, [[100, 'Hi.', true]]), turn(2, [[50, 'Old.', false]], { superseded: true, supersededBy: 3 }), turn(3, [[300, 'New.', true]])] } as ScenarioRunResult;
    expect(ttfsSamples(result)).toEqual([100, 300]);
  });
  it('computes nearest-rank percentiles', () => {
    expect(percentile([300, 100, 200, 400, 500], 50)).toBe(300);
    expect(percentile([300, 100, 200, 400, 500], 90)).toBe(500);
    expect(percentile([42], 90)).toBe(42);
    expect(percentile([], 50)).toBeNull();
  });
});
