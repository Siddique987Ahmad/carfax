# api/19 — Dealer credits

Status: planned · Phase: reports launch · Depends on: api/16, admin/18

## Goal
A dealer on a monthly plan orders reports using credits instead of paying each time, and can see their balance and history.

## Decisions
- **`GET /dealer/credits`** (tech doc) returns the balance and recent ledger rows from `dealer_credit_ledger` (set up by admin/18).
- **Ordering with credits:** `POST /reports/orders` with `payWith: 'credits'`. The API locks the dealer account row, checks the balance, writes a `-1` ledger row and marks the order paid, all in one transaction, so two orders at once can't spend the same credit.
- **Credits work in every city,** paid or free, so dealers get used to the flow before reports are charged.
- **A failed report build refunds the credit** automatically (`+1` row with the reason).

## Scope
**In:**
- `GET /dealer/credits`
- Credit payment path in the order service
- Credit refund when the build fails

**Out (later items):**
- Granting credits and plans (admin/18), dealer dashboard (web)

## Steps
1. Balance query (sum of ledger rows).
2. Credit payment inside the order transaction with `SELECT … FOR UPDATE`.
3. Refund on build failure (called from the worker's failure handler).
4. Tests: 10 parallel orders with 5 credits → exactly 5 succeed.

## Files and folders touched
- `apps/api/src/modules/dealers/*`, `apps/api/src/modules/reports/*`

## Done when
- [ ] A dealer with credits gets a report without payment, and the balance drops by one
- [ ] Parallel orders never spend more credits than the dealer has
- [ ] A failed build gives the credit back

## Open questions
- None
