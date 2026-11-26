# workers/06 — Report builder

Status: planned · Phase: pilot (free reports) · Depends on: workers/02, db/04

## Goal
After payment, the worker builds a car's history report from trustworthy records only and saves it as a fixed snapshot, so the report a buyer paid for never changes underneath them.

## Decisions
- **What goes in:** approved jobs only, excluding jobs marked `excluded_from_reports` (admin/15). Jobs with an open dispute are included but marked "under review" (admin/19).
- **What never goes in** (product doc privacy rules):
  - customer names or phones
  - photos
  - the full chassis number (last 4 characters only)
  - the garage name, unless the garage chose to show it
- **Snapshot as JSON** on the order (`report_orders.snapshot`), with the date it was built. The web page and the PDF are both made from this snapshot.
- **Built from `cars`, `jobs` and `job_items` only,** as in the tech doc, so personal data can't leak in by accident.
- **Includes:**
  - the mileage timeline, with rollback warnings
  - the service and repair list (date, work type, city)
  - body-work flags (denting, painting, panel replacement)
  - the product doc's statement that the report shows only what partner workshops recorded
- **Free preview** (web/07) uses the same builder in a "count only" mode.

## Scope
**In:**
- Builder function and its tests, including a privacy test that fails if any customer field appears
- Job triggered by confirmed payment (api/18) or a free report order
- Snapshot saved to the order; then the PDF job is queued (workers/07)

**Out (later items):**
- PDF rendering and delivery (workers/07), report web page (web/09)

## Steps
1. Define the snapshot type in `packages/shared`.
2. Write the builder and tests with sample cars (clean, rollback, accident, disputed).
3. Write the privacy test.
4. Add the job and connect it to payment confirmation.

## Files and folders touched
- `workers/src/reports/build.ts`, `packages/shared/src/report-snapshot.ts`, `packages/db` (`snapshot` column)

## Done when
- [ ] A paid order gets its snapshot within a minute
- [ ] Rejected, flagged and excluded jobs never appear; disputed ones are marked
- [ ] The privacy test passes and fails if a customer field is added
- [ ] Later edits to the car don't change an existing snapshot

## Open questions
- Should a buyer get a free refresh if new records are added within, say, 30 days? Proposed: decide after launch.
