import { startFakeServer } from './fake.js';
import { SMOKE_SCRIPT } from './fake-scripts.js';

const portFlag = process.argv.indexOf('--port');
const port = portFlag >= 0 ? Number(process.argv[portFlag + 1]) : 3218;
const server = await startFakeServer({ port, script: SMOKE_SCRIPT });
console.log(`fake custom-LLM server listening on ${server.url} (scripted replies, no API key)`);
