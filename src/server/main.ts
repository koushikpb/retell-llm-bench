import { BookingStore } from './booking.js';
import { createClaudeClient } from './claude.js';
import { loadLocalEnv } from './env.js';
import { startReferenceServer } from './reference.js';

loadLocalEnv();
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY is not set. Copy .env.example to .env.local and add your key, or run the bench against the fake server: npm run fake');
  process.exit(1);
}
const portFlag = process.argv.indexOf('--port');
const port = portFlag >= 0 ? Number(process.argv[portFlag + 1]) : Number(process.env.PORT ?? 3217);
const model = process.env.MODEL ?? 'claude-sonnet-5';
const server = await startReferenceServer({
  port,
  deps: { llm: createClaudeClient({ model }), bookings: new BookingStore(), log: (line) => console.log(line) },
});
console.log(`reference custom-LLM server listening on ${server.url} (model ${model})`);
