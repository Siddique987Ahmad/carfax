# admin/15 — Garage trust score and spot-checks

Status: planned · Phase: pilot · Depends on: admin/08, admin/10

## Goal
Ops can see which garages look suspicious and plan spot-check visits, as the product doc's trust rules require ("many jobs, no photos, same car repeatedly").

## Decisions
- **The trust score is calculated, not typed.** It starts at 100 (as in the tech doc's `garages.trust_score`) and drops with rejected jobs, flags per 100 jobs, missing photos and GPS far from the garage. The formula lives in one function so it can be tuned.
- **The score is a ranking for ops, not an automatic ban.** Only a person suspends a garage.
- **Spot-check log:** record each visit (date, who, result, notes), so the product doc's "spot-checked and can be removed" has a paper trail.
- **When a garage is removed,** ops decides whether its past approved jobs stay in reports. The decision is audited.

## Scope
**In:**
- Worker: recalculate scores nightly
- DB: `garage_spot_checks` (garage_id, visited_at, visited_by, result: ok | issues | removed, notes); `jobs.excluded_from_reports` boolean
- API: `GET /admin/garages/risk` (lowest scores and the reasons), spot-check endpoints, and "exclude this garage's jobs from reports"
- UI: risk list with reasons ("38% of jobs flagged in 30 days"), spot-check form and history on the garage page

**Out (later items):**
- None

## Steps
1. Score function, with tests on sample garages.
2. Nightly worker job.
3. Spot-check table from db/09 and the exclusion flag from db/05; the report builder honours the flag.
4. Risk list and spot-check UI.

## Files and folders touched
- `workers/src/trust-score.ts`, `packages/db` (migration), `apps/api/src/modules/admin/garages/*`, `apps/admin/src/pages/garages/risk/*`

## Done when
- [ ] A seeded garage with many flags appears at the top of the risk list with readable reasons
- [ ] A spot-check visit can be logged and shows on the garage page
- [ ] Excluded jobs don't appear in the report preview (admin/11)

## Open questions
- Score weights: start simple and tune after the pilot with real data.
