# api/15 — Public search and free preview

Status: planned · Phase: pilot (free reports) · Depends on: api/06, api/14

## Goal
A buyer types a plate or chassis number and learns, for free, whether we have a history for that car, enough to decide whether to buy the report.

## Decisions
- **`GET /public/search?q=`** (tech doc).
- **Show as little as needed** (the tech doc's preview showed an exact record count, which helps scrapers map the database):
  - `found: false` → "No records yet."
  - `found: true` → make, model, year, and a **range** of records ("1–2", "3–5", "6+") and the year of the latest record.
- **Only approved, non-excluded jobs count**, the same rule as the report.
- **No garage names, cities of individual jobs, or customer data** in the preview.
- **Every search is logged** (`search_logs`: normalised query, found yes/no, city if known, time, no IP stored beyond 30 days). This gives the product doc's gate metric "searches that find a history" (admin/16).
- **Rate limited and protected by Turnstile** (api/14).

## Scope
**In:**
- `GET /public/search`
- DB: `search_logs` — add to db: reports tables
- Preview query that matches the report builder's rules

**Out (later items):**
- Search page (web), report orders (api/16)

## Steps
1. Normalise the query with the shared helpers; look up by plate, chassis and aliases (api/06).
2. Count approved, non-excluded jobs; map the count to a range.
3. Write the search log row.
4. Tests: unknown plate, known plate, plate with only flagged jobs (counts as not found), privacy test.

## Files and folders touched
- `apps/api/src/modules/public/*`, `packages/db` (search_logs)

## Done when
- [ ] A plate with approved jobs shows make, model, year and a record range
- [ ] A plate with only flagged or excluded jobs shows "no records"
- [ ] Every search appears in `search_logs` and the hit-rate number in admin/16 matches

## Open questions
- Show the preview to signed-out visitors, or require a phone sign-in first? Proposed: signed-out is fine, with Turnstile.
