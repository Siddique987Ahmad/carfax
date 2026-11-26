# api/17 — Report delivery

Status: planned · Phase: pilot (free reports) · Depends on: api/16, workers: report build and PDF

## Goal
After a free or paid order, the buyer sees their report on the website and gets a PDF, and nobody else can open it without permission.

## Decisions
- **`GET /reports/:orderId`** (tech doc) returns the order status (`pending`, `building`, `ready`, `failed`) and, when ready, the report data and a short-lived PDF link.
- **The report's shape is one Zod schema in `packages/shared`**, used by the worker that builds it, the API that serves it and the web page that shows it.
- **What goes in** (product doc): mileage timeline with rollback flags, service and repair list (date, type of work, city), body-work flags, chassis last 4 only, garage shown as "verified partner." Jobs under an open dispute are marked "under review" (admin/19).
- **What never goes in:** customer names or phones, owner details, odometer photos. The privacy test (api/02) checks the report schema.
- **Access:** the buyer who ordered it, or anyone with the **share link** the buyer creates (a random token, valid 30 days). Dealers show reports to their buyers this way.
- **The report states its limits** (product doc): it shows only what partner workshops recorded; no record is not proof of no accident.

## Scope
**In:**
- `GET /reports/:orderId`, `POST /reports/:orderId/share` → share link, `GET /public/reports/:shareToken`
- `POST /reports/:orderId/send` (queue a WhatsApp/SMS with the link)
- Report schema in shared code

**Out (later items):**
- Building the report and PDF (workers), the report page (web)

## Steps
1. Report Zod schema and a sample fixture.
2. Fetch endpoint with ownership check; signed PDF URL.
3. Share token create and public fetch.
4. Send endpoint (queue).
5. Tests: another user's order is 404; an expired share link is refused; the schema has no personal fields.

## Files and folders touched
- `apps/api/src/modules/reports/*`, `packages/shared/src/report-schema.ts`

## Done when
- [ ] The buyer sees status change from building to ready and can download the PDF
- [ ] A share link works without login for 30 days and then stops
- [ ] The report response contains no customer or owner personal data

## Open questions
- None
