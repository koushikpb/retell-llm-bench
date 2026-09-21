import { writeFileSync } from 'node:fs';
import { runBench } from '../src/bench/cli.js';
import { renderMarkdown } from '../src/bench/report.js';
import { BookingStore } from '../src/server/booking.js';
import { createClaudeClient } from '../src/server/claude.js';
import { loadLocalEnv } from '../src/server/env.js';
import { startReferenceServer } from '../src/server/reference.js';

loadLocalEnv();
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY is not set. Copy .env.example to .env.local and add your key, or run the suite with no key: npm run smoke');
  process.exit(1);
}
const model = process.env.MODEL ?? 'claude-sonnet-5';
const runs = 3;
const server = await startReferenceServer({
  port: 0,
  deps: { llm: createClaudeClient({ model }), bookings: new BookingStore(), log: (line) => console.log(`server: ${line}`) },
});
console.log(`retell-llm-bench results run: Claude reference server on ${server.url} (model ${model}), ${runs} runs per scenario`);
try {
  const report = await runBench({ url: server.url, scenarios: 'scenarios', runs, json: 'docs/results.json' }, (line) => console.log(line));
  writeFileSync('docs/results.md', renderMarkdown(report));
  console.log('wrote docs/results.md');
} finally {
  await server.close();
}
// Printed after wss.close() resolves, which happens only after every connection's 'close' callback has run,
// so this is guaranteed to be the last line of the log (server-side 'closed <code>' lines can land after 'wrote ...').
console.log('results run complete');
