// Zod schemas made from the tables, for the API and admin to validate with the database's own rules.
// This entry point never loads the Postgres driver, so it's safe for browser and app bundles.
// Request-only schemas (forms, filters) stay hand-written in @carfax/shared.
import {
  ChassisNoSchema,
  FlagCodeSchema,
  PAKISTAN_MOBILE_PATTERN,
  RegNoSchema,
  WorkTypeSchema,
} from '@carfax/shared';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import type { z } from 'zod';
import { carAliases, carRegistrations, cars } from './schema/cars';
import { customers, garageMembers, garages } from './schema/garages';
import { jobFlags, jobItems, jobPhotos, jobs, reminders } from './schema/jobs';
import { userRoles, users } from './schema/users';

export { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';

// users (db/02)
export const userInsertSchema = createInsertSchema(users, {
  phone: (s) => s.regex(PAKISTAN_MOBILE_PATTERN, 'Phone must be +923XXXXXXXXX'),
});
export const userSelectSchema = createSelectSchema(users);
/** What any client may see about a user: never the TOTP secret. */
export const publicUserSchema = userSelectSchema.omit({ totpSecretEnc: true });

export const userRoleInsertSchema = createInsertSchema(userRoles);
export const userRoleSelectSchema = createSelectSchema(userRoles);

// garages, staff and customers (db/03)
export const garageInsertSchema = createInsertSchema(garages, {
  name: (s) => s.trim().min(2),
  city: (s) => s.trim().min(2),
  lat: (s) => s.min(-90).max(90),
  lng: (s) => s.min(-180).max(180),
});
export const garageSelectSchema = createSelectSchema(garages);

export const garageMemberInsertSchema = createInsertSchema(garageMembers);
export const garageMemberSelectSchema = createSelectSchema(garageMembers);

export const customerInsertSchema = createInsertSchema(customers, {
  phone: (s) => s.regex(PAKISTAN_MOBILE_PATTERN, 'Phone must be +923XXXXXXXXX'),
});
export const customerSelectSchema = createSelectSchema(customers);

// cars and plate history (db/04, db/04b)
/** Any chassis spelling goes in; the normalised form comes out. Plates are in carRegistrationInsertSchema. */
export const carInsertSchema = createInsertSchema(cars, {
  chassisNo: ChassisNoSchema.nullish(),
  year: (s) => s.min(1950).max(2100),
});
export const carSelectSchema = createSelectSchema(cars);

/** Any plate spelling goes in; the normalised form comes out. */
export const carRegistrationInsertSchema = createInsertSchema(carRegistrations, {
  regNo: RegNoSchema,
  regYear: (s) => s.min(1950).max(2100),
});
export const carRegistrationSelectSchema = createSelectSchema(carRegistrations);

export const carAliasSelectSchema = createSelectSchema(carAliases);

// jobs, work items, photos, flags and reminders (db/05)
const km = (s: z.ZodNumber) => s.int().min(0).max(2_000_000);

export const jobInsertSchema = createInsertSchema(jobs, {
  regNo: RegNoSchema.nullish(),
  odometerKm: km,
  nextServiceDueKm: km,
  totalPkr: (s) => s.int().min(0),
}).refine((job) => job.odometerKm != null || job.odometerNotWorking === true, {
  message: 'An odometer reading is needed unless the odometer is marked as not working',
  path: ['odometerKm'],
});
export const jobSelectSchema = createSelectSchema(jobs);

export const jobItemInsertSchema = createInsertSchema(jobItems, {
  workType: WorkTypeSchema,
  partPricePkr: (s) => s.int().min(0),
  labourPricePkr: (s) => s.int().min(0),
});
export const jobItemSelectSchema = createSelectSchema(jobItems);

export const jobPhotoInsertSchema = createInsertSchema(jobPhotos, {
  ocrReading: km,
  lat: (s) => s.min(-90).max(90),
  lng: (s) => s.min(-180).max(180),
  gpsAccuracyM: (s) => s.min(0),
});
export const jobPhotoSelectSchema = createSelectSchema(jobPhotos);

export const jobFlagInsertSchema = createInsertSchema(jobFlags, { code: FlagCodeSchema });
export const jobFlagSelectSchema = createSelectSchema(jobFlags);

export const reminderInsertSchema = createInsertSchema(reminders, { kind: WorkTypeSchema });
export const reminderSelectSchema = createSelectSchema(reminders);
