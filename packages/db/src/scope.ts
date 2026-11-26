import { sql } from 'drizzle-orm';
import type { Db } from './client';

/** A transaction handle: what withGarage and withSystem pass to your function. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Runs `fn` in a transaction that can only see and change one garage's rows (customers, jobs and
 * their items, photos and flags, reminders, staff). Use it for every garage app request (db/07).
 * The setting ends with the transaction, so it can't leak to the next request on the same
 * pooled connection.
 */
export function withGarage<T>(db: Db, garageId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!UUID.test(garageId)) throw new Error(`withGarage: not a garage id: ${garageId}`);
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.garage_id', ${garageId}, true)`);
    return fn(tx);
  });
}

/**
 * Runs `fn` in a transaction that sees every garage's rows. For the admin panel, workers, report
 * building and login (finding a user's garages). Never use it for a garage app request.
 */
export function withSystem<T>(db: Db, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.scope', 'system', true)`);
    return fn(tx);
  });
}
