import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnvFile } from 'node:process';

export function loadLocalEnv(dir: string = process.cwd()): boolean {
  if (process.env.BENCH_NO_ENV_FILE === '1') return false; // Task 13 Step 5's no-key check, run from the repo root
  const file = join(dir, '.env.local');
  if (!existsSync(file)) return false;
  loadEnvFile(file);
  return true;
}
