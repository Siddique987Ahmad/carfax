# garage-app/18 — Under 30 seconds per job

Status: planned · Phase: pilot · Depends on: garage-app/15, garage-app/17

## Goal
Logging a typical job takes under 30 seconds, the product doc's target for keeping garages logging. We measure it with real mechanics and fix whatever is slow.

## Decisions
- **Measure from "New job" tapped to job saved,** using the `job_started` and `job_saved` events (15). Track the median and the slowest 10% per garage, per week.
- **Watch, don't just count.** In the first two pilot weeks, sit with mechanics and time 10 jobs each by hand, noting where they hesitate.
- **Fix the slowest step first,** whichever it turns out to be (likely plate typing, odometer confirm or work items).
- **Report the result in the pilot review,** since it's an input to the product doc's Gate 2.

## Scope
**In:**
- PostHog dashboard: median and slow-tail time per job, per garage, per week
- Breakdown by step (plate, car, odometer, job card, bill)
- Hand-timed observation notes from pilot visits
- Up to three speed fixes, each a small change shipped by over-the-air update

**Out (later items):**
- Larger redesigns (become their own plan items)

## Steps
1. Add step timestamps to the existing events.
2. Build the PostHog dashboard.
3. Observe and time jobs in pilot week 1.
4. Pick and ship the top three fixes.
5. Measure again in pilot week 2.

## Files and folders touched
- `apps/garage-app/src/telemetry/*`, the screens being fixed

## Done when
- [ ] Median time per job is under 30 seconds across pilot garages
- [ ] The step breakdown shows where time goes
- [ ] The findings are written up for the pilot review

## Open questions
- None
