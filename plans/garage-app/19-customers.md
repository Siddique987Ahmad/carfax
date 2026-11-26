# garage-app/19 — Customers list

Status: planned · Phase: pilot · Depends on: garage-app/10, garage-app/14

## Goal
The garage has a private list of its customers and their cars, which it doesn't have today on paper slips and WhatsApp.

## Decisions
- **Private to the garage,** as in the product doc. Customers are never shared with other garages, admin reports or history reports.
- **Built automatically from jobs.** Each job's customer is added or matched by phone number, so nobody types the list by hand.
- **Search by name, phone or plate.**
- **Tap to call or WhatsApp** the customer.

## Scope
**In:**
- Customers list (name, phone, number of cars, last visit), from the local database
- Customer detail: cars and visit history at this garage, total spent (owner only)
- Edit name and phone; merge two entries with the same person
- Call and WhatsApp buttons

**Out (later items):**
- Bulk messages to customers (a future paid Workshop Pro feature in the product doc)

## Steps
1. List and detail screens with local queries.
2. Search across name, phone and plate.
3. Edit and merge.
4. Call and WhatsApp buttons.

## Files and folders touched
- `apps/garage-app/app/(app)/customers/*`, `apps/garage-app/src/features/customers/*`

## Done when
- [ ] Every customer from a logged job appears in the list without extra typing
- [ ] Search finds a customer by any of name, phone or plate, offline
- [ ] Mechanics don't see total spent

## Open questions
- None
