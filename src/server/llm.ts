export type LlmContentPart =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string };

export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string | LlmContentPart[];
}

export interface LlmToolUse { id: string; name: string; input: Record<string, unknown> }
export interface LlmResult { text: string; toolUses: LlmToolUse[] }

export interface LlmClient {
  generate(input: { messages: LlmMessage[]; signal: AbortSignal; onText: (delta: string) => void }): Promise<LlmResult>;
}
