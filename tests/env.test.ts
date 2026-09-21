import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadLocalEnv } from '../src/server/env.js';

describe('loadLocalEnv', () => {
  it('loads .env.local from the given directory into process.env', () => {
    const dir = mkdtempSync(join(tmpdir(), 'env-'));
    writeFileSync(join(dir, '.env.local'), 'BENCH_TEST_VAR=from-file\n');
    expect(loadLocalEnv(dir)).toBe(true);
    expect(process.env.BENCH_TEST_VAR).toBe('from-file');
  });
  it('returns false and does not throw when the file is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'env-'));
    expect(loadLocalEnv(dir)).toBe(false);
  });
  it('skips the file when BENCH_NO_ENV_FILE=1 (used by the no-key check)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'env-'));
    writeFileSync(join(dir, '.env.local'), 'BENCH_SKIPPED_VAR=should-not-load\n');
    process.env.BENCH_NO_ENV_FILE = '1';
    try {
      expect(loadLocalEnv(dir)).toBe(false);
      expect(process.env.BENCH_SKIPPED_VAR).toBeUndefined();
    } finally {
      delete process.env.BENCH_NO_ENV_FILE;
    }
  });
});
