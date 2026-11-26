# db/05 — Jobs, work items, photos, flags and reminders

Status: done (Nov 27, 2026) · Phase: pre-pilot · Depends on: db/03, db/04

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
- **Built with these additions** (from the garage-app, api and admin plans, or found while building):
  - **"Odometer not working"** (garage-app/11): `odometer_km` may be null only when `odometer_not_working` is true (CHECK). Readings must be 0–2,000,000 km.
  - **"Next service due"** date and km on the job card (garage-app/20, api/13), which reminders are made from.
  - **Labour price separate from part price** on work items (garage-app/12).
  - **`job_photos.uploaded_at`:** a photo row can sync before its file finishes uploading, so the flag check can tell "still uploading" from "no photo" (workers/02). An uploaded photo must have a storage key (CHECK). The storage key is unique.
  - **Privacy guard:** jobs and reminders reference `(customer_id, garage_id)` together, so a job can only use a customer of its own garage. This needs a unique `(id, garage_id)` on customers, which the migration creates before the foreign keys (moved by hand: drizzle-kit put it after them).
  - **Work type and flag codes are text**, as planned, with a CHECK on the code format (`oil_change`, `MILEAGE_DROP`) and the exact list checked by Zod (`WorkTypeSchema`, `FlagCodeSchema`).
  - **`photo_kind` is an enum** (`odometer`, `before`, `after`) instead of a CHECK.
  - **The review queue index** is on `synced_at` for flagged jobs only, so the oldest-first queue (admin/09) reads straight from it.
  - **`createDb` now always handles idle-connection errors** (found while testing). In node-postgres, an unhandled error on an idle pooled connection crashes the whole process, which would happen on any database restart or failover. `createDb` logs it by default and the pool replaces the connection; a test kills a connection to prove it.
- **Answer to the open question:** the API rewrites `jobs.car_id` to the kept car when a job arrives under an alias (api/08), so reports only ever follow `merged_into_id`.

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
- `packages/db/src/schema/jobs.ts` (jobs, items, photos, flags and reminders in one file), `packages/db/src/schema/garages.ts` (unique `(id, garage_id)`), `packages/db/src/zod.ts`, `packages/db/src/client.ts` (error handler)
- `packages/db/migrations/0006_jobs_and_reminders.sql`

## Done when
- [x] Inserting the same job ID twice fails, so the API can treat a resend as "already saved"
- [x] A job can't point at a car or garage that doesn't exist (nor at another garage's customer)
- [x] A second open `MILEAGE_DROP` flag on the same job is refused; after resolving, a new one is allowed
- [x] The car timeline query uses `jobs_car_date` (checked with `EXPLAIN`)

## Open questions
- None. (Alias question answered above: rewrite on sync.)
