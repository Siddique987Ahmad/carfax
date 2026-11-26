# garage-app/08 — Home screen

Status: planned · Phase: pre-pilot · Depends on: garage-app/03, garage-app/06

## Goal
One screen that shows the day at a glance and starts a new job in one tap.

## Decisions
- **One big "New job" button** at the bottom, the most common action.
- **Show three things:** today's jobs (with total for owners), how many jobs and photos are waiting to sync, and how many reminders are due.
- **Everything comes from the local database,** so the screen opens instantly with or without internet.
- **Mechanics don't see money totals** (see 14).

## Scope
**In:**
- Today's job list (plate, car, work types, synced or not); tap opens the job
- Sync status card with "Sync now"
- Reminders due count, linking to the reminders screen (20)
- Garage approval banner if the garage is still pending
- Pull to refresh (runs a sync)

**Out (later items):**
- Customers (19) and reminders (20) screens themselves

## Steps
1. Build the layout with the UI kit.
2. Connect it to local queries (reactive, so it updates when a job is saved or synced).
3. Add the sync card and the banners.

## Files and folders touched
- `apps/garage-app/app/(app)/index.tsx`, `apps/garage-app/src/features/home/*`

## Done when
- [ ] The home screen opens in under a second on a low-end phone, offline
- [ ] A newly saved job appears immediately, and its sync mark updates after syncing
- [ ] A mechanic sees no rupee totals

## Open questions
- None
