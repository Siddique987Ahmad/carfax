# api/06 — Car lookup and offline-created cars

Status: done (Nov 27, 2026) · Phase: pre-pilot · Depends on: api/04, db: core tables, admin/13 (merge service)

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
- **Built with these decisions:**
  - **`CarIdentityService.resolve()` / `resolveIn(tx)`** is the one place cars are found or created; api/08 calls `resolveIn` inside the sync transaction.
  - **No double-create under concurrency:** each call takes Postgres advisory locks on the plate, chassis and phone id it touches (in a fixed order, so no deadlocks). Three phones syncing the same new car at once give one car and two aliases (tested). Advisory locks were used instead of `INSERT … ON CONFLICT` because plates live in `car_registrations` with a partial unique index, and the decision spans several tables.
  - **The chassis number wins:** a known plate with a **different** chassis means the plate moved to another car (new car, plate ended on the old one as `plate_moved`); a known chassis with a **new** plate means the car was re-registered (old plate ended as `re_registered`); the app's `differentCar: true` moves the plate too. Plate moves and re-registrations go in the audit log.
  - **Plate and chassis pointing at two different cars:** the chassis car is used, and the pair is written to a new `car_duplicate_candidates` table (one open entry per pair) for admin/13's duplicates list.
  - **Details are learned, never overwritten:** a missing make, model, year or chassis number is filled in from later calls.
  - **Merged cars** (admin/13) are followed to the car that was kept, in lookup and resolve.
  - **`POST /cars` answers 200** with `created`, `remappedFrom`, `possibleDuplicate`, `plateMoved` and the car summary; it's safe to resend (same phone id, same answer). Lookup answers `{ found: false }` instead of 404.
  - **`CAR_MODELS` and `canonicalCar()`** in `@carfax/shared`: common Pakistani makes and models, one spelling (`' honda'`/`'CITY '` → Honda City); unknown ones are kept as typed.
  - **The normalisers already existed** (`normaliseRegNo`, `normaliseChassisNo`, db/02 and setup/04), and so did `car_aliases` (db/04).

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
- `apps/api/src/cars/*`, `apps/api/test/cars.test.ts`, `packages/shared/src/constants/car-models.ts`
- `packages/db/src/schema/cars.ts` (`car_duplicate_candidates`), `packages/db/migrations/0011_car_duplicate_candidates.sql`

## Done when
- [x] Different spellings of one plate return the same car
- [x] Two offline-created copies of one car end up as one car with an alias, and the phone receives the remap
- [x] Plate/chassis conflicts appear in the admin duplicates list (written to `car_duplicate_candidates`; admin/13 builds the screen that lists them)

## Open questions
- ~~Is a Punjab plate unique without its registration year?~~ Answered in db/04b: plates are unique at any one moment, but move between cars; plates are a dated history.
- ~~Should lookup return the last odometer reading?~~ No: it would show other garages' data, and the flag checks (workers/02) already catch low readings.
