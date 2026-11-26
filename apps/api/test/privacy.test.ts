import { Controller, Get, Inject, Module } from '@nestjs/common';
import type { Db } from '@carfax/db';
import { sql } from 'drizzle-orm';
import { schema, withSystem } from '@carfax/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Public } from '../src/access/access.decorators';
import { buildOpenApi } from '../src/app';
import { DB } from '../src/db/db.module';
import { createCar, createCustomer, createGarage, createJob, createUser } from './factories';
import { startTestApp, type TestApp } from './harness';
import { findPersonalData } from './privacy';

// The product's core privacy rule: reports and public responses describe the car, never the person.
// Customer names and phones live in `customers` and must never appear in any response that isn't
// the garage's own customer list.

/** Routes that may show customer details to their own garage. Add one here only with a reason. */
const ALLOWED_TO_SHOW_CUSTOMERS: readonly string[] = [
  // e.g. 'GET /v1/customers' (api/11): the garage's private customer list, behind withGarage.
];

/** Seeds a garage whose customer has a name and phone that must never leak. */
async function seedCustomer(t: TestApp) {
  const { garage, owner } = await createGarage(t.db);
  const customer = await createCustomer(t.db, garage.id, {
    name: 'Bilal Privacy-Check',
    phone: '+923457778899',
  });
  const { car, regNo } = await createCar(t.db);
  await createJob(t.db, {
    garageId: garage.id,
    carId: car.id,
    createdBy: owner.id,
    customerId: customer.id,
    regNo,
  });
  return { names: [customer.name!], phones: [customer.phone!] };
}

describe('privacy: no customer data in public responses', () => {
  let t: TestApp;
  let names: string[];
  beforeAll(async () => {
    t = await startTestApp();
    ({ names } = await seedCustomer(t));
  });
  afterAll(async () => {
    await t?.close();
  });

  it('every GET route without parameters is free of customer names and phones', async () => {
    const paths = buildOpenApi(t.app).paths;
    const routes = Object.entries(paths)
      .filter(([path, ops]) => ops.get && !path.includes('{'))
      .map(([path]) => path)
      .filter((path) => !ALLOWED_TO_SHOW_CUSTOMERS.includes(`GET ${path}`));
    expect(routes.length).toBeGreaterThan(0);
    for (const path of routes) {
      const res = await t.http.get(path);
      expect(findPersonalData(res.text, names), `GET ${path}`).toEqual([]);
    }
    // Routes with parameters (report pages, search) get explicit cases here as they're built.
  });

  it('the public bill page (api/12) shows no customer name or phone', async () => {
    const [job] = await t.db.select({ id: schema.jobs.id }).from(schema.jobs).limit(1);
    const owner = await t.db
      .execute(sql`select u.phone from jobs j join garages g on g.id = j.garage_id
      join users u on u.id = g.owner_id where j.id = ${job!.id}`);
    const session = await t.asUser(String(owner.rows[0]!.phone));
    const sent = await session.http.post(`/v1/jobs/${job!.id}/send-bill`).send({}).expect(200);
    const res = await t.http.get(`/v1/bills/${sent.body.billUrl.split('/b/')[1]}`).expect(200);
    expect(findPersonalData(res.text, names)).toEqual([]);
  });
});

describe('privacy: signed in, nobody outside the garage sees its customers', () => {
  let t: TestApp;
  let names: string[];
  let phones: string[];
  beforeAll(async () => {
    t = await startTestApp();
    ({ names, phones } = await seedCustomer(t));
  });
  afterAll(async () => {
    await t?.close();
  });

  it("another garage's owner and a buyer see neither the name nor the phone on any route", async () => {
    const otherGarage = await createGarage(t.db, { name: 'Other Motors' });
    const callers = [
      await t.asUser(otherGarage.owner.phone),
      await t.asUser((await createUser(t.db, { roles: ['buyer'] })).phone, 'web'),
    ];
    const paths = Object.entries(buildOpenApi(t.app).paths)
      .filter(([path, ops]) => ops.get && !path.includes('{'))
      .map(([path]) => path);
    expect(paths).toContain('/v1/customers');
    for (const caller of callers) {
      for (const path of paths) {
        const res = await caller.http.get(path);
        expect(findPersonalData(res.text, names, phones), `GET ${path}`).toEqual([]);
      }
    }
  });
});

describe('privacy: the check itself catches a leak', () => {
  // A deliberately leaky route, to prove the check fails when a customer phone is added.
  @Controller('test-leak')
  @Public()
  class LeakyController {
    constructor(@Inject(DB) private readonly db: Db) {}
    @Get()
    async report() {
      const [customer] = await withSystem(this.db, (tx) =>
        tx.select().from(schema.customers).limit(1),
      );
      return { car: 'Toyota Corolla', lastServicedFor: customer?.name, contact: customer?.phone };
    }
  }
  @Module({ controllers: [LeakyController] })
  class LeakyModule {}

  let t: TestApp;
  let names: string[];
  beforeAll(async () => {
    t = await startTestApp({ imports: [LeakyModule] });
    ({ names } = await seedCustomer(t));
  });
  afterAll(async () => {
    await t?.close();
  });

  it('flags the phone and the name', async () => {
    const res = await t.http.get('/v1/test-leak').expect(200);
    expect(findPersonalData(res.text, names)).toEqual([
      'a phone number',
      'the name "Bilal Privacy-Check"',
    ]);
  });

  it('flags a phone in any spelling', () => {
    for (const leak of ['0345-7778899', '0345 7778899', '923457778899', '+92 345 7778899']) {
      expect(findPersonalData({ note: `call ${leak}` }, [])).toEqual(['a phone number']);
    }
  });
});
