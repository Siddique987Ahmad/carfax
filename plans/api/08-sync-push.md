# api/08 — Sync push (offline jobs to server)

Status: done (Nov 27, 2026) · Phase: pre-pilot · Depends on: api/06, api/07, db: job tables

## Goal
Jobs saved on a phone without internet reach the server safely when it reconnects: none lost, none duplicated, even if the upload is cut halfway and retried.

## Decisions
- **Photos (from api/07):** accept a photo's `storageKey` only if it equals `photoKey(job.garageId, job.id, photo.id)` (exported from `uploads.controller.ts`), so a key can't point into another garage's folder. Set `uploaded_at` only after `StorageService.head()` finds the file (size ≤ 2 MB); otherwise keep the row with `uploaded_at` null, which the flag checks treat as "still uploading" (workers/02).
- **Cars (from api/06):** resolve each car in the push with `CarIdentityService.resolveIn(tx, …)` inside the same transaction, then use the returned `carId` for its jobs and return every `remappedFrom → carId` to the phone. A `plateMoved` result means the phone's car is new; a `possibleDuplicate` is already logged for ops.
- **When a job arrives under a car alias, rewrite `jobs.car_id` to the kept car** before saving (decided in db/05), so reports only follow `merged_into_id`. A photo row can arrive before its file: leave `uploaded_at` null until the upload is confirmed.
- **Follow WatermelonDB's sync format** (`changes: { table: { created, updated, deleted } }`), so the app can use WatermelonDB's built-in `synchronize()` (garage-app sync plan) instead of custom code.
- **`POST /sync/push`** (tech doc) saves the whole batch in **one transaction**: all of it or none of it.
- **Safe to resend:** every record has a phone-made UUID; a record already saved is skipped, not duplicated.
- **Submitted jobs are final from the app's side.** The app can edit a job only while it's a draft; after submit, only ops can correct it (admin/12). This stops quiet mileage edits.
- **Order inside the batch:** cars → customers → jobs → job items → photos, with car ID remaps from api/06 applied before jobs are saved.
- ~~**Photo records are accepted only if the file is in storage**~~ **Changed while building** (it contradicted db/05 and api/07): a photo row is accepted before its file, with `uploaded_at` empty; the app resends the row after uploading and the server then confirms the file. Refusing the push would hold every job back behind slow photo uploads on weak networks. The flag check's grace period covers the gap (workers/02).
- **Batch limit:** 50 jobs per push. The app splits bigger backlogs.
- **After commit, flag checks are queued** for each new job (workers: flag checks). If queueing fails, a sweeper picks up `submitted` jobs older than 5 minutes, so no job skips its checks.
- **Built with these decisions:**
  - **Two kinds of failure.** Malformed data (an app bug) fails validation: 400 `VALIDATION_FAILED` and nothing is saved. Records that can **never** be accepted are listed in `rejected` with a code (`SYNC_REJECT_CODES` in `@carfax/shared`) while the rest is saved: refusing the whole push for them would block that phone's sync forever. Codes: `JOB_CONFLICT`, `JOB_LOCKED`, `JOB_UNKNOWN_CAR`, `JOB_FUTURE_DATE`, `JOB_NO_ITEMS`, `PARENT_JOB_MISSING`, `PHOTO_KEY_INVALID`, `PHOTO_LOCKED`, `CUSTOMER_PHONE_TAKEN`, `ID_CONFLICT`. A database failure mid-push rolls everything back (tested by making the last step, photos, fail).
  - **Customers are remapped like cars:** a customer created on two phones of one garage with the same number becomes one (a lock per phone makes it safe when pushes arrive together). Another garage's customer with the same number stays separate. The response has `remaps.cars` and `remaps.customers`.
  - **A job's customer the server doesn't know** is dropped with a `CUSTOMER_UNKNOWN` warning, and the job is saved.
  - **The server decides** the garage, `created_by`, `status` (`submitted`) and `total_pkr` (from the items); what the app sends for these is ignored. Service dates may be at most tomorrow in Pakistan time.
  - **Photos can be added to a job synced earlier** (evidence only grows), never deleted. A resent photo row can only fill in the upload state; its time, place and reading can't change.
  - **Ownership checks run before the transaction** in system scope (which job and photo ids exist in which garage), because row-level security hides other garages' rows inside it; file checks in storage run there too, 20 at a time.
  - **Request bodies up to 1 MB** (Express's default is 100 kB; 50 jobs with items are bigger).
  - **Queueing uses BullMQ** (`QUEUES.flagChecks` in `@carfax/shared`, one queue entry per job id), best effort with a 2-second limit. `msgpackr-extract` (an optional native speed-up) is denied in `pnpm-workspace.yaml`.
  - **Reminder rows are created by api/13,** which owns their rules, by hooking into this push.
  - **Sync record schemas** (`SyncPushSchema` and friends in `packages/shared/src/sync.ts`) use WatermelonDB's raw format: snake_case columns, times in milliseconds; WatermelonDB's `_status`/`_changed` are dropped.

## Scope
**In:**
- `POST /sync/push` with Zod schemas per table
- Server-side checks: job belongs to the caller's garage, odometer is a whole number ≥ 0, service date not in the future, work types from the shared list
- Response: `{ ok, remaps: { cars, customers }, rejected: [{ table, id, code }], warnings, newJobs }`
- ~~Reminder rows created from jobs~~ moved to api/13

**Out (later items):**
- Sync pull (api/09), flag logic (workers)

## Steps
1. Zod schemas for each synced table in `packages/shared` (shared with the app).
2. Push service: open `withGarage` transaction, resolve cars, upsert customers, insert jobs/items/photos with `ON CONFLICT (id) DO NOTHING`.
3. Storage existence check for photos.
4. Enqueue flag checks after commit; sweeper job definition handed to workers.
5. Tests: retry of the same batch saves nothing twice; a batch with a missing photo saves nothing; a cut-off batch leaves no partial rows.

## Files and folders touched
- `apps/api/src/sync/*`, `apps/api/src/queue/queue.module.ts`, `apps/api/src/cars/car-identity.service.ts` (`resolveCarId`, `currentPlate`), `apps/api/src/app.ts` (body limit)
- `apps/api/test/sync.test.ts`, `apps/api/test/sync-queue.test.ts`, `apps/api/test/redis-outage.test.ts`
- `packages/shared/src/sync.ts`, `packages/shared/src/queues.ts`, `pnpm-workspace.yaml`

## Done when
- [x] Sending the same batch 3 times gives the same database state as sending it once (also two at the same moment)
- [x] A batch with one bad record is refused as a whole with a readable error code, when the record is malformed (`VALIDATION_FAILED` with the path); a valid record that can never be accepted is listed in `rejected` instead (see Decisions)
- [x] An offline-created car that already exists is remapped, and its jobs land on the existing car (also jobs sent later with the old id)
- [x] Every new job gets a flag check, even when Redis was down during the push: queued once per new job; when queueing fails, the push succeeds and the job stays `submitted` for the sweeper, which workers/02 builds

## Open questions
- ~~If a mechanic made a mistake after submitting, how do they ask for a fix?~~ Decided Nov 27, 2026: a "request correction" from the app that lands in the admin review queue. Planned as api/08b.
