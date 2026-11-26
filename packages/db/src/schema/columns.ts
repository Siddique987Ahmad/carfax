import { timestamp } from 'drizzle-orm/pg-core';

/** When the row was created. */
export const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();

/**
 * When the row last changed. Set by the `set_updated_at` database trigger on every UPDATE
 * (migration 0003), so it's right however the row was changed, also from raw SQL.
 * Sync pulls (api/09) read it.
 */
export const updatedAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();

/** Soft delete for tables the garage app syncs, so phones learn about deletions (api/09). */
export const deletedAt = () => timestamp({ withTimezone: true });
