import type { WebSocket } from 'ws';
import { RetellFrameSchema, type Utterance } from '../protocol/schemas.js';
import type { BookingStore } from './booking.js';
import type { LlmClient, LlmMessage, LlmToolUse } from './llm.js';
import { BEGIN_MESSAGE } from './tools.js';

export interface ServerDeps {
  llm: LlmClient;
  bookings: BookingStore;
  log: (line: string) => void;
}

// Retell best-practice page: on reminder_required "nudge rather than answering a question nobody asked".
export const REMINDER_NOTE = '[The caller has been silent for a while. Nudge them briefly; do not answer a question nobody asked.]';

export function buildMessages(transcript: Utterance[], kind: 'response_required' | 'reminder_required'): LlmMessage[] {
  const messages: LlmMessage[] = [];
  for (const u of transcript) {
    if (u.content.trim().length === 0) continue;
    const role = u.role === 'agent' ? 'assistant' : 'user';
    const last = messages[messages.length - 1];
    if (last && last.role === role && typeof last.content === 'string') last.content += ` ${u.content}`;
    else messages.push({ role, content: u.content });
  }
  if (messages.length === 0 || messages[0].role !== 'user') messages.unshift({ role: 'user', content: '[Call connected.]' });
  if (kind === 'reminder_required') {
    const last = messages[messages.length - 1];
    if (last.role === 'user' && typeof last.content === 'string') last.content += ` ${REMINDER_NOTE}`;
    else messages.push({ role: 'user', content: REMINDER_NOTE });
  }
  if (messages[messages.length - 1].role === 'assistant') messages.push({ role: 'user', content: '[The caller is waiting.]' });
  return messages;
}

export function handleConnection(ws: WebSocket, callId: string, deps: ServerDeps): void {
  const send = (frame: Record<string, unknown>) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(frame));
  };
  let latestId = -1;
  let inflight: AbortController | null = null;
  let toolSeq = 0;

  // Retell custom-LLM overview: config first, then the begin message with response_id 0.
  send({ response_type: 'config', config: { auto_reconnect: true, call_details: true } });
  send({ response_type: 'response', response_id: 0, content: BEGIN_MESSAGE, content_complete: true });

  ws.on('message', (data) => {
    let json: unknown;
    try {
      json = JSON.parse(data.toString());
    } catch {
      deps.log(`${callId}: dropped non-JSON frame`);
      return;
    }
    const parsed = RetellFrameSchema.safeParse(json);
    if (!parsed.success) {
      deps.log(`${callId}: dropped invalid frame`);
      return;
    }
    const frame = parsed.data;
    switch (frame.interaction_type) {
      case 'ping_pong':
        send({ response_type: 'ping_pong', timestamp: frame.timestamp });
        return;
      case 'call_details':
        deps.log(`${callId}: call_details ${JSON.stringify(frame.call).slice(0, 200)}`);
        return;
      case 'update_only':
        return;
      case 'response_required':
      case 'reminder_required': {
        inflight?.abort();
        const controller = new AbortController();
        inflight = controller;
        latestId = frame.response_id;
        void respond(frame.response_id, frame.interaction_type, frame.transcript, controller);
        return;
      }
      default:
        return;
    }
  });
  ws.on('close', () => inflight?.abort());

  async function respond(id: number, kind: 'response_required' | 'reminder_required', transcript: Utterance[], controller: AbortController): Promise<void> {
    const isStale = () => latestId !== id || ws.readyState !== ws.OPEN;
    const say = (content: string) => {
      if (!isStale() && content.length > 0) send({ response_type: 'response', response_id: id, content, content_complete: false });
    };
    let endCall = false;
    let pendingAfterCap = false;
    let cappedToolName = '';
    const messages = buildMessages(transcript, kind);
    try {
      // Reference-server limit: one tool call per turn, then at most one follow-up generation. Extra tool uses are logged and ignored (see README "What was left out").
      for (let round = 0; round < 2; round += 1) {
        const result = await deps.llm.generate({
          messages,
          signal: controller.signal,
          onText: (delta) => {
            if (isStale()) controller.abort();
            else say(delta);
          },
        });
        const tool = result.toolUses[0];
        if (result.toolUses.length > 1) deps.log(`${callId}: response ${id} returned ${result.toolUses.length} tool uses; only ${tool?.name ?? 'none'} runs (reference-server limit)`);
        if (!tool || isStale()) break;
        const message = typeof tool.input.message === 'string' ? tool.input.message : '';
        const spoken = message.endsWith(' ') || message.length === 0 ? message : `${message} `;
        // Separate the streamed text from the tool's spoken message: without this, non-whitespace-terminated
        // text runs straight into the message ("...for you now.One moment...").
        const needsSeparator = result.text.length > 0 && !/\s$/.test(result.text) && spoken.length > 0;
        say(needsSeparator ? ` ${spoken}` : spoken);
        const outcome = runTool(tool);
        if (tool.name === 'end_call') {
          endCall = true;
          break;
        }
        if (round === 1) {
          pendingAfterCap = true;
          cappedToolName = tool.name;
        }
        messages.push({
          role: 'assistant',
          content: [...(result.text.length > 0 ? [{ type: 'text' as const, text: result.text }] : []), { type: 'tool_use', id: tool.id, name: tool.name, input: tool.input }],
        });
        messages.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: tool.id, content: outcome }] });
      }
      if (pendingAfterCap) deps.log(`${callId}: response ${id} hit the tool-loop cap after ${cappedToolName}; no follow-up generation (reference-server limit)`);
    } catch (err) {
      if (!controller.signal.aborted) deps.log(`${callId}: response ${id} failed: ${(err as Error).message}`);
    } finally {
      // Retell best-practice page: "Send content_complete: true in a finally block."
      if (ws.readyState === ws.OPEN) send({ response_type: 'response', response_id: id, content: '', content_complete: true, ...(endCall ? { end_call: true } : {}) });
    }
  }

  function runTool(tool: LlmToolUse): string {
    toolSeq += 1;
    const tool_call_id = `${callId}-${toolSeq}`;
    const { message: _message, ...args } = tool.input;
    send({ response_type: 'tool_call_invocation', tool_call_id, name: tool.name, arguments: JSON.stringify(args) });
    let content: string;
    if (tool.name === 'book_appointment') {
      const r = deps.bookings.book(callId, { date: String(args.date ?? ''), time: String(args.time ?? '') });
      content = r.created
        ? `Booked ${String(args.date)} ${String(args.time)}, confirmation ${r.confirmation}.`
        : `Already booked ${String(args.date)} ${String(args.time)} on this call, confirmation ${r.confirmation}; nothing changed.`;
    } else if (tool.name === 'end_call') {
      content = 'Call will end after this message.';
    } else {
      content = `Unknown tool ${tool.name}.`;
    }
    send({ response_type: 'tool_call_result', tool_call_id, content, successful: true });
    return content;
  }
}
