# api/16 — Report orders and the free-until-coverage switch

Status: planned · Phase: pilot (free reports) · Depends on: api/15

## Goal
A signed-in buyer can order a report for a car. Reports are free in a city until it meets the coverage gate, and become paid there with a config change, not new code.

## Decisions
- **`POST /reports/orders`** (tech doc) with `{ carId }` from the search result.
- **Buyers must sign in with phone OTP** (web audience, api/03) before ordering. The phone is where the report link is sent, and it lets us limit free reports.
- **Price per city from one config** (`report-pricing.ts` in `packages/shared`): `{ lahore: { paid: false, pricePkr: 0 } }`. The city is taken from the car's most recent approved job. **Every city starts free** (product doc Gate 3: sell only when searches find a history).
- **Free orders skip payment:** status goes straight to `paid` (amount 0) and the report build is queued.
- **Paid orders wait for payment** (api/18); dealers can pay with credits (api/19).
- **A report is a snapshot:** built from the data at order time and stored, so the buyer's copy doesn't change later.
- **Free orders are limited** to 5 per account per day (api/14), to stop free scraping.

## Scope
**In:**
- `POST /reports/orders`, `GET /reports/orders` (the buyer's own orders)
- Pricing config and the city lookup
- Queue the report build (workers: report build and PDF) for free or paid orders

**Out (later items):**
- Payment (api/18), report content and delivery (api/17)

## Steps
1. Pricing config with tests.
2. Order service: price lookup, create order, branch on free/paid.
3. Queue the build job for free orders.
4. Tests: a free city order is paid at 0 and queued; switching the city to paid makes the next order wait for payment.

## Files and folders touched
- `apps/api/src/modules/reports/*`, `packages/shared/src/report-pricing.ts`

## Done when
- [ ] Ordering in a free city produces a report without any payment step
- [ ] Changing one config value makes that city's new orders require payment
- [ ] A 6th free order in a day is refused

## Open questions
- Should pricing move into the database with an admin screen once more than one city is live? Proposed: yes, at that point.
