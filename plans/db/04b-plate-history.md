# db/04b — Plate history

Status: done (Nov 27, 2026) · Phase: pre-pilot · Depends on: db/04

## Goal
A car's history stays correct when a plate moves to another car or a car gets a new plate, both of which now happen in Pakistan.

## Why (found Nov 27, 2026 while answering db/04's open question)
- **Since September 2025, a Punjab plate belongs to its owner, not the car.** It's linked to the owner's CNIC. When a car is sold, the seller keeps the plate and can move it to their next car; the buyer gets a new number ([PakWheels](https://www.pakwheels.com/blog/punjab-linked-number-plates-to-cnic-what-car-owners-must-know/amp), [Profit](https://profit.pakistantoday.com.pk/2025/08/26/punjab-to-link-vehicle-registration-numbers-with-cnic-from-september)). Whether this is fully in force today should be confirmed with Punjab Excise.
- **Cars from other provinces are re-registered with a new Punjab number,** and the old one is cancelled ([ProPakistani](https://propakistani.pk/2026/02/15/punjab-starts-re-registering-vehicles-from-other-provinces/)).
- So a plate is unique **at any one moment**, but not over a car's life. db/04's "one plate per car, unique forever" would mix two cars' histories (and flag the second car's lower mileage as a rollback), or split one car's history across two plates.

## Decisions
- **The chassis number is the car's real identity.** Plates move to `car_registrations`: car, plate, year, `valid_from`, `valid_to`, and `ended_reason` (`plate_moved`, `re_registered`, `correction`).
- **A plate is current on at most one car, and a car has at most one current plate** (partial unique indexes on `valid_to IS NULL`). Past plates are kept and searchable (trigram index).
- **A car still needs an identifier:** a chassis number or at least one plate, checked by a constraint trigger at commit, so a car and its first plate can be inserted in either order in one transaction. Removing a car's only plate is refused too.
- **Each job stores the plate it was serviced under** (`jobs.reg_no`, db/05), so reports and disputes show the plate as it was.
- **The migration copied existing plates** into `car_registrations` before dropping `cars.reg_no` and `cars.reg_year`.
- **Effects on other plans** (noted in each): the garage app confirms make, model and year when a plate is found, and "different car" moves the plate (garage-app/10, api/06); search covers current and past plates (admin/11, web/06); merges also move registrations (admin/13).

## Scope
**In:**
- Enum `registration_end_reason`, table `car_registrations`, constraint triggers, `updated_at` trigger
- `cars.reg_no` and `cars.reg_year` removed
- Zod: `carRegistrationInsertSchema` (any plate spelling in, normalised out)

**Out (later items):**
- The plate-move flow in the API and app (api/06, garage-app/10)

## Files and folders touched
- `packages/db/src/schema/cars.ts`, `packages/db/src/zod.ts`, `packages/db/src/schema/cars.test.ts`
- `packages/db/migrations/0005_plate_history.sql` (generated, plus hand-written data copy and triggers)

## Done when
- [x] A plate can move from one car to another, and the first car keeps it in its history (tested with the Corolla → Civic example)
- [x] A plate can't be current on two cars, and a car can't have two current plates
- [x] A car with neither chassis nor plate is refused, and so is removing a car's only plate
- [x] Plates already stored under db/04 survive the migration (checked on a database migrated up to 0004 with data)

## Open questions
- Confirm with Punjab Excise (or in the garage interviews) that the owner-linked plate rule is in force, and how other provinces handle it.
