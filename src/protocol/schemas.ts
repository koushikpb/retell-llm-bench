import { z } from 'zod';

// ---- shared (Retell WebSocket reference and setup guide) ----
export const UtteranceSchema = z.object({
  role: z.enum(['agent', 'user']),
  content: z.string(),
  words: z.array(z.object({ word: z.string(), start: z.number(), end: z.number() })).optional(),
});
export type Utterance = z.infer<typeof UtteranceSchema>;

// ---- Retell -> server, discriminator interaction_type (Retell WebSocket reference) ----
export const PingPongRequestSchema = z.object({ interaction_type: z.literal('ping_pong'), timestamp: z.int() });
export const CallDetailsRequestSchema = z.object({ interaction_type: z.literal('call_details'), call: z.record(z.string(), z.unknown()) });
export const UpdateOnlyRequestSchema = z.object({
  interaction_type: z.literal('update_only'),
  transcript: z.array(UtteranceSchema),
  transcript_with_tool_calls: z.array(z.record(z.string(), z.unknown())).optional(),
  turntaking: z.enum(['agent_turn', 'user_turn']).optional(),
});
export const ResponseRequiredRequestSchema = z.object({
  interaction_type: z.literal('response_required'),
  response_id: z.int(),
  transcript: z.array(UtteranceSchema),
  transcript_with_tool_calls: z.array(z.record(z.string(), z.unknown())).optional(),
  timestamp: z.int().optional(),
});
export const ReminderRequiredRequestSchema = z.object({
  interaction_type: z.literal('reminder_required'),
  response_id: z.int(),
  transcript: z.array(UtteranceSchema),
  transcript_with_tool_calls: z.array(z.record(z.string(), z.unknown())).optional(),
  timestamp: z.int().optional(),
});
export const RetellFrameSchema = z.discriminatedUnion('interaction_type', [
  PingPongRequestSchema,
  CallDetailsRequestSchema,
  UpdateOnlyRequestSchema,
  ResponseRequiredRequestSchema,
  ReminderRequiredRequestSchema,
]);
export type RetellFrame = z.infer<typeof RetellFrameSchema>;

// ---- server -> Retell, discriminator response_type (Retell WebSocket reference and setup guide) ----
const actionFields = {
  no_interruption_allowed: z.boolean().optional(),
  end_call: z.boolean().optional(),
  transfer_number: z.string().optional(),
  digit_to_press: z.string().optional(),
};
export const ConfigResponseSchema = z.object({
  response_type: z.literal('config'),
  config: z.object({
    auto_reconnect: z.boolean().optional(),
    call_details: z.boolean().optional(),
    transcript_with_tool_calls: z.boolean().optional(),
  }),
});
export const PingPongResponseSchema = z.object({ response_type: z.literal('ping_pong'), timestamp: z.int() });
export const ResponseResponseSchema = z.object({
  response_type: z.literal('response'),
  response_id: z.int(),
  content: z.string(),
  content_complete: z.boolean(),
  ...actionFields,
  show_transferee_as_caller: z.boolean().optional(),
});
// agent_interrupt, update_agent and metadata are accepted by response_type only: the bench never emits or scores
// them (the Retell WebSocket reference documents their fields, and the bench has no reason to validate them).
export const AgentInterruptSchema = z.object({ response_type: z.literal('agent_interrupt') });
export const ToolCallInvocationSchema = z.object({
  response_type: z.literal('tool_call_invocation'),
  tool_call_id: z.string(),
  name: z.string(),
  arguments: z.string(),
});
export const ToolCallResultSchema = z.object({
  response_type: z.literal('tool_call_result'),
  tool_call_id: z.string(),
  content: z.string(),
  successful: z.boolean().optional(),
});
export const UpdateAgentSchema = z.object({ response_type: z.literal('update_agent') });
export const MetadataResponseSchema = z.object({ response_type: z.literal('metadata') });
export const ServerFrameSchema = z.discriminatedUnion('response_type', [
  ConfigResponseSchema,
  PingPongResponseSchema,
  ResponseResponseSchema,
  AgentInterruptSchema,
  ToolCallInvocationSchema,
  ToolCallResultSchema,
  UpdateAgentSchema,
  MetadataResponseSchema,
]);
export type ServerFrame = z.infer<typeof ServerFrameSchema>;
export type ConfigFrame = z.infer<typeof ConfigResponseSchema>;
export type ResponseFrame = z.infer<typeof ResponseResponseSchema>;

// ---- validation that mirrors Retell's documented behavior ----
export type ViolationCode =
  | 'invalid_json'
  | 'not_an_object'
  | 'missing_response_type'
  | 'unknown_response_type'
  | 'schema'
  | 'exclusive_actions'
  | 'binary_frame'
  | 'wrong_response_id'
  | 'config_not_first'
  | 'orphan_tool_result'
  | 'content_after_complete';

export interface Violation {
  code: ViolationCode;
  message: string;
  raw: string;
}

const RESPONSE_TYPES = new Set(['config', 'ping_pong', 'response', 'agent_interrupt', 'tool_call_invocation', 'tool_call_result', 'update_agent', 'metadata']);

export function validateServerFrame(raw: string): { frame: ServerFrame | null; violations: Violation[] } {
  const violations: Violation[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { frame: null, violations: [{ code: 'invalid_json', message: `not JSON: ${(err as Error).message}`, raw }] };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { frame: null, violations: [{ code: 'not_an_object', message: 'frame is not a JSON object', raw }] };
  }
  const obj = parsed as Record<string, unknown>;
  if (obj.response_type === undefined) {
    violations.push({ code: 'missing_response_type', message: 'no response_type; Retell treats this as a response and the mistake fails silently (Retell custom-LLM overview)', raw });
    obj.response_type = 'response';
  } else if (typeof obj.response_type !== 'string' || !RESPONSE_TYPES.has(obj.response_type)) {
    return { frame: null, violations: [{ code: 'unknown_response_type', message: `unknown response_type ${JSON.stringify(obj.response_type)}`, raw }] };
  }
  const result = ServerFrameSchema.safeParse(obj);
  if (!result.success) {
    const detail = result.error.issues.map((i) => `${i.path.map(String).join('.') || '(root)'}: ${i.message}`).join('; ');
    violations.push({ code: 'schema', message: `Retell would drop this ${String(obj.response_type)} event: ${detail} (Retell WebSocket reference)`, raw });
    return { frame: null, violations };
  }
  const frame = result.data;
  if (frame.response_type === 'response') {
    const actions = [frame.end_call === true, frame.transfer_number !== undefined, frame.digit_to_press !== undefined].filter(Boolean).length;
    if (actions > 1) {
      violations.push({ code: 'exclusive_actions', message: 'end_call, transfer_number and digit_to_press are mutually exclusive; Retell runs at most one (Retell WebSocket reference)', raw });
    }
  }
  return { frame, violations };
}
