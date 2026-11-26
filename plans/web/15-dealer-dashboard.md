# web/15 — Dealer login and dashboard

Status: planned · Phase: reports launch · Depends on: web/08, admin/18

## Goal
A dealer on a monthly plan checks cars using their credits, checks several cars at once, and sees their usage and invoices, which is the product doc's dealer plan.

## Decisions
- **Same phone login as buyers.** A phone linked to a dealer account (set up by our team in admin/18) also sees the dealer pages.
- **Opening a report with credits skips payment.** One credit per report, taken from the credit ledger.
- **Bulk check:** paste up to 20 plates and get a preview for each, then choose which to open with credits. The product doc lists "bulk checks" for dealers.
- **Invoices are listed as PDFs** made by the workers, matching the plan our team set up.

## Scope
**In:**
- `/dealer`: credit balance, renewal date, recent checks
- Bulk check page
- History of all checks, with links to the reports
- Invoices list
- "Use 1 credit" option at checkout when the user is a dealer

**Out (later items):**
- Verified-history badge for listings (web/18)

## Steps
1. Detect the dealer role in the session; add the dealer menu.
2. Build the dashboard from the API's dealer endpoints (`/dealer/credits`, as in the tech doc).
3. Build the bulk check page (uses the same preview endpoint, with a higher rate limit for dealers).
4. Add credit use at checkout.
5. Add the invoices list.

## Files and folders touched
- `apps/web/src/app/[locale]/dealer/*`, `apps/web/src/app/[locale]/checkout/*`

## Done when
- [ ] Opening a report with credits takes exactly one credit, even if the button is clicked twice
- [ ] Bulk check handles 20 plates without hitting the public rate limit
- [ ] A dealer with no credits is offered normal payment

## Open questions
- Should dealers be able to buy more credits on the site, or only through our team? Proposed: through our team at first.
