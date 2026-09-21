import { parseArgs } from './args.js';
import { runBench } from './cli.js';

async function main(): Promise<void> {
  try {
    await runBench(parseArgs(process.argv.slice(2)), (line) => console.log(line));
  } catch (err: unknown) {
    console.error(`bench failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

void main();
