// Zod schemas made from the tables, for the API and admin to validate with the database's own rules.
// This entry point never loads the Postgres driver, so it's safe for browser and app bundles.
// Each table file adds its schemas here as tables arrive (db/02 onward), e.g.
//   export const userInsertSchema = createInsertSchema(users);
// Request-only schemas (forms, filters) stay hand-written in @carfax/shared.
export { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
