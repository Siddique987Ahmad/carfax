# garage-app/20 — Service reminders

Status: planned · Phase: pilot · Depends on: garage-app/12, garage-app/19

## Goal
The garage sees which customers are due for their next service and messages them in one tap, bringing customers back. The product doc calls this the feature that wins garage owners.

## Decisions
- **From api/13:** the due list is `GET /v1/reminders/due?within=7`; one tap is `POST /v1/reminders/:id/send` (open `shareLink`); snooze and dismiss are `PATCH /v1/reminders/:id`. Reminders also arrive through sync pull, so the list works offline; sending needs a connection. Convert a "next service at X km" into `next_service_due_date` before pushing the job.
- **Due dates come from the job card's "next service due"** (date, or km turned into an estimated date from the car's average km per day; default 3 months if unknown).
- **MVP: one-tap send through `wa.me`** from the garage's own WhatsApp, with a friendly pre-written message. Automatic sending through the Cloud API comes later via workers/, as in 13.
- **Mark as sent, snooze or dismiss.** A reminder counts as "came back" if the same car has a job at this garage within 30 days of the reminder. This is a product doc metric.
- **Ship it early in the pilot,** since it's the main reason owners keep logging.

## Scope
**In:**
- Reminders list: due today, overdue, upcoming (from the local database)
- Message template in Urdu and English with the garage name and car
- Send (wa.me), snooze 1 week, dismiss
- "Came back" link from a new job to the last reminder sent for that car
- Count of reminders due on the home screen (08)
- Local Android notification each morning when reminders are due

**Out (later items):**
- Automatic sending through the Cloud API (workers/)

## Steps
1. Calculate due reminders from jobs.
2. Reminders screen with the three groups.
3. Send, snooze, dismiss actions; sync their state.
4. "Came back" link on new jobs.
5. Morning notification (`expo-notifications`, local only).

## Files and folders touched
- `apps/garage-app/app/(app)/reminders/*`, `apps/garage-app/src/features/reminders/*`

## Done when
- [ ] An oil change logged with "next due in 3 months" appears in the list on the right day
- [ ] Sending a reminder takes one tap and records it as sent
- [ ] The "came back" rate can be counted on the server per garage

## Open questions
- Should reminders also go out automatically for garages that switch it on, once workers/ has the Cloud API? Decide after seeing pilot send rates.
