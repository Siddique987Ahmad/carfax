# api/18 — Payments: JazzCash, Easypaisa and card

Status: planned · Phase: reports launch · Depends on: api/16, setup: business accounts

## Goal
Buyers pay for a report with JazzCash, Easypaisa or a card, and the report is delivered only after the payment is confirmed by the provider.

## Decisions
- **`POST /payments/:provider/init`** (tech doc) returns what the website needs to send the buyer to the provider's hosted checkout. We never handle card numbers ourselves.
- **`POST /payments/:provider/callback`** (tech doc) checks the provider's signature (HMAC hash for JazzCash and Easypaisa), then checks the amount and order match before marking anything paid.
- **Safe to receive twice:** `payments.provider_ref` is unique; a repeated callback changes nothing.
- **Missed callbacks:** a worker asks the provider for the status of payments still pending after 15 minutes, so a dropped callback doesn't leave a paid buyer without a report.
- **One `PaymentProvider` interface** with three implementations, so adding Safepay or PayFast later is one new file.
- **Paid → queue the report build;** failed or expired → order `cancelled`.
- **Reports stay free until the coverage gate** (api/16), so this code is built and tested in sandbox but no city charges until its switch is turned on.

## Scope
**In:**
- `PaymentProvider` interface; JazzCash, Easypaisa and card-gateway implementations (sandbox first)
- Init and callback endpoints, signature checks, amount checks
- Status-check job definition for the worker
- `GET /payments/:orderId/status` for the website to poll after returning from checkout

**Out (later items):**
- Refunds (admin/17), checkout page (web)

## Steps
1. Interface and the JazzCash implementation against its sandbox.
2. Easypaisa implementation.
3. Card gateway implementation (provider chosen in setup).
4. Callback handling in one transaction: payment row → order paid → queue build.
5. Status-check job for stuck payments.
6. Tests with recorded sandbox callbacks: bad signature refused, wrong amount refused, duplicate callback ignored.

## Files and folders touched
- `apps/api/src/modules/payments/*`

## Done when
- [ ] A sandbox payment with each provider ends with a delivered report
- [ ] A callback with a bad signature or wrong amount changes nothing and is logged
- [ ] A payment whose callback never arrived is completed by the status check

## Open questions
- Which card gateway? Decide with the merchant accounts in setup.
- Do JazzCash and Easypaisa support refunds by API? Needed for admin/17.
