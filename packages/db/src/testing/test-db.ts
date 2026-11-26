import { existsSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from '../client';

/** Folder with the committed migrations. */
export const migrationsFolder = new URL('../../migrations', import.meta.url).pathname;

function adminUrl(): string {
  const envFile = new URL('../../../../.env', import.meta.url);
  if (!process.env.DATABASE_URL && existsSync(envFile)) process.loadEnvFile(envFile);
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set: run pnpm env:init and pnpm services:up');
  return url;
}

/**
 * Creates a throwaway database (optionally with all migrations applied) for one test file.
 * Call `drop()` in afterAll. Needs the local services (pnpm services:up); CI provides Postgres.
 */
export async function createTestDatabase(options: { migrated?: boolean } = {}) {
  // Dropping a test database ends its connections on purpose, so those errors are ignored here.
  const quiet = { onError: () => {} };
  const admin = createDb(adminUrl(), { max: 1, ...quiet });
  const name = `carfax_test_${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  await admin.db.execute(sql.raw(`CREATE DATABASE "${name}"`));

  const url = new URL(adminUrl());
  url.pathname = `/${name}`;
  const target = createDb(url.toString(), { max: 2, ...quiet });
  if (options.migrated) await migrate(target.db, { migrationsFolder });

  return {
    ...target,
    async drop() {
      await target.pool.end();
      await admin.db.execute(sql.raw(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`));
      await admin.pool.end();
    },
  };
}
