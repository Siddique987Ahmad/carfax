# admin/20 — Audit log viewer

Status: planned · Phase: reports launch · Depends on: admin/06

## Goal
A super admin can see who changed what and when, with the value before and after. This matters for disputes, fraud checks and any legal question about the data.

## Decisions
- **Super admin only,** as in the tech doc (`GET /admin/audit`).
- **Read-only.** There is no edit or delete, in the UI or the API. The database user the API runs as can't update or delete `audit_logs` rows.
- **Show before/after as a field-by-field difference,** not raw JSON.

## Scope
**In:**
- API: `GET /admin/audit?actor=&entity=&entity_id=&action=&from=&to=&page=`
- DB: revoke UPDATE and DELETE on `audit_logs` from the API's database role
- UI: filterable list; detail with the changed fields highlighted; links to the changed garage, car, job or order
- "History" links from the garage, car and job pages open the log filtered to that record

**Out (later items):**
- Exporting the log (add if a legal request needs it)

## Steps
1. Endpoint with filters and an index on (entity, entity_id, created_at).
2. The database permission change comes from db/06.
3. List and diff view.
4. History links from the other detail pages.

## Files and folders touched
- `packages/db` (migration/grants), `apps/api/src/modules/admin/audit/*`, `apps/admin/src/pages/audit/*`

## Done when
- [ ] Every action from admin/05–19 appears with the right person and before/after values
- [ ] An attempt to update or delete an audit row in SQL as the API role fails
- [ ] Non-super-admins get 403

## Open questions
- How long to keep the log? Proposed: forever, since it's small.
