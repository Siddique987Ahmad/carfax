# admin/16 — Dashboard with the product metrics

Status: planned · Phase: pilot · Depends on: admin/07, admin/09

## Goal
The home page shows the numbers the product doc uses to decide whether to move to the next phase, so the go/no-go gates are read from real data.

## Decisions
- **"Customers who came back after a reminder" (from api/13):** sent reminders with `returned_job_id` set, divided by sent reminders whose window has closed (due date + 30 days passed).
- **Track the product doc's metrics table, not vanity numbers:**
  - Active garages (logged at least one job in the last 7 days)
  - Jobs per garage per week
  - Share of jobs with an odometer photo
  - Customers who came back after a reminder (needs workers/05)
  - Report searches that found a history (needs api/15 and web/07)
  - Paying report buyers and dealers
- **Add one number missing from the product doc:** cars with 2 or more records. That's what makes a report worth buying.
- **Show each metric against its target** (pilot month 4 and one city at month 12), so the gate status is visible at a glance.
- **Numbers come from nightly snapshots** (`daily_metrics` table), so the dashboard is fast and trends can be charted.

## Scope
**In:**
- Worker: nightly job writing one row per metric per day (and per city)
- API: `GET /admin/stats?from=&to=&city=` (as in the tech doc)
- UI: metric tiles with target and trend, a jobs-per-day chart, flag queue size, and a city filter
- Metrics that have no data yet show "not live yet" instead of zero

**Out (later items):**
- Revenue numbers (added with admin/17)

## Steps
1. `daily_metrics` table comes from db/09.
2. Nightly worker, with a backfill command for past days.
3. Stats endpoint.
4. Dashboard tiles and charts.

## Files and folders touched
- `packages/db` (migration), `workers/src/daily-metrics.ts`, `apps/api/src/modules/admin/stats/*`, `apps/admin/src/pages/dashboard/*`

## Done when
- [ ] Each tile matches a hand-counted SQL query on seeded data
- [ ] Targets from the product doc appear next to each metric
- [ ] The dashboard loads in under a second with a year of snapshots

## Open questions
- Should targets be editable in the panel, or kept in code? Proposed: in code until they change often.
