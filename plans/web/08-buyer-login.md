# web/08 — Buyer login by phone OTP

Status: planned · Phase: pilot · Depends on: web/07, api/03

## Goal
A buyer signs in with their phone number only when they open a report, so we know whose report it is, and can follow up to ask whether they'd pay.

## Decisions
- **Login is asked for at the moment of opening a report,** never to search. Every step before that stays open.
- **Same OTP endpoints as the apps** (api/03), with `audience: "web"`. The first successful login creates a `buyer` user.
- **Tokens:** the access token is held in memory, and the refresh token is in an httpOnly, Secure, `SameSite=Lax` cookie on the shared parent domain (same plan as admin/06).
- **One login for every role.** If the phone belongs to a dealer or a car owner, the same login opens their pages too (web/15, web/16).
- **Ask for a name only if needed.** The phone number is enough to deliver a report.

## Scope
**In:**
- Login dialog (phone → code) that opens from the preview page and returns to it
- Session handling in Next.js: reading the session on the server for private pages, silent refresh, logout
- Account menu in the header (My reports, logout)

**Out (later items):**
- Dealer and owner pages (web/15, web/16)

## Steps
1. Build the login dialog with the shared form helper and OTP endpoints.
2. Add server-side session reading for private routes.
3. Add silent refresh and logout.
4. Return the user to the page they came from after login.

## Files and folders touched
- `apps/web/src/auth/*`, `apps/web/src/components/LoginDialog.tsx`, `apps/web/src/middleware.ts`

## Done when
- [ ] A buyer can log in from the preview page and comes back to the same car
- [ ] Reloading keeps the session; logout ends it
- [ ] OTP limits from the tech doc apply (5-minute expiry, 5 tries)

## Open questions
- Should the report also be sent to the buyer's WhatsApp after login (needs workers/04)? Proposed: yes, once WhatsApp is live.
