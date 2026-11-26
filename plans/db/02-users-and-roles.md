# db/02 — Users, roles and admin login data

Status: done (Nov 27, 2026) · Phase: pre-pilot · Depends on: db/01

## Goal
Tables for everyone who logs in, the roles they hold, and the data admin login needs (second factor, recovery codes, active flag).

## Decisions
- **A person can hold more than one role.** The tech doc's single `users.role` column is replaced by a `user_roles` table, because one phone number can be a garage owner and also buy a report or claim their own car.
- **Two kinds of role:**
  - **Platform roles** in `user_roles`: `buyer`, `dealer`, `car_owner`, `admin` (super admin), `ops`, `support`.
  - **Garage roles** (`owner`, `mechanic`) live in `garage_members` (db/03), because they belong to one garage, not the whole platform.
- **Phone is the login.** It's stored in one format, `+923XXXXXXXXX` (Pakistani mobiles only, since only they can receive the login code), and unique. `normalisePakistanMobile()` and `PakistanMobileSchema` in `@carfax/shared` turn any spelling (`0300-1234567`, `+92 300 1234567`, Urdu digits) into that format; a CHECK in the database refuses anything else.
- **Login codes live in Redis, not Postgres** (changed while building, matching api/03). Codes expire on their own and attempt counting is atomic, so there's no `otp_codes` table and no cleanup job. Redis is shared by all API servers.
- **The role enum comes from `PLATFORM_ROLES` in `@carfax/shared`**, so the code and the database can't disagree. `db` imports `shared`, never the reverse (db/01).
- **Extra safety rules:** the second factor can't be switched on without a stored secret (CHECK), deleting a user removes their roles and recovery codes, and `granted_by` becomes null if the granting team member is deleted.
- **`publicUserSchema`** (in `@carfax/db/zod`) is the user without the TOTP secret, for anything sent to a client.
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
- ~~`otp_codes`~~: moved to Redis (see Decisions)
- Zod schemas for users and roles

**Out (later items):**
- Garage roles (db/03), audit entries for role changes (db/06)

## Steps
1. Write the schema files and generate the migration.
2. Add a `CHECK` that `phone` matches the `+92` format.
3. ~~`otp_codes` index and cleanup~~: not needed with Redis.
4. Export the types and Zod schemas.

## Files and folders touched
- `packages/db/src/schema/users.ts`, `packages/db/src/zod.ts`, `packages/db/src/testing/test-db.ts` (throwaway database helper for tests), `packages/db/migrations/0001_users_and_roles.sql`
- `packages/shared/src/utils/identifiers.ts` (`normalisePakistanMobile`), `packages/shared/src/schemas/common.ts` (`PakistanMobileSchema`)

## Done when
- [x] One user can hold `buyer` and `car_owner` at the same time
- [x] A badly formatted phone number is refused by the database (`0300…`, spaces, landlines and foreign numbers all tested)
- [x] Migration applies cleanly on a fresh database (every test file migrates its own throwaway database)

## Open questions
- Does the API's permission map (admin/06) read roles from `user_roles` only, or also from `garage_members`? Proposed: tokens carry both. To settle in api/04 (guards), which uses them.
