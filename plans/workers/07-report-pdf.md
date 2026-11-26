# workers/07 — Report PDF and delivery

Status: planned · Phase: pilot (free reports) · Depends on: workers/06, workers/04

## Goal
Each report snapshot becomes a PDF stored privately, and the buyer gets a link to it on the page and, if they asked, on WhatsApp.

## Decisions
- **Puppeteer renders an HTML template,** as in the tech doc.
- **One template for the PDF and the web report page** (`packages/report-template`), so they never look different.
- **PDFs run on their own queue with low concurrency** (1–2 at a time), because headless Chrome uses a lot of memory.
- **Stored in the private `reports` bucket** and served by short-lived signed URLs, as the tech doc says.
- **The PDF carries a QR code** that opens the report's verification page, so a printed copy can be checked. PakWheels inspection reports do the same.
- **If the PDF fails** after retries, the order goes to admin (admin/17) and is refunded automatically, as in the tech doc's buying flow.

## Scope
**In:**
- `packages/report-template` (React component rendered to static HTML), with Urdu and English
- PDF job: render, upload, save `pdf_key`, mark the order `delivered`
- WhatsApp or SMS message with the link, through workers/04
- Failure path to refund and admin

**Out (later items):**
- The report web page (web/09), which uses the same template

## Steps
1. Build the template with sample snapshots.
2. Add Puppeteer and Chromium to the worker image; check memory use.
3. Write the PDF job and the upload.
4. Add the delivery message.
5. Add the failure path.

## Files and folders touched
- `packages/report-template/*`, `workers/src/reports/pdf.ts`, `infra/Dockerfile`

## Done when
- [ ] A paid order produces a PDF in under 30 seconds
- [ ] The PDF and the web page show the same content
- [ ] The QR code opens the right report
- [ ] A forced failure leads to a refund and an admin entry

## Open questions
- None
