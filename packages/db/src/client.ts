import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema/index';

export interface CreateDbOptions {
  /** Maximum connections in the pool. Keep it small on managed Postgres plans. */
  max?: number;
  /**
   * Called when an idle pooled connection fails (database restart, failover, network drop).
   * The pool replaces the connection by itself. Without a handler, node-postgres would crash the
   * whole process on such an error. Defaults to logging it.
   */
  onError?: (error: Error) => void;
}

/**
 * One database client for the API and workers. Call once at start-up and share it;
 * call `pool.end()` on shutdown.
 */
export function createDb(url: string, options: CreateDbOptions = {}) {
  const pool = new pg.Pool({ connectionString: url, max: options.max ?? 10 });
  pool.on(
    'error',
    options.onError ??
      ((error) => console.error('[db] idle connection error (the pool will replace it):', error)),
  );
  const db = drizzle(pool, { schema, casing: 'snake_case' });
  return { db, pool };
}

export type Db = ReturnType<typeof createDb>['db'];
