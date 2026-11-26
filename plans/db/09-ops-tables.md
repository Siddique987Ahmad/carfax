# db/09 — Spot-checks and daily metrics

Status: planned · Phase: pilot · Depends on: db/03, db/05

## Goal
Tables for the ops work that starts once real garages are logging: recording spot-check visits, and storing daily numbers for the dashboard.

## Decisions
- **`garage_spot_checks`** (admin/15): one row per visit, with who went, the result and notes. This is the paper trail behind the product doc's "spot-checked and can be removed."
- **`daily_metrics`** (admin/16): one row per date, city and metric, written by a nightly worker. Dashboards read these snapshots instead of counting live tables.
- **City `'all'` for totals,** instead of an empty value, so the unique key works simply.
- **Metric names are text checked by Zod** against a list in `packages/shared`, so adding a metric needs no migration.

## Scope
**In:**
- Enum `spot_check_result` (`ok`, `issues`, `removed`)
- `garage_spot_checks` (id, garage_id, visited_at, visited_by, result, notes, created_at)
- `daily_metrics` (date, city, metric, value NUMERIC, created_at); primary key date + city + metric, so a rerun overwrites instead of duplicating
- Zod schemas and the metric name list

**Out (later items):**
- The trust-score and metrics workers (admin/15, admin/16)

## Steps
1. Write the schema files and generate the migration.
2. Add the metric list to `packages/shared`.
3. Add sample rows to the `dev` seed (db/08).

## Files and folders touched
- `packages/db/src/schema/ops.ts`, `packages/db/migrations/*`, `packages/shared/src/metrics.ts`, `packages/db/seed/*`

## Done when
- [ ] Writing the same day's metric twice keeps one row with the latest value
- [ ] A spot-check can't point at a garage or user that doesn't exist

## Open questions
- None
