import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from './client';
import { carRegistrations, cars } from './schema/cars';
import { customers, garageMembers, garages } from './schema/garages';
import { jobFlags, jobItems, jobPhotos, jobs, reminders } from './schema/jobs';
import { users } from './schema/users';
import { withGarage, withSystem } from './scope';
import { createTestDatabase } from './testing/test-db';

// Runs as carfax_app (t.app.db), like the API. The owner (t.db) bypasses row-level security,
// so it's only used here to set up data.
let t: Awaited<ReturnType<typeof createTestDatabase>>;
let A: Awaited<ReturnType<typeof seedGarage>>;
let B: Awaited<ReturnType<typeof seedGarage>>;

let n = 4000000;
async function seedGarage(name: string) {
  const [owner] = await t.db
    .insert(users)
    .values({ phone: `+92303${n++}` })
    .returning();
  const [garage] = await t.db
    .insert(garages)
    .values({ ownerId: owner!.id, name, city: 'Lahore' })
    .returning();
  await t.db
    .insert(garageMembers)
    .values({ garageId: garage!.id, userId: owner!.id, role: 'owner' });
  const car = await t.db.transaction(async (tx) => {
    const [c] = await tx.insert(cars).values({}).returning();
    await tx.insert(carRegistrations).values({ carId: c!.id, regNo: `LEA${n++}` });
    return c!;
  });
  const [customer] = await t.db
    .insert(customers)
    .values({ garageId: garage!.id, name: `${name} customer` })
    .returning();
  const [job] = await t.db
    .insert(jobs)
    .values({
      carId: car.id,
      garageId: garage!.id,
      customerId: customer!.id,
      createdBy: owner!.id,
      serviceDate: '2026-11-27',
      odometerKm: 50000,
      deviceCreatedAt: new Date(),
    })
    .returning();
  await t.db.insert(jobItems).values({ jobId: job!.id, workType: 'oil_change' });
  await t.db.insert(jobPhotos).values({ jobId: job!.id, kind: 'odometer', takenAt: new Date() });
  await t.db.insert(jobFlags).values({ jobId: job!.id, code: 'NO_PHOTO' });
  await t.db.insert(reminders).values({
    garageId: garage!.id,
    carId: car.id,
    customerId: customer!.id,
    kind: 'oil_change',
    dueDate: '2027-02-27',
  });
  return { owner: owner!, garage: garage!, car, customer: customer!, job: job! };
}

beforeAll(async () => {
  t = await createTestDatabase({ migrated: true });
  A = await seedGarage('A Motors');
  B = await seedGarage('B Motors');
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
const RLS_DENIED = '42501'; // new row violates row-level security policy

describe('garage scope (withGarage)', () => {
  it('garage A sees only its own rows in every protected table', async () => {
    const seen = await withGarage(t.app.db, A.garage.id, async (tx) => ({
      jobs: (await tx.select().from(jobs)).map((r) => r.garageId),
      customers: (await tx.select().from(customers)).map((r) => r.garageId),
      reminders: (await tx.select().from(reminders)).map((r) => r.garageId),
      members: (await tx.select().from(garageMembers)).map((r) => r.garageId),
      items: (await tx.select().from(jobItems)).map((r) => r.jobId),
      photos: (await tx.select().from(jobPhotos)).map((r) => r.jobId),
      flags: (await tx.select().from(jobFlags)).map((r) => r.jobId),
    }));
    expect(seen).toEqual({
      jobs: [A.garage.id],
      customers: [A.garage.id],
      reminders: [A.garage.id],
      members: [A.garage.id],
      items: [A.job.id],
      photos: [A.job.id],
      flags: [A.job.id],
    });
  });

  it("garage A can't read B's job even by its id, with a raw query", async () => {
    const rows = await withGarage(t.app.db, A.garage.id, (tx) =>
      tx.execute(sql`select * from jobs where id = ${B.job.id}`),
    );
    expect(rows.rows).toEqual([]);
  });

  it("garage A can't change or delete B's rows (they're invisible, so nothing matches)", async () => {
    const updated = await withGarage(t.app.db, A.garage.id, (tx) =>
      tx
        .update(customers)
        .set({ name: 'hacked' })
        .where(eq(customers.id, B.customer.id))
        .returning(),
    );
    expect(updated).toEqual([]);
    const deleted = await withGarage(t.app.db, A.garage.id, (tx) =>
      tx.delete(customers).where(eq(customers.id, B.customer.id)).returning(),
    );
    expect(deleted).toEqual([]);
    const [still] = await t.db.select().from(customers).where(eq(customers.id, B.customer.id));
    expect(still!.name).toBe('B Motors customer');
  });

  it("garage A can't insert rows for garage B, or add items to B's job", async () => {
    expect(
      await pgCode(
        withGarage(t.app.db, A.garage.id, (tx) =>
          tx.insert(customers).values({ garageId: B.garage.id, name: 'x' }),
        ),
      ),
    ).toBe(RLS_DENIED);
    expect(
      await pgCode(
        withGarage(t.app.db, A.garage.id, (tx) =>
          tx.insert(jobItems).values({ jobId: B.job.id, workType: 'brakes' }),
        ),
      ),
    ).toBe(RLS_DENIED);
  });

  it("garage A can't move its own job to garage B", async () => {
    expect(
      await pgCode(
        withGarage(t.app.db, A.garage.id, (tx) =>
          tx.update(jobs).set({ garageId: B.garage.id }).where(eq(jobs.id, A.job.id)),
        ),
      ),
    ).toBe(RLS_DENIED);
  });

  it('garage A can write its own rows', async () => {
    await withGarage(t.app.db, A.garage.id, async (tx) => {
      await tx.insert(customers).values({ garageId: A.garage.id, name: 'New customer' });
      await tx.insert(jobItems).values({ jobId: A.job.id, workType: 'tuning' });
    });
  });

  it('refuses a garage id that is not a UUID', () => {
    expect(() => withGarage(t.app.db, "x' or 1=1 --", async () => null)).toThrow(/not a garage id/);
  });
});

describe('no scope and system scope', () => {
  it('a query without a helper sees no garage rows at all', async () => {
    expect(await t.app.db.select().from(jobs)).toEqual([]);
    expect(await t.app.db.select().from(customers)).toEqual([]);
    expect(await t.app.db.select().from(jobItems)).toEqual([]);
  });

  it('withSystem sees every garage', async () => {
    const garageIds = await withSystem(t.app.db, async (tx) =>
      (await tx.select().from(jobs)).map((r) => r.garageId).sort(),
    );
    expect(garageIds).toEqual([A.garage.id, B.garage.id].sort());
  });

  it('shared tables (cars, plates) are visible to every garage', async () => {
    const plates = await withGarage(t.app.db, A.garage.id, (tx) =>
      tx.select().from(carRegistrations),
    );
    expect(plates.length).toBeGreaterThanOrEqual(2);
  });
});

describe('coverage', () => {
  it('every table holding garage data has row-level security switched on', async () => {
    // Any table with a garage_id or job_id column belongs to one garage.
    const result = await t.db.execute(sql`
      select distinct c.table_name
      from information_schema.columns c
      join pg_class cl on cl.relname = c.table_name and cl.relkind = 'r'
      join pg_namespace ns on ns.oid = cl.relnamespace and ns.nspname = 'public'
      where c.table_schema = 'public' and c.column_name in ('garage_id', 'job_id')
        and not cl.relrowsecurity
      order by 1`);
    expect(result.rows.map((r) => r.table_name)).toEqual([]);
  });
});

describe('pooled connections', () => {
  it("a garage setting doesn't leak to the next transaction on the same connection", async () => {
    // One connection only, so every query below reuses it.
    const appUrl = new URL(String(t.app.pool.options.connectionString));
    const single = createDb(appUrl.toString(), { max: 1, onError: () => {} });
    try {
      const pids = new Set<number>();
      const pid = async () =>
        pids.add(Number((await single.db.execute(sql`select pg_backend_pid() as p`)).rows[0]!.p));

      await withGarage(single.db, A.garage.id, async (tx) => {
        expect((await tx.select().from(jobs)).length).toBe(1);
      });
      await pid();
      expect(await single.db.select().from(jobs)).toEqual([]);

      await withSystem(single.db, async (tx) => {
        expect((await tx.select().from(jobs)).length).toBe(2);
      });
      await pid();
      expect(await single.db.select().from(jobs)).toEqual([]);

      // A failed transaction must not leave the setting behind either.
      await withGarage(single.db, A.garage.id, async () => {
        throw new Error('request failed');
      }).catch(() => {});
      await pid();
      expect(await single.db.select().from(jobs)).toEqual([]);

      expect(pids.size).toBe(1); // really the same connection every time
    } finally {
      await single.pool.end();
    }
  });
});
