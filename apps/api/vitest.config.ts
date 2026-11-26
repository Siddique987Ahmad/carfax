import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // NestJS needs decorator metadata, which Vite's default transform (esbuild) can't emit.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    globalSetup: ['./test/global-setup.ts'],
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
