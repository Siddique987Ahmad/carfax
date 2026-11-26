# admin/04 — Login with phone OTP

Status: planned · Phase: pre-pilot · Depends on: admin/03, api/03

## Goal
Team members sign in with their phone number and a one-time code, and nobody outside the team can get in.

## Decisions
- **Built on api/03:** add `admin` to the `auth_audience` enum (db migration) and to `AudienceSchema`; the OTP, token and refresh logic is reused as is. Note that today any user can sign in with the `garage` audience (e.g. the seeded `+923000000001` admin); the admin panel must use the `admin` audience, which is where the staff-only check goes.
- **Same OTP endpoints as the garage app** (`/auth/otp/request`, `/auth/otp/verify`), with an `audience: "admin"` flag.
- **Allowed accounts only.** For the admin audience, the API refuses phones that don't belong to an active user with role `admin`, `ops` or `support`. It returns the same response as for a wrong code, so outsiders can't learn which numbers are staff.
- **Seed the first super admin with a script.** There is no sign-up page for admins.

## Scope
**In:**
- API: admin audience check on OTP request and verify; a seed command for the first super admin
- DB: `users.is_active` boolean (default true)
- UI: phone screen → code screen, a resend timer, and error messages
- Rate limits as in the tech doc (code expires in 5 minutes, max 5 tries)

**Out (later items):**
- Second factor (admin/05), session storage and route guards (admin/06)

## Steps
1. `users.is_active` comes from db/02.
2. Add the admin audience check to the OTP service.
3. Add `pnpm --filter api seed:admin --phone=...`.
4. Build the two login screens with the shared form helper.
5. On success, continue to the second-factor step (a stub until admin/05).

## Files and folders touched
- `packages/db` (migration), `apps/api/src/modules/auth/*`, `apps/admin/src/pages/login/*`

## Done when
- [ ] The seeded admin can request and enter a code
- [ ] A non-staff phone gets the same response as a wrong code, and no code is sent
- [ ] The 6th wrong attempt is blocked

## Open questions
- Should admin OTPs go by SMS only (WhatsApp messages can show on linked devices)? Proposed: WhatsApp first, as in the tech doc, and decide after the pilot.
