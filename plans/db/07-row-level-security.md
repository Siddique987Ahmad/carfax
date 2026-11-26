# db/07 — Row-level security for garage data

Status: done (Nov 27, 2026) · Phase: pre-pilot · Depends on: db/03, db/05, db/06

## Goal
Even if an API query forgets its `garage_id` filter, a garage can never read or change another garage's customers, jobs or reminders. The tech doc calls this the "second safety net."

## Decisions
- **Tables with RLS:** `customers`, `jobs`, `job_items`, `job_photos`, `job_flags`, `reminders`, `garage_members`.
- **Tables without RLS:** `cars`, because cars are shared between garages; every garage must find the same car by its plate.
- **The garage ID is set per transaction:** `select set_config('app.garage_id', $1, true)`. The `true` makes it last only until the transaction ends. A plain `SET` would stay on the pooled connection and leak to the next request.
- **Two helpers in `packages/db`:**
  - `withGarage(db, garageId, fn)` for garage app requests.
  - `withSystem(db, fn)` for admin, workers and report building. It sets `app.scope = 'system'`.
- **No setting means no rows.** Policies treat a missing setting as "see nothing," so forgetting a helper fails safely.
- **Policies live in the Drizzle schema** (`pgPolicy`), so drizzle-kit generates and tracks them with the tables.
- **Child tables use the parent job's garage.** `job_items`, `job_photos` and `job_flags` check through `EXISTS` on `jobs`, so the phone doesn't need to send `garage_id` on every row.
- **Built as planned, plus:**
  - **One shared condition** (`garageScope()` in `schema/rls.ts`) for every garage-owned table: system scope, or `garage_id` equal to `nullif(current_setting('app.garage_id', true), '')::uuid`. The `nullif` matters: once a setting has been used on a connection, Postgres returns `''` (not NULL) after the transaction, and `''` can't be cast to a UUID.
  - **Child policies rely on the `jobs` policy:** `EXISTS (SELECT 1 FROM jobs WHERE jobs.id = job_id)` only finds the current garage's jobs, so there's one source of truth.
  - **`withGarage` refuses a garage ID that isn't a UUID** before touching the database.
  - **A failed request doesn't leave its scope behind** either (tested on a one-connection pool, checking it really is the same connection each time).
  - **A coverage test** fails if any table with a `garage_id` or `job_id` column doesn't have row-level security on (checked by switching it off on `reminders`).
  - **Not protected by row-level security:** `users`, `garages`, `cars`, plates, `audit_logs`. They're shared or platform-wide, so the API's guards (api/04) decide who sees them.
  - **The table owner bypasses row-level security** (Postgres default, not forced). That's why the app must connect as `carfax_app` (db/06); migrations, seeds and tests set up data as the owner.

## Scope
**In:**
- Enable RLS and add policies on the tables above
- `withGarage` and `withSystem` helpers
- An integration test suite that runs against a real Postgres as `carfax_app`

**Out (later items):**
- API use of the helpers (api/01 and the garage endpoints)

## Steps
1. Add `pgPolicy` definitions to the schema files; generate the migration.
2. Write the two helpers, each wrapping `db.transaction`.
3. Write tests: garage A sees only its own rows; no setting sees nothing; system scope sees all; a setting doesn't survive into the next transaction on the same pooled connection.
4. Note in the API README that every database call must go through a helper.

## Files and folders touched
- `packages/db/src/schema/rls.ts`, `garages.ts`, `jobs.ts` (policies), `packages/db/src/scope.ts`, `packages/db/src/scope.test.ts`, `packages/db/src/index.ts`, `packages/db/README.md`
- `packages/db/migrations/0009_row_level_security.sql`

## Done when
- [x] Garage A can't read, update or insert garage B's jobs or customers, even with a raw query (nor move its own job to B, nor add items to B's job)
- [x] A query with no helper returns no garage rows
- [x] Pooled-connection test passes: the setting doesn't leak to the next transaction (also after a failed one)

## Open questions
- Is the `EXISTS` check on child tables fast enough at pilot scale? Measure in db/10; if not, copy `garage_id` onto the child tables.
