# api/10 — Garage jobs list and detail

Status: done (Nov 27, 2026) · Phase: pre-pilot · Depends on: api/08

## Goal
A garage can list and open its own jobs from the server, for screens and devices that don't hold the full history locally (for example a new phone, or the owner checking from a second device).

## Decisions
- **`GET /jobs?from=&to=`** (tech doc), plus status and car filters, with cursor paging.
- **`GET /jobs/:id`** returns items, photo signed URLs, flags in plain words ("mileage lower than a previous record") and review notes from ops.
- **The app mostly reads its local database**; these endpoints are the fallback and the source for the owner's history screens.
- ~~**Mechanics see the job list but not totals.** Prices on single jobs stay visible because mechanics write the bill.~~ **Changed while building:** one rule everywhere, the one sync pull already uses (api/09): **a mechanic sees prices only on jobs they logged** (they write those bills), in the list and in the detail; owners see all. Two rules would make the phone and the server disagree about the same job.
- **Built with these decisions:**
  - **`GET /v1/jobs`:** filters `from`, `to` (service date), `status`, `carId`; newest first; cursor paging by (service date, id), 50 per page by default, at most 100. Each row has the car, plate, customer name, who logged it and the work types.
  - **`GET /v1/jobs/:id`:** items, customer, photos with **5-minute signed links** (none until the file is uploaded), flags in plain words (`FLAG_DESCRIPTIONS` in `@carfax/shared`, so the app shows the same wording), ops' review notes (the audit log's `job.approve`, `job.reject`, `job.correct`, written by admin/10 and admin/12) and correction requests.
  - **Another garage's job is 404,** exactly like one that doesn't exist (row-level security hides it).
  - **The correction request is api/08b's,** not a `job_flags` row: a separate table keeps ops' "please fix" queue apart from the automatic fraud flags and lets the garage see the outcome.

## Scope
**In:**
- `GET /jobs`, `GET /jobs/:id`
- ~~`POST /jobs/:id/correction-request`~~ built in api/08b

**Out (later items):**
- Admin review (admin/10), editing jobs (only via sync while a draft)

## Steps
1. List query with filters and cursor paging.
2. Detail with signed photo URLs from `StorageService`.
3. ~~Correction request~~ (api/08b).
4. Tests for garage isolation and the mechanic view.

## Files and folders touched
- `apps/api/src/jobs/jobs.service.ts`, `apps/api/src/jobs/jobs.controller.ts`, `apps/api/src/jobs/jobs.module.ts`, `apps/api/test/jobs.test.ts`, `packages/shared/src/constants/statuses.ts` (`FLAG_DESCRIPTIONS`)

## Done when
- [x] An owner can list last month's jobs and open one with its photos (the photo link downloads the file)
- [x] A correction request appears in the admin review queue (api/08b's `job_correction_requests`; the admin screen is admin/12)
- [x] Another garage's job ID returns 404

## Open questions
- None
