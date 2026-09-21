import { WebSocket } from 'ws';

const url = process.argv[2];
if (!url) {
  console.error('usage: tsx scripts/wait-ws.ts <ws-url>');
  process.exit(1);
}
const deadline = Date.now() + 30000;
const attempt = () =>
  new Promise<boolean>((resolve) => {
    const ws = new WebSocket(url);
    ws.on('open', () => {
      ws.close(1000);
      resolve(true);
    });
    ws.on('error', () => resolve(false));
  });
while (Date.now() < deadline) {
  if (await attempt()) {
    console.log(`ready: ${url}`);
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 500));
}
console.error(`not ready after 30 s: ${url}`);
process.exit(1);
