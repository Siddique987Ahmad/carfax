# api/11 — Customers

Status: planned · Phase: pre-pilot · Depends on: api/08

## Goal
Each garage has a private customer list with each customer's cars and visits, so it can call them back and send reminders. No other garage, and no report, ever sees it.

## Decisions
- **Customers are created and edited through sync** (api/08/09), so this works offline. These endpoints add search and history for screens that need the server.
- **One customer per phone per garage** (tech doc: `UNIQUE (garage_id, phone)`). The same person at two garages is two separate, unlinked records.
- **Deleting a customer clears their name and phone** and keeps the job rows without them, so the car's history survives but the person is gone. This supports privacy requests.
- **Never readable outside the garage:** not by reports, not by public search, not by other garages. Covered by the privacy test (api/02).

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
- `apps/api/src/modules/customers/*`

## Done when
- [ ] Search finds a customer by part of their name or phone
- [ ] Deleting a customer removes their name and phone everywhere but keeps the car's jobs
- [ ] No endpoint outside the garage routes returns customer data

## Open questions
- None
