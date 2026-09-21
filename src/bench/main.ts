import { parseArgs } from './args.js';
import { runBench } from './cli.js';

runBench(parseArgs(process.argv.slice(2)), (line) => console.log(line)).catch((err: unknown) => {
  console.error(`bench failed: ${(err as Error).message}`);
  process.exit(1);
});
