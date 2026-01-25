import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Use .spec.ts convention for test files
    include: ['src/**/*.spec.ts'],

    // Node environment for backend code
    environment: 'node',

    // Enable globals so we don't need to import describe, it, expect
    globals: true,
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
});