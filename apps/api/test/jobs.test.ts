import { randomUUID } from 'node:crypto';
import { schema } from '@carfax/db';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { StorageService } from '../src/storage/storage.module';
import { photoKey } from '../src/uploads/uploads.controller';
import { createCar, createCustomer, createGarage, createJob, createUser } from './factories';
import { startTestApp, type TestApp } from './harness';

type Http = Awaited<ReturnType<TestApp['asUser']>>['http'];
let t: TestApp;
let A: Awaited<ReturnType<typeof createGarage>>;
let owner: Http;
let mechanic: Http;
let mechanicId: string;
let otherOwner: Http;
let B: Awaited<ReturnType<typeof createGarage>>;
beforeAll(async () => {
  t = await startTestApp();
  A = await createGarage(t.db, { name: 'A Motors' });
  B = await createGarage(t.db, { name: 'B Motors' });
  owner = (await t.asUser(A.owner.phone)).http;
  otherOwner = (await t.asUser(B.owner.phone)).http;
  const m = await createUser(t.db, { name: 'Usman' });
  mechanicId = m.id;
  await t.db
    .insert(schema.garageMembers)
    .values({ garageId: A.garage.id, userId: m.id, role: 'mechanic' });
  mechanic = (await t.asUser(m.phone)).http;
});
afterAll(async () => {
  await t?.close();
});

/** A job in garage A on a given date, with an oil change item and a total. */
async function job(opts: {
  date: string;
  createdBy?: string;
  carId?: string;
  status?: 'approved' | 'flagged';
}) {
  const carId = opts.carId ?? (await createCar(t.db)).car.id;
  const j = await createJob(t.db, {
    garageId: A.garage.id,
    carId,
    createdBy: opts.createdBy ?? A.owner.id,
  });
  await t.db
    .update(schema.jobs)
    .set({ serviceDate: opts.date, totalPkr: 8500, status: opts.status ?? 'approved' })
    .where(eq(schema.jobs.id, j.id));
  await t.db
    .insert(schema.jobItems)
    .values({ jobId: j.id, workType: 'oil_change', partPricePkr: 7800, labourPricePkr: 700 });
  return { ...j, carId };
}

describe('the job list', () => {
  it("an owner can list last month's jobs, newest first", async () => {
    const early = await job({ date: '2026-10-03' });
    const late = await job({ date: '2026-10-28' });
    await job({ date: '2026-09-15' }); // the month before
    const res = await owner
      .get('/v1/jobs')
      .query({ from: '2026-10-01', to: '2026-10-31' })
      .expect(200);
    expect(res.body.jobs.map((j: { id: string }) => j.id)).toEqual([late.id, early.id]);
    expect(res.body.jobs[0]).toMatchObject({
      serviceDate: '2026-10-28',
      totalPkr: 8500,
      workTypes: ['oil_change'],
      make: 'Toyota',
    });
  });

  it('filters by status and car, and pages with a cursor without gaps or repeats', async () => {
    const { car } = await createCar(t.db);
    const ids = [];
    for (let d = 1; d <= 7; d++)
      ids.push(
        (
          await job({
            date: `2026-08-0${d}`,
            carId: car.id,
            status: d % 2 ? 'approved' : 'flagged',
          })
        ).id,
      );
    const flagged = await owner
      .get('/v1/jobs')
      .query({ carId: car.id, status: 'flagged' })
      .expect(200);
    expect(flagged.body.jobs).toHaveLength(3);

    const seen: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await owner
        .get('/v1/jobs')
        .query({ carId: car.id, limit: 3, ...(cursor && { cursor }) })
        .expect(200);
      seen.push(...page.body.jobs.map((j: { id: string }) => j.id));
      cursor = page.body.nextCursor ?? undefined;
    } while (cursor);
    expect(seen).toEqual([...ids].reverse());
  });

  it('a mechanic sees the list, with totals only on the jobs they logged', async () => {
    const { car } = await createCar(t.db);
    const byOwner = await job({ date: '2026-07-01', carId: car.id });
    const byMechanic = await job({ date: '2026-07-02', carId: car.id, createdBy: mechanicId });
    const res = await mechanic.get('/v1/jobs').query({ carId: car.id }).expect(200);
    const total = (id: string) => res.body.jobs.find((j: { id: string }) => j.id === id).totalPkr;
    expect(total(byOwner.id)).toBeNull();
    expect(total(byMechanic.id)).toBe(8500);
  });

  it('refuses a bad date range or cursor', async () => {
    await owner.get('/v1/jobs').query({ from: '2026-10-31', to: '2026-10-01' }).expect(400);
    await owner.get('/v1/jobs').query({ cursor: 'garbage' }).expect(400);
  });

  it("never lists another garage's jobs", async () => {
    const mine = await job({ date: '2026-06-01' });
    const res = await otherOwner.get('/v1/jobs').expect(200);
    expect(res.body.jobs.map((j: { id: string }) => j.id)).not.toContain(mine.id);
  });
});

describe('one job', () => {
  it('opens with its items, customer, photos (a working link), flags in plain words and review notes', async () => {
    const j = await job({ date: '2026-10-10', status: 'flagged' });
    const customer = await createCustomer(t.db, A.garage.id, { name: 'Bilal' });
    await t.db.update(schema.jobs).set({ customerId: customer.id }).where(eq(schema.jobs.id, j.id));
    // An uploaded odometer photo.
    const photoId = randomUUID();
    const key = photoKey(A.garage.id, j.id, photoId);
    const storage = t.app.get(StorageService);
    const bytes = Buffer.from([0xff, 0xd8, 9, 9, 9]);
    const put = await storage.signUpload(storage.photosBucket, key, 'image/jpeg', bytes.length, 60);
    await fetch(put, { method: 'PUT', body: bytes, headers: { 'content-type': 'image/jpeg' } });
    await t.db.insert(schema.jobPhotos).values({
      id: photoId,
      jobId: j.id,
      kind: 'odometer',
      storageKey: key,
      uploadedAt: new Date(),
      takenAt: new Date(),
      ocrReading: 50_000,
    });
    await t.db.insert(schema.jobFlags).values({
      jobId: j.id,
      code: 'MILEAGE_DROP',
      details: { previousKm: 60_000, thisKm: 50_000 },
    });
    await t.db.insert(schema.auditLogs).values({
      action: 'job.approve',
      entity: 'job',
      entityId: j.id,
      note: 'Photo checked, reading is right',
    });

    const res = await owner.get(`/v1/jobs/${j.id}`).expect(200);
    expect(res.body).toMatchObject({
      id: j.id,
      status: 'flagged',
      totalPkr: 8500,
      customer: { id: customer.id, name: 'Bilal' },
      items: [{ workType: 'oil_change', partPricePkr: 7800, labourPricePkr: 700 }],
      flags: [
        {
          code: 'MILEAGE_DROP',
          description: 'The odometer reading is lower than an earlier visit',
          resolved: false,
        },
      ],
      reviewNotes: [{ action: 'job.approve', note: 'Photo checked, reading is right' }],
    });
    const photo = res.body.photos[0];
    expect(photo).toMatchObject({ kind: 'odometer', uploaded: true, ocrReading: 50_000 });
    const download = await fetch(photo.url);
    expect(Buffer.from(await download.arrayBuffer()).equals(bytes)).toBe(true);
  });

  it('a photo not uploaded yet has no link', async () => {
    const j = await job({ date: '2026-10-11' });
    await t.db
      .insert(schema.jobPhotos)
      .values({ jobId: j.id, kind: 'odometer', takenAt: new Date() });
    const res = await owner.get(`/v1/jobs/${j.id}`).expect(200);
    expect(res.body.photos[0]).toMatchObject({ uploaded: false, url: null });
  });

  it("a mechanic opening the owner's job sees it without prices", async () => {
    const j = await job({ date: '2026-10-12' });
    const res = await mechanic.get(`/v1/jobs/${j.id}`).expect(200);
    expect(res.body.totalPkr).toBeNull();
    expect(res.body.items[0]).toMatchObject({ partPricePkr: null, labourPricePkr: null });
  });

  it("another garage's job ID returns 404", async () => {
    const mine = await job({ date: '2026-10-13' });
    const res = await otherOwner.get(`/v1/jobs/${mine.id}`).expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    await owner.get(`/v1/jobs/${randomUUID()}`).expect(404);
    await owner.get('/v1/jobs/not-a-uuid').expect(400);
  });

  it('shows its correction requests (api/08b)', async () => {
    const j = await job({ date: '2026-10-14' });
    await owner
      .post(`/v1/jobs/${j.id}/correction-requests`)
      .send({ message: 'Wrong km', proposed: { odometerKm: 51_000 } })
      .expect(201);
    const res = await owner.get(`/v1/jobs/${j.id}`).expect(200);
    expect(res.body.correctionRequests).toMatchObject([{ message: 'Wrong km', status: 'open' }]);
  });
});
