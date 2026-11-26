import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createTestDatabase } from './testing/test-db';

describe('createDb error handling', () => {
  it('an idle connection killed by the database is reported, not a crash', async () => {
    const t = await createTestDatabase();
    const errors: Error[] = [];
    t.pool.removeAllListeners('error');
    t.pool.on('error', (e) => errors.push(e));

    // Open an idle pooled connection, then have Postgres terminate it, as a restart would.
    const pid = (await t.db.execute(sql`select pg_backend_pid() as pid`)).rows[0]!.pid;
    const killer = await createTestDatabase();
    await killer.db.execute(sql`select pg_terminate_backend(${pid})`);
    await new Promise((r) => setTimeout(r, 200));

    expect(errors.length).toBe(1);
    // The pool recovers with a fresh connection.
    expect((await t.db.execute(sql`select 1 as ok`)).rows[0]).toEqual({ ok: 1 });
    await killer.drop();
    await t.drop();
  });
});
