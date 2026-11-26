import { randomUUID } from 'node:crypto';
import { schema } from '@carfax/db';
import { and, eq, isNull } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCar, createGarage, nextPlate } from './factories';
import { startTestApp, type TestApp } from './harness';

let t: TestApp;
let A: Awaited<ReturnType<TestApp['asUser']>>['http'];
let B: Awaited<ReturnType<TestApp['asUser']>>['http'];
beforeAll(async () => {
  t = await startTestApp();
  A = (await t.asUser((await createGarage(t.db, { name: 'A Motors' })).owner.phone)).http;
  B = (await t.asUser((await createGarage(t.db, { name: 'B Motors' })).owner.phone)).http;
});
afterAll(async () => {
  await t?.close();
});

const currentPlateCar = async (regNo: string) =>
  (
    await t.db
      .select()
      .from(schema.carRegistrations)
      .where(and(eq(schema.carRegistrations.regNo, regNo), isNull(schema.carRegistrations.validTo)))
  )[0]?.carId;

describe('lookup', () => {
  it('different spellings of one plate return the same car', async () => {
    const { car } = await createCar(t.db, { plate: 'LEA4321' });
    for (const spelling of ['LEA-4321', 'lea 4321', 'LEA–4321', 'LEA-۴۳۲۱']) {
      const res = await A.get('/v1/cars/lookup').query({ reg: spelling }).expect(200);
      expect(res.body).toMatchObject({ found: true, car: { id: car.id, regNo: 'LEA4321' } });
    }
  });

  it('shows the car only: chassis last 4, no jobs, no customer', async () => {
    const created = await A.post('/v1/cars')
      .send({
        regNo: nextPlate(),
        chassisNo: 'NZE161-0123456',
        make: 'toyota',
        model: 'corolla',
        year: 2016,
      })
      .expect(200);
    const res = await B.get('/v1/cars/lookup').query({ chassis: 'nze1610123456' }).expect(200);
    expect(res.body.car).toEqual({
      id: created.body.carId,
      regNo: created.body.car.regNo,
      chassisLast4: '3456',
      make: 'Toyota',
      model: 'Corolla',
      year: 2016,
    });
  });

  it('an unknown plate is "not found", not an error', async () => {
    expect((await A.get('/v1/cars/lookup').query({ reg: 'ZZZ9999' }).expect(200)).body).toEqual({
      found: false,
    });
  });

  it('a merged car leads to the car that was kept', async () => {
    const kept = await createCar(t.db);
    const dup = await createCar(t.db);
    await t.db
      .update(schema.cars)
      .set({ mergedIntoId: kept.car.id })
      .where(eq(schema.cars.id, dup.car.id));
    const res = await A.get('/v1/cars/lookup').query({ reg: dup.regNo }).expect(200);
    expect(res.body.car.id).toBe(kept.car.id);
  });

  it('needs exactly one of reg and chassis, and a garage', async () => {
    await A.get('/v1/cars/lookup').expect(400);
    await A.get('/v1/cars/lookup').query({ reg: 'LEA1234', chassis: 'NZE1610123456' }).expect(400);
    await t.http.get('/v1/cars/lookup').query({ reg: 'LEA1234' }).expect(401);
  });
});

describe('adding cars', () => {
  it('creates a new car with the phone id; resending gives the same answer', async () => {
    const id = randomUUID();
    const body = { id, regNo: nextPlate(), make: 'Suzuki', model: 'Mehran', year: 2012 };
    const first = await A.post('/v1/cars').send(body).expect(200);
    expect(first.body).toMatchObject({ carId: id, created: true });
    const again = await A.post('/v1/cars').send(body).expect(200);
    expect(again.body).toMatchObject({ carId: id, created: false });
    expect(again.body.remappedFrom).toBeUndefined();
  });

  it('two offline-created copies of one car end up as one car with an alias, and the phone receives the remap', async () => {
    const plate = nextPlate();
    const phoneA = randomUUID();
    const phoneB = randomUUID();
    await A.post('/v1/cars').send({ id: phoneA, regNo: plate }).expect(200);
    const second = await B.post('/v1/cars').send({ id: phoneB, regNo: plate }).expect(200);
    expect(second.body).toMatchObject({ carId: phoneA, created: false, remappedFrom: phoneB });
    const [alias] = await t.db
      .select()
      .from(schema.carAliases)
      .where(eq(schema.carAliases.aliasId, phoneB));
    expect(alias!.carId).toBe(phoneA);
    // A job arriving later with garage B's phone id still finds the car.
    const later = await B.post('/v1/cars').send({ id: phoneB, regNo: plate }).expect(200);
    expect(later.body).toMatchObject({ carId: phoneA, remappedFrom: phoneB });
  });

  it('two phones syncing the same new car at the same moment: one car, the other an alias', async () => {
    const plate = nextPlate();
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    const results = await Promise.all(
      ids.map((id, i) => (i % 2 ? B : A).post('/v1/cars').send({ id, regNo: plate })),
    );
    const carIds = new Set(results.map((r) => r.body.carId));
    expect(carIds.size).toBe(1);
    expect(results.filter((r) => r.body.created)).toHaveLength(1);
    const cars = await t.db
      .select()
      .from(schema.cars)
      .where(eq(schema.cars.id, [...carIds][0]!));
    expect(cars).toHaveLength(1);
  });

  it('spells make and model one way', async () => {
    const res = await A.post('/v1/cars')
      .send({ regNo: nextPlate(), make: ' honda', model: 'CITY ' })
      .expect(200);
    expect(res.body.car).toMatchObject({ make: 'Honda', model: 'City' });
  });

  it('fills in missing details but never overwrites them', async () => {
    const plate = nextPlate();
    await A.post('/v1/cars').send({ regNo: plate }).expect(200);
    const filled = await B.post('/v1/cars')
      .send({ regNo: plate, make: 'Toyota', model: 'Yaris', chassisNo: 'NSP151-0000123' })
      .expect(200);
    expect(filled.body.car).toMatchObject({ make: 'Toyota', model: 'Yaris', chassisLast4: '0123' });
    const kept = await A.post('/v1/cars').send({ regNo: plate, make: 'Suzuki' }).expect(200);
    expect(kept.body.car.make).toBe('Toyota');
  });

  it('needs a plate or a chassis number, and refuses a bad plate', async () => {
    expect((await A.post('/v1/cars').send({ make: 'Toyota' }).expect(400)).body.error.code).toBe(
      'VALIDATION_FAILED',
    );
    await A.post('/v1/cars').send({ regNo: 'hello' }).expect(400);
  });
});

describe('plates that move (db/04b)', () => {
  it('"different car": the plate moves to a new car and the old car keeps its history', async () => {
    const plate = nextPlate();
    const corolla = (
      await A.post('/v1/cars').send({ regNo: plate, make: 'Toyota', model: 'Corolla' }).expect(200)
    ).body.carId;
    const civic = await A.post('/v1/cars')
      .send({ regNo: plate, make: 'Honda', model: 'Civic', differentCar: true })
      .expect(200);
    expect(civic.body).toMatchObject({
      created: true,
      plateMoved: true,
      car: { make: 'Honda', regNo: plate },
    });
    expect(civic.body.carId).not.toBe(corolla);
    expect(await currentPlateCar(plate)).toBe(civic.body.carId);
    const [ended] = await t.db
      .select()
      .from(schema.carRegistrations)
      .where(eq(schema.carRegistrations.carId, corolla));
    expect(ended).toMatchObject({ regNo: plate, endedReason: 'plate_moved' });
    const audit = await t.db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.entityId, civic.body.carId));
    expect(audit.map((a) => a.action)).toEqual(['car.plate_moved']);
  });

  it('a known plate with a different chassis is a different car', async () => {
    const plate = nextPlate();
    const first = (
      await A.post('/v1/cars').send({ regNo: plate, chassisNo: 'ZRE172-1111111' }).expect(200)
    ).body.carId;
    const second = await B.post('/v1/cars')
      .send({ regNo: plate, chassisNo: 'ZRE172-2222222' })
      .expect(200);
    expect(second.body).toMatchObject({ created: true, plateMoved: true });
    expect(second.body.carId).not.toBe(first);
  });

  it('a known chassis with a new plate was re-registered: same car, new plate', async () => {
    const oldPlate = nextPlate();
    const newPlate = nextPlate();
    const car = (
      await A.post('/v1/cars').send({ regNo: oldPlate, chassisNo: 'NHP10-3333333' }).expect(200)
    ).body.carId;
    const res = await B.post('/v1/cars')
      .send({ regNo: newPlate, chassisNo: 'NHP10-3333333' })
      .expect(200);
    expect(res.body).toMatchObject({ carId: car, created: false, car: { regNo: newPlate } });
    const regs = await t.db
      .select()
      .from(schema.carRegistrations)
      .where(eq(schema.carRegistrations.carId, car));
    expect(regs.map((r) => [r.regNo, r.endedReason]).sort()).toEqual(
      [
        [newPlate, null],
        [oldPlate, 're_registered'],
      ].sort(),
    );
  });
});

describe('conflicts for ops', () => {
  it('plate on one car and chassis on another: trust the chassis, and list the pair for review', async () => {
    const plateCar = await createCar(t.db);
    const chassisCar = (
      await A.post('/v1/cars').send({ regNo: nextPlate(), chassisNo: 'KSP130-4444444' }).expect(200)
    ).body.carId;
    const res = await A.post('/v1/cars')
      .send({ regNo: plateCar.regNo, chassisNo: 'KSP130-4444444' })
      .expect(200);
    expect(res.body).toMatchObject({ carId: chassisCar, possibleDuplicate: true });
    const candidates = await t.db
      .select()
      .from(schema.carDuplicateCandidates)
      .where(eq(schema.carDuplicateCandidates.carId, chassisCar));
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      otherCarId: plateCar.car.id,
      reason: 'plate_and_chassis_disagree',
    });
    // Seen again: still one entry.
    await B.post('/v1/cars')
      .send({ regNo: plateCar.regNo, chassisNo: 'KSP130-4444444' })
      .expect(200);
    expect(
      await t.db
        .select()
        .from(schema.carDuplicateCandidates)
        .where(eq(schema.carDuplicateCandidates.carId, chassisCar)),
    ).toHaveLength(1);
  });
});

describe('garage status', () => {
  it('a pending garage can look cars up but not add them', async () => {
    const pending = (await t.asUser((await createGarage(t.db, { status: 'pending' })).owner.phone))
      .http;
    await pending.get('/v1/cars/lookup').query({ reg: 'LEA1234' }).expect(200);
    expect(
      (await pending.post('/v1/cars').send({ regNo: nextPlate() }).expect(403)).body.error.code,
    ).toBe('GARAGE_PENDING');
  });
});
