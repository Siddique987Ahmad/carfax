# api/04 — Role guards and garage scoping

Status: planned · Phase: pre-pilot · Depends on: api/03, db: row-level security

## Goal
Every route checks who is calling, and a garage can only ever read or change its own data, even if a query forgets to filter.

## Decisions
- **Three guards on every route:** signed in (`JwtGuard`), allowed to do this (`PermissionGuard`), and which garage (`GarageScope`).
- **One permission map in `packages/shared`**, the same one admin/06 extends with admin permissions. This item adds the garage and public permissions, e.g. `jobs.create: ['garage_owner','mechanic']`, `garage.stats: ['garage_owner']`.
- **The caller's role inside a garage comes from `garage_members`**, not from `users.role`, so one person can be a mechanic in a garage and also a buyer on the website.
- **Two layers for garage data:** every query filters by `garage_id`, and Postgres row-level security is the safety net. The API sets `app.garage_id` with `set_config(..., true)` **inside each transaction**, so pooled connections can't leak it to the next request.
- **Routes are deny-by-default:** a route without a permission decorator fails the build-time check.

## Scope
**In:**
- `JwtGuard`, `PermissionGuard`, `@Permission()` decorator, `@CurrentUser()` and `@CurrentGarage()` decorators
- `GarageScope`: loads the caller's membership and role; refuses suspended garages for write routes
- `db.withGarage(garageId, fn)` helper that opens a transaction and sets `app.garage_id`
- A test that lists every route and fails if one has no permission

**Out (later items):**
- Admin permissions and admin route guards (admin/06), RLS policies themselves (db: row-level security)

## Steps
1. Add garage/public permissions to the shared permission map.
2. Build the guards and decorators.
3. Build `withGarage` and use it in a sample route.
4. Route-coverage test; RLS test that a query without a `garage_id` filter still returns only the caller's rows.

## Files and folders touched
- `packages/shared/src/permissions.ts`, `apps/api/src/common/guards/*`, `apps/api/src/common/db/with-garage.ts`

## Done when
- [ ] A mechanic calling an owner-only route gets 403
- [ ] Garage A can't read garage B's jobs or customers, even through a query with the filter removed
- [ ] A suspended garage can read but not write
- [ ] The route-coverage test passes and fails when a permission is removed

## Open questions
- None
