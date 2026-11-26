# admin/08 — Garage detail and approval

Status: planned · Phase: pre-pilot · Depends on: admin/07

## Goal
Ops can open a workshop, check that it's real, and approve or suspend it with a reason.

## Decisions
- **Approve and suspend need a reason,** stored in the audit log. Suspend also needs a reason the garage will see.
- **Suspending stops new jobs from syncing** but keeps old jobs. Whether old jobs stay in reports is a separate call per case (see admin/15).
- **Location check:** show the garage's map pin next to the GPS points of its recent odometer photos. If they're far apart, that's a warning sign.

## Scope
**In:**
- API: `GET /admin/garages/:id` (profile, owner, staff, stats, recent jobs) and `POST /admin/garages/:id/approve|suspend|reactivate` with a reason
- DB: `garages.status_reason`, `garages.status_changed_at`
- UI: profile card, map (Google Maps, as in the tech doc), staff list, a 30-day jobs-per-day chart, recent jobs, and action buttons
- Audit log entry for every status change

**Out (later items):**
- WhatsApp message to the owner about approval (workers/04). Until then the owner sees their status in the app.

## Steps
1. The status reason columns come from db/03.
2. Detail endpoint and status-change endpoints, run in a transaction together with the audit write.
3. Detail page sections, then action buttons using `ConfirmDialog` with a required reason.
4. Map with the garage pin and photo GPS points (needs the GPS columns from db/05).

## Files and folders touched
- `packages/db` (migration), `apps/api/src/modules/admin/garages/*`, `apps/admin/src/pages/garages/[id]/*`

## Done when
- [ ] Approving a pending garage lets its staff sync jobs; suspending blocks new syncs
- [ ] Every status change has an audit entry with the reason
- [ ] Support users see the page but no action buttons

## Open questions
- Should a suspended garage's existing jobs be hidden from reports automatically? Proposed: no, decide per case in admin/15.
