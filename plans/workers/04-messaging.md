# workers/04 — Messaging: WhatsApp, SMS and bills

Status: planned · Phase: pre-pilot (OTPs live by week 9) · Depends on: workers/01, setup/02

## Goal
One messaging service sends OTPs from day one, and later bills and reminders, by WhatsApp with SMS as the fallback. It records every message with its cost.

**Pilot decision (Nov 26, 2026):** bills and reminders go out with one tap from the garage's own WhatsApp (`wa.me`, api/12 and api/13). This service sends only **OTPs** in the pilot, which have to be automatic. Bills and reminders switch to it once Meta approves the account.

## Decisions
- **The API already sends login codes through a `MessageSender` interface** (api/03: `apps/api/src/messaging/messaging.module.ts`, with `console` and `memory` providers). Build `packages/messaging` with the WhatsApp and SMS providers behind the same `sendLoginCode(phone, code)` shape, then switch the API's module to it; production already refuses `console` and `memory`.
- **A shared `packages/messaging`,** used by:
  - the API for OTPs, sent straight away because the user is waiting
  - the workers for bills and reminders, sent through the `messages` queue
- **WhatsApp Business Cloud API first, SMS fallback** when WhatsApp fails or the number isn't on WhatsApp.
- **Templates need Meta's approval:** an authentication template for OTPs, and utility templates for the bill and the reminder, in Urdu and English. Submit them as soon as Meta verification is done.
- **The pilot bill is a text message** listing the work items and the total in rupees. A PDF or link bill comes later, so the pilot doesn't depend on the public site.
- **Message log:** each message records its kind, the related job or customer, provider, status from delivery webhooks, and estimated cost. The phone number isn't copied into the log; it's taken from the customer record.
- **Locally, messages are printed to the console** (setup/03).

## Scope
**In:**
- `packages/messaging` with WhatsApp, SMS and console providers behind one interface
- `messages` table and status updates from the WhatsApp webhook (endpoint in the API)
- Bill job, triggered by `POST /jobs/:id/send-bill` for garages switched to the Cloud API (after Meta approval; built and tested in the pilot, switched off)
- Template text in `packages/i18n`
- Cost estimate per message (feeds setup/11)

**Out (later items):**
- Reminders (workers/05)
- Report links to buyers (workers/07)

## Steps
1. Define the provider interface and the console provider.
2. Build the WhatsApp provider; submit templates.
3. Build the SMS provider and the fallback rule.
4. Add the `messages` table and the webhook handler.
5. Add the bill job.
6. Send real test messages on staging to Jazz, Zong, Telenor and Ufone numbers.

## Files and folders touched
- `packages/messaging/*`, `workers/src/messages/*`, `apps/api/src/modules/webhooks/whatsapp/*`, `packages/db` (migration)

## Done when
- [ ] An OTP arrives on WhatsApp, and by SMS for a number without WhatsApp
- [ ] A bill arrives on the customer's WhatsApp in Urdu or English
- [ ] Every message has a delivery status and a cost estimate in the log

## Open questions
- Should bills go from the platform's WhatsApp number, or the garage's own number via a share link (free, but manual)? Proposed: platform number, so bills are consistent and logged.
