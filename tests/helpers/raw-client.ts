import { WebSocket } from 'ws';

export interface RawClient {
  frames: Record<string, unknown>[];
  send(frame: unknown): void;
  waitFor(pred: (f: Record<string, unknown>) => boolean, timeoutMs?: number): Promise<Record<string, unknown>>;
  close(): Promise<void>;
}

export function connectRaw(url: string): Promise<RawClient> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const frames: Record<string, unknown>[] = [];
    const waiters: { pred: (f: Record<string, unknown>) => boolean; resolve: (f: Record<string, unknown>) => void }[] = [];
    ws.on('message', (data) => {
      const f = JSON.parse(data.toString()) as Record<string, unknown>;
      frames.push(f);
      for (const w of [...waiters]) {
        if (w.pred(f)) {
          waiters.splice(waiters.indexOf(w), 1);
          w.resolve(f);
        }
      }
    });
    ws.on('error', reject);
    ws.on('open', () =>
      resolve({
        frames,
        send: (frame) => ws.send(JSON.stringify(frame)),
        waitFor: (pred, timeoutMs = 2000) =>
          new Promise((res, rej) => {
            const hit = frames.find(pred);
            if (hit) {
              res(hit);
              return;
            }
            const timer = setTimeout(() => rej(new Error(`waitFor timed out after ${timeoutMs} ms; frames so far: ${JSON.stringify(frames)}`)), timeoutMs);
            waiters.push({ pred, resolve: (f) => { clearTimeout(timer); res(f); } });
          }),
        close: () =>
          new Promise((done) => {
            ws.once('close', () => done());
            ws.close(1000);
          }),
      }),
    );
  });
}
