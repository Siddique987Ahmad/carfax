# garage-app/15 — Crash reporting and usage analytics

Status: planned · Phase: pre-pilot · Depends on: garage-app/01

## Goal
We see crashes and where mechanics get stuck before garage owners complain, without collecting anyone's personal data.

## Decisions
- **Sentry for crashes and errors** (free tier), as in the tech doc, with source maps uploaded by EAS Build so stack traces are readable.
- **PostHog for usage events,** as in the tech doc.
- **No personal data in either:** no customer names, phone numbers or plate numbers. Use garage ID and user ID only.
- **A short, fixed list of events** that answer pilot questions:

| Event | Why |
|---|---|
| `job_started`, `job_saved` (with seconds taken) | Speed target (18) |
| `plate_scan_result` (read correctly yes/no) | Scan accuracy (09) |
| `odometer_suggestion_result` (correct yes/no) | OCR accuracy (11) |
| `bill_sent` | Is the bill feature used |
| `reminder_sent` | Reminder use (20) |
| `sync_failed` (error type) | Sync health (06) |

- **Events queue offline** and send later.

## Scope
**In:**
- Sentry setup with the Expo plugin and EAS source maps
- PostHog setup, the event list above, and a typed `track()` helper
- A scrubber that removes phone and plate patterns from error messages

**Out (later items):**
- Dashboards in PostHog (set up during the pilot)

## Steps
1. Add Sentry with the Expo plugin; test with a forced crash.
2. Add PostHog and the typed `track()` helper.
3. Add the scrubber, with tests.
4. Add the events as each screen is built (the list lives in one file).

## Files and folders touched
- `apps/garage-app/src/telemetry/*`, `apps/garage-app/app.config.ts`

## Done when
- [ ] A test crash shows in Sentry with a readable stack trace
- [ ] Events recorded offline arrive after reconnecting
- [ ] A search of Sentry and PostHog finds no phone numbers or plates

## Open questions
- None
