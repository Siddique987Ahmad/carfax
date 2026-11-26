// Writes apps/api/openapi.json at build time (api/01). packages/api-client is generated from it
// (admin/03). Runs in preview mode: no providers are created, so it needs no database or Redis.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildOpenApi, createApp } from './app';

async function generate() {
  const app = await createApp({ preview: true });
  const document = buildOpenApi(app);
  const target = join(__dirname, '../openapi.json');
  writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`);
  await app.close();
  console.log(`wrote openapi.json (${Object.keys(document.paths).length} paths)`);
}

void generate();
