import { and, eq, isNull, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase } from '../testing/test-db';
import { carInsertSchema, carRegistrationInsertSchema } from '../zod';
import { carAliases, carRegistrations, cars } from './cars';

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

/** A car with a current plate, created in one transaction as the API will do. */
async function carWithPlate(regNo: string, extra: Partial<typeof cars.$inferInsert> = {}) {
  return t.db.transaction(async (tx) => {
    const [car] = await tx.insert(cars).values(extra).returning();
    await tx.insert(carRegistrations).values({ carId: car!.id, regNo });
    return car!;
  });
}

const currentPlate = (regNo: string) =>
  t.db
    .select()
    .from(carRegistrations)
    .where(and(eq(carRegistrations.regNo, regNo), isNull(carRegistrations.validTo)));

describe('cars', () => {
  it('a car with neither a chassis number nor a plate is refused (at commit)', async () => {
    expect(await pgCode(t.db.insert(cars).values({ make: 'Toyota' }))).toBe('23514');
  });

  it('a car with only a plate, or only a chassis number, is accepted', async () => {
    await carWithPlate('LEA1001');
    await t.db.insert(cars).values({ chassisNo: 'NZE1610000001' });
    await t.db.insert(cars).values({ chassisNo: 'NZE1610000002' });
  });

  it('removing a car’s only plate is refused', async () => {
    const car = await carWithPlate('LEA1002');
    expect(
      await pgCode(t.db.delete(carRegistrations).where(eq(carRegistrations.carId, car.id))),
    ).toBe('23514');
  });

  it('a car with an id made on the phone is accepted', async () => {
    const id = crypto.randomUUID();
    const car = await carWithPlate('LEA1003', { id });
    expect(car.id).toBe(id);
  });

  it('chassis numbers are unique and must be normalised', async () => {
    await t.db.insert(cars).values({ chassisNo: 'ZRE1720000003' });
    expect(await pgCode(t.db.insert(cars).values({ chassisNo: 'ZRE1720000003' }))).toBe('23505');
    expect(await pgCode(t.db.insert(cars).values({ chassisNo: 'zre172-0000004' }))).toBe('23514');
  });

  it('refuses an impossible year', async () => {
    expect(await pgCode(t.db.insert(cars).values({ chassisNo: 'ZRE1720000005', year: 1890 }))).toBe(
      '23514',
    );
  });

  it('a car can be merged into another, but not into itself', async () => {
    const kept = await carWithPlate('LEA1005');
    const dup = await carWithPlate('LEA1050');
    await t.db.update(cars).set({ mergedIntoId: kept.id }).where(eq(cars.id, dup.id));
    expect(
      await pgCode(t.db.update(cars).set({ mergedIntoId: kept.id }).where(eq(cars.id, kept.id))),
    ).toBe('23514');
  });
});

describe('plate history', () => {
  it.each([['LEA-1006'], ['lea1006'], ['LEA 1006'], ['1234'], ['LEA']])(
    'refuses a plate that was not normalised: %s',
    async (regNo) => {
      const [car] = await t.db
        .insert(cars)
        .values({ chassisNo: `CHK${Date.now()}` })
        .returning();
      expect(await pgCode(t.db.insert(carRegistrations).values({ carId: car!.id, regNo }))).toBe(
        '23514',
      );
    },
  );

  it('a plate can be current on only one car at a time', async () => {
    await carWithPlate('LEA1007');
    expect(await pgCode(carWithPlate('LEA1007'))).toBe('23505');
  });

  it('a car has only one current plate', async () => {
    const car = await carWithPlate('LEA1008');
    expect(
      await pgCode(t.db.insert(carRegistrations).values({ carId: car.id, regNo: 'LEB2008' })),
    ).toBe('23505');
  });

  it('a plate moves to another car: the old car keeps it in its history', async () => {
    // Ahmed sells his Corolla and moves plate LEA-1234 to his new Civic (Punjab, since Sept 2025).
    const corolla = await carWithPlate('LEA1234', { make: 'Toyota', model: 'Corolla' });
    const civic = await t.db.transaction(async (tx) => {
      await tx
        .update(carRegistrations)
        .set({ validTo: new Date(), endedReason: 'plate_moved' })
        .where(and(eq(carRegistrations.carId, corolla.id), isNull(carRegistrations.validTo)));
      await tx.insert(carRegistrations).values({ carId: corolla.id, regNo: 'LEC5678' });
      const [car] = await tx.insert(cars).values({ make: 'Honda', model: 'Civic' }).returning();
      await tx.insert(carRegistrations).values({ carId: car!.id, regNo: 'LEA1234' });
      return car!;
    });

    const [now] = await currentPlate('LEA1234');
    expect(now!.carId).toBe(civic.id);
    const corollaPlates = await t.db
      .select()
      .from(carRegistrations)
      .where(eq(carRegistrations.carId, corolla.id));
    expect(corollaPlates.map((r) => [r.regNo, r.endedReason]).sort()).toEqual([
      ['LEA1234', 'plate_moved'],
      ['LEC5678', null],
    ]);
  });

  it('an ended plate must say why, and a current one must not', async () => {
    const car = await carWithPlate('LEA1009');
    expect(
      await pgCode(
        t.db
          .update(carRegistrations)
          .set({ validTo: new Date() })
          .where(eq(carRegistrations.carId, car.id)),
      ),
    ).toBe('23514');
  });

  it('a partial plate search can use the trigram index', async () => {
    await t.db.execute(sql`
      with new_cars as (
        insert into cars (chassis_no) select 'TRGM' || i from generate_series(10000, 11000) as i
        returning id, chassis_no)
      insert into car_registrations (car_id, reg_no)
      select id, 'AB' || substr(chassis_no, 5) from new_cars`);
    await t.db.execute(sql`analyze car_registrations`);
    // With a small test table Postgres prefers reading every row, which is cheaper at this size.
    // Switching table scans off for this one query shows the index can serve the search.
    const text = await t.db.transaction(async (tx) => {
      await tx.execute(sql`set local enable_seqscan = off`);
      const plan = await tx.execute(
        sql`explain select car_id from car_registrations where reg_no ilike ${'%B1023%'}`,
      );
      return plan.rows.map((r) => Object.values(r)[0]).join('\n');
    });
    expect(text).toContain('car_registrations_reg_no_trgm');
  });
});

describe('car aliases', () => {
  it('a phone-made id can point to the car that was kept', async () => {
    const car = await carWithPlate('LEA1010');
    const phoneId = crypto.randomUUID();
    await t.db.insert(carAliases).values({ aliasId: phoneId, carId: car.id });
    const [alias] = await t.db.select().from(carAliases).where(eq(carAliases.aliasId, phoneId));
    expect(alias!.carId).toBe(car.id);
  });

  it('refuses an alias to an unknown car, or to itself', async () => {
    expect(
      await pgCode(
        t.db
          .insert(carAliases)
          .values({ aliasId: crypto.randomUUID(), carId: crypto.randomUUID() }),
      ),
    ).toBe('23503');
    const car = await carWithPlate('LEA1011');
    expect(await pgCode(t.db.insert(carAliases).values({ aliasId: car.id, carId: car.id }))).toBe(
      '23514',
    );
  });
});

describe('Zod schemas for cars and plates', () => {
  it('normalises any plate and chassis spelling', () => {
    expect(carInsertSchema.parse({ chassisNo: 'nze161-0123456' })).toMatchObject({
      chassisNo: 'NZE1610123456',
    });
    expect(
      carRegistrationInsertSchema.parse({ carId: crypto.randomUUID(), regNo: 'lea-1234' }),
    ).toMatchObject({ regNo: 'LEA1234' });
  });

  it('rejects text that is not a plate', () => {
    expect(
      carRegistrationInsertSchema.safeParse({ carId: crypto.randomUUID(), regNo: 'hello' }).success,
    ).toBe(false);
  });
});
