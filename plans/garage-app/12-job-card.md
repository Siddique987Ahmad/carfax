# garage-app/12 — Job card

Status: planned · Phase: pre-pilot · Depends on: garage-app/11

## Goal
The mechanic records what work was done, the parts and the labour cost, quickly enough that logging every job feels worth it.

## Decisions
- **Work types from a fixed list** in `packages/shared`, as in the product doc: oil change, tuning, brakes, denting/painting, engine, suspension, AC, electrical, plus "Other". Tuning is added because it's a common job in Pakistan. Fixed codes keep reports consistent; the labels are translated.
- **Each work type is one tap.** Parts and prices are optional details under it.
- **Quick fill for the most common job:** "Oil change" adds the usual lines (oil, filter, labour) with the garage's last-used prices.
- **Before/after photos are optional,** but the app suggests them for denting/painting, because they back up the accident and body-work flags in reports.
- **Next service due:** for an oil change, ask for the next due km or date (default from garage settings). This feeds reminders.

## Scope
**In:**
- Work type chips, part name, part price, labour price, notes
- Quick-fill templates for common jobs, using last-used prices
- Before/after photo buttons (same camera and queue as 11, no GPS requirement)
- Next service due fields
- Running total in rupees
- Save the job to the local database (status `submitted`), then trigger sync

**Out (later items):**
- The bill and sending it (13)

## Steps
1. Work type list in shared code, with translation keys.
2. Job card form with chips and item lines.
3. Quick-fill templates.
4. Before/after photos.
5. Next service due fields.
6. Save in one write; trigger sync.

## Files and folders touched
- `packages/shared/src/work-types.ts`, `apps/garage-app/app/(app)/job/new/card.tsx`, `apps/garage-app/src/features/job-card/*`

## Done when
- [ ] An oil change job card is filled in under 10 seconds using quick fill
- [ ] A job with several work types saves offline and syncs with all its items
- [ ] Denting/painting jobs prompt for before/after photos

## Open questions
- Should a mechanic be able to edit a job after saving, and for how long? Proposed: until it syncs, or for 24 hours; after that only the owner can, and the edit is recorded.
