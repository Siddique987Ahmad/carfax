import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  check,
  index,
  pgTable,
  smallint,
  text,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { createdAt, updatedAt } from './columns';

/**
 * One row per vehicle. The id can come from the phone (cars are added offline);
 * the API resolves duplicates through car_aliases (api/06) and ops merge the rest (admin/13).
 */
export const cars = pgTable(
  'cars',
  {
    id: uuid().primaryKey().defaultRandom(),
    /** Normalised by normaliseRegNo() in @carfax/shared: 'LEA1234'. Unique. */
    regNo: varchar({ length: 15 }).unique('cars_reg_no_unique'),
    /**
     * Registration year. Nullable for now: if Punjab plates turn out to repeat across years,
     * the unique key becomes (reg_no, reg_year) without reshaping the table (open question).
     */
    regYear: smallint(),
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
    check('cars_has_identifier', sql`${t.regNo} IS NOT NULL OR ${t.chassisNo} IS NOT NULL`),
    // Only normalised values: catches any code path that forgot normaliseRegNo()/normaliseChassisNo().
    check(
      'cars_reg_no_normalised',
      sql`${t.regNo} ~ '^[A-Z0-9]{3,15}$' AND ${t.regNo} ~ '[A-Z]' AND ${t.regNo} ~ '[0-9]'`,
    ),
    check('cars_chassis_no_normalised', sql`${t.chassisNo} ~ '^[A-Z0-9]{6,30}$'`),
    check('cars_year_range', sql`${t.year} BETWEEN 1950 AND 2100`),
    check('cars_reg_year_range', sql`${t.regYear} BETWEEN 1950 AND 2100`),
    check('cars_not_merged_into_self', sql`${t.mergedIntoId} <> ${t.id}`),
    // Partial-match search on plates and chassis numbers (admin/11, web/06). Needs pg_trgm.
    index('cars_reg_no_trgm').using('gin', t.regNo.op('gin_trgm_ops')),
    index('cars_chassis_no_trgm').using('gin', t.chassisNo.op('gin_trgm_ops')),
    index().on(t.mergedIntoId),
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
