# db/08 — Seed data for development and demos

Status: planned · Phase: pre-pilot · Depends on: db/02 to db/07

## Goal
One command fills a local or staging database with realistic data, so developers can build screens and the team can demo the product before real garages use it.

## Decisions
- **Two seed sets:**
  - `dev`: a lot of varied data for building and testing.
  - `demo`: a small, polished set for showing to garage owners and dealers.
- **Same data every time,** using a fixed random seed, so bugs can be reproduced.
- **Includes the edge cases the app must handle:**
  - Mileage drops (rollbacks)
  - Jobs with no photo
  - A misread odometer
  - Two copies of the same car
  - Suspended and pending garages
- **Can never run against production.** The command refuses if `NODE_ENV` or the database name says production.
- **Photos point at a few sample images** uploaded to local storage, not real customer photos.

## Scope
**In:**
- `dev` seed:
  - Platform users: 1 super admin, 1 ops, 1 support
  - 8 garages in two cities (mixed statuses), each with an owner and mechanics
  - 300 cars, 2,000 jobs over 18 months, about 5% flagged
  - Customers and reminders
- `demo` seed:
  - 3 garages
  - A car with a clean history
  - A car with a rollback
  - A car with accident repairs
- Commands: `db:seed`, `db:seed:demo`, `db:reset` (drop, migrate, seed; local only)

**Out (later items):**
- Report orders, payments, dealers and disputes (added to the seed when db/11 and db/12 are built)

## Steps
1. Write the seed scripts with `@faker-js/faker`, using a fixed seed and Pakistani names, cities and plate formats.
2. Build mileage series per car that rise realistically, then add the planned errors.
3. Add the production guard.
4. Add the commands and document them in `packages/db/README.md`.

## Files and folders touched
- `packages/db/seed/*`, `packages/db/package.json`, `packages/db/README.md`

## Done when
- [ ] `pnpm db:reset` gives a working local database in under a minute
- [ ] Every admin queue (pending garages, flagged jobs, duplicate cars) has rows to work on
- [ ] Running the seed against a database named like production refuses to start

## Open questions
- None
