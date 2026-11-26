import { createDb, type Db } from '@carfax/db';
import {
  Global,
  Inject,
  Logger,
  Module,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Pool } from 'pg';
import { getConfig } from '../config';

export const DB = Symbol('DB');
export const DB_POOL = Symbol('DB_POOL');
/** Inject the database in a service: constructor(@InjectDb() private readonly db: Db) {} */
export const InjectDb = () => Inject(DB);

/**
 * One Drizzle client for the whole API, connected as the app user (db/06).
 * Every query on garage data must run inside withGarage or withSystem (db/07).
 */
@Global()
@Module({
  providers: [
    {
      provide: DB_POOL,
      useFactory: () => {
        const config = getConfig();
        const logger = new Logger('Database');
        return createDb(config.DATABASE_URL, {
          max: config.DATABASE_POOL_MAX,
          onError: (error) =>
            logger.error(`idle connection error (the pool replaces it): ${error.message}`),
        });
      },
    },
    { provide: DB, useFactory: (c: ReturnType<typeof createDb>) => c.db, inject: [DB_POOL] },
  ],
  exports: [DB, DB_POOL],
})
export class DbModule implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger('Database');

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(DB_POOL) private readonly client: { pool: Pool },
  ) {}

  /**
   * Refuses to start when connected as a user that owns tables: the owner bypasses row-level
   * security, which would silently switch off garage separation (db/06, db/07).
   */
  async onModuleInit() {
    const result = await this.db.execute(sql`
      select current_user as "user",
             (select count(*)::int from pg_tables
               where schemaname = 'public' and tableowner = current_user) as "ownedTables"`);
    const row = result.rows[0] as { user: string; ownedTables: number };
    if (row.ownedTables > 0) {
      throw new Error(
        `DATABASE_URL connects as "${row.user}", which owns ${row.ownedTables} tables and so bypasses ` +
          'row-level security. Use the app user (carfax_app) instead.',
      );
    }
    this.logger.log(`connected as ${row.user}`);
  }

  async onApplicationShutdown() {
    await this.client.pool.end();
  }
}
