import { Controller, Get, Inject, Module } from '@nestjs/common';
import type { Db } from '@carfax/db';
import { schema, withSystem } from '@carfax/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildOpenApi } from '../src/app';
import { DB } from '../src/db/db.module';
import { createCar, createCustomer, createGarage, createJob } from './factories';
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
  return { names: [customer.name!] };
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
});

describe('privacy: the check itself catches a leak', () => {
  // A deliberately leaky route, to prove the check fails when a customer phone is added.
  @Controller('test-leak')
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
