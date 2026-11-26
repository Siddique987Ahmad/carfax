# web/11 — Analytics and error tracking

Status: planned · Phase: pilot · Depends on: web/01, web/04

## Goal
We can see how buyers move from search to report and where they drop off, and we hear about errors before users complain.

## Decisions
- **PostHog for analytics and Sentry for errors**, as in the tech doc.
- **Track a short list of events, matching the product doc's questions:**
  - `search` (hit or miss)
  - `preview_view`, `login_start`, `login_done`
  - `report_open`, `pdf_download`, `survey_answer`
  - From web/13 on: `checkout_start`, `payment_success`, `payment_fail`
- **No plates or phone numbers in analytics.** Events carry a hashed car ID at most, matching the product doc's privacy stance.
- **Server-side events for anything about money,** so ad blockers don't hide sales.
- **Consent notice if the lawyer says it's needed** (web/04).

## Scope
**In:**
- PostHog client and server set up, with the event list in one typed file
- Sentry for client and server errors, with source maps uploaded on deploy
- A funnel in PostHog: search → preview → login → report

**Out (later items):**
- Admin dashboard metrics (admin/16 reads from our own database, not PostHog)

## Steps
1. Add the typed event list and a small `track()` helper.
2. Wire the events into the existing pages.
3. Add Sentry with source maps.
4. Build the funnel in PostHog.

## Files and folders touched
- `apps/web/src/lib/analytics.ts`, `apps/web/sentry.*.config.ts`

## Done when
- [ ] Each event in the list fires once per action on staging
- [ ] No event contains a plate, chassis number or phone number
- [ ] A test error shows in Sentry with the right source line

## Open questions
- Use PostHog's EU cloud or self-host? Depends on the lawyer's view of data leaving Pakistan.
