# web/09 — Report page

Status: planned · Phase: pilot · Depends on: web/08, workers/06, api/17

## Goal
The buyer sees the car's full recorded history in a page that's quick to read on a phone, with the warnings that matter at the top.

## Decisions
- **Bill pages too (from api/12):** render `GET /v1/bills/:token` at `/b/:token` with the same layout and the `bill.notice` text; no login, no phone numbers.
- **Warnings first:** a possible mileage rollback (a reading lower than an earlier one) and body-work records (denting, painting, panel replacement) are shown at the top, before the full list. The product doc says drops are flagged, never hidden.
- **The report is a frozen copy.** It's built once per order (workers/06) and stored, so the page, the PDF and the verification QR code (web/10) always match.
- **The mileage chart is plain SVG drawn on the server.** No chart library, so the page stays light on low-end phones (web/12).
- **What it shows, per the product doc's data table:**
  - Make, model and year
  - The last 4 characters of the chassis number
  - Each job's date and city
  - Each odometer reading (not the photo)
  - The work done
  - "Verified partner workshop," with the workshop name only if that garage opted in
- **Jobs with an open dispute are shown marked "under review"** (admin/19).
- **The coverage disclaimer (web/04) appears at the top and the bottom.**
- **The page is private:** only the buyer who ordered it (or anyone they share the link with, using an unguessable ID) can see it, and it's marked `noindex`.

## Scope
**In:**
- `/reports/[orderId]`: summary box (records, years covered, latest mileage, warnings), mileage chart, a timeline of services and repairs, body-work section, disclaimer, generated date
- Share button (copy link, WhatsApp)
- Free reports in the pilot: the order is created with price 0, then a one-question survey: "Would you have paid Rs X for this?" (the product doc's demand test)

**Out (later items):**
- PDF and QR code (web/10), payment (web/13)

## Steps
1. Agree the frozen report data shape with workers/06.
2. Build the summary box and warning banners.
3. Build the SVG mileage chart with drops highlighted.
4. Build the timeline and body-work section.
5. Add sharing and the pilot survey.

## Files and folders touched
- `apps/web/src/app/[locale]/reports/[orderId]/*`, `apps/web/src/components/report/*`

## Done when
- [ ] A seeded car with a mileage drop shows the rollback warning at the top
- [ ] No customer name, phone or photo appears anywhere in the page source
- [ ] The page passes the web/12 budget on a throttled low-end phone profile
- [ ] Survey answers are stored and counted on the admin dashboard

## Open questions
- If new records arrive after purchase, can the buyer refresh the report for free (e.g. within 30 days)?
