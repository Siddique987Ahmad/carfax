import { z } from 'zod';
import {
  ChassisNoSchema,
  PakistanMobileSchema,
  RegNoSchema,
  WorkTypeSchema,
} from './schemas/common';

// The garage app's sync format (api/08, api/09): WatermelonDB's raw records, snake_case columns,
// times as millisecond numbers. WatermelonDB's own fields (_status, _changed) are dropped.

const id = z.uuid();
const ms = z
  .number()
  .int()
  .positive()
  .transform((n) => new Date(n));
const isoDate = z.iso.date();
const km = z.number().int().min(0).max(2_000_000);
const rupees = z.number().int().min(0).max(100_000_000);

export const SyncCarSchema = z
  .object({
    id,
    reg_no: RegNoSchema.nullish(),
    reg_year: z.number().int().min(1950).max(2100).nullish(),
    chassis_no: ChassisNoSchema.nullish(),
    make: z.string().trim().min(1).max(40).nullish(),
    model: z.string().trim().min(1).max(40).nullish(),
    year: z.number().int().min(1950).max(2100).nullish(),
    /** The mechanic said the car found for this plate is a different car (api/06). */
    different_car: z.boolean().optional(),
  })
  .refine((c) => c.reg_no || c.chassis_no, {
    message: 'A car needs a plate or a chassis number',
    path: ['reg_no'],
  });

export const SyncCustomerSchema = z.object({
  id,
  name: z.string().trim().max(80).nullish(),
  phone: PakistanMobileSchema.nullish(),
});

export const SyncJobSchema = z
  .object({
    id,
    car_id: id,
    customer_id: id.nullish(),
    reg_no: RegNoSchema.nullish(),
    service_date: isoDate,
    odometer_km: km.nullish(),
    odometer_not_working: z.boolean().default(false),
    notes: z.string().max(1000).nullish(),
    next_service_due_date: isoDate.nullish(),
    next_service_due_km: km.nullish(),
    device_created_at: ms,
  })
  .refine((j) => j.odometer_km != null || j.odometer_not_working, {
    message: 'An odometer reading is needed unless the odometer is marked as not working',
    path: ['odometer_km'],
  });

export const SyncJobItemSchema = z.object({
  id,
  job_id: id,
  work_type: WorkTypeSchema,
  description: z.string().max(200).nullish(),
  part_name: z.string().max(100).nullish(),
  part_price_pkr: rupees.nullish(),
  labour_price_pkr: rupees.nullish(),
});

export const SyncJobPhotoSchema = z.object({
  id,
  job_id: id,
  kind: z.enum(['odometer', 'before', 'after']),
  /** From POST /uploads/sign; empty until the photo has been signed for upload. */
  storage_key: z.string().max(200).nullish(),
  taken_at: ms,
  ocr_reading: km.nullish(),
  lat: z.number().min(-90).max(90).nullish(),
  lng: z.number().min(-180).max(180).nullish(),
  gps_accuracy_m: z.number().min(0).max(100_000).nullish(),
});

const table = <T extends z.ZodType>(record: T, max: number) =>
  z
    .object({
      created: z.array(record).max(max).default([]),
      updated: z.array(record).max(max).default([]),
      deleted: z.array(id).max(max).default([]),
    })
    .default({ created: [], updated: [], deleted: [] });

/** At most 50 jobs per push (api/08); the app splits a bigger backlog. */
export const SYNC_MAX_JOBS = 50;

export const SyncPushSchema = z.object({
  changes: z.object({
    cars: table(SyncCarSchema, 100),
    customers: table(SyncCustomerSchema, 100),
    jobs: table(SyncJobSchema, SYNC_MAX_JOBS),
    job_items: table(SyncJobItemSchema, 500),
    job_photos: table(SyncJobPhotoSchema, 200),
  }),
  last_pulled_at: z.number().int().nonnegative().nullish(),
});
export type SyncPush = z.infer<typeof SyncPushSchema>;

/**
 * Why a single record was refused while the rest of the push was saved. These can never be fixed by
 * resending, so they're reported instead of failing the whole push (which would block sync forever).
 */
export const SYNC_REJECT_CODES = [
  /** The job id already belongs to another garage. */
  'JOB_CONFLICT',
  /** A submitted job can't be changed or deleted from the app; ops correct it (admin/12). */
  'JOB_LOCKED',
  /** The job's car isn't in this push and isn't known to the server. */
  'JOB_UNKNOWN_CAR',
  /** The service date is in the future. */
  'JOB_FUTURE_DATE',
  /** A new job needs at least one work item. */
  'JOB_NO_ITEMS',
  /** The item or photo's job wasn't saved (refused or unknown). */
  'PARENT_JOB_MISSING',
  /** The photo's storage key isn't the one the server issued for this job and photo. */
  'PHOTO_KEY_INVALID',
  /** Photos are evidence and can't be deleted from the app. */
  'PHOTO_LOCKED',
  /** Another customer of this garage already has that phone number. */
  'CUSTOMER_PHONE_TAKEN',
  /** The record's id is already used by another garage (or, for a photo, another job). */
  'ID_CONFLICT',
] as const;
export type SyncRejectCode = (typeof SYNC_REJECT_CODES)[number];

/** Saved anyway, with a change worth knowing about. */
export const SYNC_WARNING_CODES = [
  /** The job's customer isn't known to the server, so the job was saved without one. */
  'CUSTOMER_UNKNOWN',
] as const;
export type SyncWarningCode = (typeof SYNC_WARNING_CODES)[number];
