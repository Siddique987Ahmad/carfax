# garage-app/06 — Sync engine

Status: planned · Phase: pre-pilot · Depends on: garage-app/04, garage-app/05, api: sync push and pull

## Goal
Jobs saved on the phone reach the server reliably whenever there is internet, and changes made elsewhere (by the owner on another phone, or by the team) come back down, with no lost or duplicated jobs.

## Decisions
- **From api/08:** push with `POST /v1/sync/push` in WatermelonDB's format (snake_case, times in ms; schemas in `@carfax/shared`), at most 50 jobs per push. After a push: apply `remaps.cars` and `remaps.customers` to every local record; stop resending anything in `rejected` and show it to the user (`JOB_LOCKED`: "ask the garage owner or support to correct it"); after a photo uploads, mark its row changed so it's resent and confirmed. Submitted jobs are read-only in the app.
- **WatermelonDB's built-in `synchronize()`** with `pullChanges` → `GET /sync/pull?since=` and `pushChanges` → `POST /sync/push`. The API should use WatermelonDB's change format (`{ table: { created, updated, deleted } }` plus a server timestamp), which saves writing a custom protocol. Flag this to the api/ plan.
- **Job data and photos sync separately.** Job rows are small and go first; photo files go through their own queue (07). The server must treat a job whose photo hasn't arrived yet as "photo pending", not "no photo", for 48 hours. Flag this to the workers/ flag-check plan.
- **When to sync:** right after a job is saved, when the app opens, when the internet comes back (NetInfo), and every 15 minutes in the background (`expo-background-task`) where Android allows.
- **Retries with growing waits** (30 s, 1 min, 5 min … up to 1 hour). Pushing the same job twice is safe because the server uses the phone's UUID.
- **The server wins on conflicts** for fields the team edits (e.g. a corrected odometer reading); the phone wins for drafts that never reached the server.

## Scope
**In:**
- Sync service wrapping `synchronize()`, with a lock so only one sync runs at a time
- Triggers: after save, app open, reconnect, background task
- Pending count (jobs not yet on the server) exposed to the UI
- Sync log screen in settings for support (last success, last error)
- Handling of a suspended garage: stop pushing, keep data, show a message

**Out (later items):**
- Photo uploads (07), duplicate car IDs (10)

## Steps
1. Write `pullChanges` and `pushChanges` against the API.
2. Add the sync lock and retry schedule.
3. Add the triggers, including the background task.
4. Expose the pending count and last-sync time.
5. Add the sync log screen.
6. Test: airplane mode for a day, 50 jobs, then reconnect.

## Files and folders touched
- `apps/garage-app/src/sync/*`, `apps/garage-app/app/(app)/settings/sync.tsx`

## Done when
- [ ] 50 jobs created offline all reach the server once, with no duplicates, after reconnecting
- [ ] Killing the app mid-sync loses nothing; the next sync finishes the job
- [ ] A change made by the team on the server appears on the phone after the next pull
- [ ] The pending count is correct at all times

## Open questions
- Android background limits vary by phone maker (Xiaomi, Oppo, Vivo kill background tasks). Check on pilot phones, and show a "keep the app open to sync" hint if needed.
