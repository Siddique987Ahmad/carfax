# db/03 — Garages, staff and customers

Status: done (Nov 27, 2026) · Phase: pre-pilot · Depends on: db/02

## Goal
Tables for workshops, their staff, and each workshop's private customer list.

## Decisions
- **Garage status:** `pending` → `active` → `suspended`, as in the tech doc. Adds `status_reason` and `status_changed_at` (admin/08).
- **`trust_score`** starts at 100, as in the tech doc. It's recalculated nightly (admin/15), not typed by hand.
- **Garage roles** use their own enum `garage_role` (`owner`, `mechanic`), separate from platform roles (db/02).
- **Customers belong to one garage** and are never shared between garages. `UNIQUE (garage_id, phone)` comes from the tech doc. Reports never read this table.
- **Sync support:** the garage app syncs customers, so `customers` has `updated_at` (set by a database trigger, so it's correct however the row was changed) and `deleted_at` (soft delete, so the phone learns about deletions).
- **Customer IDs can come from the phone,** because a mechanic can add a customer while offline.
- **Built with these additions:**
  - "One customer per phone per garage" ignores deleted customers (a partial unique index), so a returning customer can be added again.
  - Customer phones use the users' format (`+923XXXXXXXXX`, CHECK), because bills and reminders go to WhatsApp. The phone is optional, since deleting a customer clears it (api/11).
  - CHECKs on `trust_score` (0–100) and on latitude and longitude ranges.
  - The owner is also a `garage_members` row with role `owner`, so "who works here" is one query.
  - `garages.owner_id` and `customers.garage_id` can't be deleted out from under their rows; garages are suspended, not deleted.
  - The `set_updated_at()` trigger also covers `users`, replacing the app-side update from db/02, so there's one mechanism everywhere.
  - A test fails if any table with an `updated_at` column lacks the trigger, so later tables can't forget it.
  - Shared column helpers (`createdAt`, `updatedAt`, `deletedAt` in `schema/columns.ts`) for every later table.
- **Sync pitfall handed to api/09:** `updated_at` is the transaction's start time, so a pull must overlap the previous one slightly or it can skip a change that was still being saved.

## Scope
**In:**
- Enums `garage_status`, `garage_role`
- `garages` (id, owner_id, name, city, address, lat, lng, status, status_reason, status_changed_at, trust_score, created_at, updated_at)
- `garage_members` (garage_id, user_id, role, created_at; primary key garage_id + user_id)
- `customers` (id, garage_id, name, phone, created_at, updated_at, deleted_at)
- A shared `set_updated_at()` trigger function, used here and by every synced table after this
- Indexes: `garages (status, city)`, `customers (garage_id, updated_at)` for sync pulls

**Out (later items):**
- Row-level security on these tables (db/07), spot-check visits (db/09)

## Steps
1. Write the trigger function in a hand-written migration (drizzle-kit can't create functions).
2. Write the schema files and generate the migration.
3. Attach the `updated_at` trigger to `garages` and `customers`.
4. Export the Zod schemas.

## Files and folders touched
- `packages/db/src/schema/garages.ts`, `packages/db/src/schema/columns.ts`, `packages/db/src/schema/users.ts`, `packages/db/src/zod.ts`
- `packages/db/migrations/0002_garages_members_customers.sql`, `0003_updated_at_triggers.sql` (hand-written)

## Done when
- [x] Updating a customer changes `updated_at` even when done in raw SQL
- [x] The same phone can be a customer at two garages, but not twice at one (and a deleted customer doesn't block re-adding)
- [x] A garage can't exist without an owner (missing owner and unknown owner both refused)

## Open questions
- None
