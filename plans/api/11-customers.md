# api/11 — Customers

Status: done (Nov 27, 2026) · Phase: pre-pilot · Depends on: api/08

## Goal
Each garage has a private customer list with each customer's cars and visits, so it can call them back and send reminders. No other garage, and no report, ever sees it.

## Decisions
- **Customers are created and edited through sync** (api/08/09), so this works offline. These endpoints add search and history for screens that need the server.
- **One customer per phone per garage** (tech doc: `UNIQUE (garage_id, phone)`). The same person at two garages is two separate, unlinked records.
- **Deleting a customer clears their name and phone** and keeps the job rows without them, so the car's history survives but the person is gone. This supports privacy requests.
- **Never readable outside the garage:** not by reports, not by public search, not by other garages. Covered by the privacy test (api/02).
- **Built with these decisions:**
  - **Search** (`GET /v1/customers?q=`) matches part of the name (case-insensitive) or part of the phone in any spelling: the typed digits are normalised like stored phones (`0300 123`, `+92 300 123` and `300123` all find `+923001234567`). `%`, `_` and `\` are plain characters, not wildcards. Each result has the last visit, the number of visits and the customer's cars with current plates; most recent visit first; up to 100.
  - **Detail** (`GET /v1/customers/:id`): visits newest first and reminders. Visit totals follow api/09's rule (a mechanic sees prices only on jobs they logged). Mechanics can search and open customers (`customers.view`): they send bills and reminders.
  - **Deleting** (`DELETE /v1/customers/:id`, owner only) clears the name and phone, sets `deleted_at` (so phones drop it on their next pull), **cancels the customer's scheduled reminders** (there's no number to send them to), and keeps the jobs. **The audit entry records that it happened, never the deleted name or phone**, or the log would undo the privacy request.
  - **Another garage's customer is 404.**
  - **The privacy test now also runs signed in** (api/02's version only ran signed out): another garage's owner and a buyer call every parameter-free route, and the seeded customer's name and phone, in any spelling, must not appear. Checked by breaking search on purpose (no garage scope): the test named `GET /v1/customers`.

## Scope
**In:**
- `GET /customers?q=` (tech doc) — search by name or phone, with last visit and cars
- `GET /customers/:id` — visits and reminders
- `DELETE /customers/:id` — clear personal data (owner only)

**Out (later items):**
- Owner's own record on the website (api/20)

## Steps
1. Search query (name/phone prefix) scoped to the garage.
2. Detail with visits and reminders.
3. Delete that clears name/phone, keeps jobs, and writes an audit entry.
4. Tests: isolation, delete keeps job history, privacy test includes customers.

## Files and folders touched
- `apps/api/src/customers/*`, `apps/api/test/customers.test.ts`, `apps/api/test/privacy.ts`, `apps/api/test/privacy.test.ts`, `apps/api/src/app.module.ts`

## Done when
- [x] Search finds a customer by part of their name or phone
- [x] Deleting a customer removes their name and phone everywhere but keeps the car's jobs (including the audit log and the phones, via sync pull)
- [x] No endpoint outside the garage routes returns customer data (privacy test, signed out and signed in as other users)

## Open questions
- None
