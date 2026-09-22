import { WebSocketServer } from 'ws';
import { handleConnection, type ServerDeps } from './session.js';

export interface ReferenceServer { port: number; url: string; close(): Promise<void> }

// Retell WebSocket reference: Retell appends the call id as the last path segment; a trailing slash is normalized.
export function callIdFromUrl(url: string | undefined): string {
  let path: string;
  try {
    path = new URL(url ?? '/', 'ws://localhost').pathname;
  } catch {
    // Security H1: an unparsable request path (e.g. "//") must not crash the server.
    return 'unknown-call';
  }
  return path.split('/').filter(Boolean).pop() ?? 'unknown-call';
}

export function startReferenceServer(opts: { port: number; deps: ServerDeps }): Promise<ReferenceServer> {
  return new Promise((resolve, reject) => {
    const wss = new WebSocketServer({ port: opts.port, host: '127.0.0.1' });
    wss.on('connection', (ws, req) => {
      const callId = callIdFromUrl(req.url);
      opts.deps.log(`${callId}: connected`);
      ws.on('close', (code) => opts.deps.log(`${callId}: closed ${code}`));
      handleConnection(ws, callId, opts.deps);
    });
    wss.on('error', reject);
    wss.on('listening', () => {
      const address = wss.address();
      if (address === null) throw new Error('server has no address after listening');
      const port = typeof address === 'string' ? opts.port : address.port;
      resolve({ port, url: `ws://127.0.0.1:${port}/llm-websocket`, close: () => new Promise((done) => wss.close(() => done())) });
    });
  });
}
