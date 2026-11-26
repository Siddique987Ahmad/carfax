import { type SQL, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

/**
 * Row-level security (db/07): the condition every garage-owned row must meet.
 *
 * - `app.scope = 'system'` (set by withSystem): admin, workers and report building see every row.
 * - `app.garage_id` (set by withGarage): a garage sees only its own rows.
 * - Neither set: no rows. `current_setting(..., true)` gives NULL or '' instead of an error, and
 *   `nullif` turns '' into NULL, which matches nothing. Forgetting a helper fails safely.
 *
 * Both settings are made with set_config(..., true), so they end with the transaction and can't
 * leak to the next request on the same pooled connection (src/scope.ts).
 */
export const garageScope = (garageId: AnyPgColumn): SQL =>
  sql`current_setting('app.scope', true) = 'system' OR ${garageId} = nullif(current_setting('app.garage_id', true), '')::uuid`;
