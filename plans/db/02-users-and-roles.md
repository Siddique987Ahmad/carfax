# db/02 — Users, roles and admin login data

Status: planned · Phase: pre-pilot · Depends on: db/01

## Goal
Tables for everyone who logs in, the roles they hold, and the data admin login needs (second factor, recovery codes, active flag).

## Decisions
- **A person can hold more than one role.** The tech doc's single `users.role` column is replaced by a `user_roles` table, because one phone number can be a garage owner and also buy a report or claim their own car.
- **Two kinds of role:**
  - **Platform roles** in `user_roles`: `buyer`, `dealer`, `car_owner`, `admin` (super admin), `ops`, `support`.
  - **Garage roles** (`owner`, `mechanic`) live in `garage_members` (db/03), because they belong to one garage, not the whole platform.
- **Phone is the login.** It's stored in one format (`+92XXXXXXXXXX`) and unique.
- **Admin login data, from the admin plans:**
  - `is_active` (admin/04): inactive users can't log in.
  - `totp_secret_enc`, `totp_enabled_at` (admin/05): the secret is encrypted by the API before saving.
  - `last_login_at` (admin/14).
  - `admin_recovery_codes` table (admin/05).

## Scope
**In:**
- Enum `platform_role`
- `users` (id, phone, name, is_active, totp_secret_enc, totp_enabled_at, last_login_at, created_at, updated_at)
- `user_roles` (user_id, role, granted_by, created_at; primary key user_id + role)
- `admin_recovery_codes` (id, user_id, code_hash, used_at, created_at)
- `otp_codes` (phone, code_hash, purpose, attempts, expires_at): enforces "expires in 5 minutes, max 5 tries" from the tech doc. Kept in the database, not memory, so it works with more than one API server.
- Zod schemas for users and roles

**Out (later items):**
- Garage roles (db/03), audit entries for role changes (db/06)

## Steps
1. Write the schema files and generate the migration.
2. Add a `CHECK` that `phone` matches the `+92` format.
3. Add an index on `otp_codes (phone, created_at)` and a cleanup query for expired codes (run by a worker later).
4. Export the types and Zod schemas.

## Files and folders touched
- `packages/db/src/schema/users.ts`, `packages/db/migrations/*`

## Done when
- [ ] One user can hold `buyer` and `car_owner` at the same time
- [ ] A badly formatted phone number is refused by the database
- [ ] Migration applies cleanly on a fresh database

## Open questions
- Does the API's permission map (admin/06) read roles from `user_roles` only, or also from `garage_members`? Proposed: tokens carry both.
