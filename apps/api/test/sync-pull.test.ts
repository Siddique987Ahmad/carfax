import { randomUUID } from 'node:crypto';
import { schema } from '@carfax/db';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PULL_OVERLAP_MS, PULL_PAGE_SIZE } from '../src/sync/sync-pull.service';
import { createGarage, createUser, nextPhone, nextPlate } from './factories';
import { startTestApp, type TestApp } from './harness';

type Http = Awaited<ReturnType<TestApp['asUser']>>['http'];
let t: TestApp;
let A: Awaited<ReturnType<typeof createGarage>>;
let owner: Http; // phone 1 in garage A
let mechanic: Http; // phone 2 in garage A
let mechanicId: string;
let other: Http; // garage B
beforeAll(async () => {
  t = await startTestApp();
  A = await createGarage(t.db, { name: 'A Motors' });
  owner = (await t.asUser(A.owner.phone)).http;
  const m = await createUser(t.db, { name: 'Usman' });
  mechanicId = m.id;
  await t.db
    .insert(schema.garageMembers)
    .values({ garageId: A.garage.id, userId: m.id, role: 'mechanic' });
  mechanic = (await t.asUser(m.phone)).http;
  other = (await t.asUser((await createGarage(t.db, { name: 'B Motors' })).owner.phone)).http;
});
afterAll(async () => {
  await t?.close();
});

/** Pushes one visit: car, customer, job with a priced item, photo. */
async function push(http: Http, opts: { plate?: string } = {}) {
  const ids = {
    car: randomUUID(),
    customer: randomUUID(),
    job: randomUUID(),
    item: randomUUID(),
    photo: randomUUID(),
  };
  await http
    .post('/v1/sync/push')
    .send({
      changes: {
        cars: {
          created: [
            { id: ids.car, reg_no: opts.plate ?? nextPlate(), make: 'Toyota', model: 'Corolla' },
          ],
        },
        customers: { created: [{ id: ids.customer, name: 'Bilal', phone: nextPhone() }] },
        jobs: {
          created: [
            {
              id: ids.job,
              car_id: ids.car,
              customer_id: ids.customer,
              service_date: '2026-11-20',
              odometer_km: 50_000,
              device_created_at: Date.now(),
            },
          ],
        },
        job_items: {
          created: [
            {
              id: ids.item,
              job_id: ids.job,
              work_type: 'oil_change',
              part_price_pkr: 7800,
              labour_price_pkr: 700,
            },
          ],
        },
        job_photos: {
          created: [{ id: ids.photo, job_id: ids.job, kind: 'odometer', taken_at: Date.now() }],
        },
      },
    })
    .expect(200);
  return ids;
}

/** Pulls every page and merges them, as the app does. */
async function pullAll(http: Http, lastPulledAt?: number) {
  const merged: Record<string, { updated: Record<string, unknown>[]; deleted: string[] }> = {};
  let cursor: string | undefined;
  let pages = 0;
  let timestamp: number;
  do {
    const res = await http
      .get('/v1/sync/pull')
      .query({
        ...(lastPulledAt !== undefined && { last_pulled_at: lastPulledAt }),
        ...(cursor && { cursor }),
      })
      .expect(200);
    pages++;
    timestamp = res.body.timestamp;
    for (const [table, c] of Object.entries(res.body.changes) as [
      string,
      { created: unknown[]; updated: Record<string, unknown>[]; deleted: string[] },
    ][]) {
      expect(c.created).toEqual([]);
      merged[table] ??= { updated: [], deleted: [] };
      merged[table].updated.push(...c.updated);
      merged[table].deleted.push(...c.deleted);
    }
    cursor = res.body.hasMore ? res.body.cursor : undefined;
  } while (cursor);
  const ids = (table: string) => merged[table]?.updated.map((r) => r.id) ?? [];
  const find = (table: string, id: string) => merged[table]?.updated.find((r) => r.id === id);
  return { merged, ids, find, timestamp, pages };
}

describe('two phones in one garage', () => {
  it("each sees the other's jobs, with their car, customer, items and photos", async () => {
    const fromOwner = await push(owner);
    const fromMechanic = await push(mechanic);
    const onMechanic = await pullAll(mechanic);
    const onOwner = await pullAll(owner);
    for (const pulled of [onMechanic, onOwner]) {
      expect(pulled.ids('jobs')).toEqual(expect.arrayContaining([fromOwner.job, fromMechanic.job]));
      expect(pulled.ids('cars')).toEqual(expect.arrayContaining([fromOwner.car, fromMechanic.car]));
      expect(pulled.ids('customers')).toEqual(
        expect.arrayContaining([fromOwner.customer, fromMechanic.customer]),
      );
      expect(pulled.ids('job_items')).toEqual(
        expect.arrayContaining([fromOwner.item, fromMechanic.item]),
      );
      expect(pulled.ids('job_photos')).toEqual(
        expect.arrayContaining([fromOwner.photo, fromMechanic.photo]),
      );
    }
    expect(onMechanic.find('jobs', fromOwner.job)).toMatchObject({
      car_id: fromOwner.car,
      service_date: '2026-11-20',
      odometer_km: 50_000,
      status: 'submitted',
    });
    expect(onMechanic.find('cars', fromOwner.car)).toMatchObject({
      make: 'Toyota',
      model: 'Corolla',
    });
    // Times are numbers (ms), as WatermelonDB needs, not strings (found in api/08b).
    const job = onMechanic.find('jobs', fromOwner.job)!;
    expect(typeof job.device_created_at).toBe('number');
    expect(typeof job.synced_at).toBe('number');
    expect(typeof onMechanic.find('job_photos', fromOwner.photo)!.taken_at).toBe('number');
  });

  it("a later pull brings only what changed (plus the overlap), including a colleague's new job on an old car", async () => {
    const first = await push(owner);
    const { timestamp } = await pullAll(mechanic);
    expect(timestamp).toBeLessThan(Date.now() - PULL_OVERLAP_MS + 5_000);
    // A colleague logs a new job on the same (old) car.
    const jobId = randomUUID();
    await owner
      .post('/v1/sync/push')
      .send({
        changes: {
          jobs: {
            created: [
              {
                id: jobId,
                car_id: first.car,
                service_date: '2026-11-21',
                odometer_km: 51_000,
                device_created_at: Date.now(),
              },
            ],
          },
          job_items: { created: [{ id: randomUUID(), job_id: jobId, work_type: 'tuning' }] },
        },
      })
      .expect(200);
    const next = await pullAll(mechanic, timestamp);
    expect(next.ids('jobs')).toContain(jobId);
    expect(next.ids('cars')).toContain(first.car);
  });
});

describe('review results and other updates', () => {
  it('an admin approval shows up on the phone after the next pull', async () => {
    const { job } = await push(owner);
    const { timestamp } = await pullAll(mechanic);
    await t.db.update(schema.jobs).set({ status: 'approved' }).where(eq(schema.jobs.id, job));
    const next = await pullAll(mechanic, timestamp);
    expect(next.find('jobs', job)).toMatchObject({ status: 'approved' });
  });

  it('a deleted customer appears in `deleted`', async () => {
    const { customer } = await push(owner);
    const { timestamp } = await pullAll(mechanic);
    await owner
      .post('/v1/sync/push')
      .send({ changes: { customers: { deleted: [customer] } } })
      .expect(200);
    const next = await pullAll(mechanic, timestamp);
    expect(next.merged.customers!.deleted).toContain(customer);
  });

  it('a car that moved to a new plate comes with the new plate; a merged car is deleted', async () => {
    const plate = nextPlate();
    const { car } = await push(owner, { plate });
    const { timestamp } = await pullAll(mechanic);
    const newPlate = nextPlate();
    await t.db
      .update(schema.carRegistrations)
      .set({ validTo: new Date(), endedReason: 'correction' })
      .where(eq(schema.carRegistrations.carId, car));
    await t.db.insert(schema.carRegistrations).values({ carId: car, regNo: newPlate });
    const next = await pullAll(mechanic, timestamp);
    expect(next.find('cars', car)).toMatchObject({ reg_no: newPlate });

    const kept = await push(owner);
    await t.db.update(schema.cars).set({ mergedIntoId: kept.car }).where(eq(schema.cars.id, car));
    const afterMerge = await pullAll(mechanic, next.timestamp);
    expect(afterMerge.merged.cars!.deleted).toContain(car);
  });

  it('a first sync gets no deletions, only what exists', async () => {
    const first = await pullAll(owner);
    for (const table of Object.values(first.merged)) expect(table.deleted).toEqual([]);
  });
});

describe('privacy', () => {
  it("a pull never returns another garage's data", async () => {
    const theirs = await push(other);
    const mine = await pullAll(owner);
    for (const [table, id] of [
      ['jobs', theirs.job],
      ['cars', theirs.car],
      ['customers', theirs.customer],
      ['job_items', theirs.item],
      ['job_photos', theirs.photo],
    ] as const) {
      expect(mine.ids(table)).not.toContain(id);
    }
  });

  it("a mechanic sees prices on their own jobs, not on the owner's; the owner sees all", async () => {
    const byOwner = await push(owner);
    const byMechanic = await push(mechanic);
    const asMechanic = await pullAll(mechanic);
    expect(asMechanic.find('job_items', byOwner.item)).toMatchObject({
      part_price_pkr: null,
      labour_price_pkr: null,
    });
    expect(asMechanic.find('jobs', byOwner.job)).toMatchObject({ total_pkr: null });
    expect(asMechanic.find('job_items', byMechanic.item)).toMatchObject({ part_price_pkr: 7800 });
    const asOwner = await pullAll(owner);
    expect(asOwner.find('jobs', byMechanic.job)).toMatchObject({
      total_pkr: 8500,
      created_by: mechanicId,
    });
  });

  it('a pull needs a garage member', async () => {
    await t.http.get('/v1/sync/pull').expect(401);
    const outsider = (await t.asUser((await createUser(t.db)).phone)).http;
    await outsider.get('/v1/sync/pull').expect(403);
  });

  it('a made-up cursor is refused', async () => {
    const res = await owner.get('/v1/sync/pull').query({ cursor: 'not-a-cursor' }).expect(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });
});

describe('a big first sync', () => {
  it('5,000 jobs with their items come in a few pages, none missing or repeated', async () => {
    const G = await createGarage(t.db, { name: 'Busy Motors' });
    const http = (await t.asUser(G.owner.phone)).http;
    const { car } = await push(http);
    // 5,000 jobs and 5,000 items, written straight to the database.
    await t.db.execute(sql`
      insert into jobs (id, car_id, garage_id, created_by, service_date, odometer_km, device_created_at, status)
      select gen_random_uuid(), ${car}, ${G.garage.id}, ${G.owner.id}, date '2026-01-01' + (i % 300), 10000 + i, now(), 'approved'
      from generate_series(1, 5000) as i`);
    await t.db.execute(sql`
      insert into job_items (job_id, work_type, labour_price_pkr)
      select id, 'oil_change', 500 from jobs where garage_id = ${G.garage.id} and odometer_km between 10001 and 15000`);
    const started = Date.now();
    const pulled = await pullAll(http);
    const elapsed = Date.now() - started;
    const jobIds = pulled.ids('jobs');
    expect(jobIds).toHaveLength(5001);
    expect(new Set(jobIds).size).toBe(5001);
    expect(new Set(pulled.ids('job_items')).size).toBe(5001);
    expect(pulled.pages).toBeGreaterThan(5);
    expect(pulled.pages).toBeLessThanOrEqual(Math.ceil(10_010 / PULL_PAGE_SIZE) + 1);
    expect(elapsed).toBeLessThan(15_000);
  });
});
