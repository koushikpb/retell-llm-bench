export const DEFAULT_URL = 'ws://127.0.0.1:3217/llm-websocket';

export interface BenchArgs {
  url: string;
  scenarios: string;
  runs: number;
  json: string | null;
}

export function parseArgs(argv: string[]): BenchArgs {
  const args: BenchArgs = { url: DEFAULT_URL, scenarios: 'scenarios', runs: 1, json: null };
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (value === undefined) throw new Error(`missing value for ${flag}`);
    switch (flag) {
      case '--url':
        args.url = value;
        break;
      case '--scenarios':
        args.scenarios = value;
        break;
      case '--runs': {
        const n = Number(value);
        if (!Number.isInteger(n) || n < 1) throw new Error(`--runs must be a positive integer, got ${value}`);
        args.runs = n;
        break;
      }
      case '--json':
        args.json = value;
        break;
      default:
        throw new Error(`unknown flag ${flag}`);
    }
  }
  return args;
}
