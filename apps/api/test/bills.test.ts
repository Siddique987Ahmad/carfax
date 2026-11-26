import { createHash } from 'node:crypto';
import { schema } from '@carfax/db';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BILL_SENDS_PER_DAY } from '../src/bills/bills.service';
import {
  createCar,
  createCustomer,
  createGarage,
  createJob,
  createUser,
  nextPhone,
} from './factories';
import { startTestApp, type TestApp } from './harness';

type Http = Awaited<ReturnType<TestApp['asUser']>>['http'];
let t: TestApp;
let A: Awaited<ReturnType<typeof createGarage>>;
let owner: Http;
let mechanic: Http;
let otherOwner: Http;
beforeAll(async () => {
  t = await startTestApp();
  A = await createGarage(t.db, { name: 'Ahmed Motors' });
  owner = (await t.asUser(A.owner.phone)).http;
  const m = await createUser(t.db);
  await t.db
    .insert(schema.garageMembers)
    .values({ garageId: A.garage.id, userId: m.id, role: 'mechanic' });
  mechanic = (await t.asUser(m.phone)).http;
  otherOwner = (await t.asUser((await createGarage(t.db)).owner.phone)).http;
});
afterAll(async () => {
  await t?.close();
});

/** A finished job for a customer with a phone: an oil change and tuning, 10,500 in all. */
async function billableJob(opts: { phone?: string | null } = {}) {
  const customer = await createCustomer(t.db, A.garage.id, {
    name: 'Bilal Hidden',
    phone: opts.phone === null ? undefined : (opts.phone ?? nextPhone()),
  });
  if (opts.phone === null)
    await t.db
      .update(schema.customers)
      .set({ phone: null })
      .where(eq(schema.customers.id, customer.id));
  const { car, regNo } = await createCar(t.db, {
    make: 'Toyota',
    model: 'Corolla',
    plate: undefined,
  });
  const job = await createJob(t.db, {
    garageId: A.garage.id,
    carId: car.id,
    createdBy: A.owner.id,
    customerId: customer.id,
    regNo,
    odometerKm: 84_250,
  });
  await t.db
    .update(schema.jobs)
    .set({ serviceDate: '2026-11-20', totalPkr: 10_500, nextServiceDueDate: '2027-02-20' })
    .where(eq(schema.jobs.id, job.id));
  await t.db.insert(schema.jobItems).values([
    {
      jobId: job.id,
      workType: 'oil_change',
      partName: 'Oil + filter',
      partPricePkr: 7800,
      labourPricePkr: 700,
    },
    { jobId: job.id, workType: 'tuning', labourPricePkr: 2000 },
  ]);
  return { job, car, regNo, customer };
}
const tokenOf = (billUrl: string) => billUrl.split('/b/')[1]!;

describe('sending a bill', () => {
  it('returns a working wa.me link with the customer number and the bill text, and records the send', async () => {
    const { job, regNo } = await billableJob({ phone: '+923217654321' });
    const res = await owner.post(`/v1/jobs/${job.id}/send-bill`).send({}).expect(200);
    expect(res.body).toMatchObject({ method: 'wa_me', sendsToday: 1 });
    const link = new URL(res.body.shareLink);
    expect(link.origin + link.pathname).toBe('https://wa.me/923217654321');
    const text = link.searchParams.get('text')!;
    expect(text).toBe(res.body.text);
    for (const part of [
      '*Ahmed Motors*',
      `Bill for Toyota Corolla (${regNo})`,
      'Date: 2026-11-20',
      'Odometer: 84,250 km',
      '• Oil change: Oil + filter — Rs. 8,500',
      '• Tuning — Rs. 2,000',
      '*Total: Rs. 10,500*',
      'Next service: 2027-02-20',
      res.body.billUrl,
      'may appear in vehicle history reports',
    ]) {
      expect(text).toContain(part);
    }
    const sends = await t.db
      .select()
      .from(schema.billSends)
      .where(eq(schema.billSends.jobId, job.id));
    expect(sends).toHaveLength(1);
    expect(sends[0]).toMatchObject({ method: 'wa_me', garageId: A.garage.id, sentBy: A.owner.id });
  });

  it('writes the bill in Urdu when asked', async () => {
    const { job } = await billableJob();
    const res = await owner
      .post(`/v1/jobs/${job.id}/send-bill`)
      .send({ language: 'ur' })
      .expect(200);
    for (const part of ['آئل چینج', 'کل رقم: 10,500 روپے', 'اگلی سروس: 2027-02-20', 'ہسٹری رپورٹس'])
      expect(res.body.text).toContain(part);
  });

  it('a mechanic can send bills too', async () => {
    const { job } = await billableJob();
    await mechanic.post(`/v1/jobs/${job.id}/send-bill`).send({}).expect(200);
  });

  it("refuses when the customer has no phone, and for another garage's job", async () => {
    const { job } = await billableJob({ phone: null });
    expect(
      (await owner.post(`/v1/jobs/${job.id}/send-bill`).send({}).expect(400)).body.error.code,
    ).toBe('NO_CUSTOMER_PHONE');
    const mine = await billableJob();
    await otherOwner.post(`/v1/jobs/${mine.job.id}/send-bill`).send({}).expect(404);
  });

  it(`at most ${BILL_SENDS_PER_DAY} sends per job per day, even when tapped at the same moment`, async () => {
    const { job } = await billableJob();
    const results = await Promise.all(
      Array.from({ length: BILL_SENDS_PER_DAY + 2 }, () =>
        owner.post(`/v1/jobs/${job.id}/send-bill`).send({}),
      ),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(BILL_SENDS_PER_DAY);
    expect(results.filter((r) => r.status === 429)[0]!.body.error.code).toBe('RATE_LIMITED');
  });
});

describe('the bill page', () => {
  it('opens without login and shows only that job: no customer details, no other visits', async () => {
    const { job, car, regNo } = await billableJob({ phone: '+923217650000' });
    // Another visit of the same car must not show.
    const other = await createJob(t.db, {
      garageId: A.garage.id,
      carId: car.id,
      createdBy: A.owner.id,
      regNo,
      odometerKm: 90_000,
    });
    await t.db
      .insert(schema.jobItems)
      .values({ jobId: other.id, workType: 'brakes', labourPricePkr: 99_999 });

    const sent = await owner.post(`/v1/jobs/${job.id}/send-bill`).send({}).expect(200);
    const res = await t.http.get(`/v1/bills/${tokenOf(sent.body.billUrl)}`).expect(200);
    expect(res.body).toMatchObject({
      garage: { name: 'Ahmed Motors', city: 'Lahore' },
      car: { make: 'Toyota', model: 'Corolla', regNo },
      serviceDate: '2026-11-20',
      odometerKm: 84_250,
      totalPkr: 10_500,
      items: [
        { workType: 'oil_change', partPricePkr: 7800 },
        { workType: 'tuning', labourPricePkr: 2000 },
      ],
    });
    expect(res.body.notice).toContain('history reports');
    expect(res.text).not.toContain('Bilal Hidden');
    expect(res.text).not.toMatch(/7650000/);
    expect(res.text).not.toContain('99999');
  });

  it('an unknown, altered or expired link is 404', async () => {
    const { job } = await billableJob();
    const sent = await owner.post(`/v1/jobs/${job.id}/send-bill`).send({}).expect(200);
    const token = tokenOf(sent.body.billUrl);
    await t.http
      .get(`/v1/bills/${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`)
      .expect(404);
    await t.http.get('/v1/bills/nothing-here').expect(404);
    await t.db.execute(
      sql`update bill_sends set expires_at = now() - interval '1 second' where job_id = ${job.id}`,
    );
    await t.http.get(`/v1/bills/${token}`).expect(404);
  });

  it('only a hash of the link token is stored', async () => {
    const { job } = await billableJob();
    const sent = await owner.post(`/v1/jobs/${job.id}/send-bill`).send({}).expect(200);
    const token = tokenOf(sent.body.billUrl);
    const [row] = await t.db
      .select()
      .from(schema.billSends)
      .where(eq(schema.billSends.jobId, job.id));
    expect(row!.tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(JSON.stringify(row)).not.toContain(token);
  });
});
