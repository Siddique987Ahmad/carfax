import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema/index';

export interface CreateDbOptions {
  /** Maximum connections in the pool. Keep it small on managed Postgres plans. */
  max?: number;
}

/**
 * One database client for the API and workers. Call once at start-up and share it;
 * call `pool.end()` on shutdown.
 */
export function createDb(url: string, options: CreateDbOptions = {}) {
  const pool = new pg.Pool({ connectionString: url, max: options.max ?? 10 });
  const db = drizzle(pool, { schema, casing: 'snake_case' });
  return { db, pool };
}

export type Db = ReturnType<typeof createDb>['db'];
