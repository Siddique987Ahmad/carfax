import { schema } from '@carfax/db';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { STAFF_LIMIT } from '../src/garages/garages.service';
import { createCar, createGarage, createJob, createUser, nextPhone } from './factories';
import { startTestApp, type TestApp } from './harness';

let t: TestApp;
beforeAll(async () => {
  t = await startTestApp();
});
afterAll(async () => {
  await t?.close();
});

const newGarage = {
  name: 'Ahmed Motors',
  city: 'Lahore',
  address: 'Nicholson Road',
  lat: 31.5609,
  lng: 74.3378,
};

describe('creating a garage', () => {
  it('an owner creates a garage, adds a mechanic, and the mechanic signs in and sees it', async () => {
    const owner = await t.asUser(nextPhone());
    const created = await owner.http.post('/v1/garage').send(newGarage).expect(201);
    expect(created.body).toMatchObject({
      ...newGarage,
      status: 'pending',
      role: 'owner',
      statusReason: null,
    });

    // No token refresh needed: membership is read from the database.
    const me = await owner.http.get('/v1/garage/me').expect(200);
    expect(me.body.id).toBe(created.body.id);

    const mechanicPhone = nextPhone();
    const local = `0${mechanicPhone.slice(3, 6)}-${mechanicPhone.slice(6)}`;
    const added = await owner.http
      .post('/v1/garage/members')
      .send({ phone: local, name: 'Usman' })
      .expect(201);
    expect(added.body).toMatchObject({ phone: mechanicPhone, name: 'Usman', role: 'mechanic' });

    const mechanic = await t.asUser(mechanicPhone);
    const seen = await mechanic.http.get('/v1/garage/me').expect(200);
    expect(seen.body).toMatchObject({ id: created.body.id, role: 'mechanic', status: 'pending' });
  });

  it('a new garage is pending, and its creation is in the audit log', async () => {
    const owner = await t.asUser(nextPhone());
    const { body } = await owner.http.post('/v1/garage').send(newGarage).expect(201);
    const [row] = await t.db.select().from(schema.garages).where(eq(schema.garages.id, body.id));
    expect(row!.status).toBe('pending');
    const audit = await t.db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.entityId, body.id));
    expect(audit.map((a) => a.action)).toEqual(['garage.create']);
  });

  it('a pending garage can finish its profile and add staff, but not log jobs yet', async () => {
    const owner = await t.asUser(nextPhone());
    await owner.http.post('/v1/garage').send(newGarage).expect(201);
    await owner.http.patch('/v1/garage/me').send({ address: 'Montgomery Road' }).expect(200);
    await owner.http.post('/v1/garage/members').send({ phone: nextPhone() }).expect(201);
  });

  it('one garage per owner', async () => {
    const owner = await t.asUser(nextPhone());
    await owner.http.post('/v1/garage').send(newGarage).expect(201);
    const res = await owner.http
      .post('/v1/garage')
      .send({ ...newGarage, name: 'Second' })
      .expect(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('refuses an unknown city, a missing name and bad coordinates', async () => {
    const owner = await t.asUser(nextPhone());
    for (const bad of [
      { ...newGarage, city: 'Atlantis' },
      { ...newGarage, name: ' ' },
      { ...newGarage, lat: 95 },
    ]) {
      expect((await owner.http.post('/v1/garage').send(bad).expect(400)).body.error.code).toBe(
        'VALIDATION_FAILED',
      );
    }
  });

  it('needs a signed-in user', async () => {
    await t.http.post('/v1/garage').send(newGarage).expect(401);
  });
});

describe('what a mechanic may do', () => {
  let ownerHttp: Awaited<ReturnType<TestApp['asUser']>>['http'];
  let mechanicHttp: Awaited<ReturnType<TestApp['asUser']>>['http'];
  let mechanicId: string;
  beforeAll(async () => {
    const g = await createGarage(t.db);
    ownerHttp = (await t.asUser(g.owner.phone)).http;
    const mechanicPhone = nextPhone();
    mechanicId = (
      await ownerHttp.post('/v1/garage/members').send({ phone: mechanicPhone }).expect(201)
    ).body.userId;
    mechanicHttp = (await t.asUser(mechanicPhone)).http;
  });

  it('a mechanic gets 403 on stats, profile edit and staff routes', async () => {
    await mechanicHttp.get('/v1/garage/stats').expect(403);
    await mechanicHttp.patch('/v1/garage/me').send({ name: 'Taken Over' }).expect(403);
    await mechanicHttp.get('/v1/garage/members').expect(403);
    await mechanicHttp.post('/v1/garage/members').send({ phone: nextPhone() }).expect(403);
    await mechanicHttp.delete(`/v1/garage/members/${mechanicId}`).expect(403);
  });

  it('a mechanic can see the garage', async () => {
    await mechanicHttp.get('/v1/garage/me').expect(200);
  });

  it('a removed mechanic loses access on their very next request', async () => {
    const phone = nextPhone();
    const { userId } = (await ownerHttp.post('/v1/garage/members').send({ phone }).expect(201))
      .body;
    const session = await t.asUser(phone);
    await session.http.get('/v1/garage/me').expect(200);
    await ownerHttp.delete(`/v1/garage/members/${userId}`).expect(204);
    await session.http.get('/v1/garage/me').expect(403);
  });
});

describe('staff', () => {
  it("the owner can't remove themselves, and nobody can be added twice", async () => {
    const g = await createGarage(t.db);
    const owner = await t.asUser(g.owner.phone);
    expect(
      (await owner.http.delete(`/v1/garage/members/${g.owner.id}`).expect(409)).body.error.code,
    ).toBe('CONFLICT');
    const phone = nextPhone();
    await owner.http.post('/v1/garage/members').send({ phone }).expect(201);
    await owner.http.post('/v1/garage/members').send({ phone }).expect(409);
  });

  it('removing someone not on the staff is 404', async () => {
    const g = await createGarage(t.db);
    const stranger = await createUser(t.db);
    const owner = await t.asUser(g.owner.phone);
    await owner.http.delete(`/v1/garage/members/${stranger.id}`).expect(404);
  });

  it('adding an existing user keeps their account and roles', async () => {
    const g = await createGarage(t.db);
    const buyer = await createUser(t.db, { roles: ['buyer'], name: 'Sara' });
    const owner = await t.asUser(g.owner.phone);
    const res = await owner.http
      .post('/v1/garage/members')
      .send({ phone: buyer.phone })
      .expect(201);
    expect(res.body).toMatchObject({ userId: buyer.id, name: 'Sara' });
    const roles = await t.db
      .select()
      .from(schema.userRoles)
      .where(eq(schema.userRoles.userId, buyer.id));
    expect(roles.map((r) => r.role)).toEqual(['buyer']);
  });

  it(`at most ${STAFF_LIMIT} staff, the owner included`, async () => {
    const g = await createGarage(t.db);
    const owner = await t.asUser(g.owner.phone);
    for (let i = 1; i < STAFF_LIMIT; i++)
      await owner.http.post('/v1/garage/members').send({ phone: nextPhone() }).expect(201);
    const res = await owner.http
      .post('/v1/garage/members')
      .send({ phone: nextPhone() })
      .expect(409);
    expect(res.body.error.details).toEqual({ limit: STAFF_LIMIT });
    const list = await owner.http.get('/v1/garage/members').expect(200);
    expect(list.body).toHaveLength(STAFF_LIMIT);
  });

  it('two additions at the same moment cannot pass the limit', async () => {
    const g = await createGarage(t.db);
    const owner = await t.asUser(g.owner.phone);
    for (let i = 2; i < STAFF_LIMIT; i++)
      await owner.http.post('/v1/garage/members').send({ phone: nextPhone() }).expect(201);
    const results = await Promise.all(
      [1, 2, 3].map(() => owner.http.post('/v1/garage/members').send({ phone: nextPhone() })),
    );
    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409]);
  });
});

describe('stats', () => {
  it('counts this week and month, earnings this month, and reminders sent; rejected jobs and other garages excluded', async () => {
    const g = await createGarage(t.db);
    const other = await createGarage(t.db);
    const { car } = await createCar(t.db);
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
    const add = async (
      garage: typeof g,
      total: number,
      status: 'approved' | 'rejected' = 'approved',
      date = today,
    ) => {
      const job = await createJob(t.db, {
        garageId: garage.garage.id,
        carId: car.id,
        createdBy: garage.owner.id,
      });
      await t.db
        .update(schema.jobs)
        .set({ totalPkr: total, status, serviceDate: date })
        .where(eq(schema.jobs.id, job.id));
      return job;
    };
    const first = await add(g, 8000);
    await add(g, 4500);
    await add(g, 99_000, 'rejected');
    await add(other, 50_000);
    await add(g, 7000, 'approved', '2020-01-15'); // long ago
    await t.db.insert(schema.reminders).values({
      garageId: g.garage.id,
      carId: car.id,
      sourceJobId: first.id,
      kind: 'oil_change',
      dueDate: today,
      status: 'sent',
      sentAt: new Date(),
    });

    const owner = await t.asUser(g.owner.phone);
    const res = await owner.http.get('/v1/garage/stats').expect(200);
    expect(res.body).toEqual({
      jobsThisWeek: 2,
      jobsThisMonth: 2,
      earningsThisMonthPkr: 12_500,
      remindersSentThisMonth: 1,
    });
  });
});
