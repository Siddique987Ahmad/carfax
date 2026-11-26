# web/13 — Checkout and the per-city coverage gate

Status: planned · Phase: reports launch · Depends on: web/09, api/18

## Goal
Once a city has enough recorded cars, buyers there pay for reports by JazzCash, Easypaisa or card; until then, reports in that city stay free, as the product doc requires.

## Decisions
- **Free or paid is set per city in one config file** (`report-pricing.ts` in `packages/shared`, owned by api/16). With one city in year one, a change is a small reviewed pull request, and git history records who changed it and when. Move it to a database table with an admin screen only when there are several cities.
- **A car's city is the city of its most recent job.**
- **Payment uses each provider's hosted checkout,** so card details never touch our servers. The provider calls the API back (api/18); the site only shows status.
- **The report is released only after the API confirms payment,** as in the tech doc. The success page waits for the order status instead of trusting the redirect.
- **Free mode still creates an order** (price 0) and keeps the survey from web/09, so free and paid reports follow one path.

## Scope
**In:**
- Checkout step between preview and report: price, what's included, choice of JazzCash, Easypaisa or card
- Redirect to the provider, return page that waits for confirmation, then opens the report
- Failure and timeout states with "try again," and a support contact with the order ID
- Reading the city's pricing config to decide free or paid

**Out (later items):**
- Refunds (admin/17), dealer credits instead of payment (web/15)

## Steps
1. Agree with api/18 on the order and payment start endpoints and statuses.
2. Build the checkout step and the provider choice.
3. Build the return page that waits for confirmation (poll every few seconds, give up after 2 minutes with clear help).
4. Switch between free and paid from the city's pricing config.
5. Test each provider in its sandbox, including failed and abandoned payments.

## Files and folders touched
- `apps/web/src/app/[locale]/checkout/*`, `apps/web/src/app/[locale]/reports/[orderId]/*`

## Done when
- [ ] In a paid city, the report opens only after the provider confirms payment
- [ ] In a free city, the flow skips payment and still records the order
- [ ] Failed, cancelled and abandoned payments each show a clear message
- [ ] Switching a city between free and paid needs no deploy

## Open questions
- None for pricing: it's a config change (see Decisions).
- Final price: the product doc's Rs 500–1,000 is a guess to test.
