import { WebSocketServer, type WebSocket } from 'ws';
import { RetellFrameSchema, type Utterance } from '../protocol/schemas.js';

export interface FakeChunk { text: string; delayMs: number }
export interface FakeToolCall { name: string; arguments: Record<string, unknown>; result: string; afterChunk: number }
export interface FakeReply {
  chunks: FakeChunk[];
  complete: boolean;
  completeDelayMs: number;
  toolCalls: FakeToolCall[];
  rawFrames: unknown[];
  endCall: boolean;
}
export interface FakeMatcher { pattern: string; reply: FakeReply }
export interface FakeScript {
  config: { auto_reconnect?: boolean; call_details?: boolean } | null;
  begin: string | null;
  echoPing: boolean;
  honorSupersede: boolean;
  byResponseId: Record<number, FakeReply>;
  matchers: FakeMatcher[];
  fallback: FakeReply;
}
export interface FakeServer { port: number; url: string; received: unknown[]; close(): Promise<void> }

export function reply(partial: Partial<FakeReply> = {}): FakeReply {
  return { chunks: [], complete: true, completeDelayMs: 0, toolCalls: [], rawFrames: [], endCall: false, ...partial };
}

export function script(partial: Partial<FakeScript> = {}): FakeScript {
  return {
    config: { auto_reconnect: false, call_details: false },
    begin: 'Hello, how can I help?',
    echoPing: true,
    honorSupersede: true,
    byResponseId: {},
    matchers: [],
    fallback: reply({ chunks: [{ text: 'Okay.', delayMs: 5 }] }),
    ...partial,
  };
}

function pickReply(s: FakeScript, id: number, transcript: Utterance[]): FakeReply {
  const byId = s.byResponseId[id];
  if (byId) return byId;
  const lastUser = [...transcript].reverse().find((u) => u.role === 'user')?.content ?? '';
  const m = s.matchers.find((x) => new RegExp(x.pattern, 'i').test(lastUser));
  return m ? m.reply : s.fallback;
}

export function startFakeServer(opts: { port: number; script: FakeScript }): Promise<FakeServer> {
  return new Promise((resolve) => {
    const received: unknown[] = [];
    const wss = new WebSocketServer({ port: opts.port });
    wss.on('connection', (ws) => handle(ws, opts.script, received));
    wss.on('listening', () => {
      const address = wss.address();
      if (address === null) throw new Error('server has no address after listening');
      const port = typeof address === 'string' ? opts.port : address.port;
      resolve({
        port,
        url: `ws://127.0.0.1:${port}/llm-websocket`,
        received,
        close: () => new Promise((done) => wss.close(() => done())),
      });
    });
  });
}

function handle(ws: WebSocket, s: FakeScript, received: unknown[]): void {
  const send = (frame: unknown) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(frame));
  };
  let timers: NodeJS.Timeout[] = [];
  const cancelPlayback = () => {
    for (const t of timers) clearTimeout(t);
    timers = [];
  };
  const later = (ms: number, fn: () => void) => {
    timers.push(setTimeout(fn, ms));
  };
  let toolSeq = 0;

  if (s.config) send({ response_type: 'config', config: s.config });
  if (s.begin !== null) send({ response_type: 'response', response_id: 0, content: s.begin, content_complete: true });

  ws.on('message', (data) => {
    let json: unknown;
    try {
      json = JSON.parse(data.toString());
    } catch {
      return;
    }
    const parsed = RetellFrameSchema.safeParse(json);
    if (!parsed.success) return;
    const frame = parsed.data;
    received.push(frame);
    if (frame.interaction_type === 'ping_pong') {
      if (s.echoPing) send({ response_type: 'ping_pong', timestamp: frame.timestamp });
      return;
    }
    if (frame.interaction_type !== 'response_required' && frame.interaction_type !== 'reminder_required') return;
    if (s.honorSupersede) cancelPlayback();
    const id = frame.response_id;
    const r = pickReply(s, id, frame.transcript);
    for (const raw of r.rawFrames) send(raw);
    const emitTools = (afterChunk: number) => {
      for (const t of r.toolCalls.filter((x) => x.afterChunk === afterChunk)) {
        toolSeq += 1;
        const tool_call_id = `fake-${id}-${toolSeq}`;
        send({ response_type: 'tool_call_invocation', tool_call_id, name: t.name, arguments: JSON.stringify(t.arguments) });
        send({ response_type: 'tool_call_result', tool_call_id, content: t.result, successful: true });
      }
    };
    emitTools(0);
    let at = 0;
    r.chunks.forEach((chunk, i) => {
      at += chunk.delayMs;
      later(at, () => {
        send({ response_type: 'response', response_id: id, content: chunk.text, content_complete: false });
        emitTools(i + 1);
      });
    });
    if (r.complete) {
      at += r.completeDelayMs;
      later(at, () => send({ response_type: 'response', response_id: id, content: '', content_complete: true, ...(r.endCall ? { end_call: true } : {}) }));
    }
  });
  ws.on('close', cancelPlayback);
}
