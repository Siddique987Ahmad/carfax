# admin/12 — Correct a car or job record

Status: planned · Phase: pilot · Depends on: admin/11

## Goal
Ops can fix a wrong make, model, plate or odometer value, and every fix is recorded with who made it, why, and the value before and after.

## Decisions
- **Garage correction requests (api/08b, approved Nov 27, 2026):** list open `job_correction_requests` here, next to the flagged-jobs queue. Approving applies the proposed values through this same audited edit (with the request's message as the note); rejecting needs a reason. The garage sees the outcome on its next sync pull.
- **Edit with a required note,** never silently. The API writes `before`/`after` JSON to `audit_logs`, as in the tech doc.
- **Only a small set of fields can be edited:** car (plate, chassis, make, model, year) and job (odometer reading, service date, work items). Everything else is read-only.
- **Changing a plate to one that already exists is blocked,** with a link to merge instead (admin/13).
- **After an edit, the flag checks run again** for that car, because a corrected reading can create or clear a mileage drop.

## Scope
**In:**
- API: `PATCH /admin/cars/:id` and `PATCH /admin/jobs/:id/fields` with a note
- UI: edit dialogs on the car detail page, a "changed by ops" marker on edited values, and a history of changes per car
- Queue a workers/02 flag check after each edit

**Out (later items):**
- Edits that come from disputes (admin/16 uses this same endpoint)

## Steps
1. Endpoints with field allowlists and Zod validation.
2. Write the audit entry in the same transaction as the change.
3. Check for a duplicate plate or chassis and return a "merge instead" error.
4. Queue the flag re-check.
5. Edit dialogs and the per-car change history.

## Files and folders touched
- `apps/api/src/modules/admin/cars/*`, `apps/api/src/modules/admin/jobs/*`, `apps/admin/src/pages/cars/[id]/*`

## Done when
- [ ] Every edit shows in the car's history with old value, new value, person and note
- [ ] Editing to a plate that exists is refused with a link to merge
- [ ] Correcting an odometer reading updates the mileage flags

## Open questions
- None
