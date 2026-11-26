# api/13 — Service reminders

Status: planned · Phase: pre-pilot · Depends on: api/08, api/11

## Goal
The garage sees which customers are due for their next service and sends reminders that bring them back, which is the feature that wins garage owners (product doc).

## Decisions
- **Reminders are created automatically from jobs** during sync push, using simple rules in `packages/shared`, e.g. oil change → due in 3 months or +5,000 km, whichever comes first.
- **Pilot: one tap only** (decided Nov 26, 2026). The owner sees due reminders and taps "send," which opens WhatsApp with a `wa.me` link. **Auto-send** (the worker sends on the due date) is switched on per garage once the WhatsApp Cloud API is approved.
- **`POST /reminders/:id/send` returns the `wa.me` link** and marks the reminder sent, the same way as bills (api/12). With auto-send on later, the worker sends instead (workers/05).
- **Track the result:** when the same car comes back to the same garage within 30 days of a reminder, the reminder is marked `returned`. This feeds the product doc metric "customers who return after a reminder" (admin/16).
- **A new job for the same work cancels the open reminder.**

## Scope
**In:**
- `GET /reminders/due` (tech doc), `POST /reminders/:id/send`, `PATCH /reminders/:id` (snooze, cancel)
- `PATCH /garage/me/settings` for auto-send on/off and default intervals
- Reminder rules and the `returned` marking during sync push

**Out (later items):**
- Sending (workers), reminder screens (garage-app)

## Steps
1. Rule table in shared code with tests.
2. Create/cancel reminders inside the sync push transaction.
3. Endpoints for due list, send, snooze, cancel; settings.
4. Mark `returned` when a matching job arrives.

## Files and folders touched
- `apps/api/src/modules/reminders/*`, `packages/shared/src/reminder-rules.ts`

## Done when
- [ ] An oil change creates a reminder with the right due date
- [ ] A new oil change cancels the old reminder and marks it `returned` if one was sent
- [ ] Manual send queues one message; auto-send garages get theirs without tapping

## Open questions
- Default intervals per work type: confirm with garage owners in the interviews.
