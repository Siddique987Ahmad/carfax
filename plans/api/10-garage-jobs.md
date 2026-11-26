# api/10 — Garage jobs list and detail

Status: planned · Phase: pre-pilot · Depends on: api/08

## Goal
A garage can list and open its own jobs from the server, for screens and devices that don't hold the full history locally (for example a new phone, or the owner checking from a second device).

## Decisions
- **`GET /jobs?from=&to=`** (tech doc), plus status and car filters, with cursor paging.
- **`GET /jobs/:id`** returns items, photo signed URLs, flags in plain words ("mileage lower than a previous record") and review notes from ops.
- **The app mostly reads its local database**; these endpoints are the fallback and the source for the owner's history screens.
- **Mechanics see the job list but not totals.** Prices on single jobs stay visible because mechanics write the bill.

## Scope
**In:**
- `GET /jobs`, `GET /jobs/:id`
- `POST /jobs/:id/correction-request` (mechanic or owner asks ops to fix a submitted job; lands in the admin review queue)

**Out (later items):**
- Admin review (admin/10), editing jobs (only via sync while a draft)

## Steps
1. List query with filters and cursor paging.
2. Detail with signed photo URLs from `StorageService`.
3. Correction request: creates a `job_flags` row with code `CORRECTION_REQUESTED` and the note.
4. Tests for garage isolation and the mechanic view.

## Files and folders touched
- `apps/api/src/modules/jobs/*`

## Done when
- [ ] An owner can list last month's jobs and open one with its photos
- [ ] A correction request appears in the admin flagged queue
- [ ] Another garage's job ID returns 404

## Open questions
- None
