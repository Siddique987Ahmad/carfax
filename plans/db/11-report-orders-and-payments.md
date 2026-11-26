# db/11 — Searches, report orders and payments

Status: planned · Phase: pilot (free reports) · Depends on: db/02, db/04

## Goal
Tables for the money side: what people search for, which reports they order, and every payment attempt, refund and provider callback.

## Decisions
- **`searches` table:** one row per public search, recording whether a history was found. The product doc's Gate 3 ("searches that find a history," 30%+ before selling) needs this, and web/06 builds it **before** reports are paid. Build this table early, with web/06, even though the rest of the plan waits.
- **Reports are free at first,** as in the product doc: `price_pkr = 0` and no payment row.
- **A report is a snapshot.** The built report is saved as JSON (`report_snapshot`) with `built_at`, so a later correction doesn't silently change a report someone already paid for. A corrected report means a new build.
- **Order status:** `pending`, `paid`, `delivered`, `refunded`, `cancelled`. Payment status: `initiated`, `success`, `failed`, `refunded`.
- **Every provider callback is stored** as received (body, whether the signature was valid, time), so the team can see the whole payment timeline in admin/17.
- **Dealer orders** use credits (db/12) instead of a payment; `dealer_account_id` is set on the order.
- **No buyer account needed.** `buyer_id` can be empty, with `buyer_phone` for sending the link.

## Scope
**In:**
- Enums `order_status`, `payment_status`, `payment_provider` (`jazzcash`, `easypaisa`, `card`)
- `searches` (id, query_normalised, car_id, found, records_count, ip_hash, created_at)
- `report_orders` (id, car_id, buyer_id, buyer_phone, dealer_account_id, price_pkr, status, report_snapshot, built_at, pdf_key, refunded_at, refund_ref, refund_reason, created_at, updated_at)
- `payments` (id, order_id, provider, provider_ref unique, amount_pkr, status, created_at, updated_at)
- `payment_callbacks` (id, payment_id, body JSONB, signature_ok, received_at)
- Indexes: `searches (created_at)`; `report_orders (buyer_phone)`, `(car_id)`, `(status, created_at)`

**Out (later items):**
- Dealer accounts (db/12); payment code (api/18)

## Steps
1. Build `searches` first, alongside web/06.
2. Write the order and payment schemas; generate the migration.
3. Add orders and payments to the `dev` seed.
4. Export the Zod schemas.

## Files and folders touched
- `packages/db/src/schema/reports.ts`, `packages/db/migrations/*`, `packages/db/seed/*`

## Done when
- [ ] The same provider reference can't be saved twice, so a repeated callback can't mark two payments
- [ ] A free order can exist with no payment
- [ ] Search hit rate for a city and date range can be calculated from `searches`

## Open questions
- How long to keep `searches` and `ip_hash`? Proposed: 12 months, then delete the IP hash.
