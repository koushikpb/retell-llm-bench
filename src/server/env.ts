import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnvFile } from 'node:process';

export function loadLocalEnv(dir: string = process.cwd()): boolean {
  if (process.env.BENCH_NO_ENV_FILE === '1') return false; // lets a no-key check skip the file without touching the caller's environment
  const file = join(dir, '.env.local');
  if (!existsSync(file)) return false;
  loadEnvFile(file);
  return true;
}
