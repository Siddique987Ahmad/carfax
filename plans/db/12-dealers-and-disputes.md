# db/12 — Dealers, car owner claims and disputes

Status: planned · Phase: reports launch · Depends on: db/04, db/05, db/11

## Goal
Tables for the dealer monthly plan, car owners claiming their car, and owners reporting wrong entries.

## Decisions
- **`dealer_accounts`** as in the tech doc (user, business name, plan, monthly credits, status), plus price and the "verified history" badge switch (admin/18).
- **Credits are a ledger** (`dealer_credit_ledger`, admin/18): each grant, monthly top-up, use and expiry is a row. The balance is the sum, so it can always be explained.
- **Monthly top-ups can't double:** unique on account + period for `monthly` rows, so a worker running twice adds credits once.
- **`car_claims`:** a car owner proves ownership by OTP and links their account to a car (web/16). One car can have one verified owner at a time.
- **`disputes`** with the columns admin/19 needs: car, job, owner, message, status (`open`, `fixed`, `rejected`), resolution note, who resolved it, and when.

## Scope
**In:**
- Enums `dealer_status`, `credit_reason` (`grant`, `monthly`, `use`, `expire`, `refund`), `dispute_status`
- `dealer_accounts` (id, user_id, business_name, plan_name, monthly_credits, price_pkr, verified_badge, status, created_at, updated_at)
- `dealer_credit_ledger` (id, dealer_account_id, change, reason, period, order_id, created_by, note, created_at)
- `car_claims` (id, car_id, user_id, verified_at, ended_at, created_at); partial unique on car_id where ended_at is null
- `disputes` (id, car_id, job_id, user_id, message, status, resolution_note, resolved_by, resolved_at, created_at)
- Indexes: `disputes (status, created_at)`, `dealer_credit_ledger (dealer_account_id, created_at)`

**Out (later items):**
- Dealer dashboard (web/05), owner page (web/16), admin screens (admin/18, admin/19)

## Steps
1. Write the schema files and generate the migration.
2. Add a `dealer_balances` view that sums the ledger.
3. Add dealers, claims and disputes to the `dev` seed.
4. Export the Zod schemas.

## Files and folders touched
- `packages/db/src/schema/dealers.ts`, `packages/db/src/schema/owners.ts`, `packages/db/migrations/*`, `packages/db/seed/*`

## Done when
- [ ] A dealer's balance from the view equals the sum of their ledger rows
- [ ] A second `monthly` row for the same dealer and month is refused
- [ ] A car can't have two active verified owners

## Open questions
- Do dealer credits roll over? This is the same question as admin/18; the ledger works either way.
