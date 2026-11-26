# db/05 — Jobs, work items, photos, flags and reminders

Status: planned · Phase: pre-pilot · Depends on: db/03, db/04

## Goal
The tables that hold every service visit and its evidence. This is the data the whole product is built on, so it must support offline sync, fraud checks and reports.

## Decisions
- **Each job stores the plate it was serviced under** (`jobs.reg_no`, normalised), because plates can move between cars (db/04b).
- **The phone creates the job ID**, as in the tech doc, so resending the same job never makes a duplicate. Work items and photos also get phone-made IDs.
- **Job status** as in the tech doc: `draft`, `submitted`, `approved`, `flagged`, `rejected`.
- **`excluded_from_reports`** on jobs (admin/15): ops can keep a removed garage's jobs out of reports without deleting them.
- **Work type is text checked by Zod, not a database enum.** The list (oil change, brakes, denting/painting, engine, suspension, AC, electrical, other) lives in `packages/shared`, so adding a type needs no migration.
- **Photos have GPS:** `lat`, `lng` and `gps_accuracy_m`. The tech doc requires GPS on odometer photos but had no columns for it. admin/08 and admin/15 use them.
- **Flags have `created_at`,** which the tech doc's table was missing. Flag codes: `MILEAGE_DROP`, `NO_PHOTO`, `OCR_MISMATCH`, `MANY_JOBS_SHORT_TIME` (admin/09). Only one open flag per code per job (partial unique index where `resolved_at` is null).
- **Reminders** (tech doc table, left out of its SQL): one row per message due. `returned_job_id` records the job when the customer comes back, which gives the dashboard's "customers who return after a reminder" (admin/16).
- **Synced tables** (`jobs`, `job_items`, `job_photos`, `reminders`) get `updated_at` triggers. Jobs are never hard-deleted; the other three have `deleted_at`.

## Scope
**In:**
- Enums `job_status`, `reminder_status` (`scheduled`, `sent`, `failed`, `cancelled`)
- `jobs` (id, car_id, garage_id, customer_id, created_by, service_date, odometer_km ≥ 0, total_pkr, notes, status, excluded_from_reports, device_created_at, synced_at, updated_at)
- `job_items` (id, job_id, work_type, description, part_name, price_pkr, updated_at, deleted_at)
- `job_photos` (id, job_id, kind: odometer | before | after, storage_key, taken_at, ocr_reading, lat, lng, gps_accuracy_m, updated_at, deleted_at)
- `job_flags` (id, job_id, code, details JSONB, created_at, resolved_by, resolved_at)
- `reminders` (id, garage_id, car_id, customer_id, source_job_id, kind, due_date, status, sent_at, returned_job_id, created_at, updated_at, deleted_at)
- Indexes:
  - `jobs (car_id, service_date)` (tech doc), for the car's timeline
  - `jobs (garage_id, updated_at)`, for sync pulls
  - `jobs (status) WHERE status = 'flagged'`, for the review queue
  - `reminders (status, due_date)`, for the reminder worker

**Out (later items):**
- Row-level security (db/07), flag logic (workers/02)

## Steps
1. Write the schema files and generate the migration.
2. Add the checks (odometer ≥ 0, photo kind) and the partial unique index on open flags.
3. Attach the `updated_at` triggers.
4. Export Zod schemas, with the work-type list from `packages/shared`.

## Files and folders touched
- `packages/db/src/schema/jobs.ts`, `packages/db/src/schema/reminders.ts`, `packages/db/migrations/*`

## Done when
- [ ] Inserting the same job ID twice fails, so the API can treat a resend as "already saved"
- [ ] A job can't point at a car or garage that doesn't exist
- [ ] A second open `MILEAGE_DROP` flag on the same job is refused; after resolving, a new one is allowed
- [ ] The car timeline query uses `jobs_car_date` (checked with `EXPLAIN`)

## Open questions
- Should the API rewrite `jobs.car_id` to the real car when it came in under an alias (db/04), or keep the alias and resolve it on read? Proposed: rewrite on sync, so reports only follow `merged_into_id`.
