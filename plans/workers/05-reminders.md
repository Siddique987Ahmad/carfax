# workers/05 — Service reminders and return tracking

Status: planned · Phase: pilot · Depends on: workers/04

## Goal
Customers get a WhatsApp reminder when their next service is due, and we measure whether they came back, since that's the main reason garages keep using the app.

## Decisions
- **From api/13:** reminders are already created, cancelled and marked `returned` in the sync push (not at approval, as written below); this item adds **auto-send** (the per-garage setting, quiet hours 10:00–19:00, STOP opt-out) on top, through workers/04's Cloud API. Reuse `reminder.*` texts from `@carfax/i18n` and `REMINDER_RETURN_WINDOW_DAYS`.
- **A reminder is scheduled when a job is approved,** based on its work type: oil change after 90 days by default, other types per a table in shared code. The garage can change the date or turn it off on the job card.
- **Two modes, chosen per garage** (the tech doc's "send now or auto-send"):
  - **manual (one tap), the only mode in the pilot** (decided Nov 26, 2026): shown in the garage app's reminder list; the owner taps to send through `wa.me`
  - **auto:** sent by the platform, switched on once the WhatsApp Cloud API is approved
- **Send only between 10:00 and 19:00 Pakistan time.**
- **Customers can opt out** by replying STOP; opted-out numbers get nothing more.
- **"Came back" means** the same car has a job at the same garage within 30 days after the reminder. This feeds the product metric on the dashboard (admin/16).

## Scope
**In:**
- Reminder creation on approval, with due date
- Daily scheduled job that sends auto reminders due that day through workers/04. Built in the pilot, but no garage uses it until Meta approval
- Opt-out handling from the WhatsApp webhook
- Return check that marks each reminder `returned` or `not_returned`
- `GET /reminders/due` data for manual mode (api)

**Out (later items):**
- The garage app's reminder screen (garage-app/20)

## Steps
1. Add the due-date table per work type.
2. Create reminders when jobs are approved.
3. Write the daily send job with the time window.
4. Add opt-out handling.
5. Write the return check (runs daily).

## Files and folders touched
- `workers/src/reminders/*`, `packages/shared/src/constants/service-intervals.ts`, `packages/db` (reminders table, opt-outs)

## Done when
- [ ] An approved oil change creates a reminder 90 days later
- [ ] Auto reminders go out only in the daytime window, once each
- [ ] A customer who replies STOP gets no more reminders
- [ ] Return rate per garage can be read from the database

## Open questions
- Default mode for pilot garages, auto or manual? Auto costs a template message each; manual depends on the owner remembering.
