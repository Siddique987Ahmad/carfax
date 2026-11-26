# web/05 — Garage sign-up page

Status: planned · Phase: pilot · Depends on: web/02

## Goal
A workshop owner who hears about the app (from another garage, a market association or a WhatsApp forward) can apply to join in under a minute, and the ops team sees the application.

## Decisions
- **Lead with money, not data,** as the product doc says: reminders that bring customers back, a professional bill on WhatsApp, free forever.
- **The form is short:** owner name, phone, garage name, city, area/market, type of work. Everything else is collected in person when the team installs the app.
- **The application creates a `pending` garage,** which shows up in the admin garages list (admin/07).
- **Urdu first on this page.** Most garage owners will read it in Urdu, so the Urdu version is the main one and English is the translation.

## Scope
**In:**
- `/garages` page: benefits, short video or screenshots of the app, testimonial from a pilot garage when we have one
- Sign-up form with phone verification by OTP (stops fake applications)
- Play Store link to the garage app
- Thank-you screen saying the team will call within a set time

**Out (later items):**
- Approval flow (admin/08), in-app onboarding (garage-app plans)

## Steps
1. Write the page copy (Urdu first).
2. Build the form using the shared Zod schema for a garage application.
3. Call the API's garage application endpoint (api: garages topic), with OTP verification.
4. Add the Play Store link and the thank-you screen.

## Files and folders touched
- `apps/web/src/app/[locale]/garages/*`, `packages/shared` (application schema)

## Done when
- [ ] An application appears in the admin list as `pending`
- [ ] The same phone can't apply twice
- [ ] The page works well on a cheap Android phone over a slow connection

## Open questions
- Should the page show which garages already use the app (a trust signal)? Only if those garages agree.
