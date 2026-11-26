// Zod schemas made from the tables, for the API and admin to validate with the database's own rules.
// This entry point never loads the Postgres driver, so it's safe for browser and app bundles.
// Request-only schemas (forms, filters) stay hand-written in @carfax/shared.
import { ChassisNoSchema, PAKISTAN_MOBILE_PATTERN, RegNoSchema } from '@carfax/shared';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { carAliases, carRegistrations, cars } from './schema/cars';
import { customers, garageMembers, garages } from './schema/garages';
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
