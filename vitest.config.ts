import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/priorart/integration/**'],
    environment: 'node',
    testTimeout: 20000,
    coverage: {
      provider: 'v8',
      include: ['src/lib/agents/priorart/**'],
    },
  },
  resolve: {
    alias: { '@': path.resolve(process.cwd(), './src') },
  },
});
