import { existsSync, readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from './client';

// Needs the local services (pnpm services:up). CI provides Postgres as a service container.
const envFile = new URL('../../../.env', import.meta.url);
if (!process.env.DATABASE_URL && existsSync(envFile)) process.loadEnvFile(envFile);
const adminUrl = process.env.DATABASE_URL;
if (!adminUrl) throw new Error('DATABASE_URL is not set: run pnpm env:init and pnpm services:up');

const migrationsFolder = new URL('../migrations', import.meta.url).pathname;
const journal = JSON.parse(readFileSync(`${migrationsFolder}/meta/_journal.json`, 'utf8')) as {
  entries: unknown[];
};

// A throwaway database per run, so the test always migrates from empty.
const dbName = `carfax_test_${process.pid}_${Date.now()}`;
const admin = createDb(adminUrl, { max: 1 });
let target: ReturnType<typeof createDb>;

beforeAll(async () => {
  await admin.db.execute(sql.raw(`CREATE DATABASE "${dbName}"`));
  const url = new URL(adminUrl);
  url.pathname = `/${dbName}`;
  target = createDb(url.toString(), { max: 2 });
});

afterAll(async () => {
  await target?.pool.end();
  await admin.db.execute(sql.raw(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`));
  await admin.pool.end();
});

describe('createDb and migrations', () => {
  it('connects', async () => {
    const result = await target.db.execute(sql`select 1 as ok`);
    expect(result.rows[0]).toEqual({ ok: 1 });
  });

  it('applies every committed migration to an empty database', async () => {
    await migrate(target.db, { migrationsFolder });
    const applied = await target.db.execute(
      sql`select count(*)::int as n from drizzle.__drizzle_migrations`,
    );
    expect(applied.rows[0]).toEqual({ n: journal.entries.length });
  });

  it('running migrations again changes nothing', async () => {
    await migrate(target.db, { migrationsFolder });
    const applied = await target.db.execute(
      sql`select count(*)::int as n from drizzle.__drizzle_migrations`,
    );
    expect(applied.rows[0]).toEqual({ n: journal.entries.length });
  });
});
