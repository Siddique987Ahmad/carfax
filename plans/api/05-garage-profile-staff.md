# api/05 — Garage profile and staff

Status: done (Nov 27, 2026) · Phase: pre-pilot · Depends on: api/04

## Goal
A workshop owner can create their garage in the app, edit its profile and add mechanics, and the garage waits for approval before its jobs count.

## Decisions
- **From api/04:** use `@GaragePermission('garage.view' | 'garage.edit' | 'staff.manage')` and `@CurrentGarage()`; run queries in `withGarage`. Pending garages may already edit their profile and staff.
- **The owner creates the garage on first sign-in to the app** (`POST /garage`). It starts as `pending` until ops approves it (admin/08).
- ~~**Pending garages can already log jobs**~~ **Changed while building:** pending garages can finish their profile and staff but **can't log jobs until approved**, as api/04 already enforces (`GARAGE_PENDING`). Simpler and safer, and in the pilot the team installs the app on site (garage-app/17) and can approve the garage there. To let owners try first, add `jobs.create` to `GARAGE_WRITES_WHILE_PENDING` in `@carfax/shared`; reports must then skip pending garages' jobs.
- **Mechanics are added by phone number.** If the phone has no account yet, one is created and the mechanic signs in with OTP.
- **Mechanic limits (tech doc):** can create jobs and see the garage's job list, but can't see earnings, change the profile or manage staff.
- **Staff limit of 10 per garage** for now, to stop abuse; easy to raise.
- **Built with these decisions:**
  - **One garage per owner** (409 otherwise), so nobody floods the approval queue.
  - **The access guard reads the caller's memberships from the database** when no `X-Garage-Id` is sent (changed in api/04's guard). Right after creating a garage, the owner's token lists no garages; without this they'd be refused until the token refreshed.
  - **A removed mechanic loses access on their very next request,** not at the next token refresh (api/04 checks membership live).
  - **The staff limit holds under concurrency:** additions lock the garage's staff rows, so three at once with one place left give one 201 and two 409 (tested).
  - **Adding an existing user** (e.g. a buyer) makes them a mechanic and keeps their other roles.
  - **The staff list** (names and phones) is owner-only (`staff.manage`), since mechanics don't need colleagues' phone numbers.
  - **Stats** count by service date in Pakistan time (weeks start Monday), exclude rejected jobs, and include reminders sent this month.
  - **Creating a garage and adding or removing staff go in the audit log.**
  - **`CITIES` and `CitySchema`** are in `@carfax/shared` (`constants/cities.ts`): 15 major cities.
  - **CI now also runs the build:** a wrong response schema broke OpenAPI generation, which only the build exercises (caught here by the privacy test, which builds the document).

## Scope
**In:**
- `POST /garage`, `GET /garage/me` (profile + status + the caller's role), `PATCH /garage/me`
- `GET /garage/members`, `POST /garage/members` (tech doc), `DELETE /garage/members/:userId`
- `GET /garage/stats` (owner only: jobs this week/month, earnings, reminders sent)
- Location: lat/lng from the owner's phone when creating the garage

**Out (later items):**
- Approval and suspension (admin/08), garage sign-up page on the website (web)

## Steps
1. Garage create/read/update with Zod schemas (name, city from a fixed list, address, lat/lng).
2. Member add/remove; the owner can't remove themselves.
3. Stats query (owner only).
4. Tests: mechanic can't see stats or add staff; a removed mechanic loses access on next token refresh.

## Files and folders touched
- `apps/api/src/garages/*`, `apps/api/src/access/access.guard.ts`, `apps/api/test/garages.test.ts`
- `packages/shared/src/constants/cities.ts`, `packages/shared/src/schemas/common.ts` (`CitySchema`), `.github/workflows/ci.yml` (build)

## Done when
- [x] An owner can create a garage, add a mechanic, and the mechanic can sign in and see the garage
- [x] Mechanics get 403 on stats, profile edit and staff routes
- [x] New garages are `pending` (and can't log jobs until approved, so none can reach reports; see the changed decision above)

## Open questions
- ~~Can one person belong to two garages?~~ Yes: the API supports it (`X-Garage-Id`, `GARAGE_REQUIRED`, tested in api/04); the app picks one active garage (garage-app/14).
