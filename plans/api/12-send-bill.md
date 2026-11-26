# api/12 — Send the bill on WhatsApp

Status: done (Nov 27, 2026) · Phase: pre-pilot · Depends on: api/08, api/11

## Goal
After a job, the customer gets a professional bill on WhatsApp — one of the main reasons a garage owner will use the app (product doc).

## Decisions
- **Pilot: one tap from the garage's own WhatsApp** (decided Nov 26, 2026). `POST /jobs/:id/send-bill` returns a `wa.me` link with the bill text and the bill link, and the app opens WhatsApp. No Meta approval or per-message cost is needed.
- **The bill is a link to a simple bill page** with a PDF download, not only an attachment, so it works on any phone.
- **Bill links are unguessable** (random token) and show only the garage, the work, the parts and the total — no other jobs of the car.
- **Later: automatic sending through the WhatsApp Cloud API** once Meta approves the account. The same endpoint then queues the message for workers/04 instead. A per-garage setting picks the method, so switching needs no app update.
- **Each send is recorded** (`bill_sends`: job, channel, status, sent_at), so the app shows "sent" and nobody sends twice by mistake.
- **Built with these decisions:**
  - **One `bill_sends` table** (job, garage, who sent it, method, link token hash, expiry), not two. Each send gets its own link; only a SHA-256 hash of the token is stored (like refresh tokens), so a database leak exposes no working links. Links last a year. Row-level security and a composite key to the job's garage, like correction requests.
  - **`POST /v1/jobs/:id/send-bill`** (`bills.send`: owners and mechanics) with `{ language: 'en' | 'ur' }` returns `{ method: 'wa_me', shareLink, billUrl, text, sendsToday }`. `shareLink` is `https://wa.me/92…?text=…`.
  - **The bill text** comes from `@carfax/i18n` (`bill.*`), so the Urdu translation is enforced by the i18n check: garage name, car and plate, date, odometer, each work line with its price, total, next service, the bill link and the history-report notice. Prices in Pakistani format (`Rs. 8,500`, `8,500 روپے`).
  - **The public bill page data** is `GET /v1/bills/:token` (no login); the website renders it at `/b/:token` (`PUBLIC_WEB_URL`, new setting). It shows the garage (name, city, address), the car, the date, the work and prices, the total and the notice; **no phone numbers at all** (not the customer's, and the garage has no business phone field; the customer already has the garage's number from the WhatsApp chat) and no other visits. Added to the privacy test as an explicit case.
  - **The limit of 3 per job per day holds under concurrency** (a lock per job; five taps at once give three sends and two `RATE_LIMITED`).
  - **No customer phone:** `NO_CUSTOMER_PHONE` (new error code), so the app can ask for the number.
  - **No per-garage "send method" setting yet:** with only `wa_me` in the pilot it would be dead code; workers/04 adds it with the Cloud API (`bill_sends.method` already allows `cloud_api`).
  - **A mechanic sending a colleague's bill sees its prices** (a bill shows prices by nature); this is the one exception to api/09's price rule.

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
- `apps/api/src/bills/*`, `apps/api/test/bills.test.ts`, `apps/api/test/privacy.test.ts`, `apps/api/src/config.ts`
- `packages/db/src/schema/jobs.ts` (`bill_sends`), `packages/db/migrations/0013_bill_sends.sql`, `packages/i18n/src/locales/{en,ur}/bill.json`, `packages/shared/src/errors.ts`, `.env.example`, `turbo.json`

## Done when
- [x] Sending a bill returns a working `wa.me` link and records the send
- [x] The bill link opens without login and shows only that job (no customer details, no other visits)
- [x] The `wa.me` link opens WhatsApp with the customer's number and the bill text filled in (the link's number and `text` are checked; opening WhatsApp itself is checked on a phone in garage-app/13)

## Open questions
- ~~Should the bill page carry the history-report notice?~~ Yes: in the WhatsApp text and on the bill page (`bill.notice`).
