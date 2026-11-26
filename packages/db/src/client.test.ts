import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, migrationsFolder } from './testing/test-db';

const journal = JSON.parse(readFileSync(`${migrationsFolder}/meta/_journal.json`, 'utf8')) as {
  entries: unknown[];
};

let t: Awaited<ReturnType<typeof createTestDatabase>>;
beforeAll(async () => {
  t = await createTestDatabase();
});
afterAll(async () => {
  await t?.drop();
});

const appliedCount = async () =>
  (await t.db.execute(sql`select count(*)::int as n from drizzle.__drizzle_migrations`)).rows[0];

describe('createDb and migrations', () => {
  it('connects', async () => {
    const result = await t.db.execute(sql`select 1 as ok`);
    expect(result.rows[0]).toEqual({ ok: 1 });
  });

  it('applies every committed migration to an empty database', async () => {
    await migrate(t.db, { migrationsFolder });
    expect(await appliedCount()).toEqual({ n: journal.entries.length });
  });

  it('running migrations again changes nothing', async () => {
    await migrate(t.db, { migrationsFolder });
    expect(await appliedCount()).toEqual({ n: journal.entries.length });
  });
});
