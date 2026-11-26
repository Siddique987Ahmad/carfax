# admin/07 — Garages list

Status: planned · Phase: pre-pilot · Depends on: admin/02, admin/06, api/05

## Goal
The ops team can see every workshop, find new sign-ups waiting for approval, and spot garages that stopped logging.

## Decisions
- **New sign-ups come first:** the list opens filtered to `pending`.
- **Show activity next to each garage** (jobs in the last 7 days, last job date), because "stopped logging" is the biggest risk in the product doc.

## Scope
**In:**
- API: `GET /admin/garages?status=&city=&q=&page=` returning name, owner phone, city, status, jobs in the last 7 days, last job date and trust score
- UI: list with status tabs (Pending, Active, Suspended, All), city filter, and search by name or phone
- Sort by newest, most jobs or least recent activity

**Out (later items):**
- Garage detail and actions (admin/08)

## Steps
1. Write the list query with activity counts (one SQL query with a grouped subquery on `jobs`, not one query per garage).
2. Add the endpoint with pagination and filters, and its Zod schema.
3. Build the page with `DataList`, `FilterBar` and URL state.

## Files and folders touched
- `apps/api/src/modules/admin/garages/*`, `apps/admin/src/pages/garages/*`

## Done when
- [ ] Pending garages appear by default, newest first
- [ ] Filters and search work and stay in the URL
- [ ] With 500 seeded garages the list loads in under a second

## Open questions
- None
