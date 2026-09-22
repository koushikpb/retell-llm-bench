import { WebSocket } from 'ws';
import { validateServerFrame, type ConfigFrame, type ResponseFrame, type Utterance } from '../protocol/schemas.js';
import type { BeginRecord, KeepaliveRecord, RecordedFrame, RecordedViolation, ToolCallRecord, TurnRecord } from './types.js';

export interface BenchClientOptions {
  url: string;
  callId: string;
  pingIntervalMs?: number;
  pingTimeoutMs?: number;
  beginTimeoutMs?: number;
}

// Sample call object from Retell WebSocket reference (call_details); web-call fields omitted on purpose.
function sampleCall(callId: string): Record<string, unknown> {
  return {
    call_type: 'phone_call',
    from_number: '+14155550100',
    to_number: '+14155550101',
    direction: 'inbound',
    call_id: callId,
    agent_id: 'bench-agent',
    call_status: 'registered',
    metadata: {},
    retell_llm_dynamic_variables: { customer_name: 'John Doe' },
    opt_out_sensitive_data_storage: true,
  };
}

interface Waiter { check: () => boolean; resolve: () => void }

export class BenchClient {
  readonly startedAt = performance.now();
  readonly frames: RecordedFrame[] = [];
  readonly violations: RecordedViolation[] = [];
  readonly turns: TurnRecord[] = [];
  readonly toolCalls: ToolCallRecord[] = [];
  readonly keepalive: KeepaliveRecord = { enabled: false, sent: 0, echoed: 0, missed: 0 };
  readonly begin: BeginRecord = { received: false, content: '', ms: null };
  config: ConfigFrame['config'] | null = null;
  private liveId: number | null = null;
  private pingTimer: NodeJS.Timeout | null = null;
  private readonly pendingPings = new Map<number, NodeJS.Timeout>();
  private lastPingTs = 0;
  private waiters: Waiter[] = [];

  private constructor(private readonly ws: WebSocket, private readonly opts: BenchClientOptions) {}

  static connect(opts: BenchClientOptions): Promise<BenchClient> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${opts.url.replace(/\/$/, '')}/${opts.callId}`);
      const client = new BenchClient(ws, opts);
      ws.on('message', (data, isBinary) => client.onMessage(data.toString(), isBinary));
      ws.on('error', reject);
      ws.on('open', () => resolve(client));
    });
  }

  waitForBegin(): Promise<boolean> {
    return this.wait(() => this.begin.received, this.opts.beginTimeoutMs ?? 5000);
  }

  sendUpdateOnly(transcript: Utterance[], turntaking?: 'agent_turn' | 'user_turn'): void {
    this.send({ interaction_type: 'update_only', transcript, ...(turntaking ? { turntaking } : {}) });
  }

  requestResponse(kind: 'response_required' | 'reminder_required', responseId: number, transcript: Utterance[]): TurnRecord {
    const at = performance.now();
    const prev = this.liveId === null ? undefined : this.turns.find((t) => t.responseId === this.liveId);
    if (prev && prev.completedAt === null && !prev.timedOut) {
      prev.superseded = true;
      prev.supersededAt = at;
      prev.supersededBy = responseId;
    }
    const turn: TurnRecord = { responseId, kind, requestedAt: at, chunks: [], completedAt: null, superseded: false, supersededAt: null, supersededBy: null, timedOut: false };
    this.turns.push(turn);
    this.liveId = responseId;
    this.send({ interaction_type: kind, response_id: responseId, transcript });
    return turn;
  }

  async waitForComplete(responseId: number, timeoutMs: number): Promise<TurnRecord> {
    const turn = this.turns.find((t) => t.responseId === responseId);
    if (!turn) throw new Error(`response_id ${responseId} was never requested`);
    const done = await this.wait(() => turn.completedAt !== null, timeoutMs);
    if (!done) turn.timedOut = true;
    return turn;
  }

  waitForFirstChunk(responseId: number, timeoutMs: number): Promise<boolean> {
    const turn = this.turns.find((t) => t.responseId === responseId);
    if (!turn) throw new Error(`response_id ${responseId} was never requested`);
    return this.wait(() => turn.chunks.some((c) => c.content.length > 0), timeoutMs);
  }

  agentTextFor(responseId: number): string {
    const turn = this.turns.find((t) => t.responseId === responseId);
    return turn ? turn.chunks.map((c) => c.content).join('').trim() : '';
  }

  close(): Promise<void> {
    if (this.pingTimer) clearInterval(this.pingTimer);
    for (const t of this.pendingPings.values()) clearTimeout(t);
    this.pendingPings.clear();
    return new Promise((resolve) => {
      if (this.ws.readyState === this.ws.CLOSED) {
        resolve();
        return;
      }
      const timer = setTimeout(resolve, 1000);
      this.ws.once('close', () => {
        clearTimeout(timer);
        resolve();
      });
      this.ws.close(1000);
    });
  }

  // ---- internals ----
  private send(frame: Record<string, unknown>): void {
    if (this.ws.readyState === this.ws.OPEN) this.ws.send(JSON.stringify(frame));
  }

  private wait(check: () => boolean, timeoutMs: number): Promise<boolean> {
    if (check()) return Promise.resolve(true);
    return new Promise((resolve) => {
      const waiter: Waiter = { check, resolve: () => { clearTimeout(timer); resolve(true); } };
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w !== waiter);
        resolve(false);
      }, timeoutMs);
      this.waiters.push(waiter);
    });
  }

  private checkWaiters(): void {
    for (const w of [...this.waiters]) {
      if (w.check()) {
        this.waiters = this.waiters.filter((x) => x !== w);
        w.resolve();
      }
    }
  }

  private onMessage(raw: string, isBinary: boolean): void {
    const at = performance.now();
    if (isBinary) {
      this.violations.push({ code: 'binary_frame', message: 'binary frame; Retell closes the connection with code 1007 (Retell WebSocket reference)', raw: '<binary>', at });
      return;
    }
    const { frame, violations } = validateServerFrame(raw);
    for (const v of violations) this.violations.push({ ...v, at });
    if (!frame) return;
    if (frame.response_type === 'config' && this.frames.length > 0) {
      this.violations.push({ code: 'config_not_first', message: 'config arrived after another frame; Retell acts on it as it arrives (Retell custom-LLM overview)', raw, at });
    }
    this.frames.push({ at, frame });
    switch (frame.response_type) {
      case 'config':
        this.onConfig(frame.config);
        break;
      case 'ping_pong':
        this.onPong(frame.timestamp);
        break;
      case 'response':
        this.onResponse(frame, at, raw);
        break;
      case 'tool_call_invocation': {
        let parsed: Record<string, unknown> | null = null;
        try {
          const p: unknown = JSON.parse(frame.arguments);
          parsed = typeof p === 'object' && p !== null && !Array.isArray(p) ? (p as Record<string, unknown>) : null;
        } catch {
          parsed = null;
        }
        this.toolCalls.push({ tool_call_id: frame.tool_call_id, name: frame.name, arguments: frame.arguments, parsedArguments: parsed, at, responseId: this.liveId ?? 0, result: null });
        break;
      }
      case 'tool_call_result': {
        const call = this.toolCalls.find((c) => c.tool_call_id === frame.tool_call_id);
        if (call) call.result = { content: frame.content, successful: frame.successful ?? null, at };
        else this.violations.push({ code: 'orphan_tool_result', message: `tool_call_result for unknown tool_call_id ${frame.tool_call_id} (Retell WebSocket reference: same id for both)`, raw, at });
        break;
      }
      default:
        break;
    }
    this.checkWaiters();
  }

  private onConfig(config: ConfigFrame['config']): void {
    this.config = config;
    if (config.auto_reconnect) {
      this.keepalive.enabled = true;
      this.startPing();
    }
    if (config.call_details) this.send({ interaction_type: 'call_details', call: sampleCall(this.opts.callId) });
  }

  private startPing(): void {
    if (this.pingTimer) return;
    const interval = this.opts.pingIntervalMs ?? 2000;
    const timeout = this.opts.pingTimeoutMs ?? 5000;
    this.pingTimer = setInterval(() => {
      const ts = Math.max(Date.now(), this.lastPingTs + 1);
      this.lastPingTs = ts;
      this.keepalive.sent += 1;
      this.pendingPings.set(ts, setTimeout(() => {
        this.pendingPings.delete(ts);
        this.keepalive.missed += 1;
      }, timeout));
      this.send({ interaction_type: 'ping_pong', timestamp: ts });
    }, interval);
  }

  // Retell WebSocket reference: the requirement is "a ping_pong event back every 2s" with an integer timestamp (the schema checks the
  // field); the guide's code echoes the request's timestamp, but equality is not documented as required, so any reply
  // credits the oldest outstanding ping.
  private onPong(_ts: number): void {
    const oldest = this.pendingPings.keys().next();
    if (oldest.done) return;
    clearTimeout(this.pendingPings.get(oldest.value));
    this.pendingPings.delete(oldest.value);
    this.keepalive.echoed += 1;
  }

  private onResponse(frame: ResponseFrame, at: number, raw: string): void {
    if (frame.response_id === 0) {
      this.begin.content += frame.content;
      if (frame.content_complete && !this.begin.received) {
        this.begin.received = true;
        this.begin.ms = at - this.startedAt;
      }
      return;
    }
    const turn = this.turns.find((t) => t.responseId === frame.response_id);
    if (!turn) {
      this.violations.push({ code: 'wrong_response_id', message: `response for response_id ${frame.response_id}, which was never requested; Retell discards it silently (Retell WebSocket reference)`, raw, at });
      return;
    }
    if (turn.completedAt !== null) {
      this.violations.push({ code: 'content_after_complete', message: `response_id ${frame.response_id} sent content after content_complete: true; Retell ignores it (Retell WebSocket reference)`, raw, at });
      return;
    }
    turn.chunks.push({
      at,
      content: frame.content,
      content_complete: frame.content_complete,
      end_call: frame.end_call === true,
      transfer_number: frame.transfer_number ?? null,
      digit_to_press: frame.digit_to_press ?? null,
    });
    if (frame.content_complete && turn.completedAt === null) turn.completedAt = at;
  }
}
