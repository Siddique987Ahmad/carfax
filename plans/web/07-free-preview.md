# web/07 — Free preview

Status: planned · Phase: pilot · Depends on: web/06, web/04

## Goal
After a search, the buyer sees enough to decide whether the full report is worth opening, without the preview giving away the report or helping anyone copy the database.

## Decisions
- **What the preview shows:** make, model and year, whether records exist, and a range for how many (1–2, 3–5, 6+), not the exact count. This responds to the scraping concern in the tech-doc review.
- **No dates, cities, mileage or work types.** Those are the report.
- **"No records" is said plainly,** with the coverage disclaimer (web/04) and the list of covered cities, so the buyer knows it's not a clean bill of health.
- **Rate limits by IP and device,** with a Cloudflare Turnstile check after a few searches, so a script can't check thousands of plates.
- **Unknown numbers create nothing.** Searching a plate we've never seen doesn't add a car to the database.

## Scope
**In:**
- `/check/[number]` page: preview card, button to open the full report, disclaimer
- Calls the API's public search endpoint (`GET /public/search`, as in the tech doc), changed to return a count range
- Turnstile challenge when the API says the limit is reached
- "No records" state with covered cities and the garage sign-up link ("Ask your mechanic to join")

**Out (later items):**
- Opening the full report (web/08, web/09)

## Steps
1. Agree the response shape with the API (count range instead of exact count).
2. Build the preview card and the no-records state.
3. Add the Turnstile flow.
4. Load-test the rate limit with a simple script.

## Files and folders touched
- `apps/web/src/app/[locale]/check/[number]/*`, `apps/web/src/components/PreviewCard.tsx`

## Done when
- [ ] The preview never shows an exact record count, a date or a city
- [ ] A script making 100 searches a minute gets blocked
- [ ] Unknown plates don't create car rows

## Open questions
- Should "no records" offer a "tell me when records appear" option? It would collect phone numbers, so it needs a privacy decision.
