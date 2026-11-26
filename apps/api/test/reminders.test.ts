import { randomUUID } from 'node:crypto';
import { schema } from '@carfax/db';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createGarage, createUser, nextPhone, nextPlate } from './factories';
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

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
const addDays = (d: string, n: number) =>
  new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** A visit pushed from the app, on a new car unless `car` is given. */
async function visit(opts: {
  work: string[];
  date?: string;
  due?: string;
  car?: { id: string; plate: string };
  customer?: { id: string; phone: string | null };
}) {
  const car = opts.car ?? { id: randomUUID(), plate: nextPlate() };
  const customer = opts.customer ?? { id: randomUUID(), phone: nextPhone() };
  const job = randomUUID();
  await owner
    .post('/v1/sync/push')
    .send({
      changes: {
        cars: { created: [{ id: car.id, reg_no: car.plate, make: 'Toyota', model: 'Corolla' }] },
        customers: { created: [{ id: customer.id, name: 'Bilal', phone: customer.phone }] },
        jobs: {
          created: [
            {
              id: job,
              car_id: car.id,
              customer_id: customer.id,
              service_date: opts.date ?? today(),
              odometer_km: 50_000,
              next_service_due_date: opts.due ?? null,
              device_created_at: Date.now(),
            },
          ],
        },
        job_items: {
          created: opts.work.map((w) => ({ id: randomUUID(), job_id: job, work_type: w })),
        },
      },
    })
    .expect(200);
  return { car, customer, job };
}
const remindersOf = (carId: string) =>
  t.db
    .select()
    .from(schema.reminders)
    .where(eq(schema.reminders.carId, carId))
    .orderBy(schema.reminders.createdAt);

describe('reminders from jobs', () => {
  it('an oil change creates a reminder with the right due date', async () => {
    const withDate = await visit({ work: ['oil_change'], date: '2026-11-20', due: '2027-01-15' });
    expect(await remindersOf(withDate.car.id)).toMatchObject([
      { kind: 'oil_change', dueDate: '2027-01-15', status: 'scheduled', sourceJobId: withDate.job },
    ]);
    const byRule = await visit({ work: ['oil_change', 'brakes'], date: '2026-11-20' });
    expect(await remindersOf(byRule.car.id)).toMatchObject([
      { kind: 'oil_change', dueDate: '2027-02-18' },
    ]);
  });

  it('tuning gets 180 days; brakes alone get no reminder', async () => {
    const tuning = await visit({ work: ['tuning'], date: '2026-11-20' });
    expect(await remindersOf(tuning.car.id)).toMatchObject([
      { kind: 'tuning', dueDate: '2027-05-19' },
    ]);
    const brakes = await visit({ work: ['brakes'] });
    expect(await remindersOf(brakes.car.id)).toEqual([]);
  });

  it('a resent push creates no second reminder', async () => {
    const car = { id: randomUUID(), plate: nextPlate() };
    const customer = { id: randomUUID(), phone: nextPhone() };
    const job = randomUUID();
    const body = {
      changes: {
        cars: { created: [{ id: car.id, reg_no: car.plate }] },
        customers: { created: [{ id: customer.id, phone: customer.phone }] },
        jobs: {
          created: [
            {
              id: job,
              car_id: car.id,
              customer_id: customer.id,
              service_date: today(),
              odometer_km: 1,
              device_created_at: Date.now(),
            },
          ],
        },
        job_items: { created: [{ id: randomUUID(), job_id: job, work_type: 'oil_change' }] },
      },
    };
    await owner.post('/v1/sync/push').send(body).expect(200);
    await owner.post('/v1/sync/push').send(body).expect(200);
    expect(await remindersOf(car.id)).toHaveLength(1);
  });

  it('a new oil change cancels the old reminder if it was never sent', async () => {
    const first = await visit({ work: ['oil_change'], date: addDays(today(), -40) });
    await visit({ work: ['oil_change'], car: first.car, customer: first.customer });
    const [old, fresh] = await remindersOf(first.car.id);
    expect(old).toMatchObject({ status: 'cancelled', returnedJobId: null });
    expect(fresh).toMatchObject({ status: 'scheduled' });
  });

  it('a car that comes back after a sent reminder marks it returned, whatever the work', async () => {
    const first = await visit({
      work: ['oil_change'],
      date: addDays(today(), -95),
      due: addDays(today(), -5),
    });
    const [reminder] = await remindersOf(first.car.id);
    await owner.post(`/v1/reminders/${reminder!.id}/send`).send({}).expect(200);
    const back = await visit({ work: ['brakes'], car: first.car, customer: first.customer });
    const [after] = await remindersOf(first.car.id);
    expect(after).toMatchObject({ status: 'sent', returnedJobId: back.job });
  });

  it('a visit more than 30 days after the due date does not count as coming back', async () => {
    const first = await visit({
      work: ['oil_change'],
      date: addDays(today(), -200),
      due: addDays(today(), -60),
    });
    const [reminder] = await remindersOf(first.car.id);
    await t.db
      .update(schema.reminders)
      .set({ status: 'sent', sentAt: new Date(Date.now() - 62 * 86_400_000) })
      .where(eq(schema.reminders.id, reminder!.id));
    await visit({ work: ['oil_change'], car: first.car, customer: first.customer });
    const [after] = await remindersOf(first.car.id);
    expect(after!.returnedJobId).toBeNull();
  });
});

describe('the due list and sending', () => {
  it('lists reminders due soon (and overdue), with the customer and car', async () => {
    const soon = await visit({
      work: ['oil_change'],
      date: addDays(today(), -85),
      due: addDays(today(), 3),
    });
    const overdue = await visit({
      work: ['oil_change'],
      date: addDays(today(), -100),
      due: addDays(today(), -10),
    });
    const later = await visit({ work: ['oil_change'], due: addDays(today(), 40) });
    const res = await owner.get('/v1/reminders/due').query({ within: 7 }).expect(200);
    const cars = res.body.map((r: { carId: string }) => r.carId);
    expect(cars).toEqual(expect.arrayContaining([soon.car.id, overdue.car.id]));
    expect(cars).not.toContain(later.car.id);
    expect(res.body.find((r: { carId: string }) => r.carId === soon.car.id)).toMatchObject({
      kind: 'oil_change',
      customerName: 'Bilal',
      customerPhone: soon.customer.phone,
      regNo: soon.car.plate,
      make: 'Toyota',
    });
    expect(
      await otherOwner
        .get('/v1/reminders/due')
        .expect(200)
        .then((r) => r.body),
    ).toEqual([]);
  });

  it('one tap: a wa.me link to the customer with the reminder typed in, in English or Urdu; then it is sent', async () => {
    const v = await visit({ work: ['oil_change'], due: '2027-02-18' });
    const [reminder] = await remindersOf(v.car.id);
    const res = await mechanic.post(`/v1/reminders/${reminder!.id}/send`).send({}).expect(200);
    const link = new URL(res.body.shareLink);
    expect(link.pathname).toBe(`/${v.customer.phone!.replace('+', '')}`);
    expect(res.body.text).toBe(
      `Hello Bilal! Your Toyota Corolla (${v.car.plate}) is due for Oil change around 2027-02-18. Please visit us. — Ahmed Motors`,
    );
    expect(link.searchParams.get('text')).toBe(res.body.text);
    const [sent] = await remindersOf(v.car.id);
    expect(sent).toMatchObject({ status: 'sent' });
    expect(sent!.sentAt).not.toBeNull();
    // Already sent: not twice.
    await owner.post(`/v1/reminders/${reminder!.id}/send`).send({}).expect(409);

    const urdu = await visit({ work: ['oil_change'], due: '2027-02-18' });
    const [r2] = await remindersOf(urdu.car.id);
    const ur = await owner
      .post(`/v1/reminders/${r2!.id}/send`)
      .send({ language: 'ur' })
      .expect(200);
    expect(ur.body.text).toContain('السلام علیکم Bilal!');
    expect(ur.body.text).toContain('آئل چینج');
  });

  it('refuses without a customer phone, and for another garage', async () => {
    const v = await visit({ work: ['oil_change'], customer: { id: randomUUID(), phone: null } });
    const [reminder] = await remindersOf(v.car.id);
    expect(
      (await owner.post(`/v1/reminders/${reminder!.id}/send`).send({}).expect(400)).body.error.code,
    ).toBe('NO_CUSTOMER_PHONE');
    await otherOwner.post(`/v1/reminders/${reminder!.id}/send`).send({}).expect(404);
  });

  it('snooze moves the due date; cancel stops it; neither works once sent', async () => {
    const v = await visit({ work: ['oil_change'], due: addDays(today(), -2) });
    const [reminder] = await remindersOf(v.car.id);
    const snoozed = await owner
      .patch(`/v1/reminders/${reminder!.id}`)
      .send({ action: 'snooze', days: 7 })
      .expect(200);
    expect(snoozed.body).toMatchObject({ status: 'scheduled', dueDate: addDays(today(), 7) });
    await owner.patch(`/v1/reminders/${reminder!.id}`).send({ action: 'cancel' }).expect(200);
    const [cancelled] = await t.db
      .select()
      .from(schema.reminders)
      .where(and(eq(schema.reminders.id, reminder!.id)));
    expect(cancelled!.status).toBe('cancelled');
    await owner.post(`/v1/reminders/${reminder!.id}/send`).send({}).expect(409);
  });
});
