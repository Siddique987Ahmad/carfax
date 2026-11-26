-- Hand-written (db/06): the database user the API and workers connect as, and what it may do.
--
-- Migrations run as the table owner (MIGRATION_DATABASE_URL). The app connects as carfax_app
-- (DATABASE_URL), which can read and write rows but can't change tables. It must never connect as
-- the owner: Postgres skips row-level security for a table's owner, which would silently switch off
-- db/07.
--
-- Users are shared by the whole Postgres server, so this only creates carfax_app if it's missing,
-- and never sets a password: `pnpm db:provision-app-user` does that from APP_DB_PASSWORD (the secret
-- store in staging and production).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'carfax_app') THEN
    CREATE ROLE carfax_app NOLOGIN;
  END IF;
EXCEPTION
  WHEN duplicate_object OR unique_violation THEN
    NULL; -- created at the same moment by another migration run on this server
END;
$$;
--> statement-breakpoint
-- Nobody but the owner creates objects in public (already the default since PostgreSQL 15).
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO carfax_app;
--> statement-breakpoint
-- Rows in every table that exists now...
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO carfax_app;
--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO carfax_app;
--> statement-breakpoint
-- ...and in every table later migrations create (they run as the same owner).
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO carfax_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO carfax_app;
--> statement-breakpoint
-- The audit log is add-only for the app (admin/20 relies on this).
REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM carfax_app;
--> statement-breakpoint
-- Records that are never hard-deleted by design: jobs (history), cars and their plates and aliases
-- (merges and plate moves end or redirect them instead). Soft-deleted tables keep DELETE.
REVOKE DELETE, TRUNCATE ON jobs, cars, car_registrations, car_aliases FROM carfax_app;
