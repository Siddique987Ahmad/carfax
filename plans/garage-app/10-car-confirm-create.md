# garage-app/10 — Confirm or create the car

Status: planned · Phase: pre-pilot · Depends on: garage-app/09, api: car lookup

## Goal
After the plate is entered, the mechanic confirms it's the right car, or adds a new one in a few taps, even with no internet.

## Decisions
- **Look locally first** (cars this garage has serviced). If not found and online, call `GET /cars/lookup?reg=` to fetch make, model and year if another garage already added the car. If offline, create it.
- **New cars get a UUID on the phone.** If the server already has that plate, it maps the phone's car to the existing one during sync and tells the phone the real ID. Flag this to the api/ car lookup plan; it reuses the merge logic in admin/13.
- **Never show other garages' odometer readings or jobs.** It could leak another garage's business and would show a cheater what number to beat.
- **Make and model come from a short picker list** of common cars in Pakistan (in `packages/shared`), with "Other" for typing. Year is a number picker.
- **Chassis number is optional but prompted on first visit** ("from the registration book"), since it's the most reliable key for re-registered and imported cars.

## Scope
**In:**
- Confirm screen: plate, make, model, year, last visit at this garage
- New car form with the make/model list
- Optional chassis number field with format check
- Customer step: pick an existing customer for this car or add name and phone (stored only for this garage)

**Out (later items):**
- Customer list screen (19)

## Steps
1. Make/model list in `packages/shared`.
2. Local lookup, online lookup, offline create.
3. Confirm and new-car screens.
4. Customer pick/add step.
5. Handle the server's "this car already exists" mapping after sync.

## Files and folders touched
- `packages/shared/src/car-catalogue.ts`, `apps/garage-app/app/(app)/job/new/*`, `apps/garage-app/src/features/car/*`

## Done when
- [ ] A returning car is found in under a second, offline
- [ ] A car created offline at two garages ends up as one car on the server
- [ ] No reading or job from another garage is ever shown

## Open questions
- Should chassis number be required for imported cars, given auction-sheet checks use it?
