import { schema } from '@carfax/db';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCar, createGarage, createJob, createUser } from './factories';
import { startTestApp, type TestApp } from './harness';

type Http = Awaited<ReturnType<TestApp['asUser']>>['http'];
let t: TestApp;
let A: Awaited<ReturnType<typeof createGarage>>;
let B: Awaited<ReturnType<typeof createGarage>>;
let mechanicA: Http;
let ownerA: Http;
let ownerB: Http;
beforeAll(async () => {
  t = await startTestApp();
  A = await createGarage(t.db, { name: 'A Motors' });
  B = await createGarage(t.db, { name: 'B Motors' });
  const m = await createUser(t.db);
  await t.db
    .insert(schema.garageMembers)
    .values({ garageId: A.garage.id, userId: m.id, role: 'mechanic' });
  mechanicA = (await t.asUser(m.phone)).http;
  ownerA = (await t.asUser(A.owner.phone)).http;
  ownerB = (await t.asUser(B.owner.phone)).http;
});
afterAll(async () => {
  await t?.close();
});

async function jobIn(g: typeof A) {
  const { car } = await createCar(t.db);
  return createJob(t.db, {
    garageId: g.garage.id,
    carId: car.id,
    createdBy: g.owner.id,
    odometerKm: 48_250,
  });
}
const ask = (http: Http, jobId: string, body: Record<string, unknown>) =>
  http.post(`/v1/jobs/${jobId}/correction-requests`).send(body);

describe('asking for a correction', () => {
  it("a mechanic can request a correction for their garage's submitted job", async () => {
    const job = await jobIn(A);
    const res = await ask(mechanicA, job.id, {
      message: 'Typed 48250, the photo shows 84250',
      proposed: { odometerKm: 84_250 },
    }).expect(201);
    expect(res.body).toMatchObject({
      jobId: job.id,
      status: 'open',
      proposed: { odometerKm: 84_250 },
      decisionNote: null,
      decidedAt: null,
    });
    // The job itself doesn't change until ops approve.
    const [row] = await t.db.select().from(schema.jobs).where(eq(schema.jobs.id, job.id));
    expect(row!.odometerKm).toBe(48_250);
    const audit = await t.db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.entityId, job.id));
    expect(audit.map((a) => a.action)).toEqual(['job.correction_request']);
  });

  it("not for another garage's job: it looks like it doesn't exist", async () => {
    const theirs = await jobIn(B);
    const res = await ask(ownerA, theirs.id, { message: 'Not our job' }).expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(
      await t.db
        .select()
        .from(schema.jobCorrectionRequests)
        .where(eq(schema.jobCorrectionRequests.jobId, theirs.id)),
    ).toEqual([]);
  });

  it('a second open request for the same job is refused; after ops decide, a new one is allowed', async () => {
    const job = await jobIn(A);
    const first = await ask(ownerA, job.id, {
      message: 'Wrong service date',
      proposed: { serviceDate: '2026-11-19' },
    }).expect(201);
    const again = await ask(mechanicA, job.id, { message: 'Also the price' }).expect(409);
    expect(again.body.error.code).toBe('CONFLICT');
    await t.db
      .update(schema.jobCorrectionRequests)
      .set({ status: 'rejected', decidedAt: new Date(), decisionNote: 'The photo shows the 20th' })
      .where(eq(schema.jobCorrectionRequests.id, first.body.id));
    await ask(mechanicA, job.id, {
      message: 'Also the price',
      proposed: { items: [{ workType: 'oil_change', partPricePkr: 7800 }] },
    }).expect(201);
    const list = await ownerA.get(`/v1/jobs/${job.id}/correction-requests`).expect(200);
    expect(list.body.map((r: { status: string }) => r.status)).toEqual(['open', 'rejected']);
  });

  it('only odometer, date and work items may be proposed; never the car or garage', async () => {
    const job = await jobIn(A);
    for (const proposed of [
      { carId: job.carId },
      { garageId: B.garage.id },
      {},
      { odometerKm: -1 },
      { items: [{ workType: 'car_wash' }] },
    ]) {
      expect(
        (await ask(ownerA, job.id, { message: 'Please fix', proposed }).expect(400)).body.error
          .code,
      ).toBe('VALIDATION_FAILED');
    }
    await ask(ownerA, job.id, { message: 'x' }).expect(400); // too short
  });

  it('a pending garage, or someone signed out, cannot ask', async () => {
    const job = await jobIn(A);
    await t.http
      .post(`/v1/jobs/${job.id}/correction-requests`)
      .send({ message: 'Please fix' })
      .expect(401);
    const pending = (await t.asUser((await createGarage(t.db, { status: 'pending' })).owner.phone))
      .http;
    await ask(pending, job.id, { message: 'Please fix' }).expect(403);
  });
});

describe('the database guards the rules too', () => {
  it("a request can't name a garage other than its job's", async () => {
    const job = await jobIn(A);
    const insert = t.db
      .insert(schema.jobCorrectionRequests)
      .values({ jobId: job.id, garageId: B.garage.id, requestedBy: B.owner.id, message: 'Sneaky' });
    await expect(insert).rejects.toThrow();
  });
});

describe('the outcome reaches the phones', () => {
  it('the request reaches the garage through sync pull, and its status updates when ops decide', async () => {
    const job = await jobIn(A);
    const { body: request } = await ask(mechanicA, job.id, {
      message: 'Typed 48250, the photo shows 84250',
      proposed: { odometerKm: 84_250 },
    }).expect(201);
    const first = await ownerA.get('/v1/sync/pull').expect(200);
    const pulled = first.body.changes.job_correction_requests.updated.find(
      (r: { id: string }) => r.id === request.id,
    );
    expect(pulled).toMatchObject({
      job_id: job.id,
      status: 'open',
      proposed: { odometerKm: 84_250 },
    });

    // Ops approve it in the admin panel (admin/12).
    await t.db.execute(
      sql`update job_correction_requests set status = 'approved', decided_at = now(), decision_note = 'Checked the photo' where id = ${request.id}`,
    );
    const next = await ownerA
      .get('/v1/sync/pull')
      .query({ last_pulled_at: first.body.timestamp })
      .expect(200);
    const updated = next.body.changes.job_correction_requests.updated.find(
      (r: { id: string }) => r.id === request.id,
    );
    expect(updated).toMatchObject({ status: 'approved', decision_note: 'Checked the photo' });
    expect(updated.decided_at).toBeGreaterThan(0);
  });

  it("another garage's phones never see it", async () => {
    const job = await jobIn(A);
    const { body: request } = await ask(ownerA, job.id, { message: 'Wrong km' }).expect(201);
    const theirs = await ownerB.get('/v1/sync/pull').expect(200);
    expect(
      theirs.body.changes.job_correction_requests.updated.map((r: { id: string }) => r.id),
    ).not.toContain(request.id);
  });
});
