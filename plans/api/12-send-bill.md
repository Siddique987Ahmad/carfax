# api/12 — Send the bill on WhatsApp

Status: planned · Phase: pre-pilot · Depends on: api/08, api/11

## Goal
After a job, the customer gets a professional bill on WhatsApp — one of the main reasons a garage owner will use the app (product doc).

## Decisions
- **Pilot: one tap from the garage's own WhatsApp** (decided Nov 26, 2026). `POST /jobs/:id/send-bill` returns a `wa.me` link with the bill text and the bill link, and the app opens WhatsApp. No Meta approval or per-message cost is needed.
- **The bill is a link to a simple bill page** with a PDF download, not only an attachment, so it works on any phone.
- **Bill links are unguessable** (random token) and show only the garage, the work, the parts and the total — no other jobs of the car.
- **Later: automatic sending through the WhatsApp Cloud API** once Meta approves the account. The same endpoint then queues the message for workers/04 instead. A per-garage setting picks the method, so switching needs no app update.
- **Each send is recorded** (`bill_sends`: job, channel, status, sent_at), so the app shows "sent" and nobody sends twice by mistake.

## Scope
**In:**
- `POST /jobs/:id/send-bill` → `{ method: 'wa_me', shareLink }` (later `{ method: 'cloud_api', status: 'queued' }`)
- `GET /b/:token` (public bill data for the bill page)
- DB: `bill_tokens` / `bill_sends` — add to db: job tables

**Out (later items):**
- Automatic Cloud API sending (workers/04), bill page design (web)

## Steps
1. Bill token creation and the public bill endpoint (no personal data except what the customer already knows).
2. Send endpoint: check the customer has a phone, build the `wa.me` link with Urdu/English bill text, and record the send.
3. Leave a `cloud_api` branch behind the per-garage setting, switched off until Meta approval.
4. Tests: token can't reveal other jobs; resending is limited to 3 per job per day.

## Files and folders touched
- `apps/api/src/modules/bills/*`, `packages/db` (bill tables)

## Done when
- [ ] Sending a bill returns a working `wa.me` link and records the send
- [ ] The bill link opens without login and shows only that job
- [ ] The `wa.me` link opens WhatsApp with the customer's number and the bill text filled in

## Open questions
- Should the bill page say "this service record may appear in car history reports"? The product doc requires this notice on the job card; the bill is the natural place.
