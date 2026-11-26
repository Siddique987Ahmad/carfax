import { and, eq, isNull, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase } from '../testing/test-db';
import { jobInsertSchema, jobItemInsertSchema } from '../zod';
import { carRegistrations, cars } from './cars';
import { customers, garages } from './garages';
import { jobFlags, jobItems, jobPhotos, jobs, reminders } from './jobs';
import { users } from './users';

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

let n = 3000000;
async function setup() {
  const [owner] = await t.db
    .insert(users)
    .values({ phone: `+92302${n++}` })
    .returning();
  const [garage] = await t.db
    .insert(garages)
    .values({ ownerId: owner!.id, name: 'Ahmed Motors', city: 'Lahore' })
    .returning();
  const car = await t.db.transaction(async (tx) => {
    const [c] = await tx.insert(cars).values({ make: 'Toyota', model: 'Corolla' }).returning();
    await tx.insert(carRegistrations).values({ carId: c!.id, regNo: `LEA${n++}` });
    return c!;
  });
  const [customer] = await t.db
    .insert(customers)
    .values({ garageId: garage!.id, name: 'Bilal' })
    .returning();
  return { owner: owner!, garage: garage!, car, customer: customer! };
}

const job = (s: Awaited<ReturnType<typeof setup>>, extra: Partial<typeof jobs.$inferInsert> = {}) =>
  ({
    carId: s.car.id,
    garageId: s.garage.id,
    customerId: s.customer.id,
    createdBy: s.owner.id,
    regNo: 'LEA1234',
    serviceDate: '2026-11-20',
    odometerKm: 84250,
    deviceCreatedAt: new Date(),
    ...extra,
  }) satisfies typeof jobs.$inferInsert;

describe('jobs', () => {
  it('inserting the same job id twice fails, so a resend is recognised', async () => {
    const s = await setup();
    const id = crypto.randomUUID();
    await t.db.insert(jobs).values(job(s, { id }));
    expect(await pgCode(t.db.insert(jobs).values(job(s, { id })))).toBe('23505');
  });

  it('a job cannot point at a car or garage that does not exist', async () => {
    const s = await setup();
    expect(await pgCode(t.db.insert(jobs).values(job(s, { carId: crypto.randomUUID() })))).toBe(
      '23503',
    );
    expect(await pgCode(t.db.insert(jobs).values(job(s, { garageId: crypto.randomUUID() })))).toBe(
      '23503',
    );
  });

  it("a job cannot use another garage's customer", async () => {
    const a = await setup();
    const b = await setup();
    expect(await pgCode(t.db.insert(jobs).values(job(a, { customerId: b.customer.id })))).toBe(
      '23503',
    );
  });

  it('needs an odometer reading unless the odometer is marked not working', async () => {
    const s = await setup();
    expect(await pgCode(t.db.insert(jobs).values(job(s, { odometerKm: null })))).toBe('23514');
    await t.db.insert(jobs).values(job(s, { odometerKm: null, odometerNotWorking: true }));
    expect(await pgCode(t.db.insert(jobs).values(job(s, { odometerKm: -5 })))).toBe('23514');
  });

  it('stores the plate as it was, normalised', async () => {
    const s = await setup();
    expect(await pgCode(t.db.insert(jobs).values(job(s, { regNo: 'LEA-1234' })))).toBe('23514');
  });

  it('a new job is submitted and included in reports by default', async () => {
    const s = await setup();
    const [row] = await t.db.insert(jobs).values(job(s)).returning();
    expect(row!.status).toBe('submitted');
    expect(row!.excludedFromReports).toBe(false);
  });

  it('the car timeline query uses jobs_car_date', async () => {
    const s = await setup();
    const text = await t.db.transaction(async (tx) => {
      await tx.execute(sql`set local enable_seqscan = off`);
      const plan = await tx.execute(
        sql`explain select * from jobs where car_id = ${s.car.id} order by service_date`,
      );
      return plan.rows.map((r) => Object.values(r)[0]).join('\n');
    });
    expect(text).toContain('jobs_car_date');
  });
});

describe('work items and photos', () => {
  it('work items need a work type code and non-negative prices', async () => {
    const s = await setup();
    const [j] = await t.db.insert(jobs).values(job(s)).returning();
    await t.db.insert(jobItems).values({ jobId: j!.id, workType: 'tuning', labourPricePkr: 1500 });
    expect(
      await pgCode(t.db.insert(jobItems).values({ jobId: j!.id, workType: 'Oil Change' })),
    ).toBe('23514');
    expect(
      await pgCode(
        t.db.insert(jobItems).values({ jobId: j!.id, workType: 'brakes', partPricePkr: -1 }),
      ),
    ).toBe('23514');
  });

  it('a photo can sync before its file uploads, but uploaded means it has a storage key', async () => {
    const s = await setup();
    const [j] = await t.db.insert(jobs).values(job(s)).returning();
    await t.db
      .insert(jobPhotos)
      .values({ jobId: j!.id, kind: 'odometer', takenAt: new Date(), lat: 31.52, lng: 74.35 });
    expect(
      await pgCode(
        t.db
          .insert(jobPhotos)
          .values({ jobId: j!.id, kind: 'odometer', takenAt: new Date(), uploadedAt: new Date() }),
      ),
    ).toBe('23514');
  });
});

describe('flags', () => {
  it('a second open MILEAGE_DROP flag on a job is refused; after resolving, a new one is allowed', async () => {
    const s = await setup();
    const [j] = await t.db.insert(jobs).values(job(s)).returning();
    await t.db.insert(jobFlags).values({ jobId: j!.id, code: 'MILEAGE_DROP' });
    expect(await pgCode(t.db.insert(jobFlags).values({ jobId: j!.id, code: 'MILEAGE_DROP' }))).toBe(
      '23505',
    );
    await t.db
      .update(jobFlags)
      .set({ resolvedAt: new Date() })
      .where(and(eq(jobFlags.jobId, j!.id), isNull(jobFlags.resolvedAt)));
    await t.db.insert(jobFlags).values({ jobId: j!.id, code: 'MILEAGE_DROP' });
    // A different code is independent.
    await t.db.insert(jobFlags).values({ jobId: j!.id, code: 'NO_PHOTO' });
  });
});

describe('reminders', () => {
  it('a reminder links the source job and, later, the job the customer came back for', async () => {
    const s = await setup();
    const [first] = await t.db.insert(jobs).values(job(s)).returning();
    const [r] = await t.db
      .insert(reminders)
      .values({
        garageId: s.garage.id,
        carId: s.car.id,
        customerId: s.customer.id,
        sourceJobId: first!.id,
        kind: 'oil_change',
        dueDate: '2027-02-20',
      })
      .returning();
    const [back] = await t.db
      .insert(jobs)
      .values(job(s, { serviceDate: '2027-02-25' }))
      .returning();
    await t.db
      .update(reminders)
      .set({ status: 'sent', sentAt: new Date(), returnedJobId: back!.id })
      .where(eq(reminders.id, r!.id));
  });

  it("refuses another garage's customer, and 'sent' without a time", async () => {
    const a = await setup();
    const b = await setup();
    const base = {
      garageId: a.garage.id,
      carId: a.car.id,
      kind: 'oil_change',
      dueDate: '2027-01-01',
    };
    expect(
      await pgCode(t.db.insert(reminders).values({ ...base, customerId: b.customer.id })),
    ).toBe('23503');
    expect(await pgCode(t.db.insert(reminders).values({ ...base, status: 'sent' }))).toBe('23514');
  });
});

describe('Zod schemas for jobs', () => {
  const base = {
    carId: crypto.randomUUID(),
    garageId: crypto.randomUUID(),
    createdBy: crypto.randomUUID(),
    serviceDate: '2026-11-20',
    deviceCreatedAt: new Date(),
  };

  it('normalises the plate and needs a reading unless the odometer is not working', () => {
    expect(jobInsertSchema.parse({ ...base, regNo: 'lea-1234', odometerKm: 1 }).regNo).toBe(
      'LEA1234',
    );
    expect(jobInsertSchema.safeParse(base).success).toBe(false);
    expect(jobInsertSchema.safeParse({ ...base, odometerNotWorking: true }).success).toBe(true);
  });

  it('work items accept only known work types, including tuning', () => {
    const jobId = crypto.randomUUID();
    expect(jobItemInsertSchema.safeParse({ jobId, workType: 'tuning' }).success).toBe(true);
    expect(jobItemInsertSchema.safeParse({ jobId, workType: 'car_wash' }).success).toBe(false);
  });
});
