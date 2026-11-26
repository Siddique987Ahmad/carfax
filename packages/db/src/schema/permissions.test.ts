import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withSystem } from '../scope';
import { createTestDatabase } from '../testing/test-db';
import { auditLogs } from './audit';
import { carRegistrations, cars } from './cars';
import { garages } from './garages';
import { jobs } from './jobs';
import { users } from './users';

// Everything here runs as carfax_app, the user the API and workers connect as (db/06).
let t: Awaited<ReturnType<typeof createTestDatabase>>;
beforeAll(async () => {
  t = await createTestDatabase({ migrated: true });
});
afterAll(async () => {
  await t?.drop();
});

async function pgCode(query: Promise<unknown>): Promise<string | undefined> {
  try {
    await query;
  } catch (error) {
    const e = error as { code?: string; cause?: { code?: string } };
    return e.cause?.code ?? e.code;
  }
  return undefined;
}
const DENIED = '42501'; // insufficient_privilege

describe('the app database user (carfax_app)', () => {
  it('is not the owner and connects as itself', async () => {
    const who = await t.app.db.execute(sql`select current_user as u`);
    expect(who.rows[0]).toEqual({ u: 'carfax_app' });
  });

  it('can read and write ordinary rows', async () => {
    const [user] = await t.app.db.insert(users).values({ phone: '+923009990001' }).returning();
    await t.app.db.update(users).set({ name: 'Ahmed' }).where(eq(users.id, user!.id));
    await t.app.db.delete(users).where(eq(users.id, user!.id));
  });

  it('can add and read audit rows, but never change or delete them', async () => {
    const [row] = await t.app.db
      .insert(auditLogs)
      .values({ action: 'garage.approve', entity: 'garage', note: 'visited' })
      .returning();
    expect(row!.id).toBeGreaterThan(0);
    expect(
      await pgCode(t.app.db.update(auditLogs).set({ note: 'x' }).where(eq(auditLogs.id, row!.id))),
    ).toBe(DENIED);
    expect(await pgCode(t.app.db.delete(auditLogs).where(eq(auditLogs.id, row!.id)))).toBe(DENIED);
    expect(await pgCode(t.app.db.execute(sql`truncate audit_logs`))).toBe(DENIED);
  });

  it('cannot hard-delete jobs, cars or plates', async () => {
    const [owner] = await t.app.db.insert(users).values({ phone: '+923009990002' }).returning();
    const [garage] = await t.app.db
      .insert(garages)
      .values({ ownerId: owner!.id, name: 'Ahmed Motors', city: 'Lahore' })
      .returning();
    const car = await t.app.db.transaction(async (tx) => {
      const [c] = await tx.insert(cars).values({}).returning();
      await tx.insert(carRegistrations).values({ carId: c!.id, regNo: 'LEA9001' });
      return c!;
    });
    // Jobs are protected by row-level security (db/07), so this needs a scope like real code.
    const job = await withSystem(t.app.db, async (tx) => {
      const [j] = await tx
        .insert(jobs)
        .values({
          carId: car.id,
          garageId: garage!.id,
          createdBy: owner!.id,
          serviceDate: '2026-11-27',
          odometerKm: 1000,
          deviceCreatedAt: new Date(),
        })
        .returning();
      return j!;
    });
    expect(
      await pgCode(withSystem(t.app.db, (tx) => tx.delete(jobs).where(eq(jobs.id, job.id)))),
    ).toBe(DENIED);
    expect(await pgCode(t.app.db.delete(cars).where(eq(cars.id, car.id)))).toBe(DENIED);
    expect(
      await pgCode(t.app.db.delete(carRegistrations).where(eq(carRegistrations.carId, car.id))),
    ).toBe(DENIED);
  });

  it('cannot create, change or drop tables', async () => {
    expect(await pgCode(t.app.db.execute(sql`create table sneaky (id int)`))).toBe(DENIED);
    expect(await pgCode(t.app.db.execute(sql`alter table users add column x int`))).toBe(DENIED);
    expect(await pgCode(t.app.db.execute(sql`drop table audit_logs`))).toBe(DENIED);
  });

  it('can use a table added by a later migration without extra grants', async () => {
    // A later migration runs as the owner, like this.
    await t.db.execute(sql`create table later_feature (id serial primary key, label text)`);
    await t.app.db.execute(sql`insert into later_feature (label) values ('works')`);
    const rows = await t.app.db.execute(sql`select label from later_feature`);
    expect(rows.rows).toEqual([{ label: 'works' }]);
  });
});
