# web/17 — Owner reports a wrong entry

Status: planned · Phase: reports launch · Depends on: web/16

## Goal
An owner who sees something wrong in their car's record can report it in a minute and follow what happens, as the product doc promises. Our team handles it in admin/19.

## Decisions
- **Only an approved owner (web/16) can file a dispute,** and only about their own car.
- **Pick the job, then a reason:**
  - Not my car
  - Wrong mileage
  - Work not done
  - Wrong date
  - Other
  
  Then a short message and an optional photo (e.g. a service receipt).
- **The disputed job shows "under review" in reports** while the dispute is open (handled in web/09 and admin/19).
- **The owner sees the status** (open, fixed, rejected) and the team's note, and is also told by WhatsApp or SMS.
- **Limit: 5 open disputes per owner,** to prevent spam.

## Scope
**In:**
- "Report a wrong entry" button on each job in the owner's car page
- Dispute form and confirmation
- "My disputes" list with statuses and resolution notes
- Uses the API's disputes endpoint (`POST /disputes`, as in the tech doc)

**Out (later items):**
- Review and resolution (admin/19)

## Steps
1. Agree the dispute fields with admin/19's `disputes` table.
2. Build the form with the shared Zod schema.
3. Build the "My disputes" list.
4. Test the round trip: file here → resolve in admin → status changes here.

## Files and folders touched
- `apps/web/src/app/[locale]/my-car/disputes/*`, `packages/shared` (dispute schema)

## Done when
- [ ] A filed dispute appears in the admin disputes queue
- [ ] Resolving it in admin updates the status and note on the owner's page
- [ ] Non-owners can't file disputes, even by calling the API directly

## Open questions
- Should the garage that logged the job be told and allowed to respond? Fairer, but slower; decide with admin/19.
