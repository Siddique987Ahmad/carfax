# web/12 — Performance on low-end phones

Status: planned · Phase: pilot · Depends on: web/09

## Goal
The landing page, preview and report load quickly on a cheap Android phone over a weak mobile connection, which is how many buyers will open them, often from a WhatsApp link.

## Decisions
- **Budgets, checked in CI:**
  - Under 100 KB of JavaScript (compressed) on the landing and preview pages
  - Under 150 KB on the report page
  - Largest content shown in under 2.5 seconds on a throttled slow-4G, low-end phone profile
- **Server components by default,** with client JavaScript only for the search box, login dialog and share button.
- **Fonts:** system fonts for English; the Urdu font only on `/ur` (web/02), subset to the characters used.
- **No heavy libraries** for charts, dates or icons. Use plain SVG, native `Intl` and inline icons.

## Scope
**In:**
- Lighthouse CI (or similar) on every pull request, failing when a budget is broken
- Bundle size report per route
- Image settings (sizes, modern formats) for the landing page and sample report
- A test run on a real low-end Android phone on mobile data

**Out (later items):**
- None

## Steps
1. Add the budget checks to CI.
2. Measure the current pages and fix anything over budget.
3. Test on a real low-end phone; write down the device and results in this plan.

## Files and folders touched
- `apps/web/lighthouserc.*`, CI workflow, any page over budget

## Done when
- [ ] CI fails a pull request that breaks a budget
- [ ] All three key pages are within budget
- [ ] A real-phone test result is recorded

## Open questions
- Which phone to test on? Proposed: the cheapest Android model commonly sold in Pakistan at the time.
