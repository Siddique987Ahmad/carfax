# admin/09 — Flagged jobs queue

Status: planned · Phase: pre-pilot · Depends on: admin/02, admin/06, workers/02

## Goal
Ops has one queue of every job the automatic checks flagged, so nothing suspicious reaches a report unseen.

## Decisions
- **Oldest first.** A flagged job stays out of reports until reviewed, so waiting jobs cost the most.
- **Group by flag code:** `MILEAGE_DROP`, `NO_PHOTO`, `OCR_MISMATCH`, `MANY_JOBS_SHORT_TIME`, so ops can work through one kind at a time.
- **Count shown in the navigation,** so the queue is hard to ignore.

## Scope
**In:**
- API: `GET /admin/jobs/flagged?code=&garage=&city=&page=` (as in the tech doc), returning job, car, garage, flag codes and age
- API: `GET /admin/jobs/flagged/counts` for the navigation badge and tabs
- UI: queue with tabs per flag code, garage and city filters, and each row's age ("waiting 2 days")

**Out (later items):**
- Reviewing a single job (admin/10)

## Steps
1. Query jobs with status `flagged` and unresolved flags, joined to car and garage.
2. Add the list and count endpoints.
3. Build the queue page and the navigation badge (refreshed every minute).

## Files and folders touched
- `apps/api/src/modules/admin/jobs/*`, `apps/admin/src/pages/jobs/flagged/*`

## Done when
- [ ] Seeded flagged jobs appear, oldest first, with the right flag codes
- [ ] Tab counts and the navigation badge match the list
- [ ] Each row opens the job review page (a stub until admin/10)

## Open questions
- Target review time (e.g. within 24 hours)? It could be shown as a warning colour on old rows.
