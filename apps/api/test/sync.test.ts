import { randomUUID } from 'node:crypto';
import { schema } from '@carfax/db';
import { eq, inArray, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { StorageService } from '../src/storage/storage.module';
import { photoKey } from '../src/uploads/uploads.controller';
import { createGarage, nextPhone, nextPlate } from './factories';
import { startTestApp, type TestApp } from './harness';

let t: TestApp;
let A: Awaited<ReturnType<typeof createGarage>>;
let B: Awaited<ReturnType<typeof createGarage>>;
let httpA: Awaited<ReturnType<TestApp['asUser']>>['http'];
let httpB: Awaited<ReturnType<TestApp['asUser']>>['http'];
beforeAll(async () => {
  t = await startTestApp();
  A = await createGarage(t.db, { name: 'A Motors' });
  B = await createGarage(t.db, { name: 'B Motors' });
  httpA = (await t.asUser(A.owner.phone)).http;
  httpB = (await t.asUser(B.owner.phone)).http;
});
afterAll(async () => {
  await t?.close();
});

const empty = () => ({
  created: [] as unknown[],
  updated: [] as unknown[],
  deleted: [] as string[],
});

/** One offline visit as the app would push it: a new car, a customer, a job with two items and a photo. */
function visit(
  opts: { plate?: string; carId?: string; customerPhone?: string; date?: string; km?: number } = {},
) {
  const ids = {
    car: opts.carId ?? randomUUID(),
    customer: randomUUID(),
    job: randomUUID(),
    item1: randomUUID(),
    item2: randomUUID(),
    photo: randomUUID(),
  };
  const changes = {
    cars: {
      ...empty(),
      created: [
        {
          id: ids.car,
          reg_no: opts.plate ?? nextPlate(),
          make: 'toyota',
          model: 'corolla',
          year: 2016,
        },
      ],
    },
    customers: {
      ...empty(),
      created: [{ id: ids.customer, name: 'Bilal', phone: opts.customerPhone ?? nextPhone() }],
    },
    jobs: {
      ...empty(),
      created: [
        {
          id: ids.job,
          car_id: ids.car,
          customer_id: ids.customer,
          service_date:
            opts.date ?? new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' }),
          odometer_km: opts.km ?? 84_250,
          device_created_at: Date.now(),
          _status: 'created', // WatermelonDB's own fields are ignored
        },
      ],
    },
    job_items: {
      ...empty(),
      created: [
        {
          id: ids.item1,
          job_id: ids.job,
          work_type: 'oil_change',
          part_name: 'Oil + filter',
          part_price_pkr: 7800,
          labour_price_pkr: 700,
        },
        { id: ids.item2, job_id: ids.job, work_type: 'tuning', labour_price_pkr: 2000 },
      ],
    },
    job_photos: {
      ...empty(),
      created: [
        {
          id: ids.photo,
          job_id: ids.job,
          kind: 'odometer',
          taken_at: Date.now(),
          ocr_reading: 84_250,
          lat: 31.56,
          lng: 74.33,
        },
      ],
    },
  };
  return { ids, body: { changes, last_pulled_at: null } };
}

const counts = async () =>
  (
    await t.db.execute(sql`select
      (select count(*) from cars)::int as cars, (select count(*) from customers)::int as customers,
      (select count(*) from jobs)::int as jobs, (select count(*) from job_items)::int as items,
      (select count(*) from job_photos)::int as photos`)
  ).rows[0];

describe('a push', () => {
  it('saves the car, customer, job, items and photo, with the total worked out from the items', async () => {
    const { ids, body } = visit();
    const res = await httpA.post('/v1/sync/push').send(body).expect(200);
    expect(res.body).toEqual({
      ok: true,
      remaps: { cars: {}, customers: {} },
      rejected: [],
      warnings: [],
      newJobs: 1,
    });
    const [job] = await t.db.select().from(schema.jobs).where(eq(schema.jobs.id, ids.job));
    expect(job).toMatchObject({
      garageId: A.garage.id,
      carId: ids.car,
      customerId: ids.customer,
      createdBy: A.owner.id,
      status: 'submitted',
      totalPkr: 10_500,
      odometerKm: 84_250,
    });
    expect(job!.regNo).toBe(body.changes.cars.created[0]!.reg_no);
    const [car] = await t.db.select().from(schema.cars).where(eq(schema.cars.id, ids.car));
    expect(car).toMatchObject({ make: 'Toyota', model: 'Corolla' });
  });

  it('sending the same batch 3 times gives the same database state as sending it once', async () => {
    const { body } = visit();
    await httpA.post('/v1/sync/push').send(body).expect(200);
    const once = await counts();
    const again = await httpA.post('/v1/sync/push').send(body).expect(200);
    await httpA.post('/v1/sync/push').send(body).expect(200);
    expect(await counts()).toEqual(once);
    expect(again.body).toMatchObject({ newJobs: 0, rejected: [] });
  });

  it('the same batch sent twice at the same moment is saved once', async () => {
    const { ids, body } = visit();
    const results = await Promise.all([1, 2].map(() => httpA.post('/v1/sync/push').send(body)));
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(results.map((r) => r.body.newJobs).sort()).toEqual([0, 1]);
    expect(
      await t.db.select().from(schema.jobItems).where(eq(schema.jobItems.jobId, ids.job)),
    ).toHaveLength(2);
  });

  it('a malformed batch is refused as a whole with VALIDATION_FAILED, and nothing is saved', async () => {
    const { body } = visit();
    const before = await counts();
    (body.changes.job_items.created[1] as { work_type: string }).work_type = 'car_wash';
    const res = await httpA.post('/v1/sync/push').send(body).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.details[0].path).toContain('work_type');
    expect(await counts()).toEqual(before);
  });

  it('a batch that fails halfway leaves no partial rows', async () => {
    const { ids, body } = visit();
    // Make the database refuse this push's photo, the last thing saved, after the car, customer,
    // job and items were already written in the same transaction.
    await t.db.execute(
      sql.raw(
        `alter table job_photos add constraint test_refuse_photo check (id <> '${ids.photo}')`,
      ),
    );
    try {
      const before = await counts();
      const res = await httpA.post('/v1/sync/push').send(body).expect(500);
      expect(res.body.error.code).toBe('INTERNAL');
      expect(await counts()).toEqual(before);
    } finally {
      await t.db.execute(sql`alter table job_photos drop constraint test_refuse_photo`);
    }
    // Once the problem is gone, the same push goes through.
    await httpA.post('/v1/sync/push').send(body).expect(200);
  });

  it('refuses more than 50 jobs in one push', async () => {
    const { body } = visit();
    const job = body.changes.jobs.created[0]!;
    body.changes.jobs.created = Array.from({ length: 51 }, () => ({ ...job, id: randomUUID() }));
    await httpA.post('/v1/sync/push').send(body).expect(400);
  });
});

describe('cars and customers made on two phones', () => {
  it('an offline-created car that already exists is remapped, and its jobs land on the existing car', async () => {
    const plate = nextPlate();
    const first = visit({ plate });
    await httpA.post('/v1/sync/push').send(first.body).expect(200);
    const second = visit({ plate });
    const res = await httpB.post('/v1/sync/push').send(second.body).expect(200);
    expect(res.body.remaps.cars).toEqual({ [second.ids.car]: first.ids.car });
    const [job] = await t.db.select().from(schema.jobs).where(eq(schema.jobs.id, second.ids.job));
    expect(job!.carId).toBe(first.ids.car);
  });

  it('a job arriving later with the old phone car id still lands on the right car', async () => {
    const plate = nextPlate();
    const first = visit({ plate });
    await httpA.post('/v1/sync/push').send(first.body).expect(200);
    const second = visit({ plate });
    await httpB.post('/v1/sync/push').send(second.body).expect(200);
    const later = visit({ carId: second.ids.car });
    later.body.changes.cars.created = [];
    await httpB.post('/v1/sync/push').send(later.body).expect(200);
    const [job] = await t.db.select().from(schema.jobs).where(eq(schema.jobs.id, later.ids.job));
    expect(job!.carId).toBe(first.ids.car);
  });

  it('the same customer added on two phones of one garage becomes one customer', async () => {
    const phone = nextPhone();
    const one = visit({ customerPhone: phone });
    await httpA.post('/v1/sync/push').send(one.body).expect(200);
    const two = visit({ customerPhone: phone });
    const res = await httpA.post('/v1/sync/push').send(two.body).expect(200);
    expect(res.body.remaps.customers).toEqual({ [two.ids.customer]: one.ids.customer });
    const [job] = await t.db.select().from(schema.jobs).where(eq(schema.jobs.id, two.ids.job));
    expect(job!.customerId).toBe(one.ids.customer);
  });

  it("another garage's customer with the same phone is a separate customer", async () => {
    const phone = nextPhone();
    await httpA
      .post('/v1/sync/push')
      .send(visit({ customerPhone: phone }).body)
      .expect(200);
    const res = await httpB
      .post('/v1/sync/push')
      .send(visit({ customerPhone: phone }).body)
      .expect(200);
    expect(res.body.remaps.customers).toEqual({});
  });
});

describe('records refused for good, while the rest is saved', () => {
  it('editing or deleting a submitted job is refused (JOB_LOCKED)', async () => {
    const { ids, body } = visit();
    await httpA.post('/v1/sync/push').send(body).expect(200);
    const edit = {
      changes: {
        jobs: { updated: [{ ...body.changes.jobs.created[0], odometer_km: 10 }], deleted: [] },
        job_items: { deleted: [ids.item1] },
      },
    };
    const res = await httpA.post('/v1/sync/push').send(edit).expect(200);
    expect(res.body.rejected).toEqual([
      { table: 'jobs', id: ids.job, code: 'JOB_LOCKED' },
      { table: 'job_items', id: ids.item1, code: 'JOB_LOCKED' },
    ]);
    const [job] = await t.db.select().from(schema.jobs).where(eq(schema.jobs.id, ids.job));
    expect(job!.odometerKm).toBe(84_250);
  });

  it("a job id owned by another garage is refused, and the push's other jobs are saved", async () => {
    const theirs = visit();
    await httpB.post('/v1/sync/push').send(theirs.body).expect(200);
    const mine = visit();
    mine.body.changes.jobs.created.push({
      ...theirs.body.changes.jobs.created[0]!,
      car_id: mine.ids.car,
      customer_id: null,
    } as never);
    mine.body.changes.job_items.created.push({
      id: randomUUID(),
      job_id: theirs.ids.job,
      work_type: 'brakes',
    } as never);
    const res = await httpA.post('/v1/sync/push').send(mine.body).expect(200);
    expect(res.body.rejected).toEqual([
      { table: 'jobs', id: theirs.ids.job, code: 'JOB_CONFLICT' },
      expect.objectContaining({ table: 'job_items', code: 'PARENT_JOB_MISSING' }),
    ]);
    expect(res.body.newJobs).toBe(1);
    const [stillTheirs] = await t.db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, theirs.ids.job));
    expect(stillTheirs!.garageId).toBe(B.garage.id);
  });

  it('a future date, a job with no items, and an unknown car are refused one by one', async () => {
    const future = visit({ date: '2099-01-01' });
    const noItems = visit();
    noItems.body.changes.job_items.created = [];
    const unknownCar = visit();
    unknownCar.body.changes.cars.created = [];
    const body = {
      changes: {
        cars: {
          created: [...future.body.changes.cars.created, ...noItems.body.changes.cars.created],
        },
        jobs: {
          created: [
            ...future.body.changes.jobs.created,
            ...noItems.body.changes.jobs.created,
            ...unknownCar.body.changes.jobs.created,
          ],
        },
        job_items: {
          created: [
            ...future.body.changes.job_items.created,
            ...unknownCar.body.changes.job_items.created,
          ],
        },
      },
    };
    const res = await httpA.post('/v1/sync/push').send(body).expect(200);
    expect(res.body.rejected.filter((r: { table: string }) => r.table === 'jobs')).toEqual([
      { table: 'jobs', id: future.ids.job, code: 'JOB_FUTURE_DATE' },
      { table: 'jobs', id: noItems.ids.job, code: 'JOB_NO_ITEMS' },
      { table: 'jobs', id: unknownCar.ids.job, code: 'JOB_UNKNOWN_CAR' },
    ]);
    expect(res.body.newJobs).toBe(0);
  });

  it('an unknown customer is dropped with a warning, and the job is saved', async () => {
    const { ids, body } = visit();
    body.changes.customers.created = [];
    const res = await httpA.post('/v1/sync/push').send(body).expect(200);
    expect(res.body.warnings).toEqual([{ table: 'jobs', id: ids.job, code: 'CUSTOMER_UNKNOWN' }]);
    const [job] = await t.db.select().from(schema.jobs).where(eq(schema.jobs.id, ids.job));
    expect(job!.customerId).toBeNull();
  });
});

describe('photos', () => {
  it("a photo row can arrive before its file; it's marked uploaded when resent after the upload", async () => {
    const { ids, body } = visit();
    const key = photoKey(A.garage.id, ids.job, ids.photo);
    body.changes.job_photos.created[0] = {
      ...body.changes.job_photos.created[0]!,
      storage_key: key,
    } as never;
    await httpA.post('/v1/sync/push').send(body).expect(200);
    const read = async () =>
      (await t.db.select().from(schema.jobPhotos).where(eq(schema.jobPhotos.id, ids.photo)))[0]!;
    expect((await read()).uploadedAt).toBeNull();

    const storage = t.app.get(StorageService);
    const file = Buffer.from([0xff, 0xd8, 1, 2, 3]);
    const url = await storage.signUpload(storage.photosBucket, key, 'image/jpeg', file.length, 60);
    expect(
      (await fetch(url, { method: 'PUT', body: file, headers: { 'content-type': 'image/jpeg' } }))
        .ok,
    ).toBe(true);

    const resend = {
      changes: {
        job_photos: {
          updated: [{ ...(body.changes.job_photos.created[0] as object), ocr_reading: 1 }],
        },
      },
    };
    await httpA.post('/v1/sync/push').send(resend).expect(200);
    const after = await read();
    expect(after.uploadedAt).not.toBeNull();
    expect(after.ocrReading).toBe(84_250); // the evidence itself can't be changed afterwards
  });

  it("a storage key into another garage's folder is refused", async () => {
    const { ids, body } = visit();
    body.changes.job_photos.created[0] = {
      ...body.changes.job_photos.created[0]!,
      storage_key: photoKey(B.garage.id, ids.job, ids.photo),
    } as never;
    const res = await httpA.post('/v1/sync/push').send(body).expect(200);
    expect(res.body.rejected).toEqual([
      { table: 'job_photos', id: ids.photo, code: 'PHOTO_KEY_INVALID' },
    ]);
  });

  it('a photo can be added to a job synced earlier, but photos are never deleted', async () => {
    const { ids, body } = visit();
    await httpA.post('/v1/sync/push').send(body).expect(200);
    const extra = randomUUID();
    const add = {
      changes: {
        job_photos: {
          created: [{ id: extra, job_id: ids.job, kind: 'after', taken_at: Date.now() }],
          deleted: [ids.photo],
        },
      },
    };
    const res = await httpA.post('/v1/sync/push').send(add).expect(200);
    expect(res.body.rejected).toEqual([
      { table: 'job_photos', id: ids.photo, code: 'PHOTO_LOCKED' },
    ]);
    expect(
      await t.db
        .select()
        .from(schema.jobPhotos)
        .where(inArray(schema.jobPhotos.id, [extra, ids.photo])),
    ).toHaveLength(2);
  });
});

describe('access', () => {
  it('a pending garage cannot push, and a push needs a sign-in', async () => {
    const pending = (await t.asUser((await createGarage(t.db, { status: 'pending' })).owner.phone))
      .http;
    expect(
      (await pending.post('/v1/sync/push').send(visit().body).expect(403)).body.error.code,
    ).toBe('GARAGE_PENDING');
    await t.http.post('/v1/sync/push').send(visit().body).expect(401);
  });
});
