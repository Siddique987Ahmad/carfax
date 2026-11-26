import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  check,
  index,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { createdAt, updatedAt } from './columns';

/**
 * Why a plate stopped being a car's current plate:
 * - plate_moved: the owner took the plate to another car (Punjab, since Sept 2025)
 * - re_registered: the car got a new plate, e.g. moved from another province to Punjab
 * - correction: the plate was recorded wrongly and fixed by ops or a garage
 */
export const registrationEndReason = pgEnum('registration_end_reason', [
  'plate_moved',
  're_registered',
  'correction',
]);

/**
 * One row per vehicle. The chassis number is the car's real identity; plates live in
 * car_registrations, because a Punjab plate belongs to its owner since Sept 2025 and can move to
 * another car, and cars re-registered from another province get a new plate (db/04b).
 * The id can come from the phone (cars are added offline); the API resolves duplicates through
 * car_aliases (api/06) and ops merge the rest (admin/13).
 * A car needs a chassis number or at least one registration; a constraint trigger checks this
 * when the transaction commits (migration 0005).
 */
export const cars = pgTable(
  'cars',
  {
    id: uuid().primaryKey().defaultRandom(),
    /** Normalised by normaliseChassisNo(): VIN or Japanese frame number. Unique. */
    chassisNo: varchar({ length: 30 }).unique('cars_chassis_no_unique'),
    make: text(),
    model: text(),
    /** Model year. */
    year: smallint(),
    /** Set when ops merge this car into another (admin/13). Never deleted; lookups follow it. */
    mergedIntoId: uuid().references((): AnyPgColumn => cars.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // Only normalised values: catches any code path that forgot normaliseChassisNo().
    check('cars_chassis_no_normalised', sql`${t.chassisNo} ~ '^[A-Z0-9]{6,30}$'`),
    check('cars_year_range', sql`${t.year} BETWEEN 1950 AND 2100`),
    check('cars_not_merged_into_self', sql`${t.mergedIntoId} <> ${t.id}`),
    // Partial-match search on chassis numbers (admin/11, web/06). Needs pg_trgm.
    index('cars_chassis_no_trgm').using('gin', t.chassisNo.op('gin_trgm_ops')),
    index().on(t.mergedIntoId),
  ],
);

/**
 * The plates a car has had, with dates. A plate is current (valid_to IS NULL) on at most one car,
 * and a car has at most one current plate. Past plates stay, so searches by an old plate still work
 * and every job keeps the plate it was serviced under (jobs.reg_no, db/05).
 */
export const carRegistrations = pgTable(
  'car_registrations',
  {
    id: uuid().primaryKey().defaultRandom(),
    carId: uuid()
      .notNull()
      .references(() => cars.id),
    /** Normalised by normaliseRegNo() in @carfax/shared: 'LEA1234'. */
    regNo: varchar({ length: 15 }).notNull(),
    /** Registration year, if known. */
    regYear: smallint(),
    /** When we first saw this plate on this car (not necessarily the official registration date). */
    validFrom: timestamp({ withTimezone: true }).notNull().defaultNow(),
    /** When the plate left this car. Null while it's the car's current plate. */
    validTo: timestamp({ withTimezone: true }),
    endedReason: registrationEndReason(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      'car_registrations_reg_no_normalised',
      sql`${t.regNo} ~ '^[A-Z0-9]{3,15}$' AND ${t.regNo} ~ '[A-Z]' AND ${t.regNo} ~ '[0-9]'`,
    ),
    check('car_registrations_reg_year_range', sql`${t.regYear} BETWEEN 1950 AND 2100`),
    check('car_registrations_dates', sql`${t.validTo} IS NULL OR ${t.validTo} >= ${t.validFrom}`),
    check('car_registrations_end_reason', sql`(${t.validTo} IS NULL) = (${t.endedReason} IS NULL)`),
    // A plate is on one car at a time, and a car has one current plate.
    uniqueIndex('car_registrations_current_reg_no')
      .on(t.regNo)
      .where(sql`${t.validTo} IS NULL`),
    uniqueIndex('car_registrations_current_per_car')
      .on(t.carId)
      .where(sql`${t.validTo} IS NULL`),
    // Partial-match search on current and past plates (admin/11, web/06). Needs pg_trgm.
    index('car_registrations_reg_no_trgm').using('gin', t.regNo.op('gin_trgm_ops')),
    index().on(t.carId),
  ],
);

/**
 * When two phones create the same car offline, the API keeps one car and records the other
 * phone's id here, so jobs that arrive later with that id still find the right car (api/06).
 * Aliases are kept forever.
 */
export const carAliases = pgTable(
  'car_aliases',
  {
    aliasId: uuid().primaryKey(),
    carId: uuid()
      .notNull()
      .references(() => cars.id),
    createdAt: createdAt(),
  },
  (t) => [check('car_aliases_not_self', sql`${t.aliasId} <> ${t.carId}`), index().on(t.carId)],
);

/**
 * Pairs of cars that may be the same vehicle, for ops to review and merge (admin/13). Written when a
 * plate and a chassis number point at two different cars (api/06).
 */
export const carDuplicateCandidates = pgTable(
  'car_duplicate_candidates',
  {
    id: uuid().primaryKey().defaultRandom(),
    carId: uuid()
      .notNull()
      .references(() => cars.id),
    otherCarId: uuid()
      .notNull()
      .references(() => cars.id),
    /** e.g. 'plate_and_chassis_disagree'. */
    reason: text().notNull(),
    details: jsonb(),
    createdAt: createdAt(),
    resolvedAt: timestamp({ withTimezone: true }),
    resolvedBy: uuid(),
  },
  (t) => [
    check('car_duplicate_candidates_not_self', sql`${t.carId} <> ${t.otherCarId}`),
    // One open entry per pair, whichever way round it was found.
    uniqueIndex('car_duplicate_candidates_open_pair')
      .on(sql`least(${t.carId}, ${t.otherCarId})`, sql`greatest(${t.carId}, ${t.otherCarId})`)
      .where(sql`${t.resolvedAt} IS NULL`),
  ],
);
