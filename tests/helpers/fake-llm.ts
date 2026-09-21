import type { LlmClient, LlmMessage, LlmResult, LlmToolUse } from '../../src/server/llm.js';

export interface FakeLlmStep { textChunks: string[]; chunkDelayMs: number; toolUses: LlmToolUse[]; fail?: boolean }

export function fakeLlm(steps: FakeLlmStep[]): LlmClient & { calls: number } {
  const client = {
    calls: 0,
    async generate({ signal, onText }: { messages: LlmMessage[]; signal: AbortSignal; onText: (d: string) => void }): Promise<LlmResult> {
      const step = steps[Math.min(client.calls, steps.length - 1)];
      client.calls += 1;
      if (step.fail) throw new Error('fake provider error');
      let text = '';
      for (const chunk of step.textChunks) {
        if (step.chunkDelayMs > 0) await new Promise<void>((r) => setTimeout(r, step.chunkDelayMs));
        if (signal.aborted) throw new Error('aborted');
        onText(chunk);
        text += chunk;
      }
      return { text, toolUses: step.toolUses };
    },
  };
  return client;
}
