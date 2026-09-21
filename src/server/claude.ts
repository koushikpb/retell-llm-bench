import Anthropic from '@anthropic-ai/sdk';
import type { LlmClient, LlmToolUse } from './llm.js';
import { SYSTEM_PROMPT, TOOLS } from './tools.js';

export function createClaudeClient(opts: { model: string; maxTokens?: number }): LlmClient {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment
  return {
    async generate({ messages, signal, onText }) {
      const stream = client.messages.stream(
        {
          model: opts.model,
          max_tokens: opts.maxTokens ?? 300,
          // No sampling parameters: Sonnet 5 rejects a non-default temperature/top_p/top_k with a 400.
          // Thinking off: max_tokens then covers spoken text only, and time to first sentence measures the server, not hidden reasoning.
          thinking: { type: 'disabled' },
          system: SYSTEM_PROMPT,
          tools: TOOLS as Anthropic.Messages.Tool[],
          messages: messages as Anthropic.Messages.MessageParam[],
        },
        { signal },
      );
      stream.on('text', (delta) => onText(delta));
      const final = await stream.finalMessage();
      const toolUses: LlmToolUse[] = [];
      let text = '';
      for (const block of final.content) {
        if (block.type === 'text') text += block.text;
        else if (block.type === 'tool_use') toolUses.push({ id: block.id, name: block.name, input: (block.input ?? {}) as Record<string, unknown> });
      }
      return { text, toolUses };
    },
  };
}
