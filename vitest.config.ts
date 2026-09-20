import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Test files run one at a time: several files drive real timers over WebSockets (Context7: docs/config/fileparallelism.md).
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
