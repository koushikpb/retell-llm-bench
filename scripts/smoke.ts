import { writeFileSync } from 'node:fs';
import { runBench } from '../src/bench/cli.js';
import { startFakeServer } from '../src/server/fake.js';
import { SMOKE_SCRIPT } from '../src/server/fake-scripts.js';

const lines: string[] = [];
const log = (line: string) => {
  lines.push(line);
  console.log(line);
};
const server = await startFakeServer({ port: 0, script: SMOKE_SCRIPT });
log(`retell-llm-bench smoke run: scripted fake server on ${server.url}, no API key, ${new Date().toISOString()}`);
log('The fake replies are scripted text keyed on the caller\'s words, so tool-call findings below describe the script, not a model.');
log('');
try {
  await runBench({ url: server.url, scenarios: 'scenarios', runs: 1, json: null }, log);
} finally {
  await server.close();
}
writeFileSync('docs/smoke.txt', `${lines.join('\n')}\n`);
console.log('wrote docs/smoke.txt');
