# db/07 — Row-level security for garage data

Status: planned · Phase: pre-pilot · Depends on: db/03, db/05, db/06

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
- `packages/db/src/schema/*` (policies), `packages/db/src/scope.ts`, `packages/db/test/rls.test.ts`

## Done when
- [ ] Garage A can't read, update or insert garage B's jobs or customers, even with a raw query
- [ ] A query with no helper returns no garage rows
- [ ] Pooled-connection test passes: the setting doesn't leak to the next transaction

## Open questions
- Is the `EXISTS` check on child tables fast enough at pilot scale? Measure in db/10; if not, copy `garage_id` onto the child tables.
