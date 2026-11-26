# web/04 — Terms, privacy and data notice

Status: planned · Phase: pilot · Depends on: web/02

## Goal
Before any report is shown, even a free one, the site says clearly what data is collected, what a report contains and what it doesn't prove, matching the product doc's privacy rules.

## Decisions
- **Three pages:** terms of use, privacy policy, and a plain-language "how our data works" notice.
- **The data notice repeats the product doc's rules word for word where possible:**
  - Reports describe the car, never the person.
  - No owner names, phone numbers or workshop customer details appear in any report.
  - A report shows only what partner workshops recorded; no record is not proof of no accident.
  - Car owners can request their car's record and report a wrong entry.
- **The same notice wording is used on the garage app's job card**, so what customers are told in the workshop matches the website.
- **Nothing goes live until a Pakistani lawyer has reviewed the text** (an open question in the product doc).

## Scope
**In:**
- `/terms`, `/privacy`, `/how-our-data-works` in English (Urdu after the lawyer's review)
- Footer links on every page
- A short version of the disclaimer as a reusable component, used by the preview (web/07) and the report (web/09)
- Cookie and analytics notice, if the lawyer says it's needed (see web/11)

**Out (later items):**
- Owner record requests and disputes (web/16, web/17)

## Steps
1. Draft the three pages from the product doc's rules.
2. Get them reviewed by a lawyer; record the review date on each page.
3. Build the pages and the disclaimer component.

## Files and folders touched
- `apps/web/src/app/[locale]/(legal)/*`, `apps/web/src/components/CoverageDisclaimer.tsx`

## Done when
- [ ] All three pages are live and linked from every page
- [ ] The lawyer's review date is recorded
- [ ] The disclaimer component is used on the preview and report pages

## Open questions
- Which law and company name go on the terms? This depends on how the company is registered.
