# garage-app/14 — Garage settings, staff and roles

Status: planned · Phase: pre-pilot · Depends on: garage-app/04, api: garage profile and staff

## Goal
The owner sets up the garage profile and adds mechanics, and each mechanic sees only what they need.

## Decisions
- **Conflict with api/08:** the table above lets the owner edit jobs after 24 hours, but sync push treats submitted jobs as final (`JOB_LOCKED`), so nobody edits them from the app. Corrections go through ops (admin/12) until a "request correction" flow exists (api/08 open question). The `jobs.edit_late` permission is unused for now.
- **From api/04:** use `GARAGE_PERMISSIONS` and `canInGarage()` from `@carfax/shared` to hide what a mechanic can't do. Send `X-Garage-Id` when the user belongs to several garages (the API answers `GARAGE_REQUIRED` with the list). Show `GARAGE_PENDING` and `GARAGE_SUSPENDED` as clear messages, not errors.
- **Two roles in the app:**

| Can do | Owner | Mechanic |
|---|---|---|
| Log jobs, send bills | ✓ | ✓ |
| See customers (needed to send bills) | ✓ | ✓ |
| See rupee totals and earnings | ✓ | — |
| Edit jobs after 24 hours | ✓ | — |
| Add/remove staff, edit garage profile | ✓ | — |

- **Permissions come from the shared permission map** in `packages/shared` (same idea as admin/06), and the API checks them too.
- **Owner adds a mechanic by phone number.** The mechanic installs the app and logs in with OTP.
- **Garage location is set from the phone's GPS** while standing in the shop, which admin uses to check the garage is real.
- **Reminder defaults** (e.g. oil change every 3,000 km or 3 months) are set here and used by the job card.

## Scope
**In:**
- Settings: garage name, address, location pin, phone on bills, language, reminder defaults
- Staff list, add mechanic, remove mechanic
- Role checks throughout the app (`can()` hook)
- Sync log link (from 06) and app version

**Out (later items):**
- None

## Steps
1. Settings screens, saving through the API (they need internet; show a clear message offline).
2. Staff list and add/remove.
3. Add the garage roles to the shared permission map and the `can()` hook.
4. Hide totals and owner-only actions for mechanics.

## Files and folders touched
- `packages/shared/src/permissions.ts`, `apps/garage-app/app/(app)/settings/*`

## Done when
- [ ] The owner can add a mechanic who can then log in and log jobs
- [ ] A mechanic never sees rupee totals or staff settings, and the API refuses if they try
- [ ] A removed mechanic is signed out after their next sync attempt, and their unsynced jobs are kept

## Open questions
- Many workshops share one phone. Support a quick "who's logging this job" picker on a shared phone, or require each mechanic to have their own login? Ask in the interviews.
