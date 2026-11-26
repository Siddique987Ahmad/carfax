import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase } from '../testing/test-db';
import { carInsertSchema } from '../zod';
import { carAliases, cars } from './cars';

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

describe('cars', () => {
  it('a car with neither a plate nor a chassis number is refused', async () => {
    expect(await pgCode(t.db.insert(cars).values({ make: 'Toyota' }))).toBe('23514');
  });

  it('a car with an id made on the phone is accepted', async () => {
    const id = crypto.randomUUID();
    const [car] = await t.db.insert(cars).values({ id, regNo: 'LEA1001' }).returning();
    expect(car!.id).toBe(id);
  });

  it('a chassis number alone is enough, and several cars can have no plate', async () => {
    await t.db.insert(cars).values({ chassisNo: 'NZE1610000001' });
    await t.db.insert(cars).values({ chassisNo: 'NZE1610000002' });
  });

  it('plates and chassis numbers are unique', async () => {
    await t.db.insert(cars).values({ regNo: 'LEA1002' });
    expect(await pgCode(t.db.insert(cars).values({ regNo: 'LEA1002' }))).toBe('23505');
    await t.db.insert(cars).values({ chassisNo: 'ZRE1720000003' });
    expect(await pgCode(t.db.insert(cars).values({ chassisNo: 'ZRE1720000003' }))).toBe('23505');
  });

  it.each([['LEA-1003'], ['lea1003'], ['LEA 1003'], ['1234'], ['LEA']])(
    'refuses a plate that was not normalised: %s',
    async (regNo) => {
      expect(await pgCode(t.db.insert(cars).values({ regNo }))).toBe('23514');
    },
  );

  it('refuses an impossible year', async () => {
    expect(await pgCode(t.db.insert(cars).values({ regNo: 'LEA1004', year: 1890 }))).toBe('23514');
  });

  it('a car can be merged into another, but not into itself', async () => {
    const [kept] = await t.db.insert(cars).values({ regNo: 'LEA1005' }).returning();
    const [dup] = await t.db.insert(cars).values({ regNo: 'LEA1050' }).returning();
    await t.db.update(cars).set({ mergedIntoId: kept!.id }).where(eq(cars.id, dup!.id));
    expect(
      await pgCode(t.db.update(cars).set({ mergedIntoId: kept!.id }).where(eq(cars.id, kept!.id))),
    ).toBe('23514');
  });
});

describe('car aliases', () => {
  it('a phone-made id can point to the car that was kept', async () => {
    const [car] = await t.db.insert(cars).values({ regNo: 'LEA1006' }).returning();
    const phoneId = crypto.randomUUID();
    await t.db.insert(carAliases).values({ aliasId: phoneId, carId: car!.id });
    const [alias] = await t.db.select().from(carAliases).where(eq(carAliases.aliasId, phoneId));
    expect(alias!.carId).toBe(car!.id);
  });

  it('refuses an alias to an unknown car, or to itself', async () => {
    expect(
      await pgCode(
        t.db
          .insert(carAliases)
          .values({ aliasId: crypto.randomUUID(), carId: crypto.randomUUID() }),
      ),
    ).toBe('23503');
    const [car] = await t.db.insert(cars).values({ regNo: 'LEA1007' }).returning();
    expect(await pgCode(t.db.insert(carAliases).values({ aliasId: car!.id, carId: car!.id }))).toBe(
      '23514',
    );
  });
});

describe('plate search', () => {
  it('a partial plate search can use the trigram index', async () => {
    await t.db.execute(sql`
      insert into cars (reg_no)
      select chr(65 + (i % 26)) || chr(65 + ((i / 26) % 26)) || 'X' || i
      from generate_series(10000, 11000) as i`);
    await t.db.execute(sql`analyze cars`);
    // With a small test table Postgres prefers reading every row, which is cheaper at this size.
    // Switching table scans off for this one query shows the index can serve the search,
    // which is what it will choose once there are real numbers of cars.
    const text = await t.db.transaction(async (tx) => {
      await tx.execute(sql`set local enable_seqscan = off`);
      const plan = await tx.execute(
        sql`explain select id from cars where reg_no ilike ${'%X1023%'}`,
      );
      return plan.rows.map((r) => Object.values(r)[0]).join('\n');
    });
    expect(text).toContain('cars_reg_no_trgm');
  });
});

describe('Zod schema for cars', () => {
  it('normalises any plate and chassis spelling', () => {
    expect(carInsertSchema.parse({ regNo: 'lea-1234', chassisNo: 'nze161-0123456' })).toMatchObject(
      {
        regNo: 'LEA1234',
        chassisNo: 'NZE1610123456',
      },
    );
  });

  it('needs a plate or a chassis number', () => {
    expect(carInsertSchema.safeParse({ make: 'Toyota' }).success).toBe(false);
    expect(carInsertSchema.safeParse({ chassisNo: 'NZE1610123456' }).success).toBe(true);
  });

  it('rejects text that is not a plate', () => {
    expect(carInsertSchema.safeParse({ regNo: 'hello' }).success).toBe(false);
  });
});
