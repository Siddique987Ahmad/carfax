import { JOB_STATUSES } from '@carfax/shared';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgPolicy,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { cars } from './cars';
import { createdAt, deletedAt, updatedAt } from './columns';
import { customers, garages } from './garages';
import { garageScope } from './rls';
import { users } from './users';

export const jobStatus = pgEnum('job_status', JOB_STATUSES);
export const photoKind = pgEnum('photo_kind', ['odometer', 'before', 'after']);

/**
 * One service visit. The phone makes the id, so resending a job never creates a duplicate
 * (api/08). Jobs are never hard-deleted. Reports read only approved jobs not excluded by ops.
 */
export const jobs = pgTable(
  'jobs',
  {
    id: uuid().primaryKey().defaultRandom(),
    carId: uuid()
      .notNull()
      .references(() => cars.id),
    garageId: uuid()
      .notNull()
      .references(() => garages.id),
    /** The garage's own customer; must belong to the same garage (composite key below). */
    customerId: uuid(),
    createdBy: uuid()
      .notNull()
      .references(() => users.id),
    /** The plate the car had at this visit (normalised), since plates can move between cars (db/04b). */
    regNo: varchar({ length: 15 }),
    serviceDate: date().notNull(),
    /** Null only when the mechanic marks the odometer as not working (garage-app/11). */
    odometerKm: integer(),
    /** Broken or unreadable odometer: the job is kept but left out of mileage checks. */
    odometerNotWorking: boolean().notNull().default(false),
    totalPkr: integer(),
    notes: text(),
    status: jobStatus().notNull().default('submitted'),
    /** Ops can keep a removed garage's jobs out of reports without deleting them (admin/15). */
    excludedFromReports: boolean().notNull().default(false),
    /** "Next service due" from the job card; reminders are made from these (garage-app/20, api/13). */
    nextServiceDueDate: date(),
    nextServiceDueKm: integer(),
    /** When the mechanic logged it on the phone (may be days before it synced). */
    deviceCreatedAt: timestamp({ withTimezone: true }).notNull(),
    /** When the server received it. */
    syncedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: updatedAt(),
  },
  (t) => [
    foreignKey({
      name: 'jobs_customer_same_garage_fk',
      columns: [t.customerId, t.garageId],
      foreignColumns: [customers.id, customers.garageId],
    }),
    check(
      'jobs_reg_no_normalised',
      sql`${t.regNo} ~ '^[A-Z0-9]{3,15}$' AND ${t.regNo} ~ '[A-Z]' AND ${t.regNo} ~ '[0-9]'`,
    ),
    check('jobs_odometer_range', sql`${t.odometerKm} BETWEEN 0 AND 2000000`),
    check(
      'jobs_odometer_or_not_working',
      sql`${t.odometerKm} IS NOT NULL OR ${t.odometerNotWorking}`,
    ),
    check('jobs_total_not_negative', sql`${t.totalPkr} >= 0`),
    check('jobs_next_service_km_range', sql`${t.nextServiceDueKm} BETWEEN 0 AND 2000000`),
    // The car's timeline (tech doc), used by reports and mileage checks.
    index('jobs_car_date').on(t.carId, t.serviceDate),
    // Sync pulls (api/09).
    index().on(t.garageId, t.updatedAt),
    // The flagged-jobs review queue, oldest first (admin/09).
    index('jobs_flagged_queue')
      .on(t.syncedAt)
      .where(sql`${t.status} = 'flagged'`),
    index().on(t.customerId),
    pgPolicy('jobs_garage_isolation', {
      for: 'all',
      using: garageScope(t.garageId),
      withCheck: garageScope(t.garageId),
    }),
  ],
);

/** Work lines on a job. Work type codes come from WORK_TYPES in @carfax/shared (checked by Zod). */
export const jobItems = pgTable(
  'job_items',
  {
    id: uuid().primaryKey().defaultRandom(),
    jobId: uuid()
      .notNull()
      .references(() => jobs.id),
    /** e.g. 'oil_change', 'tuning'. Text, not an enum, so adding a work type needs no migration. */
    workType: text().notNull(),
    description: text(),
    partName: text(),
    partPricePkr: integer(),
    labourPricePkr: integer(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    check('job_items_work_type_format', sql`${t.workType} ~ '^[a-z][a-z_]{1,39}$'`),
    check('job_items_part_price_not_negative', sql`${t.partPricePkr} >= 0`),
    check('job_items_labour_price_not_negative', sql`${t.labourPricePkr} >= 0`),
    index().on(t.jobId),
    pgPolicy('job_items_garage_isolation', {
      for: 'all',
      // Through the parent job: jobs has its own policy, so this only finds the garage's jobs.
      using: sql`EXISTS (SELECT 1 FROM jobs WHERE jobs.id = ${t.jobId})`,
      withCheck: sql`EXISTS (SELECT 1 FROM jobs WHERE jobs.id = ${t.jobId})`,
    }),
  ],
);

/**
 * Odometer and before/after photos. The row can sync before the file finishes uploading:
 * `uploaded_at` stays null until the file is in storage, so the flag check can tell
 * "still uploading" from "no photo" (workers/02).
 */
export const jobPhotos = pgTable(
  'job_photos',
  {
    id: uuid().primaryKey().defaultRandom(),
    jobId: uuid()
      .notNull()
      .references(() => jobs.id),
    kind: photoKind().notNull(),
    /** Chosen by the server when it signs the upload (api/07). */
    storageKey: text().unique('job_photos_storage_key_unique'),
    uploadedAt: timestamp({ withTimezone: true }),
    /** When the photo was taken in the app's camera. */
    takenAt: timestamp({ withTimezone: true }).notNull(),
    /** Odometer reading read from the photo on the phone, if it could be read. */
    ocrReading: integer(),
    lat: numeric({ precision: 9, scale: 6, mode: 'number' }),
    lng: numeric({ precision: 9, scale: 6, mode: 'number' }),
    gpsAccuracyM: real(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    check(
      'job_photos_uploaded_has_key',
      sql`${t.uploadedAt} IS NULL OR ${t.storageKey} IS NOT NULL`,
    ),
    check('job_photos_ocr_range', sql`${t.ocrReading} BETWEEN 0 AND 2000000`),
    check('job_photos_lat_range', sql`${t.lat} BETWEEN -90 AND 90`),
    check('job_photos_lng_range', sql`${t.lng} BETWEEN -180 AND 180`),
    check('job_photos_gps_accuracy', sql`${t.gpsAccuracyM} >= 0`),
    index().on(t.jobId),
    pgPolicy('job_photos_garage_isolation', {
      for: 'all',
      // Through the parent job: jobs has its own policy, so this only finds the garage's jobs.
      using: sql`EXISTS (SELECT 1 FROM jobs WHERE jobs.id = ${t.jobId})`,
      withCheck: sql`EXISTS (SELECT 1 FROM jobs WHERE jobs.id = ${t.jobId})`,
    }),
  ],
);

/**
 * Warnings on a job, from the automatic checks (workers/02) or ops. Codes come from FLAG_CODES in
 * @carfax/shared. Only one open flag per code per job; once resolved, a new one can be raised.
 */
export const jobFlags = pgTable(
  'job_flags',
  {
    id: uuid().primaryKey().defaultRandom(),
    jobId: uuid()
      .notNull()
      .references(() => jobs.id),
    code: text().notNull(),
    /** What the check found, e.g. { previousKm: 84250, thisKm: 61000 }. */
    details: jsonb(),
    createdAt: createdAt(),
    /** Null when the system resolved it (e.g. the photo arrived). */
    resolvedBy: uuid().references(() => users.id),
    resolvedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    check('job_flags_code_format', sql`${t.code} ~ '^[A-Z][A-Z_]{1,39}$'`),
    uniqueIndex('job_flags_one_open_per_code')
      .on(t.jobId, t.code)
      .where(sql`${t.resolvedAt} IS NULL`),
    pgPolicy('job_flags_garage_isolation', {
      for: 'all',
      // Through the parent job: jobs has its own policy, so this only finds the garage's jobs.
      using: sql`EXISTS (SELECT 1 FROM jobs WHERE jobs.id = ${t.jobId})`,
      withCheck: sql`EXISTS (SELECT 1 FROM jobs WHERE jobs.id = ${t.jobId})`,
    }),
  ],
);

export const reminderStatus = pgEnum('reminder_status', [
  'scheduled',
  'sent',
  'failed',
  'cancelled',
]);

/**
 * "Your next service is due" messages. In the pilot they're sent with one tap from the garage's own
 * WhatsApp (api/13). `returned_job_id` is set when the car comes back, which gives the dashboard's
 * "customers who return after a reminder" (admin/16).
 */
export const reminders = pgTable(
  'reminders',
  {
    id: uuid().primaryKey().defaultRandom(),
    garageId: uuid()
      .notNull()
      .references(() => garages.id),
    carId: uuid()
      .notNull()
      .references(() => cars.id),
    customerId: uuid(),
    sourceJobId: uuid().references(() => jobs.id),
    /** The work type that's due, e.g. 'oil_change'. */
    kind: text().notNull(),
    dueDate: date().notNull(),
    status: reminderStatus().notNull().default('scheduled'),
    sentAt: timestamp({ withTimezone: true }),
    returnedJobId: uuid().references(() => jobs.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    foreignKey({
      name: 'reminders_customer_same_garage_fk',
      columns: [t.customerId, t.garageId],
      foreignColumns: [customers.id, customers.garageId],
    }),
    check('reminders_kind_format', sql`${t.kind} ~ '^[a-z][a-z_]{1,39}$'`),
    check('reminders_sent_has_time', sql`${t.status} <> 'sent' OR ${t.sentAt} IS NOT NULL`),
    // The reminder worker and the garage's "due" list.
    index().on(t.status, t.dueDate),
    // Sync pulls (api/09).
    index().on(t.garageId, t.updatedAt),
    pgPolicy('reminders_garage_isolation', {
      for: 'all',
      using: garageScope(t.garageId),
      withCheck: garageScope(t.garageId),
    }),
  ],
);
