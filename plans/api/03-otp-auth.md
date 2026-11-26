# api/03 — Phone OTP login and tokens

Status: done (Nov 27, 2026) · Phase: pre-pilot · Depends on: api/01, db: core tables

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
- **Built with these decisions:**
  - **Codes are stored as an HMAC keyed with `OTP_SECRET`,** not a plain hash: a 6-digit code has only a million possibilities, so a plain hash could be reversed instantly by anyone who saw Redis.
  - **Verify is race-proof:** a Redis script counts the attempt and reads the hash in one step (the 6th attempt deletes the code), and a code is single-use: of two simultaneous correct verifies, only the one that deletes the code signs in (tested with three at once).
  - **Error codes the apps can act on:** `OTP_INVALID` (with `details.attemptsLeft`), `OTP_EXPIRED` (expired, used, or never requested) and `OTP_LOCKED`. A code is bound to its audience: a garage-app code doesn't work on the website. A new request replaces the previous code.
  - **Refresh retry grace (60 s):** on bad networks a refresh response can be lost and the app retries with the old token. Within 60 seconds, if the replacement was never used, the server cancels it and rotates again instead of signing everyone out. Any other reuse, including the cancelled replacement showing up later, revokes the whole family.
  - **Access tokens carry roles and garage memberships,** read fresh at every sign-in and refresh, so changes apply within 15 minutes (answers db/02's open question; api/04 uses them).
  - **The website's refresh cookie** is `carfax_refresh`: httpOnly, SameSite=Lax, path `/v1/auth`, Secure in production.
  - **`GET /v1/auth/me`** returns the signed-in user, behind `AuthGuard` (the protected route; api/04 adds role and garage checks).
  - **Disabled accounts** are refused at sign-in and at refresh (the family is revoked).
  - **WhatsApp and SMS delivery wait for workers/04** (`packages/messaging`, after setup/02's accounts). The API has a `MessageSender` interface with a `console` provider (local: prints the code to the terminal, never through the logger) and a `memory` provider (tests). Production refuses both, so a deploy can't silently send no codes.
  - **The database guarantees no plain refresh token is stored:** `refresh_tokens.token_hash` must be 64 hex characters (CHECK).
  - **The phone helper** was already built in db/02 (`normalisePakistanMobile`, `PakistanMobileSchema`), so no `phone.ts`.
  - **Test helper `asUser(phone, audience)`** signs in through the real flow and returns an authenticated Supertest agent; `lastCode(phone)` reads the memory provider.

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
- `apps/api/src/auth/*`, `apps/api/src/messaging/messaging.module.ts`, `apps/api/src/config.ts`, `apps/api/test/{auth,config}.test.ts`, `apps/api/test/harness.ts`
- `packages/db/src/schema/auth.ts`, `packages/db/migrations/0010_refresh_tokens.sql`, `packages/shared/src/errors.ts` (OTP codes)
- `.env.example`, `turbo.json`, `.github/workflows/ci.yml` (`JWT_SECRET`, `OTP_SECRET`, `MESSAGING_PROVIDER`)

## Done when
- [x] A new phone can request a code, verify it and call a protected test route (`GET /v1/auth/me`; also checked by hand locally with the console provider)
- [x] Expired codes and the 6th wrong try are refused (the 6th is refused even with the right code)
- [x] Reusing an old refresh token signs out every device in that session family
- [x] Logs and the database never contain a plain OTP (nor a plain refresh token)

## Open questions
- SMS provider choice for Pakistan (local gateway vs international); decide in the setup business-accounts plan.
