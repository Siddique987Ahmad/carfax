# web/14 — My reports

Status: planned · Phase: reports launch · Depends on: web/08, web/10

## Goal
A buyer can find every report they've opened or paid for, without searching again or digging through WhatsApp.

## Decisions
- **List the buyer's orders,** newest first: car, date, free or paid, and links to the page and PDF.
- **Reports stay available** for as long as the buyer has an account.
- **Help sits next to each order:** "Report not loading?" opens support with the order ID filled in, which saves time for admin/17.

## Scope
**In:**
- `/account/reports`: order list, status (preparing, ready, refunded), open and download buttons
- Empty state that leads back to the search box

**Out (later items):**
- Dealer history (web/15)

## Steps
1. Use the API's "my orders" endpoint (api: reports topic).
2. Build the list with the shared list styles.
3. Add the support link with the order ID.

## Files and folders touched
- `apps/web/src/app/[locale]/account/reports/*`

## Done when
- [ ] A buyer sees all and only their own orders
- [ ] Each order opens its report and PDF
- [ ] Refunded orders are marked and no longer open

## Open questions
- None
