import { existsSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';

// drizzle-kit runs from packages/db; load the repo's .env (pnpm env:init) when it isn't already set.
if (!process.env.MIGRATION_DATABASE_URL && existsSync('../../.env'))
  process.loadEnvFile('../../.env');

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations',
  // camelCase in TypeScript, snake_case in the database.
  casing: 'snake_case',
  // Migrations run as the table owner, never as the app's user (db/06).
  // generate doesn't need a database; migrate, push and studio do.
  dbCredentials: {
    url: process.env.MIGRATION_DATABASE_URL ?? 'postgres://MIGRATION_DATABASE_URL-is-not-set',
  },
  strict: true,
  verbose: true,
});
