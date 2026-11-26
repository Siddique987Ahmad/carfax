import { defineConfig } from 'tsup';

/**
 * The API is bundled into dist/*.js, CommonJS (api/01):
 * - NestJS needs decorator metadata, which esbuild can't emit, so tsup uses SWC (because
 *   emitDecoratorMetadata is on in tsconfig.json; needs @swc/core).
 * - The workspace packages (@carfax/*) are TypeScript source; they're compiled into the bundle,
 *   so Node runs plain JavaScript. Other dependencies stay in node_modules.
 */
export default defineConfig({
  entry: { main: 'src/main.ts', openapi: 'src/openapi.ts' },
  format: 'cjs',
  platform: 'node',
  target: 'node24',
  outDir: 'dist',
  sourcemap: true,
  clean: true,
  noExternal: [/^@carfax\//],
});
