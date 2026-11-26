# api/09 — Sync pull (server changes to phone)

Status: done (Nov 27, 2026) · Phase: pre-pilot · Depends on: api/08

## Goal
Each phone in a garage gets what changed since it last synced: jobs logged on the garage's other phones, review results (approved, flagged, rejected), customers, reminders and the latest work-type list.

## Decisions
- **`GET /sync/pull?since=`** (tech doc), in WatermelonDB's format, returning `{ changes, timestamp }`.
- **The cursor is a server timestamp**, never the phone's clock, which may be wrong.
- **Only the caller's garage data**, through `withGarage` and row-level security.
- **Every synced table has `updated_at`**, updated by a database trigger, and soft deletes (`deleted_at`), so deletions reach other phones. Add both to the db plans.
- **Overlap each pull to avoid missed changes** (found in db/03). `updated_at` is set when a transaction *starts*, but the row only becomes visible when it *commits*. A change still being saved while a phone syncs can get a timestamp just before the returned `timestamp`, and would be skipped forever. So the pull returns `timestamp` = query start minus 60 seconds, and the next pull asks for `updated_at > since` again from there. The phone receives a few rows twice, which WatermelonDB applies safely (same IDs).
- **Cars come along only if the garage has a job on them**, never the whole car table.
- **First sync on a new phone** (`since` empty) returns the last 12 months of the garage's data, in pages.
- **Built with these decisions:**
  - **`GET /v1/sync/pull?last_pulled_at=&cursor=`** (WatermelonDB's name for `since`). Tables: customers, jobs, job_items, job_photos, reminders, cars.
  - **Every changed record goes in `updated`, never `created`:** the overlap can send a record the phone already has, which WatermelonDB treats as an error in `created` but applies safely in `updated`. The app sets `sendCreatedAsUpdated: true`.
  - **The window is fixed at the first page** (the database's clock, kept exact as text); the returned `timestamp` is the window's end minus 60 seconds (the overlap). On a first sync, deleted rows aren't sent.
  - **Paging can't skip or repeat rows:** table by table, ordered by exact `updated_at` then `id`, up to 1,000 rows per page, with an opaque cursor. Tested with 5,000 jobs and items inserted in one statement (all sharing one timestamp, the hardest case): 5,001 jobs, none missing or repeated, in about 3 seconds.
  - **Cars:** the garage's cars that changed (the car or its plates) **plus** cars that a job in this pull points at, so a colleague's new job on an old car arrives with its car. Merged cars come as `deleted`; their jobs arrive pointing at the kept car. Full chassis numbers are sent for the garage's own cars.
  - **Prices:** a mechanic gets prices only on the jobs they logged (they send those bills); other jobs' `total_pkr` and item prices arrive empty. Owners get everything (garage-app/14: mechanics don't see the garage's earnings).
  - **Photos come as metadata** (with `uploaded`, not the file). Garage settings and the work-type list aren't pulled: the profile is `GET /garage/me` (api/05) and work types ship with the app (`@carfax/shared`).
  - **`updated_at` triggers and `deleted_at` columns already existed** (db/03, db/05).

## Scope
**In:**
- `GET /sync/pull?since=&page=`
- Tables: customers, cars (referenced only), jobs (with status), job_items, job_photos (metadata only), reminders, garage settings, work types
- Page size limit, and `hasMore` for large first syncs

**Out (later items):**
- App side of sync (garage-app sync plan)

## Steps
1. `updated_at` triggers and `deleted_at` columns (hand to db plans).
2. Pull query per table, filtered by garage and `updated_at > since`.
3. Paging for first sync.
4. Tests: a job pushed from phone A appears on phone B's pull; an admin approval appears as an update; a deleted customer appears in `deleted`.

## Files and folders touched
- `apps/api/src/sync/sync-pull.service.ts`, `apps/api/src/sync/sync.controller.ts`, `apps/api/src/sync/sync.module.ts`, `apps/api/test/sync-pull.test.ts`

## Done when
- [x] Two phones in one garage see each other's jobs after syncing (with their cars, customers, items and photos)
- [x] Review results from admin show up on the phone after the next pull
- [x] A pull never returns another garage's data
- [x] First sync of a garage with 5,000 jobs finishes in a few pages without timing out (11 pages, about 3 s locally)

## Open questions
- None
