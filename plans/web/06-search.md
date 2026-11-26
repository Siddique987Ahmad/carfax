# web/06 — Search box and number normalisation

Status: planned · Phase: pilot · Depends on: web/03

## Goal
A buyer can type a plate or chassis number however it's written, and the search finds the right car.

## Decisions
- **A plate search finds the car that has the plate now (db/04b),** because plates can move between cars. The report covers that car's whole history, including jobs under its earlier plates.
- **One search box for both kinds of number.** The site guesses the type (chassis numbers are long and contain a dash or many digits), with a small switch to correct it.
- **Use the shared normalisation functions** from `packages/shared` (`normaliseRegNo` from admin/11, plus `normaliseChassisNo`), so the site, the garage app and the admin panel all match numbers the same way.
- **Searching needs no login.** Login is asked for only when the buyer opens a report (web/08).
- **Search goes to a result URL** (`/check/LEA1234`) so it can be shared, but those pages are marked `noindex`, so search engines don't list every plate.

## Scope
**In:**
- Search box component (landing page and header), with format hints ("e.g. LEA-1234 or NZE161-0123456")
- Client-side check for obviously wrong input, then a redirect to `/check/[number]`
- `normaliseChassisNo` added to `packages/shared`, with tests
- Every search is logged by the API with hit or miss, for the "searches that find a history" metric (admin/16)

**Out (later items):**
- What the result page shows (web/07)

## Steps
1. Add `normaliseChassisNo` and tests for common formats.
2. Build the search box with type detection and the switch.
3. Add the `/check/[number]` route (placeholder until web/07).

## Files and folders touched
- `packages/shared/src/reg-no.ts`, `apps/web/src/components/SearchBox.tsx`, `apps/web/src/app/[locale]/check/[number]/*`

## Done when
- [ ] `LEA-1234`, `lea 1234` and `LEA1234` all go to the same result page
- [ ] A chassis number is detected as a chassis number
- [ ] Result pages carry `noindex`

## Open questions
- Is a Punjab plate unique without its registration year? If not, the search needs a year field (same question as admin/11).
