# api/05 — Garage profile and staff

Status: planned · Phase: pre-pilot · Depends on: api/04

## Goal
A workshop owner can create their garage in the app, edit its profile and add mechanics, and the garage waits for approval before its jobs count.

## Decisions
- **From api/04:** use `@GaragePermission('garage.view' | 'garage.edit' | 'staff.manage')` and `@CurrentGarage()`; run queries in `withGarage`. Pending garages may already edit their profile and staff.
- **The owner creates the garage on first sign-in to the app** (`POST /garage`). It starts as `pending` until ops approves it (admin/08).
- **Pending garages can already log jobs** so the owner can try the app, but their jobs stay out of reports until approval.
- **Mechanics are added by phone number.** If the phone has no account yet, one is created and the mechanic signs in with OTP.
- **Mechanic limits (tech doc):** can create jobs and see the garage's job list, but can't see earnings, change the profile or manage staff.
- **Staff limit of 10 per garage** for now, to stop abuse; easy to raise.

## Scope
**In:**
- `POST /garage`, `GET /garage/me` (profile + status + the caller's role), `PATCH /garage/me`
- `GET /garage/members`, `POST /garage/members` (tech doc), `DELETE /garage/members/:userId`
- `GET /garage/stats` (owner only: jobs this week/month, earnings, reminders sent)
- Location: lat/lng from the owner's phone when creating the garage

**Out (later items):**
- Approval and suspension (admin/08), garage sign-up page on the website (web)

## Steps
1. Garage create/read/update with Zod schemas (name, city from a fixed list, address, lat/lng).
2. Member add/remove; the owner can't remove themselves.
3. Stats query (owner only).
4. Tests: mechanic can't see stats or add staff; a removed mechanic loses access on next token refresh.

## Files and folders touched
- `apps/api/src/modules/garages/*`, `packages/shared/src/cities.ts`

## Done when
- [ ] An owner can create a garage, add a mechanic, and the mechanic can sign in and see the garage
- [ ] Mechanics get 403 on stats, profile edit and staff routes
- [ ] New garages are `pending`, and their jobs are not used in reports

## Open questions
- Can one person belong to two garages (e.g. a mechanic working at two shops)? Proposed: yes in the data model, but the app picks one active garage.
