# web/18 — Verified-history badge for dealer listings

Status: planned · Phase: expand · Depends on: web/10, web/15

## Goal
A dealer can show a "verified history" badge on their own car listings (website, Facebook, PakWheels ad text) that links to a genuine summary, which the product doc lists as part of the dealer plan.

## Decisions
- **The badge links to the report's verification page** (web/10), not the full report, so a buyer sees a trusted summary and the dealer's paid report isn't given away.
- **Badges only for dealers on an active plan,** and only for cars they've checked within the last 90 days.
- **Three formats:** a link with a short code (works anywhere, including WhatsApp), an image badge, and an HTML embed for dealers with websites.
- **Each badge view is counted,** so we can show dealers the badge is being seen and use it as a sales argument.

## Scope
**In:**
- "Get badge" button on each report in the dealer dashboard
- Badge image (light and dark), a short link, and an embed snippet
- Verification page shows "Checked by <dealer name> on <date>"
- Badge view counter in the dealer dashboard

**Out (later items):**
- Partnerships with listing sites (a business decision, not a web plan)

## Steps
1. Add a badge record (report, dealer, created, expires).
2. Generate the badge image and short link.
3. Add dealer name and date to the verification page for badge links.
4. Show view counts in the dashboard.

## Files and folders touched
- `apps/web/src/app/[locale]/dealer/badges/*`, `apps/web/src/app/verify/[code]/*`, `apps/web/src/app/badge/[code]/*`

## Done when
- [ ] A badge link opens the right verification summary
- [ ] Expired or cancelled-plan badges show "no longer verified"
- [ ] The embed works on a plain HTML page

## Open questions
- Would PakWheels allow badge links in its ads? Check its listing rules before promising this to dealers.
