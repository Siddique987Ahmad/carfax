# api/04 — Role guards and garage scoping

Status: done (Nov 27, 2026) · Phase: pre-pilot · Depends on: api/03, db: row-level security

## Goal
Every route checks who is calling, and a garage can only ever read or change its own data, even if a query forgets to filter.

## Decisions
- **Three guards on every route:** signed in (`JwtGuard`), allowed to do this (`PermissionGuard`), and which garage (`GarageScope`).
- **One permission map in `packages/shared`**, the same one admin/06 extends with admin permissions. This item adds the garage and public permissions, e.g. `jobs.create: ['garage_owner','mechanic']`, `garage.stats: ['garage_owner']`.
- **The caller's role inside a garage comes from `garage_members`**, not from `users.role`, so one person can be a mechanic in a garage and also a buyer on the website.
- **Two layers for garage data:** every query filters by `garage_id`, and Postgres row-level security is the safety net. The API sets `app.garage_id` with `set_config(..., true)` **inside each transaction**, so pooled connections can't leak it to the next request.
- **Routes are deny-by-default:** a route without a permission decorator fails the build-time check.
- **Built with these changes:**
  - **One global guard instead of three** (`AccessGuard`, an `APP_GUARD`), reading one access rule per route: `@Public()`, `@SignedIn()`, `@GaragePermission(p)` or `@AdminPermission(p)`. A route with no rule is **refused at runtime** (403, logged as an error) **and** fails the coverage test, so deny-by-default holds even if the test were skipped.
  - **Membership and admin roles are read fresh from the database on every request,** not trusted from the 15-minute token: a removed mechanic, a disabled account or a revoked admin role loses access at once (tested).
  - **Which garage:** the `X-Garage-Id` header, or the caller's only garage. Someone in several garages gets `GARAGE_REQUIRED` with the list. The role is per garage (owner in one, mechanic in another, tested).
  - **Garage status:** suspended garages can read but not write (`GARAGE_SUSPENDED`); pending garages can only finish setup (`garage.edit`, `staff.manage`), everything else is `GARAGE_PENDING`. Writes are POST, PUT, PATCH and DELETE.
  - **The garage permission map** (`GARAGE_PERMISSIONS`, `canInGarage()` in `@carfax/shared`) follows garage-app/14's table, using the garage roles `owner` and `mechanic` (db/03), not `garage_owner`.
  - **`withGarage` already existed** in `@carfax/db` (db/07), so there's no API copy; routes call it with `@CurrentGarage().garageId`.
  - **Route coverage** (`routesWithoutAccessRule()` in `src/access/route-coverage.ts`) walks every controller in the running app. Checked by removing the rule from the real health route: the test names it.
  - **Test harness:** `asUser()` now reuses one session per phone, since the real API allows only 3 codes per phone per 15 minutes.

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
- `packages/shared/src/constants/permissions.ts` (`GARAGE_PERMISSIONS`), `packages/shared/src/errors.ts` (`GARAGE_REQUIRED`, `GARAGE_PENDING`, `GARAGE_SUSPENDED`)
- `apps/api/src/access/*` (decorators, guard, route coverage), `apps/api/src/app.module.ts`, auth and health controllers (rules), `apps/api/test/access.test.ts`, `apps/api/test/harness.ts`

## Done when
- [x] A mechanic calling an owner-only route gets 403
- [x] Garage A can't read garage B's jobs or customers, even through a query with the filter removed (nor ask for B by header)
- [x] A suspended garage can read but not write
- [x] The route-coverage test passes and fails when a permission is removed

## Open questions
- None
