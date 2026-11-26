# web/03 — Landing page and SEO basics

Status: planned · Phase: pilot · Depends on: web/02

## Goal
A buyer who lands on the site understands in a few seconds what a history report is and why to check a car before buying, and the page can be found on Google.

## Decisions
- **The search box is the first thing on the page.** The landing page exists to get a plate number typed.
- **Lead with the buyer's fear:** rolled-back mileage and hidden accident repairs, the two problems from the product doc.
- **Be honest about coverage.** Say which city is covered and that records come from partner workshops, so a "no records" result doesn't feel like a trick.
- **Rendered on the server, with real text** (not images), so search engines and slow phones both get the content at once.

## Scope
**In:**
- Landing page: search box, what's in a report (with a sample report image), how it works in 3 steps, covered cities, FAQ, links for garages and dealers
- A sample report page (fictional car) that people can open without searching
- Metadata per page (title, description, Open Graph image for WhatsApp sharing), `sitemap.xml`, `robots.txt`
- Structured data for the FAQ

**Out (later items):**
- Search behaviour (web/06), garage sign-up page (web/05)

## Steps
1. Write the copy in English and Urdu (keep it short).
2. Build the sections as server components.
3. Add the sample report page using the report layout from web/09 (static data until then).
4. Add metadata, the Open Graph image, sitemap, robots and FAQ structured data.

## Files and folders touched
- `apps/web/src/app/[locale]/page.tsx`, `apps/web/src/app/[locale]/sample-report/*`, `apps/web/src/app/sitemap.ts`, `apps/web/src/app/robots.ts`

## Done when
- [ ] A link shared on WhatsApp shows the right title, text and image
- [ ] Lighthouse SEO score is 90+ on the landing page
- [ ] The landing page passes the performance budget in web/12

## Open questions
- Should we also target searches like "auction sheet verification"? That's a different product, so ranking for it could disappoint visitors.
