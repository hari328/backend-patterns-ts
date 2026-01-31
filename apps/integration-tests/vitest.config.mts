import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only run files ending with .integration.spec.ts
    include: ['src/**/*.integration.spec.ts'],
    
    // Longer timeout for integration tests (waiting for async processing)
    testTimeout: 30000,
    
    // Run tests sequentially (not parallel) to avoid database conflicts
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    
    // Environment variables for tests
    env: {
      NODE_ENV: 'test',
    },
  },
});

