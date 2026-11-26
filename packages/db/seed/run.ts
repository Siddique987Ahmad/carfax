// Seed commands (db/08), run from the repo root:
//   pnpm db:seed        the dev data set (8 garages, ~300 cars, ~2,000 jobs)
//   pnpm db:seed:demo   the small demo set (3 garages, 3 car stories)
//   pnpm db:reset       local only: wipe the database, migrate, then the dev seed
//   pnpm db:reset:demo  local only: wipe the database, migrate, then the demo seed
// All connect as the table owner (MIGRATION_DATABASE_URL), which also bypasses row-level security.
import { existsSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from '../src/client';
import { users } from '../src/schema/users';
import { seedDemo } from './demo';
import { seedDev } from './dev';
import { assertSafeTarget } from './guard';

const envFile = new URL('../../../.env', import.meta.url);
if (!process.env.MIGRATION_DATABASE_URL && existsSync(envFile)) process.loadEnvFile(envFile);
const url = process.env.MIGRATION_DATABASE_URL;
if (!url) throw new Error('MIGRATION_DATABASE_URL is not set (pnpm env:init)');

const mode = process.argv[2];
const resetSeed = process.argv[3] === 'demo' ? 'demo' : 'dev';
if (mode !== 'dev' && mode !== 'demo' && mode !== 'reset') {
  throw new Error('Usage: run.ts dev | demo | reset [demo]');
}
assertSafeTarget(url, { reset: mode === 'reset' });

const started = Date.now();
const { db, pool } = createDb(url, { max: 2 });
try {
  if (mode === 'reset') {
    await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
    await db.execute(sql`DROP SCHEMA public CASCADE`);
    await db.execute(sql`CREATE SCHEMA public`);
    await migrate(db, { migrationsFolder: new URL('../migrations', import.meta.url).pathname });
    console.log('ok  database wiped and migrated');
  } else {
    const [existing] = await db.select({ n: sql<number>`count(*)::int` }).from(users);
    if (existing!.n > 0) {
      throw new Error(
        'The database already has data. Run `pnpm db:reset` for a fresh seeded database',
      );
    }
  }
  if (mode === 'demo' || (mode === 'reset' && resetSeed === 'demo')) {
    await seedDemo(db);
    console.log(
      'ok  demo data: 3 garages; cars LEA-1234 (clean), LEB-5678 (rollback), LEC-9012 (accident)',
    );
  } else {
    const s = await seedDev(db);
    console.log(
      `ok  dev data: ${s.garages} garages (${s.pendingGarages} pending), ${s.cars} cars, ${s.jobs} jobs, ` +
        `${s.flaggedJobs} flagged, ${s.duplicatePairs} duplicate pairs`,
    );
  }
  console.log(
    `    team logins: +923000000001 (admin), +923000000002 (ops), +923000000003 (support)`,
  );
  console.log(`    took ${((Date.now() - started) / 1000).toFixed(1)}s`);
} finally {
  await pool.end();
}
