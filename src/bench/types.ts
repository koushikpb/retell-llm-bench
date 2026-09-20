import type { ConfigFrame, ServerFrame, Violation } from '../protocol/schemas.js';

export interface RecordedFrame { at: number; frame: ServerFrame }
export interface RecordedViolation extends Violation { at: number }

export interface ChunkRecord {
  at: number;
  content: string;
  content_complete: boolean;
  end_call: boolean;
  transfer_number: string | null;
  digit_to_press: string | null;
}

export interface ToolCallRecord {
  tool_call_id: string;
  name: string;
  arguments: string;
  parsedArguments: Record<string, unknown> | null;
  at: number;
  responseId: number;
  result: { content: string; successful: boolean | null; at: number } | null;
}

export interface TurnRecord {
  responseId: number;
  kind: 'response_required' | 'reminder_required';
  requestedAt: number;
  chunks: ChunkRecord[];
  completedAt: number | null;
  superseded: boolean;
  supersededAt: number | null;
  supersededBy: number | null;
  timedOut: boolean;
}

export interface KeepaliveRecord { enabled: boolean; sent: number; echoed: number; missed: number }
export interface BeginRecord { received: boolean; content: string; ms: number | null }

export interface ScenarioRunResult {
  scenario: string;
  run: number;
  callId: string;
  url: string;
  config: ConfigFrame['config'] | null;
  begin: BeginRecord;
  turns: TurnRecord[];
  toolCalls: ToolCallRecord[];
  violations: RecordedViolation[];
  keepalive: KeepaliveRecord;
  agentUtterances: string[];
  durationMs: number;
}
