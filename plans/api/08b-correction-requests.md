# api/08b — Correction requests from the garage

Status: done (Nov 27, 2026) · Phase: pre-pilot · Depends on: api/08, db: job tables

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
- **Built with these decisions:**
  - **What may be proposed** (answers the open question): odometer reading or "not working", service date, and work items with prices (`CorrectionProposalSchema` in `@carfax/shared`). Unknown fields, including car and garage, are refused.
  - **Requests need a connection** (a normal API call, not offline sync): they're rare, and the mechanic gets an answer at once (e.g. "already requested").
  - **The database enforces the rules too:** a request's garage must match its job's (a composite foreign key to a new unique `(id, garage_id)` on jobs; drizzle-kit put the key before the constraint, so the migration was reordered by hand, as in db/05); one open request per job (partial unique index); `decided_at` is set exactly when the status isn't `open` (CHECK); row-level security and the `updated_at` trigger (the db/07 and db/03 coverage tests require both).
  - **Another garage's job answers 404,** like any job you can't see.
  - **Ops decide in admin/12**; the endpoint for that comes with the admin panel. The garage sees the outcome in sync pull's new `job_correction_requests` table.
- **Found while building:** sync pull (api/09) returned every time (e.g. `device_created_at`, `taken_at`) as a **string**, because node-postgres returns `bigint` as text; WatermelonDB needs numbers. Times are now cast to `float8`, and api/09's tests check they're numbers (the check fails on the old code).

## Scope
**In:**
- DB: `job_correction_requests` (id, job_id, garage_id, requested_by, message, proposed JSONB, status: open | approved | rejected, decided_by, decided_at, decision_note, created_at, updated_at) with RLS and the `updated_at` trigger
- `POST /v1/jobs/:id/correction-requests`, `GET /v1/jobs/:id/correction-requests`
- Files: `packages/db/src/schema/jobs.ts`, `packages/db/migrations/0012_job_correction_requests.sql`, `packages/shared/src/corrections.ts`, `apps/api/src/jobs/*`, `apps/api/src/sync/sync-pull.service.ts`, `apps/api/test/correction-requests.test.ts`
- Requests included in sync pull (api/09)

**Out (later items):**
- The admin review screen and applying the change (admin/12), the app's "request a correction" button (garage-app)

## Done when
- [x] A mechanic can request a correction for their garage's submitted job, and not for another garage's
- [x] A second open request for the same job is refused (and a new one is allowed once ops decide)
- [x] The request reaches the phones of that garage through sync pull, and its status updates when ops decide

## Open questions
- ~~Which fields may a garage propose changing?~~ Odometer reading, service date, work items and prices; never the car or garage (see Decisions).
