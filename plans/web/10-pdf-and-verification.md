# web/10 — PDF download and QR verification

Status: planned · Phase: pilot · Depends on: web/09, workers/07

## Goal
A buyer can download the report as a PDF to show a seller or a bank, and anyone holding the PDF can scan its QR code to check it's genuine and unchanged.

## Decisions
- **One layout for page and PDF.** The PDF worker (workers/07, Puppeteer) renders a print version of the same report page (`/reports/[orderId]/print`, opened with a short-lived signed token), so the two can never disagree.
- **Each report gets a QR code and a short verification code.** The QR code opens `/verify/[code]`. This idea comes from PakWheels' inspection reports.
- **The verification page shows only a summary:** car, generation date, number of records and warnings, never the full report. Someone holding a forged PDF can see at once that the summary doesn't match.
- **PDFs are stored in the private bucket** and downloaded through a short-lived signed URL.

## Scope
**In:**
- Print route with print CSS (A4, page breaks between sections)
- "Download PDF" button: asks the API for the PDF and shows "preparing…" if it isn't ready
- QR code and verification code on every page of the PDF
- Public `/verify/[code]` page (`noindex`)

**Out (later items):**
- Rendering itself (workers/07)

## Steps
1. Build the print route and print styles.
2. Add the signed-token check so only the worker can open the print route without a session.
3. Add the QR code and the verification page.
4. Add the download button and its waiting state.

## Files and folders touched
- `apps/web/src/app/[locale]/reports/[orderId]/print/*`, `apps/web/src/app/verify/[code]/*`

## Done when
- [ ] The PDF looks the same as the page and prints cleanly on A4
- [ ] Scanning the QR code opens the right verification summary
- [ ] An edited PDF (changed mileage) visibly disagrees with its verification page

## Open questions
- Should the verification page show the report's warnings? Proposed: yes; it's the most useful part for a second buyer.
