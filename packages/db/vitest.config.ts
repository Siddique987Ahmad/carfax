import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./src/testing/global-setup.ts'],
    include: ['src/**/*.test.ts', 'seed/**/*.test.ts'],
    // Tests create and migrate real databases; under parallel load (CI, all packages at once)
    // that takes longer than Vitest's 5-second default.
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
