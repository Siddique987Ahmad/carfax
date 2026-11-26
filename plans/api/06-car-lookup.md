# api/06 — Car lookup and offline-created cars

Status: planned · Phase: pre-pilot · Depends on: api/04, db: core tables, admin/13 (merge service)

## Goal
A mechanic finds a car by its plate, or adds it if it's new, online or offline, and the same car never ends up as two records because two garages added it without internet.

## Decisions
- **Plates can move between cars (db/04b).** Since Sept 2025 a Punjab plate follows its owner. Look up plates in `car_registrations` (current plates only, `valid_to IS NULL`), and treat the chassis number as the real identity. When the app reports "different car" for a found plate, end that registration (`plate_moved`) and create the new car with the plate, in one transaction. A mileage far below the last record for that plate is a hint the plate moved, not only a rollback.
- **One normalisation function** (`normaliseRegNo` in `packages/shared`) used by the app, the API and admin search, so `LEA-1234` and `lea 1234` are the same car.
- **Online:** `GET /cars/lookup?reg=` (tech doc) returns the car or "not found", and `POST /cars` creates it.
- **Offline:** the phone creates the car with its own UUID. When it arrives in sync push (api/08), the API checks plate and chassis:
  - no match → the car is created with the phone's UUID;
  - match → the phone's UUID is saved as an **alias** of the existing car, and the push response tells the phone to swap the ID (`remap: { phoneId: serverId }`).
- **Aliases stay forever** (`car_aliases` table), so a job that arrives later with the old phone ID still lands on the right car.
- **Unclear matches go to ops:** if the plate matches one car and the chassis matches another, both are kept and flagged as possible duplicates for admin/13. The merge code is shared, not copied.
- **Lookup shows only the car itself** (plate, chassis last 4, make, model, year) — never other garages' jobs.

## Scope
**In:**
- `GET /cars/lookup?reg=|chassis=`, `POST /cars`
- `CarIdentityService.resolve()` used by both `POST /cars` and sync push
- DB: `car_aliases` (alias_id, car_id, created_at) — add to db: core tables
- Make/model list in `packages/shared` for consistent spelling (Toyota Corolla, Suzuki Mehran, …)

**Out (later items):**
- Sync push itself (api/08), merging by ops (admin/13)

## Steps
1. `normaliseRegNo` and `normaliseChassis` with tests on real plate formats.
2. `CarIdentityService.resolve({ id, regNo, chassisNo, make, model, year })` returning `{ carId, remappedFrom? , possibleDuplicate? }`, using `INSERT … ON CONFLICT` so two requests at once can't create two cars.
3. Lookup and create endpoints.
4. Tests: two garages create the same plate offline → one car, one alias, both jobs on it.

## Files and folders touched
- `packages/shared/src/reg-no.ts`, `packages/shared/src/makes.ts`, `apps/api/src/modules/cars/*`, `packages/db` (car_aliases)

## Done when
- [ ] Different spellings of one plate return the same car
- [ ] Two offline-created copies of one car end up as one car with an alias, and the phone receives the remap
- [ ] Plate/chassis conflicts appear in the admin duplicates list

## Open questions
- Is a Punjab plate unique without its registration year? If not, the year must be part of the key.
- Should lookup also return the last approved odometer reading, so the app can warn about a lower reading at entry? It helps catch mistakes, but shows a little of other garages' data.
