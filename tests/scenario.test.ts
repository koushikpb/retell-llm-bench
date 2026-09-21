import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ScenarioSchema, loadScenario, loadScenarios } from '../src/bench/scenario.js';

describe('scenario schema', () => {
  it('applies defaults for turn_timeout_ms and expectation lists', () => {
    const s = ScenarioSchema.parse({ name: 'x', description: 'd', turns: [{ user: 'hi' }], expect: {} });
    expect(s.turn_timeout_ms).toBe(15000);
    expect(s.expect).toEqual({ tool_calls: [], forbidden_tools: [], must_complete: true, agent_text_contains: [], agent_transcript: [] });
  });

  it('accepts interrupt and reminder turns and expected tool args', () => {
    const s = ScenarioSchema.parse({
      name: 'y',
      description: 'd',
      turns: [{ user: 'a', interrupt: { after_ms: 100, user: 'b' } }, { reminder: true }],
      expect: { tool_calls: [{ name: 'book_appointment', args: { date: '2026-09-24', time: '14:00' } }] },
    });
    expect(s.turns).toHaveLength(2);
    expect(s.expect.tool_calls[0].args.time).toBe('14:00');
  });

  it('rejects bad names, empty turns, and unknown turn shapes', () => {
    expect(ScenarioSchema.safeParse({ name: 'Bad Name', description: 'd', turns: [{ user: 'a' }], expect: {} }).success).toBe(false);
    expect(ScenarioSchema.safeParse({ name: 'ok', description: 'd', turns: [], expect: {} }).success).toBe(false);
    expect(ScenarioSchema.safeParse({ name: 'ok', description: 'd', turns: [{ agent: 'a' }], expect: {} }).success).toBe(false);
  });

  it('accepts an interrupt timed from the first chunk, and rejects an interrupt with neither field', () => {
    expect(
      ScenarioSchema.safeParse({ name: 'z', description: 'd', turns: [{ user: 'a', interrupt: { after_first_chunk_ms: 100, user: 'x' } }], expect: {} }).success,
    ).toBe(true);
    expect(
      ScenarioSchema.safeParse({ name: 'z', description: 'd', turns: [{ user: 'a', interrupt: { user: 'x' } }], expect: {} }).success,
    ).toBe(false);
  });
});

describe('loaders', () => {
  it('loads the bundled suite: nine scenarios, names match file names, all unique', () => {
    const all = loadScenarios('scenarios');
    expect(all).toHaveLength(9);
    expect(new Set(all.map((s) => s.name)).size).toBe(9);
    expect(all.map((s) => s.name)).toContain('interrupt-mid-sentence');
    for (const s of all) expect(loadScenario(join('scenarios', `${s.name}.yaml`)).name).toBe(s.name);
  });

  it('names the file in the error for an invalid scenario', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bench-'));
    const file = join(dir, 'broken.yaml');
    writeFileSync(file, 'name: broken\nturns: []\n');
    expect(() => loadScenario(file)).toThrow('broken.yaml');
  });
});
