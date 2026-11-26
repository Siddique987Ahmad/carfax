# admin/18 — Dealer accounts and credits

Status: planned · Phase: reports launch · Depends on: admin/17

## Goal
The team can set up a dealer on a monthly plan, give them report credits and see how they use them, as described in the product doc's dealer plan.

## Decisions
- **Plans are set up by hand at first** (plan name, credits per month, price). There's no self-serve checkout until the plan has proven itself.
- **Credits are a ledger,** not a single number: each grant, use and expiry is a row, so the balance can always be explained.
- **The "verified history" badge** is switched on per dealer here; the web listing badge comes later.

## Scope
**In:**
- DB: `dealer_accounts` (as in the tech doc: user, business name, plan, monthly credits, status) and `dealer_credit_ledger` (account, change, reason, order_id, created_at)
- API: list, create and edit dealers; grant credits; the usage history endpoint
- UI: dealer list, dealer detail (balance, usage, invoices), "grant credits" dialog with a reason
- Monthly worker that adds plan credits

**Out (later items):**
- Dealer's own dashboard on the website (web/15)

## Steps
1. Dealer account and ledger tables come from db/12.
2. Endpoints, with every grant audited.
3. Monthly credit worker.
4. Admin pages.

## Files and folders touched
- `packages/db` (migration), `apps/api/src/modules/admin/dealers/*`, `workers/src/dealer-credits.ts`, `apps/admin/src/pages/dealers/*`

## Done when
- [ ] A dealer can be created and given credits, and the balance equals the sum of the ledger
- [ ] Monthly credits are added once per month, even if the worker runs twice
- [ ] Every manual grant is in the audit log

## Open questions
- Do unused credits roll over? Proposed: no, they expire at month end.
