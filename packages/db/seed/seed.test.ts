import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { carRegistrations } from '../src/schema/cars';
import { jobs } from '../src/schema/jobs';
import { createTestDatabase } from '../src/testing/test-db';
import { buildDemoSeed, DEMO_PLATES, seedDemo } from './demo';
import { buildDevSeed, seedDev } from './dev';
import { assertSafeTarget } from './guard';

const today = new Date('2026-11-27T00:00:00Z');

describe('production guard', () => {
  const env = {} as NodeJS.ProcessEnv;
  it.each([
    ['postgres://u:p@localhost/carfax_production'],
    ['postgres://u:p@localhost/prod'],
    ['postgres://u:p@prod-db.example.com/carfax'],
  ])('refuses %s', (url) => {
    expect(() => assertSafeTarget(url, { env: { ...env, SEED_ALLOW_REMOTE: 'true' } })).toThrow(
      /production/,
    );
  });

  it('refuses when NODE_ENV is production, even locally', () => {
    expect(() =>
      assertSafeTarget('postgres://u:p@localhost/carfax', { env: { NODE_ENV: 'production' } }),
    ).toThrow(/production/);
  });

  it('needs SEED_ALLOW_REMOTE for a database on another machine, and never resets one', () => {
    const staging = 'postgres://u:p@staging-db.example.com/carfax';
    expect(() => assertSafeTarget(staging, { env })).toThrow(/SEED_ALLOW_REMOTE/);
    expect(() => assertSafeTarget(staging, { env: { SEED_ALLOW_REMOTE: 'true' } })).not.toThrow();
    expect(() =>
      assertSafeTarget(staging, { reset: true, env: { SEED_ALLOW_REMOTE: 'true' } }),
    ).toThrow(/local only/);
  });

  it('allows the local database', () => {
    expect(() =>
      assertSafeTarget('postgres://carfax:carfax@localhost:5432/carfax', { reset: true, env }),
    ).not.toThrow();
  });
});

describe('dev seed', () => {
  it('builds the same data every time, ids included', () => {
    expect(JSON.stringify(buildDevSeed(today).rows)).toBe(JSON.stringify(buildDevSeed(today).rows));
  });

  describe('in a database', () => {
    let t: Awaited<ReturnType<typeof createTestDatabase>>;
    beforeAll(async () => {
      t = await createTestDatabase({ migrated: true });
      await seedDev(t.db, today);
    });
    afterAll(async () => {
      await t?.drop();
    });

    const count = async (query: ReturnType<typeof sql>) =>
      Number((await t.db.execute(query)).rows[0]!.n);

    it('has the planned size: 8 garages, ~300 cars, ~2,000 jobs over 18 months', async () => {
      expect(await count(sql`select count(*) n from garages`)).toBe(8);
      expect(await count(sql`select count(*) n from cars`)).toBeGreaterThanOrEqual(300);
      const jobCount = await count(sql`select count(*) n from jobs`);
      expect(jobCount).toBeGreaterThan(1800);
      expect(jobCount).toBeLessThan(2300);
      expect(
        await count(sql`select (max(service_date) - min(service_date)) n from jobs`),
      ).toBeGreaterThan(450);
    });

    it('fills every admin queue', async () => {
      expect(
        await count(sql`select count(*) n from garages where status = 'pending'`),
      ).toBeGreaterThan(0);
      expect(
        await count(sql`select count(*) n from garages where status = 'suspended'`),
      ).toBeGreaterThan(0);
      const flagged = await count(sql`select count(*) n from jobs where status = 'flagged'`);
      const total = await count(sql`select count(*) n from jobs`);
      expect(flagged / total).toBeGreaterThan(0.03);
      expect(flagged / total).toBeLessThan(0.08);
      for (const code of ['MILEAGE_DROP', 'NO_PHOTO', 'OCR_MISMATCH', 'MANY_JOBS_SHORT_TIME']) {
        expect(
          await count(sql`select count(*) n from job_flags where code = ${code}`),
        ).toBeGreaterThan(0);
      }
      // Duplicate cars: same make, model and year, plates differing only by two swapped last digits.
      expect(
        await count(sql`
          select count(*) n from car_registrations a join car_registrations b
            on a.car_id <> b.car_id and a.reg_no < b.reg_no
           and left(a.reg_no, -2) = left(b.reg_no, -2)
           and right(a.reg_no, 2) = reverse(right(b.reg_no, 2))`),
      ).toBeGreaterThan(0);
    });

    it('includes a plate that moved to another car, and broken odometers', async () => {
      expect(
        await count(
          sql`select count(*) n from car_registrations where ended_reason = 'plate_moved'`,
        ),
      ).toBe(1);
      expect(
        await count(sql`select count(*) n from jobs where odometer_not_working`),
      ).toBeGreaterThan(0);
    });

    it('a rollback car really has a lower reading after a higher one', async () => {
      const [flag] = (
        await t.db.execute(
          sql`select j.car_id from job_flags f join jobs j on j.id = f.job_id where f.code = 'MILEAGE_DROP' limit 1`,
        )
      ).rows;
      const readings = (
        await t.db
          .select({ km: jobs.odometerKm })
          .from(jobs)
          .where(eq(jobs.carId, String(flag!.car_id)))
          .orderBy(jobs.serviceDate)
      ).map((r) => r.km ?? 0);
      expect(readings.some((km, i) => i > 0 && km < readings[i - 1]!)).toBe(true);
    });

    it('only some reminded customers come back', async () => {
      const sent = await count(sql`select count(*) n from reminders where status = 'sent'`);
      const back = await count(
        sql`select count(*) n from reminders where returned_job_id is not null`,
      );
      expect(back / sent).toBeGreaterThan(0.1);
      expect(back / sent).toBeLessThan(0.8);
    });
  });
});

describe('demo seed', () => {
  let t: Awaited<ReturnType<typeof createTestDatabase>>;
  beforeAll(async () => {
    t = await createTestDatabase({ migrated: true });
    await seedDemo(t.db, today);
  });
  afterAll(async () => {
    await t?.drop();
  });

  it('has the three car stories', async () => {
    const plates = (
      await t.db.select({ regNo: carRegistrations.regNo }).from(carRegistrations)
    ).map((r) => r.regNo);
    expect(plates.sort()).toEqual(Object.values(DEMO_PLATES).sort());
  });

  it('the rollback car drops from 92,400 to 61,300 km', async () => {
    const readings = (
      await t.db.execute(sql`
        select j.odometer_km km from jobs j join car_registrations r on r.car_id = j.car_id
        where r.reg_no = ${DEMO_PLATES.rollback} order by j.service_date`)
    ).rows.map((r) => Number(r.km));
    expect(readings.slice(-2)).toEqual([92_400, 61_300]);
  });

  it('the accident car has body work with before and after photos', async () => {
    const kinds = (
      await t.db.execute(sql`
        select distinct p.kind from job_photos p join jobs j on j.id = p.job_id
        join car_registrations r on r.car_id = j.car_id where r.reg_no = ${DEMO_PLATES.accident}`)
    ).rows.map((r) => r.kind);
    expect(kinds.sort()).toEqual(['after', 'before', 'odometer']);
  });

  it('builds the same data every time', () => {
    expect(JSON.stringify(buildDemoSeed(today))).toBe(JSON.stringify(buildDemoSeed(today)));
  });
});
