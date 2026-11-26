import { GARAGE_ROLES, GARAGE_STATUSES } from '@carfax/shared';
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  unique,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { createdAt, deletedAt, updatedAt } from './columns';
import { users } from './users';

export const garageStatus = pgEnum('garage_status', GARAGE_STATUSES);
export const garageRole = pgEnum('garage_role', GARAGE_ROLES);

/** A partner workshop. Ops approve it before its jobs are accepted (admin/08). */
export const garages = pgTable(
  'garages',
  {
    id: uuid().primaryKey().defaultRandom(),
    ownerId: uuid()
      .notNull()
      .references(() => users.id),
    name: text().notNull(),
    city: text().notNull(),
    address: text(),
    lat: numeric({ precision: 9, scale: 6, mode: 'number' }),
    lng: numeric({ precision: 9, scale: 6, mode: 'number' }),
    status: garageStatus().notNull().default('pending'),
    /** Why ops approved or suspended it; the garage sees the suspension reason (admin/08). */
    statusReason: text(),
    statusChangedAt: timestamp({ withTimezone: true }),
    /** 0–100, recalculated nightly from flags and reviews (admin/15), never typed by hand. */
    trustScore: integer().notNull().default(100),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('garages_trust_score_range', sql`${t.trustScore} BETWEEN 0 AND 100`),
    check('garages_lat_range', sql`${t.lat} BETWEEN -90 AND 90`),
    check('garages_lng_range', sql`${t.lng} BETWEEN -180 AND 180`),
    index().on(t.status, t.city),
    index().on(t.ownerId),
  ],
);

/** Staff of a garage and their role in it. The owner is also listed here, as `owner`. */
export const garageMembers = pgTable(
  'garage_members',
  {
    garageId: uuid()
      .notNull()
      .references(() => garages.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: garageRole().notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.garageId, t.userId] }), index().on(t.userId)],
);

/**
 * A garage's private customer list. Never shared between garages and never read by reports.
 * The id can come from the phone, because mechanics add customers offline.
 */
export const customers = pgTable(
  'customers',
  {
    id: uuid().primaryKey().defaultRandom(),
    garageId: uuid()
      .notNull()
      .references(() => garages.id),
    name: text(),
    /** '+923XXXXXXXXX' for WhatsApp bills and reminders; cleared when the customer is deleted (api/11). */
    phone: varchar({ length: 13 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    check('customers_phone_format', sql`${t.phone} ~ '^\\+923[0-9]{9}$'`),
    // One customer per phone per garage (tech doc), ignoring deleted customers.
    uniqueIndex('customers_garage_phone_unique')
      .on(t.garageId, t.phone)
      .where(sql`${t.deletedAt} IS NULL`),
    index().on(t.garageId, t.updatedAt),
    // Lets jobs and reminders reference (customer, garage) together, so a job can only point at a
    // customer of its own garage (db/05).
    unique('customers_id_garage_unique').on(t.id, t.garageId),
  ],
);
