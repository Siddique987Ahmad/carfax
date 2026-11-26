import { schema } from '@carfax/db';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCar, createCustomer, createGarage, createJob, createUser } from './factories';
import { startTestApp, type TestApp } from './harness';

type Http = Awaited<ReturnType<TestApp['asUser']>>['http'];
let t: TestApp;
let A: Awaited<ReturnType<typeof createGarage>>;
let owner: Http;
let mechanic: Http;
let otherOwner: Http;
beforeAll(async () => {
  t = await startTestApp();
  A = await createGarage(t.db, { name: 'A Motors' });
  owner = (await t.asUser(A.owner.phone)).http;
  const m = await createUser(t.db);
  await t.db
    .insert(schema.garageMembers)
    .values({ garageId: A.garage.id, userId: m.id, role: 'mechanic' });
  mechanic = (await t.asUser(m.phone)).http;
  otherOwner = (await t.asUser((await createGarage(t.db, { name: 'B Motors' })).owner.phone)).http;
});
afterAll(async () => {
  await t?.close();
});

/** A customer with one car and two visits. */
async function customerWithVisits(name: string, phone: string) {
  const customer = await createCustomer(t.db, A.garage.id, { name, phone });
  const { car, regNo } = await createCar(t.db, { model: 'City', make: 'Honda' });
  for (const date of ['2026-09-01', '2026-11-01']) {
    const j = await createJob(t.db, {
      garageId: A.garage.id,
      carId: car.id,
      createdBy: A.owner.id,
      customerId: customer.id,
      regNo,
    });
    await t.db
      .update(schema.jobs)
      .set({ serviceDate: date, totalPkr: 5000 })
      .where(eq(schema.jobs.id, j.id));
    await t.db.insert(schema.jobItems).values({ jobId: j.id, workType: 'oil_change' });
  }
  return { customer, car, regNo };
}

describe('search', () => {
  it('finds a customer by part of their name or phone, in any spelling', async () => {
    const { customer, car, regNo } = await customerWithVisits('Faisal Raza', '+923217654321');
    for (const q of [
      'faisal',
      'RAZA',
      'sal Ra',
      '7654321',
      '0321-7654',
      '+92 321 765',
      '03217654321',
    ]) {
      const res = await owner.get('/v1/customers').query({ q }).expect(200);
      expect(
        res.body.map((c: { id: string }) => c.id),
        q,
      ).toContain(customer.id);
    }
    const [row] = (await owner.get('/v1/customers').query({ q: 'faisal raza' }).expect(200)).body;
    expect(row).toMatchObject({
      name: 'Faisal Raza',
      lastVisit: '2026-11-01',
      visits: 2,
      cars: [{ id: car.id, regNo, make: 'Honda', model: 'City' }],
    });
  });

  it("treats % and _ as plain characters, and doesn't match nonsense", async () => {
    await customerWithVisits('Hamza Butt', '+923001112223');
    expect((await owner.get('/v1/customers').query({ q: '%' }).expect(200)).body).toEqual([]);
    expect((await owner.get('/v1/customers').query({ q: 'zzz-nobody' }).expect(200)).body).toEqual(
      [],
    );
  });

  it('a mechanic can search too (they send bills and reminders)', async () => {
    const { customer } = await customerWithVisits('Sara Malik', '+923331234567');
    const res = await mechanic.get('/v1/customers').query({ q: 'sara' }).expect(200);
    expect(res.body.map((c: { id: string }) => c.id)).toContain(customer.id);
  });

  it("never shows another garage's customers", async () => {
    const { customer } = await customerWithVisits('Imran Khan', '+923451239876');
    const res = await otherOwner.get('/v1/customers').query({ q: 'imran' }).expect(200);
    expect(res.body.map((c: { id: string }) => c.id)).not.toContain(customer.id);
    await otherOwner.get(`/v1/customers/${customer.id}`).expect(404);
  });
});

describe('detail', () => {
  it('shows visits newest first, and reminders', async () => {
    const { customer, car } = await customerWithVisits('Usman Ali', '+923009998887');
    await t.db.insert(schema.reminders).values({
      garageId: A.garage.id,
      carId: car.id,
      customerId: customer.id,
      kind: 'oil_change',
      dueDate: '2027-02-01',
    });
    const res = await owner.get(`/v1/customers/${customer.id}`).expect(200);
    expect(res.body.visits.map((v: { serviceDate: string }) => v.serviceDate)).toEqual([
      '2026-11-01',
      '2026-09-01',
    ]);
    expect(res.body.visits[0]).toMatchObject({
      totalPkr: 5000,
      workTypes: ['oil_change'],
      make: 'Honda',
    });
    expect(res.body.reminders).toMatchObject([
      { kind: 'oil_change', dueDate: '2027-02-01', status: 'scheduled' },
    ]);
  });

  it('a mechanic sees visit totals only on jobs they logged', async () => {
    const { customer } = await customerWithVisits('Nida Aslam', '+923112223334');
    const res = await mechanic.get(`/v1/customers/${customer.id}`).expect(200);
    expect(res.body.visits.every((v: { totalPkr: number | null }) => v.totalPkr === null)).toBe(
      true,
    );
  });
});

describe('deleting a customer', () => {
  it("removes their name and phone everywhere but keeps the car's jobs", async () => {
    const { customer, car } = await customerWithVisits('Delete Me', '+923456667778');
    await t.db.insert(schema.reminders).values({
      garageId: A.garage.id,
      carId: car.id,
      customerId: customer.id,
      kind: 'oil_change',
      dueDate: '2027-01-01',
    });
    await owner.delete(`/v1/customers/${customer.id}`).expect(204);

    const [row] = await t.db
      .select()
      .from(schema.customers)
      .where(eq(schema.customers.id, customer.id));
    expect(row).toMatchObject({ name: null, phone: null });
    expect(row!.deletedAt).not.toBeNull();
    const jobs = await t.db.select().from(schema.jobs).where(eq(schema.jobs.carId, car.id));
    expect(jobs).toHaveLength(2);
    const [reminder] = await t.db
      .select()
      .from(schema.reminders)
      .where(eq(schema.reminders.customerId, customer.id));
    expect(reminder!.status).toBe('cancelled');
    // Gone from search and detail.
    expect((await owner.get('/v1/customers').query({ q: 'Delete Me' }).expect(200)).body).toEqual(
      [],
    );
    await owner.get(`/v1/customers/${customer.id}`).expect(404);
    // The audit log records the deletion, not the deleted details.
    const audit = await t.db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.entityId, customer.id));
    expect(audit.map((a) => a.action)).toEqual(['customer.delete']);
    expect(JSON.stringify(audit)).not.toMatch(/Delete Me|6667778/);
    // Deleting again is 404.
    await owner.delete(`/v1/customers/${customer.id}`).expect(404);
  });

  it('only the owner can delete', async () => {
    const { customer } = await customerWithVisits('Keep Me', '+923211110000');
    await mechanic.delete(`/v1/customers/${customer.id}`).expect(403);
    await otherOwner.delete(`/v1/customers/${customer.id}`).expect(404);
  });

  it('the deletion reaches the phones through sync pull', async () => {
    const { customer } = await customerWithVisits('Pull Me', '+923007770000');
    const first = await mechanic.get('/v1/sync/pull').expect(200);
    await owner.delete(`/v1/customers/${customer.id}`).expect(204);
    const next = await mechanic
      .get('/v1/sync/pull')
      .query({ last_pulled_at: first.body.timestamp })
      .expect(200);
    expect(next.body.changes.customers.deleted).toContain(customer.id);
  });
});
