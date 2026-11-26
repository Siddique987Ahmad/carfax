# db/04 — Cars

Status: done (Nov 27, 2026) · Phase: pre-pilot · Depends on: db/01

## Goal
One row per vehicle, built so that phones can create cars offline, duplicates can be merged later, and searching by plate is fast.

## Decisions
- **Superseded in part by db/04b:** plates moved from `cars.reg_no` to the `car_registrations` history table, because a plate can move between cars. The rest of this plan stands.
- **The phone can create the car ID.** `id` is a UUID with a server default for rows the API creates, but the API also accepts an ID from the phone. This fixes the tech-doc problem where offline car creation and a server-generated ID didn't fit together.
- **`car_aliases` table** (alias_id → car_id). When two phones create the same car offline, the API keeps one and records the other phone's ID as an alias. Jobs that arrive later with the old ID still find the right car. api/06 uses this.
- **`merged_into_id`** (admin/13): a merged car is never deleted; lookups follow the pointer.
- **A car needs at least one identifier:** `CHECK (reg_no IS NOT NULL OR chassis_no IS NOT NULL)`.
- **`reg_no` is stored normalised** (`LEA1234`) by the shared `normaliseRegNo()` function (admin/11). It's unique, and so is `chassis_no`. Unique columns still allow many empty values.
- **Trigram indexes** on `reg_no` and `chassis_no` for partial-match search (admin/11), using the `pg_trgm` extension.
- **Synced table:** `updated_at` trigger (from db/03).
- **Built with these additions:**
  - **The database only accepts normalised numbers:** CHECKs refuse `LEA-1234`, `lea1234` or a plate without both letters and digits. If any code path forgets `normaliseRegNo()`, it fails loudly instead of storing a second spelling of the same car.
  - **CHECKs:** a car can't be merged into itself, an alias can't point to itself, and model and registration years must be 1950–2100.
  - **`carInsertSchema`** (in `@carfax/db/zod`) takes any spelling and outputs the normalised form, and refuses a car with neither a plate nor a chassis number.
  - **Constraint names are snake_case** (`cars_reg_no_unique`), set explicitly, because drizzle-kit otherwise names them from the TypeScript keys.
  - **One migration file:** `pg_trgm` and the `updated_at` trigger were added by hand to the generated `0004_cars.sql` (drizzle-kit allows editing generated SQL; `db:check` only looks for missing files). The migration user needs permission to `CREATE EXTENSION` (db/06); every common managed Postgres allows `pg_trgm`.

## Scope
**In:**
- `cars` (id, reg_no, reg_year, chassis_no, make, model, year, merged_into_id, created_at, updated_at)
- `car_aliases` (alias_id primary key, car_id, created_at)
- `pg_trgm` extension and trigram indexes
- Zod schemas, with `reg_no` run through `normaliseRegNo()`

**Out (later items):**
- Merge logic (admin/13 and api/06), owner claims (db/12)

## Steps
1. Enable `pg_trgm` in a hand-written migration.
2. Write the schema, the check, the unique indexes and the trigram indexes; generate the migration.
3. Attach the `updated_at` trigger.
4. Export the Zod schemas.

## Files and folders touched
- `packages/db/src/schema/cars.ts`, `packages/db/src/zod.ts`, `packages/db/migrations/0004_cars.sql`

## Done when
- [x] A car with neither a plate nor a chassis number is refused
- [x] Inserting a car with an ID made on the phone works
- [x] A partial plate search uses the trigram index (checked with `EXPLAIN`). The test proves the index serves `ILIKE '%…%'`. A one-off check with 100,000 cars showed Postgres choosing it by itself; with only a few thousand rows it reads the whole table instead, which is cheaper at that size.

## Open questions
- Is a Punjab plate unique without its year? If not, the unique key becomes (`reg_no`, `reg_year`). The `reg_year` column is added now (nullable) so this can change without reshaping the table.
