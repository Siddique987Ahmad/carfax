# admin/17 — Report orders, payments and refunds

Status: planned · Phase: reports launch · Depends on: api/18

## Goal
The team can answer "I paid but didn't get my report" in under a minute, and issue a refund when it's owed.

## Decisions
- **Search orders by order ID, buyer phone, plate or provider reference,** since that's what customers will quote.
- **Refunds are super admin only,** with a reason. They go through the provider's refund API where one exists; otherwise the refund is marked "refunded manually" with the reference.
- **"Resend report"** regenerates the PDF if needed and sends the link again, which fixes most complaints without a refund.

## Scope
**In:**
- API: `GET /admin/orders?q=&status=&provider=&from=&to=`, `GET /admin/orders/:id` (order, payment attempts, provider callbacks), `POST /admin/orders/:id/resend`, `POST /admin/orders/:id/refund`
- UI: orders list with status filters, order detail with a payment timeline, and resend and refund actions
- Revenue tiles added to the dashboard (admin/16)

**Out (later items):**
- Dealer credits (admin/18)

## Steps
1. List and detail endpoints, joining payments and callback records.
2. Resend action (queues the PDF job, then WhatsApp/SMS).
3. Refund action per provider; manual fallback.
4. Orders pages; revenue on the dashboard.

## Files and folders touched
- `apps/api/src/modules/admin/orders/*`, `apps/admin/src/pages/orders/*`, `apps/admin/src/pages/dashboard/*`

## Done when
- [ ] An order can be found by any of the four search keys
- [ ] Resend delivers a working link
- [ ] A refund changes the order to `refunded` and is audited

## Open questions
- Do JazzCash and Easypaisa merchant accounts support refunds by API? Check during setup/02.
