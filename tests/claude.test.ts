import { describe, it, expect } from 'vitest';
import { createClaudeClient } from '../src/server/claude.js';

describe('createClaudeClient', () => {
  it('builds an LlmClient without contacting the network', () => {
    process.env.ANTHROPIC_API_KEY = 'placeholder-not-a-real-key';
    const client = createClaudeClient({ model: 'claude-sonnet-5' });
    expect(typeof client.generate).toBe('function');
  });
});
