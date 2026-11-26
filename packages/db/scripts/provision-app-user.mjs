// Lets the app's database user log in, with the password from APP_DB_PASSWORD (db/06).
// Run after migrations on each environment, and again whenever the password is rotated.
// Usage: pnpm db:provision-app-user   (connects with MIGRATION_DATABASE_URL)
import { existsSync } from 'node:fs';
import pg from 'pg';

const envFile = new URL('../../../.env', import.meta.url);
if (existsSync(envFile)) process.loadEnvFile(envFile);

const { MIGRATION_DATABASE_URL: url, APP_DB_PASSWORD: password } = process.env;
if (!url) throw new Error('MIGRATION_DATABASE_URL is not set');
if (!password || password.length < 12) {
  throw new Error('APP_DB_PASSWORD is not set or shorter than 12 characters');
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const exists = await client.query(`select 1 from pg_roles where rolname = 'carfax_app'`);
  if (exists.rowCount === 0)
    throw new Error('carfax_app does not exist yet: run pnpm db:migrate first');
  // ALTER ROLE can't take query parameters, so the password is escaped as a literal.
  await client.query(`ALTER ROLE carfax_app WITH LOGIN PASSWORD ${client.escapeLiteral(password)}`);
  console.log('ok  carfax_app can log in with APP_DB_PASSWORD');
} finally {
  await client.end();
}
