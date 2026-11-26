import { type Db, schema, type Tx } from '@carfax/db';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { DB } from '../db/db.module';

export interface CarInput {
  /** The id the phone made for this car (offline). */
  id?: string;
  regNo?: string | null;
  regYear?: number | null;
  chassisNo?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  /** The mechanic said the car found for this plate isn't this car (the plate moved). */
  differentCar?: boolean;
}

export interface CarResolution {
  carId: string;
  created: boolean;
  /** The phone's id was mapped to an existing car: the app swaps `remappedFrom` for `carId`. */
  remappedFrom?: string;
  /** The plate and chassis point at different cars; logged for ops (admin/13). */
  possibleDuplicate?: boolean;
  /** The plate was taken off the car that had it, because this is a different car. */
  plateMoved?: boolean;
}

/**
 * Finds or creates the car for a plate and/or chassis number (api/06), for POST /cars now and sync
 * push later (api/08). The chassis number is the car's real identity; plates can move between cars
 * (db/04b). Concurrent calls for the same plate or chassis wait for each other (advisory locks), so
 * two phones syncing the same car at once get one car and one alias.
 */
@Injectable()
export class CarIdentityService {
  constructor(@Inject(DB) private readonly db: Db) {}

  resolve(input: CarInput, actorId: string): Promise<CarResolution> {
    return this.db.transaction((tx) => this.resolveIn(tx, input, actorId));
  }

  async resolveIn(tx: Tx, input: CarInput, actorId: string): Promise<CarResolution> {
    const keys = [
      input.id && `car-id:${input.id}`,
      input.regNo && `plate:${input.regNo}`,
      input.chassisNo && `chassis:${input.chassisNo}`,
    ]
      .filter((k): k is string => Boolean(k))
      .sort(); // same order everywhere, so two calls can't deadlock
    for (const key of keys) await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);

    // A resend of a car this phone already created, or one already mapped to another car.
    if (input.id) {
      const [byId] = await tx
        .select({ id: schema.cars.id })
        .from(schema.cars)
        .where(eq(schema.cars.id, input.id));
      if (byId) {
        const carId = await this.root(tx, byId.id);
        await this.learn(tx, carId, input);
        return { carId, created: false, ...(carId !== input.id && { remappedFrom: input.id }) };
      }
      const [alias] = await tx
        .select()
        .from(schema.carAliases)
        .where(eq(schema.carAliases.aliasId, input.id));
      if (alias)
        return { carId: await this.root(tx, alias.carId), created: false, remappedFrom: input.id };
    }

    const plateReg = input.regNo
      ? await this.currentRegistration(tx, { regNo: input.regNo })
      : undefined;
    const plateCarId = plateReg ? await this.root(tx, plateReg.carId) : undefined;
    const [chassisRow] = input.chassisNo
      ? await tx
          .select({ id: schema.cars.id })
          .from(schema.cars)
          .where(eq(schema.cars.chassisNo, input.chassisNo))
      : [];
    const chassisCarId = chassisRow ? await this.root(tx, chassisRow.id) : undefined;

    let result: CarResolution;
    if (chassisCarId && plateCarId && chassisCarId !== plateCarId) {
      // The plate is on one car, the chassis on another. Trust the chassis, and ask ops to look.
      await tx
        .insert(schema.carDuplicateCandidates)
        .values({
          carId: chassisCarId,
          otherCarId: plateCarId,
          reason: 'plate_and_chassis_disagree',
          details: { regNo: input.regNo, chassisNo: input.chassisNo },
        })
        .onConflictDoNothing();
      result = { carId: chassisCarId, created: false, possibleDuplicate: true };
    } else if (chassisCarId) {
      // Known chassis. A plate not on any car yet means the car was re-registered (e.g. from Sindh).
      if (input.regNo && !plateCarId)
        await this.setPlate(tx, chassisCarId, input, 're_registered', actorId);
      result = { carId: chassisCarId, created: false };
    } else if (plateCarId) {
      const [plateCar] = await tx.select().from(schema.cars).where(eq(schema.cars.id, plateCarId));
      const otherChassis = Boolean(
        input.chassisNo && plateCar!.chassisNo && plateCar!.chassisNo !== input.chassisNo,
      );
      if (input.differentCar || otherChassis) {
        // The plate moved to another car (Punjab, since Sept 2025): end it on the old car and start
        // a new car with it, so the two histories never mix (db/04b).
        await tx
          .update(schema.carRegistrations)
          .set({ validTo: new Date(), endedReason: 'plate_moved' })
          .where(eq(schema.carRegistrations.id, plateReg!.id));
        const carId = await this.createCar(tx, input);
        await tx.insert(schema.auditLogs).values({
          actorId,
          action: 'car.plate_moved',
          entity: 'car',
          entityId: carId,
          note: input.differentCar
            ? 'Mechanic said this is a different car'
            : 'Chassis number differs',
          before: { carId: plateCarId, regNo: input.regNo },
          after: { carId, regNo: input.regNo },
        });
        result = { carId, created: true, plateMoved: true };
      } else {
        if (input.chassisNo && !plateCar!.chassisNo) {
          await tx
            .update(schema.cars)
            .set({ chassisNo: input.chassisNo })
            .where(eq(schema.cars.id, plateCarId));
        }
        result = { carId: plateCarId, created: false };
      }
    } else {
      result = { carId: await this.createCar(tx, input), created: true };
    }

    if (!result.created) await this.learn(tx, result.carId, input);
    // The phone's id now points at the car that was kept, for jobs that arrive with it later.
    if (input.id && input.id !== result.carId) {
      await tx
        .insert(schema.carAliases)
        .values({ aliasId: input.id, carId: result.carId })
        .onConflictDoNothing();
      result.remappedFrom = input.id;
    }
    return result;
  }

  /**
   * The car a phone-made car id stands for now: the car itself, or the car its alias points to,
   * following merges. Null if the server has never seen the id.
   */
  async resolveCarId(tx: Tx, carId: string): Promise<string | null> {
    const [car] = await tx
      .select({ id: schema.cars.id })
      .from(schema.cars)
      .where(eq(schema.cars.id, carId));
    if (car) return this.root(tx, car.id);
    const [alias] = await tx
      .select()
      .from(schema.carAliases)
      .where(eq(schema.carAliases.aliasId, carId));
    return alias ? this.root(tx, alias.carId) : null;
  }

  /** The car's current plate, if it has one. */
  async currentPlate(tx: Tx, carId: string): Promise<string | null> {
    return (await this.currentRegistration(tx, { carId }))?.regNo ?? null;
  }

  /** The car a plate or chassis number belongs to now, without creating anything. */
  async lookup(by: { regNo?: string; chassisNo?: string }) {
    let carId: string | undefined;
    if (by.regNo) {
      const reg = await this.currentRegistration(this.db, { regNo: by.regNo });
      carId = reg?.carId;
    } else if (by.chassisNo) {
      const [row] = await this.db
        .select({ id: schema.cars.id })
        .from(schema.cars)
        .where(eq(schema.cars.chassisNo, by.chassisNo));
      carId = row?.id;
    }
    if (!carId) return undefined;
    return this.summary(await this.root(this.db, carId));
  }

  /** What a garage may see about a car: never other garages' jobs, and only the chassis' last 4. */
  async summary(carId: string, tx: Tx | Db = this.db) {
    const [car] = await tx.select().from(schema.cars).where(eq(schema.cars.id, carId));
    const reg = await this.currentRegistration(tx, { carId });
    return {
      id: car!.id,
      regNo: reg?.regNo ?? null,
      chassisLast4: car!.chassisNo ? car!.chassisNo.slice(-4) : null,
      make: car!.make,
      model: car!.model,
      year: car!.year,
    };
  }

  private async currentRegistration(tx: Tx | Db, by: { regNo?: string; carId?: string }) {
    const [reg] = await tx
      .select()
      .from(schema.carRegistrations)
      .where(
        and(
          by.regNo
            ? eq(schema.carRegistrations.regNo, by.regNo)
            : eq(schema.carRegistrations.carId, by.carId!),
          isNull(schema.carRegistrations.validTo),
        ),
      );
    return reg;
  }

  /** Follows merges (admin/13) to the car that was kept. */
  private async root(tx: Tx | Db, carId: string): Promise<string> {
    let current = carId;
    for (let hops = 0; hops < 10; hops++) {
      const [car] = await tx
        .select({ mergedIntoId: schema.cars.mergedIntoId })
        .from(schema.cars)
        .where(eq(schema.cars.id, current));
      if (!car?.mergedIntoId) return current;
      current = car.mergedIntoId;
    }
    return current;
  }

  private async createCar(tx: Tx, input: CarInput): Promise<string> {
    const [car] = await tx
      .insert(schema.cars)
      .values({
        ...(input.id && { id: input.id }),
        chassisNo: input.chassisNo ?? null,
        make: input.make ?? null,
        model: input.model ?? null,
        year: input.year ?? null,
      })
      .returning({ id: schema.cars.id });
    if (input.regNo) {
      await tx
        .insert(schema.carRegistrations)
        .values({ carId: car!.id, regNo: input.regNo, regYear: input.regYear ?? null });
    }
    return car!.id;
  }

  /** Gives a car a new current plate, ending its old one. */
  private async setPlate(
    tx: Tx,
    carId: string,
    input: CarInput,
    reason: 're_registered',
    actorId: string,
  ) {
    const current = await this.currentRegistration(tx, { carId });
    if (current?.regNo === input.regNo) return;
    if (current) {
      await tx
        .update(schema.carRegistrations)
        .set({ validTo: new Date(), endedReason: reason })
        .where(eq(schema.carRegistrations.id, current.id));
    }
    await tx
      .insert(schema.carRegistrations)
      .values({ carId, regNo: input.regNo!, regYear: input.regYear ?? null });
    await tx.insert(schema.auditLogs).values({
      actorId,
      action: 'car.re_registered',
      entity: 'car',
      entityId: carId,
      before: { regNo: current?.regNo ?? null },
      after: { regNo: input.regNo },
    });
  }

  /** Fills in make, model and year if the car doesn't have them yet; never overwrites. */
  private async learn(tx: Tx, carId: string, input: CarInput) {
    const [car] = await tx.select().from(schema.cars).where(eq(schema.cars.id, carId));
    const patch = {
      ...(!car!.make && input.make && { make: input.make }),
      ...(!car!.model && input.model && { model: input.model }),
      ...(!car!.year && input.year && { year: input.year }),
    };
    if (Object.keys(patch).length)
      await tx.update(schema.cars).set(patch).where(eq(schema.cars.id, carId));
  }
}
