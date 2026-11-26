import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./src/testing/global-setup.ts'],
    include: ['src/**/*.test.ts', 'seed/**/*.test.ts'],
  },
});
