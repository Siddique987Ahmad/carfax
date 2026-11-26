# admin/10 — Review a flagged job

Status: planned · Phase: pre-pilot · Depends on: admin/09, api/07

## Goal
Ops sees everything needed to judge one flagged job on a single screen, and approves or rejects it in a few taps, including on a phone.

## Decisions
- **Show the evidence together:** the odometer photo (zoomable), the typed reading, the reading from the photo, and the car's mileage timeline with this job highlighted.
- **Every decision needs a note.** `PATCH /admin/jobs/:id` writes the note to the audit log, as in the tech doc.
- **"Approve and next"** moves straight to the next job in the queue, so ops can work through it quickly.
- **Photos load through short-lived signed URLs.** The bucket stays private.

## Scope
**In:**
- API: `GET /admin/jobs/:id` (job, items, photos as signed URLs, flags, the car's other jobs) and `PATCH /admin/jobs/:id` (`approve` | `reject`, note, optional corrected odometer reading)
- Resolving a job marks all its flags with `resolved_by` and `resolved_at`
- UI: photo viewer, readings side by side, mileage chart, work items, garage link, decision bar fixed to the bottom on phones

**Out (later items):**
- Garage-level action after several bad jobs (admin/15)

## Steps
1. Detail endpoint, with signed URLs from the upload service.
2. Decision endpoint: update the job status, resolve its flags and write the audit entry in one transaction.
3. Build the review page: photo viewer, comparison, mileage chart.
4. Decision bar with a required note, and "Approve and next."

## Files and folders touched
- `apps/api/src/modules/admin/jobs/*`, `apps/admin/src/pages/jobs/[id]/*`

## Done when
- [ ] Approving moves the job to `approved` and clears its flags; rejecting keeps it out of reports
- [ ] Each decision appears in the audit log with the note
- [ ] A full review takes under 30 seconds on a phone in a test with real pilot photos

## Open questions
- If ops corrects a misread odometer value, should the garage be told? Proposed: yes, as a note visible in the app later.
