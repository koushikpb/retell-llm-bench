import { describe, it, expect, afterAll } from 'vitest';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startFakeServer, type FakeServer } from '../src/server/fake.js';
import { SMOKE_SCRIPT } from '../src/server/fake-scripts.js';
import { runBench } from '../src/bench/cli.js';

describe('runBench', () => {
  let srv: FakeServer;
  afterAll(async () => {
    if (srv) await srv.close();
  });

  it('runs the bundled suite against the fake server, logs a table, writes JSON', async () => {
    srv = await startFakeServer({ port: 0, script: SMOKE_SCRIPT });
    const json = join(mkdtempSync(join(tmpdir(), 'bench-')), 'out.json');
    const lines: string[] = [];
    const report = await runBench({ url: srv.url, scenarios: 'scenarios', runs: 1, json }, (l) => lines.push(l));
    expect(report.scenarios).toHaveLength(9);
    expect(report.raw).toHaveLength(9);
    expect(lines.some((l) => l.includes('book-appointment') && l.includes('ms'))).toBe(true);
    expect(existsSync(json)).toBe(true);
    expect((JSON.parse(readFileSync(json, 'utf8')) as { runsPerScenario: number }).runsPerScenario).toBe(1);
  }, 60000);
});
