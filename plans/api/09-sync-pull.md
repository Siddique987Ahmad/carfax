# api/09 — Sync pull (server changes to phone)

Status: planned · Phase: pre-pilot · Depends on: api/08

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
- `apps/api/src/modules/sync/*`, `packages/db` (triggers and soft-delete columns)

## Done when
- [ ] Two phones in one garage see each other's jobs after syncing
- [ ] Review results from admin show up on the phone after the next pull
- [ ] A pull never returns another garage's data
- [ ] First sync of a garage with 5,000 jobs finishes in a few pages without timing out

## Open questions
- None
