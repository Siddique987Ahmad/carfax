# api/08b — Correction requests from the garage

Status: planned · Phase: pre-pilot · Depends on: api/08, db: job tables

## Goal
A mechanic or owner who made a mistake in a submitted job (wrong odometer reading, wrong work item) can ask for it to be fixed from the app. Ops review the request and correct the job, so submitted jobs stay tamper-proof while honest mistakes still get fixed.

## Why (decided Nov 27, 2026)
Sync push treats submitted jobs as final (`JOB_LOCKED`, api/08), so a quiet edit can't hide a rollback. The owner approved the "request correction" proposal from api/08's open question: the garage asks, ops decide.

## Decisions
- **The app sends a request, not an edit:** `POST /v1/jobs/:id/correction-requests` with a message and, optionally, the proposed values (e.g. `{ odometerKm: 84250 }`). The job doesn't change until ops act.
- **Who can ask:** any member of the job's garage (`jobs.create`), for that garage's own jobs only. Pending and suspended garages can't (it's a write).
- **One open request per job.** A second one while the first is open is refused (409), so the queue doesn't fill with repeats.
- **Ops review it in the admin panel** (admin/12, next to the flagged-jobs queue, admin/09): approve applies the proposed values through the same audited correction path, reject closes it with a reason. Either way the garage sees the outcome after its next sync pull (api/09).
- **Requests are garage data:** stored with `garage_id`, protected by row-level security (db/07), and synced to the garage's phones so the app can show "correction requested / done / declined".
- **Every request and decision is in the audit log.**

## Scope
**In:**
- DB: `job_correction_requests` (id, job_id, garage_id, requested_by, message, proposed JSONB, status: open | approved | rejected, decided_by, decided_at, decision_note, created_at, updated_at) with RLS and the `updated_at` trigger
- `POST /v1/jobs/:id/correction-requests`, `GET /v1/jobs/:id/correction-requests`
- Requests included in sync pull (api/09)

**Out (later items):**
- The admin review screen and applying the change (admin/12), the app's "request a correction" button (garage-app)

## Done when
- [ ] A mechanic can request a correction for their garage's submitted job, and not for another garage's
- [ ] A second open request for the same job is refused
- [ ] The request reaches the phones of that garage through sync pull, and its status updates when ops decide

## Open questions
- Which fields may a garage propose changing? Proposed: odometer reading, service date, work items and prices; never the car or garage (those go through car merge, admin/13).
