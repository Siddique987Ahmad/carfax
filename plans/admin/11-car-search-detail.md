# admin/11 — Car search and detail

Status: planned · Phase: pilot · Depends on: admin/06, db/04

## Goal
Anyone on the team can find a car by plate or chassis number and see its full record, which is the same data a paid report would use, plus what was left out and why.

## Decisions
- **Search uses the same normalisation as the API** (`LEA-1234`, `lea 1234` → `LEA1234`), from one shared function in `packages/shared`.
- **Show every job, including flagged and rejected ones,** clearly marked. A "what the report would show" toggle hides everything except approved jobs.
- **No customer names or phones on this screen.** Support doesn't need them to answer a car question, and it matches the privacy rules.

## Scope
**In:**
- API: `GET /admin/cars?q=` (plate or chassis, partial match) and `GET /admin/cars/:id` (car, all jobs with status and flags, mileage series, disputes count)
- UI: search page; car detail with a mileage chart, jobs timeline and the report-preview toggle

**Out (later items):**
- Editing (admin/12), merging (admin/13)

## Steps
1. Put `normaliseRegNo()` in shared code, with tests for common plate formats.
2. Search endpoint using `ILIKE` on the normalised plate and chassis (trigram index if it gets slow).
3. Detail endpoint and page.

## Files and folders touched
- `packages/shared/src/reg-no.ts`, `apps/api/src/modules/admin/cars/*`, `apps/admin/src/pages/cars/*`

## Done when
- [ ] Different spellings of the same plate find the same car
- [ ] The report-preview toggle matches what the report builder would include
- [ ] No customer personal data appears in the responses

## Open questions
- Is a Punjab plate unique without its registration year? This decides whether `normaliseRegNo` must include the year.
