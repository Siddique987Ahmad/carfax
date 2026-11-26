import { existsSync } from 'node:fs';
import pg from 'pg';

/**
 * Runs once before all db tests. Makes sure the app's database user exists and can log in, so tests
 * can connect as carfax_app. Done once here because test files run in parallel, and changing the
 * same user from several connections at once fails ("tuple concurrently updated").
 */
export default async function setup() {
  const envFile = new URL('../../../../.env', import.meta.url);
  if (!process.env.MIGRATION_DATABASE_URL && existsSync(envFile)) process.loadEnvFile(envFile);
  const url = process.env.MIGRATION_DATABASE_URL;
  const password = process.env.APP_DB_PASSWORD;
  if (!url || !password) {
    throw new Error('MIGRATION_DATABASE_URL and APP_DB_PASSWORD must be set (pnpm env:init)');
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'carfax_app') THEN
        CREATE ROLE carfax_app NOLOGIN;
      END IF; END $$;`);
    await client.query(
      `ALTER ROLE carfax_app WITH LOGIN PASSWORD ${client.escapeLiteral(password)}`,
    );
  } finally {
    await client.end();
  }
}
