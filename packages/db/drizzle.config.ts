import { existsSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';

// drizzle-kit runs from packages/db; load the repo's .env (pnpm env:init) when DATABASE_URL isn't set.
if (!process.env.DATABASE_URL && existsSync('../../.env')) process.loadEnvFile('../../.env');

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations',
  // camelCase in TypeScript, snake_case in the database.
  casing: 'snake_case',
  // generate doesn't need a database; migrate, push and studio do.
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgres://DATABASE_URL-is-not-set' },
  strict: true,
  verbose: true,
});
