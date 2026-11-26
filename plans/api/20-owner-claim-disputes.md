# api/20 — Owner claim and disputes

Status: planned · Phase: reports launch · Depends on: api/03, api/17, admin/19

## Goal
A car owner can see their own car's record for free and report a wrong entry, as the product doc promises, without this becoming a way for anyone to get free reports.

## Decisions
- **`POST /owner/claim`** (tech doc). Knowing the plate isn't enough proof, because anyone can read a plate. A claim succeeds only if one of these is true:
  - the owner's verified phone matches the customer phone on at least one job for that car (checked inside the API; the phone is never shown), or
  - the owner enters the **full chassis number** from the registration book and it matches.
- **A claimed car shows its record** in the same shape as a report, for free, to that owner only.
- **A car can have more than one claim** over time (cars get sold); a new owner's claim doesn't remove the old one, but the old owner only sees records up to the new claim date.
- **`POST /disputes`** (tech doc) lets a claimed owner report a wrong job with a message; ops handles it in admin/19.

## Scope
**In:**
- `POST /owner/claim`, `GET /owner/cars`, `GET /owner/cars/:id` (the record)
- `POST /disputes`, `GET /disputes` (the owner's own disputes and their status)
- DB: `car_claims` (car, user, method, claimed_at) — add to db: reports tables

**Out (later items):**
- Reviewing disputes (admin/19), owner pages (web)

## Steps
1. Claim service with the two proof methods.
2. Owner record endpoint reusing the report schema (api/17).
3. Dispute create/list.
4. Tests: plate-only claim refused; phone-match claim works; wrong chassis refused; a claimed owner can't see another car.

## Files and folders touched
- `apps/api/src/modules/owners/*`, `apps/api/src/modules/disputes/*`, `packages/db` (car_claims)

## Done when
- [ ] An owner whose phone is on a job can claim the car and see its record
- [ ] Someone with only the plate number can't claim it
- [ ] A dispute appears in the admin disputes queue

## Open questions
- What should an owner do if they can't pass either check (e.g. new car at a garage that didn't save their phone)? Proposed: "contact support," handled by hand.
