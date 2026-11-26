# api/03 — Phone OTP login and tokens

Status: planned · Phase: pre-pilot · Depends on: api/01, db: core tables

## Goal
Garage staff, buyers, dealers and car owners sign in with their phone number and a 6-digit code, and get tokens that keep them signed in safely.

## Decisions
- **Add `asUser(role)` to the test harness** (moved here from api/02): signs in a factory user through the real OTP flow (the console messaging provider exposes the code to tests) and returns an authenticated Supertest agent.
- **Endpoints from the tech doc:** `POST /auth/otp/request`, `POST /auth/otp/verify`, `POST /auth/refresh`, plus `POST /auth/logout`.
- **An `audience` field:** `garage` (mobile app) or `web` (public site). The admin audience is added later by admin/04; this item leaves room for it but doesn't build it.
- **Phones normalised to +92 format** before anything else, by one function in `packages/shared`.
- **OTP rules from the tech doc:** 6 digits, expires in 5 minutes, max 5 tries. Codes are kept hashed in Redis, never in plain text.
- **Delivery:** WhatsApp template first, SMS fallback. The API calls the messaging service directly because the user is waiting.
- **Tokens:** access JWT 15 minutes; refresh token 30 days, **rotated on every use** and stored hashed. If an old refresh token is reused, the whole session family is revoked (a sign of theft).
- **Where tokens go:** the mobile app gets both in the response body (stored in expo-secure-store); the web gets the refresh token in an httpOnly cookie.
- **New phone = new user** on first verify, with the role implied by the audience (`garage` → no garage yet; see api/05).

## Scope
**In:**
- `auth` module: OTP request/verify, refresh, logout
- DB: `refresh_tokens` (user, family, token hash, expires, revoked) — add to db: core tables
- `MessagingService` with WhatsApp and SMS providers behind one interface (a log-only provider in development)
- Basic OTP limits: max 3 requests per phone per 15 minutes (general rate limiting is api/14)

**Out (later items):**
- Admin audience and second factor (admin/04, admin/05), role guards (api/04)

## Steps
1. Phone normalisation helper with tests (03xx, +92, 92, spaces, dashes).
2. OTP service: generate, hash, store in Redis with TTL, verify with attempt counter.
3. `MessagingService` interface + dev logger provider + WhatsApp/SMS providers (real keys once the business accounts from setup are approved).
4. Token service: sign access JWT, create/rotate/revoke refresh tokens.
5. Controllers, Zod schemas, and e2e tests (expiry, 6th try blocked, refresh reuse revokes family).

## Files and folders touched
- `apps/api/src/modules/auth/*`, `apps/api/src/modules/messaging/*`, `packages/shared/src/phone.ts`, `packages/db` (refresh_tokens)

## Done when
- [ ] A new phone can request a code, verify it and call a protected test route
- [ ] Expired codes and the 6th wrong try are refused
- [ ] Reusing an old refresh token signs out every device in that session family
- [ ] Logs and the database never contain a plain OTP

## Open questions
- SMS provider choice for Pakistan (local gateway vs international); decide in the setup business-accounts plan.
