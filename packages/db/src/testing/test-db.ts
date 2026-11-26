import { existsSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from '../client';

/** Folder with the committed migrations. */
export const migrationsFolder = new URL('../../migrations', import.meta.url).pathname;

function env(name: 'MIGRATION_DATABASE_URL' | 'APP_DB_PASSWORD'): string {
  const envFile = new URL('../../../../.env', import.meta.url);
  if (!process.env[name] && existsSync(envFile)) process.loadEnvFile(envFile);
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set: run pnpm env:init and pnpm services:up`);
  return value;
}

/** The table owner, who creates test databases and runs migrations. */
const adminUrl = () => env('MIGRATION_DATABASE_URL');

/**
 * Creates a throwaway database (optionally with all migrations applied) for one test file.
 * `db` connects as the owner; `app.db` connects as carfax_app, like the API (needs `migrated`).
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

  const appUrl = new URL(url);
  appUrl.username = 'carfax_app';
  appUrl.password = env('APP_DB_PASSWORD');
  const app = createDb(appUrl.toString(), { max: 2, ...quiet });

  return {
    ...target,
    app,
    async drop() {
      await app.pool.end();
      await target.pool.end();
      await admin.db.execute(sql.raw(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`));
      await admin.pool.end();
    },
  };
}
