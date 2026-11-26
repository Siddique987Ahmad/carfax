# db/06 — Audit log and database users

Status: planned · Phase: pre-pilot · Depends on: db/01, db/02

## Goal
Every admin change is recorded and can't be altered afterwards, and the app connects as a user with only the permissions it needs.

## Decisions
- **`audit_logs` as in the tech doc** (actor, action, entity, entity id, before and after JSON, time), plus a **`note`** column, because the admin plans require a reason for every change.
- **Two database users:**
  - `carfax_migrator`: owns the tables and runs migrations.
  - `carfax_app`: what the API and workers connect as. It can read and write rows but can't change tables.
- **`carfax_app` can only add audit rows** (INSERT and SELECT on `audit_logs`, no UPDATE or DELETE). admin/20 relies on this.
- **The app must never connect as the table owner.** Postgres skips row-level security for the owner, so connecting as `carfax_migrator` would silently switch off db/07.

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
- `packages/db/src/schema/audit.ts`, `packages/db/migrations/*`, `packages/db/drizzle.config.ts`, `.env.example`

## Done when
- [ ] Connected as `carfax_app`, updating or deleting an audit row fails
- [ ] Connected as `carfax_app`, `CREATE TABLE` fails
- [ ] A table added by a later migration is usable by `carfax_app` without extra grants

## Open questions
- Does the chosen managed Postgres (Neon, Supabase, Render, etc.) allow creating users with these permissions? Check before choosing a provider in setup/.
