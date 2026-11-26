# admin/19 — Owner disputes

Status: planned · Phase: reports launch · Depends on: admin/12, web/17

## Goal
When a car owner reports a wrong entry, the team reviews it, fixes or rejects it, and tells the owner the outcome. The product doc promises this.

## Decisions
- **Open disputes stay in a queue, oldest first,** like flagged jobs.
- **While a dispute is open,** the disputed job is marked "under review" in reports (still shown, with a note), so a buyer isn't misled either way.
- **The fix uses the correction tools from admin/12,** linked to the dispute, so every change has a reason.
- **The owner is told the result** by WhatsApp or SMS.

## Scope
**In:**
- DB: `disputes` (car_id, job_id, user_id, message, status: open | fixed | rejected, resolution_note, resolved_by, resolved_at, created_at)
- API: `GET /admin/disputes`, `GET /admin/disputes/:id`, `POST /admin/disputes/:id/resolve`
- UI: queue, dispute detail beside the job and car record, and resolve actions (fix → opens the edit dialog; reject → reason)
- Notification to the owner when resolved

**Out (later items):**
- The owner-side form (web/17)

## Steps
1. The `disputes` table comes from db/12.
2. Endpoints; resolving writes an audit entry.
3. Report builder shows "under review" for jobs with open disputes.
4. Queue and detail pages.

## Files and folders touched
- `packages/db`, `apps/api/src/modules/admin/disputes/*`, `apps/admin/src/pages/disputes/*`

## Done when
- [ ] A dispute filed on the owner page appears in the queue
- [ ] Fixing it changes the record, links the change to the dispute and notifies the owner
- [ ] Reports mark disputed jobs while the dispute is open

## Open questions
- Target response time to promise owners (e.g. 7 days)?
