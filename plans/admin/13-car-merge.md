# admin/13 — Merge duplicate cars

Status: planned · Phase: pilot · Depends on: admin/12

## Goal
When the same car exists twice (typed plate vs scanned plate, plate vs chassis, two garages adding it offline), ops can combine them into one record, so its history isn't split.

## Decisions
- **Preview before merge:** both cars side by side, with the combined mileage timeline.
- **No deletes.** The merged-away car keeps a `merged_into_id` pointer, so old links and report orders still resolve to the right car.
- **Merging can be undone** within 30 days, because the jobs that moved are stored in the audit entry.
- **Suggest likely duplicates:** same chassis, or plates that differ by one character, with the same make and model.

## Scope
**In:**
- DB: `cars.merged_into_id` (nullable, self-reference)
- API: `GET /admin/cars/duplicates` (suggestions), `POST /admin/cars/merge` (as in the tech doc: keep id, merge id, note), `POST /admin/cars/merge/:auditId/undo`
- Merge moves jobs, report orders, disputes and reminders to the kept car in one transaction, then runs the flag checks again
- UI: "Merge with…" on the car page, a suggestions list, the preview, and confirm

**Out (later items):**
- None

## Steps
1. `merged_into_id` comes from db/04; car lookups follow the pointer.
2. Merge service: move rows, set the pointer and write the audit entry, all in one transaction.
3. Undo service using the audit entry.
4. Duplicate suggestion query.
5. UI: suggestions, preview, confirm.

## Files and folders touched
- `packages/db` (migration), `apps/api/src/modules/admin/cars/*`, `apps/admin/src/pages/cars/merge/*`

## Done when
- [ ] After a merge, searching either plate opens the kept car with all jobs
- [ ] An old report order for the merged car still opens
- [ ] Undo restores both cars exactly

## Open questions
- This same logic serves the sync conflict in api/06 (two offline-created copies of one car). Build it once in a shared service.
