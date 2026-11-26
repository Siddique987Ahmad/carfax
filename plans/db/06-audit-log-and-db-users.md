# db/06 — Audit log and database users

Status: done (Nov 27, 2026) · Phase: pre-pilot · Depends on: db/01, db/02

## Goal
Every admin change is recorded and can't be altered afterwards, and the app connects as a user with only the permissions it needs.

## Decisions
- **`audit_logs` as in the tech doc** (actor, action, entity, entity id, before and after JSON, time), plus a **`note`** column, because the admin plans require a reason for every change.
- **Two database users:**
  - `carfax_migrator`: owns the tables and runs migrations.
  - `carfax_app`: what the API and workers connect as. It can read and write rows but can't change tables.
- **`carfax_app` can only add audit rows** (INSERT and SELECT on `audit_logs`, no UPDATE or DELETE). admin/20 relies on this.
- **The app must never connect as the table owner.** Postgres skips row-level security for the owner, so connecting as `carfax_migrator` would silently switch off db/07.
- **Built with these changes:**
  - **No separate `carfax_migrator` role.** The "migrator" is whoever runs migrations and owns the tables (`MIGRATION_DATABASE_URL`): the provider's admin user in production, `carfax` locally. Only `carfax_app` is created.
  - **Users are server-wide, not per database,** so the migration creates `carfax_app` only if it's missing, and never sets a password. `pnpm db:provision-app-user` lets it log in with `APP_DB_PASSWORD` (secret store in real environments). On a new environment: `db:migrate`, then `db:provision-app-user`.
  - **The app can't hard-delete jobs, cars, plates or car aliases** either, not only the audit log, since none of those are ever hard-deleted by design. Soft-deleted tables keep DELETE.
  - **`audit_logs.id`** is a bigint identity column (the modern form of bigserial). The actor is null for system actions.
  - **Tests connect as `carfax_app`** (`createTestDatabase().app`), with a Vitest global setup that provisions the user once (parallel test files changing the same user at once would fail). Checked on a fresh Postgres, as in CI, where the user doesn't exist yet.
  - **Local `.env`** now has `DATABASE_URL` (app), `MIGRATION_DATABASE_URL` (owner) and `APP_DB_PASSWORD`; so does CI.

## Scope
**In:**
- `audit_logs` (id bigserial, actor_id, action, entity, entity_id, note, before, after, created_at)
- Indexes: `(entity, entity_id, created_at)` and `(actor_id, created_at)`
- A hand-written migration that creates the two users (passwords from the secret store, not the migration) and grants permissions, including default permissions for tables added later
- Separate `DATABASE_URL` (app) and `MIGRATION_DATABASE_URL` (migrations)

**Out (later items):**
- The audit viewer (admin/20)

## Steps
1. Write the `audit_logs` schema and generate the migration.
2. Write the user and permission migration, with `ALTER DEFAULT PRIVILEGES` so new tables get the right grants.
3. Revoke UPDATE and DELETE on `audit_logs` from `carfax_app`.
4. Change `db:migrate` to use the migration URL.

## Files and folders touched
- `packages/db/src/schema/audit.ts`, `packages/db/migrations/0007_audit_log.sql`, `0008_app_database_user.sql` (hand-written), `packages/db/drizzle.config.ts`, `packages/db/scripts/provision-app-user.mjs`, `packages/db/src/testing/*`, `packages/db/vitest.config.ts`
- `.env.example`, `.github/workflows/ci.yml`, `README.md`, `packages/db/README.md`

## Done when
- [x] Connected as `carfax_app`, updating or deleting an audit row fails (and so does `TRUNCATE`)
- [x] Connected as `carfax_app`, `CREATE TABLE` fails (and so do `ALTER` and `DROP`)
- [x] A table added by a later migration is usable by `carfax_app` without extra grants

## Open questions
- Does the chosen managed Postgres (Neon, Supabase, Render, etc.) let the admin user `CREATE ROLE` and set default privileges? Check before choosing a provider in setup/08. If not, create `carfax_app` in the provider's console and the migration's `IF NOT EXISTS` skips it.
