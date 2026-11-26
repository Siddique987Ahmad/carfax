// Zod schemas made from the tables, for the API and admin to validate with the database's own rules.
// This entry point never loads the Postgres driver, so it's safe for browser and app bundles.
// Request-only schemas (forms, filters) stay hand-written in @carfax/shared.
import { PAKISTAN_MOBILE_PATTERN } from '@carfax/shared';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
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
