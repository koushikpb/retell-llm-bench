import { describe, it, expect } from 'vitest';
import { parseArgs, DEFAULT_URL } from '../src/bench/args.js';

describe('parseArgs', () => {
  it('returns defaults with no flags', () => {
    expect(parseArgs([])).toEqual({ url: DEFAULT_URL, scenarios: 'scenarios', runs: 1, json: null });
  });

  it('reads --url, --scenarios, --runs, --json', () => {
    expect(parseArgs(['--url', 'ws://127.0.0.1:3218/llm-websocket', '--scenarios', 'x', '--runs', '3', '--json', 'out.json'])).toEqual({
      url: 'ws://127.0.0.1:3218/llm-websocket',
      scenarios: 'x',
      runs: 3,
      json: 'out.json',
    });
  });

  it('rejects unknown flags, missing values, and bad run counts', () => {
    expect(() => parseArgs(['--nope', '1'])).toThrow('unknown flag --nope');
    expect(() => parseArgs(['--runs'])).toThrow('missing value for --runs');
    expect(() => parseArgs(['--runs', '0'])).toThrow('--runs must be a positive integer');
  });
});
