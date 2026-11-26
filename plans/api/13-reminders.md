# api/13 — Service reminders

Status: done (Nov 27, 2026) · Phase: pre-pilot · Depends on: api/08, api/11

## Goal
The garage sees which customers are due for their next service and sends reminders that bring them back, which is the feature that wins garage owners (product doc).

## Decisions
- **From api/08:** create reminder rows inside the sync push transaction (`SyncService.push`), from jobs with `next_service_due_date`, and cancel or mark `returned` the garage's open reminders for that car there too.
- **Reminders are created automatically from jobs** during sync push, using simple rules in `packages/shared`, e.g. oil change → due in 3 months or +5,000 km, whichever comes first.
- **Pilot: one tap only** (decided Nov 26, 2026). The owner sees due reminders and taps "send," which opens WhatsApp with a `wa.me` link. **Auto-send** (the worker sends on the due date) is switched on per garage once the WhatsApp Cloud API is approved.
- **`POST /reminders/:id/send` returns the `wa.me` link** and marks the reminder sent, the same way as bills (api/12). With auto-send on later, the worker sends instead (workers/05).
- **Track the result:** when the same car comes back to the same garage within 30 days of a reminder, the reminder is marked `returned`. This feeds the product doc metric "customers who return after a reminder" (admin/16).
- **A new job for the same work cancels the open reminder.**
- **Built with these decisions:**
  - **Created at sync push, not at approval** (workers/05 said approval): a flagged job can wait days for review, and its reminder is customer service, not a fraud question. Created, returned and cancelled in the push's own transaction, only for jobs new in that push (a resend adds nothing).
  - **The due date:** the job card's `next_service_due_date` if set, otherwise `REMINDER_RULES` in `@carfax/shared` (oil change 90 days, tuning 180; other work gets no automatic reminder). The kind is the work with a rule (oil change first), or the first work type. Converting a "next service at X km" into a date stays on the phone (garage-app/20). A job without a customer gets no reminder.
  - **"Came back":** a **sent** reminder for that car at that garage is marked `returned` by any visit between the day it was sent and 30 days after it was due (`REMINDER_RETURN_WINDOW_DAYS`). A reminder **not sent yet** for the same kind of work is **cancelled** by the new visit. The status stays `sent` for returned reminders; `returned_job_id` says it worked.
  - **Endpoints** (`reminders.send`, owners and mechanics): `GET /v1/reminders/due?within=7` (not sent yet, due within N days, overdue included, with customer, car, plate and last visit), `POST /v1/reminders/:id/send` with `{ language }` (a wa.me link with the reminder typed in, from `@carfax/i18n` `reminder.*`; marks it sent; `NO_CUSTOMER_PHONE` without a number; 409 if not scheduled), `PATCH /v1/reminders/:id` `{ action: 'snooze', days }` (from today if already due) or `{ action: 'cancel' }`.
  - **No auto-send setting yet:** it needs the WhatsApp Cloud API (workers/04, workers/05), like api/12's send method.
- **Found while building:** `date + $1` with an untyped parameter fails in Postgres (date plus days, or plus an interval?); every day count is now cast to `int`.

## Scope
**In:**
- `GET /reminders/due` (tech doc), `POST /reminders/:id/send`, `PATCH /reminders/:id` (snooze, cancel)
- ~~`PATCH /garage/me/settings` for auto-send on/off and default intervals~~ moved to workers/05 with auto-send
- Reminder rules and the `returned` marking during sync push

**Out (later items):**
- Sending (workers), reminder screens (garage-app)

## Steps
1. Rule table in shared code with tests.
2. Create/cancel reminders inside the sync push transaction.
3. Endpoints for due list, send, snooze, cancel; settings.
4. Mark `returned` when a matching job arrives.

## Files and folders touched
- `apps/api/src/reminders/*`, `apps/api/src/sync/sync.service.ts` (hook), `apps/api/src/sync/sync.module.ts`, `apps/api/test/reminders.test.ts`
- `packages/shared/src/reminders.ts`, `packages/i18n/src/locales/{en,ur}/reminder.json`

## Done when
- [x] An oil change creates a reminder with the right due date
- [x] A new oil change cancels the old reminder and marks it `returned` if one was sent (a sent reminder is returned by any visit in its window)
- [x] Manual send gives one wa.me message and marks it sent (twice is refused); ~~auto-send~~ waits for the Cloud API (workers/05)

## Open questions
- Default intervals per work type: confirm with garage owners in the interviews.
