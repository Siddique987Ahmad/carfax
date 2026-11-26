# api/08 — Sync push (offline jobs to server)

Status: planned · Phase: pre-pilot · Depends on: api/06, api/07, db: job tables

## Goal
Jobs saved on a phone without internet reach the server safely when it reconnects: none lost, none duplicated, even if the upload is cut halfway and retried.

## Decisions
- **When a job arrives under a car alias, rewrite `jobs.car_id` to the kept car** before saving (decided in db/05), so reports only follow `merged_into_id`. A photo row can arrive before its file: leave `uploaded_at` null until the upload is confirmed.
- **Follow WatermelonDB's sync format** (`changes: { table: { created, updated, deleted } }`), so the app can use WatermelonDB's built-in `synchronize()` (garage-app sync plan) instead of custom code.
- **`POST /sync/push`** (tech doc) saves the whole batch in **one transaction**: all of it or none of it.
- **Safe to resend:** every record has a phone-made UUID; a record already saved is skipped, not duplicated.
- **Submitted jobs are final from the app's side.** The app can edit a job only while it's a draft; after submit, only ops can correct it (admin/12). This stops quiet mileage edits.
- **Order inside the batch:** cars → customers → jobs → job items → photos, with car ID remaps from api/06 applied before jobs are saved.
- **Photo records are accepted only if the file is in storage** (api/07); otherwise the whole push is refused with a clear code and the app retries after uploading.
- **Batch limit:** 50 jobs per push. The app splits bigger backlogs.
- **After commit, flag checks are queued** for each new job (workers: flag checks). If queueing fails, a sweeper picks up `submitted` jobs older than 5 minutes, so no job skips its checks.

## Scope
**In:**
- `POST /sync/push` with Zod schemas per table
- Server-side checks: job belongs to the caller's garage, odometer is a whole number ≥ 0, service date not in the future, work types from the shared list
- Response: `{ ok, remaps, rejected: [{ id, code }] }`
- Reminder rows created from jobs (rules in api/13)

**Out (later items):**
- Sync pull (api/09), flag logic (workers)

## Steps
1. Zod schemas for each synced table in `packages/shared` (shared with the app).
2. Push service: open `withGarage` transaction, resolve cars, upsert customers, insert jobs/items/photos with `ON CONFLICT (id) DO NOTHING`.
3. Storage existence check for photos.
4. Enqueue flag checks after commit; sweeper job definition handed to workers.
5. Tests: retry of the same batch saves nothing twice; a batch with a missing photo saves nothing; a cut-off batch leaves no partial rows.

## Files and folders touched
- `apps/api/src/modules/sync/*`, `packages/shared/src/sync/*`

## Done when
- [ ] Sending the same batch 3 times gives the same database state as sending it once
- [ ] A batch with one bad record is refused as a whole with a readable error code
- [ ] An offline-created car that already exists is remapped, and its jobs land on the existing car
- [ ] Every new job gets a flag check, even when Redis was down during the push

## Open questions
- If a mechanic made a mistake after submitting (wrong odometer), how do they ask for a fix? Proposed: a "request correction" note from the app that lands in the admin review queue.
