# admin/05 — Second factor (authenticator app)

Status: planned · Phase: pre-pilot · Depends on: admin/04

## Goal
Admin login needs an authenticator-app code as well as the phone OTP, so a stolen SIM or WhatsApp account isn't enough to get in. The tech doc requires this.

## Decisions
- **TOTP** (Google Authenticator, Microsoft Authenticator and similar), with no paid service.
- **Must be set up on first login.** No access until it's set up.
- **10 one-time recovery codes,** shown once and stored hashed.
- **The TOTP secret is encrypted** in the database with a key from the secret store.
- **A super admin can reset another member's second factor.** The reset is audited.

## Scope
**In:**
- DB: `users.totp_secret_enc`, `users.totp_enabled_at`; a table `admin_recovery_codes` (user_id, code_hash, used_at)
- API: `POST /auth/2fa/setup` (returns a QR code), `POST /auth/2fa/verify`, `POST /auth/2fa/recovery`, `POST /admin/users/:id/2fa/reset`
- UI: setup screen with QR code and confirm, code entry at login, and a "use a recovery code" link
- Tokens are only issued after both factors pass

**Out (later items):**
- Team management screen (admin/14). This item only adds the reset endpoint.

## Steps
1. The new columns and table come from db/02.
2. TOTP service using a well-known library (e.g. otplib), with ±1 step clock tolerance.
3. Change the login flow so OTP verify returns a short "2FA pending" ticket instead of full tokens.
4. Build the setup, verify and recovery screens.
5. Write an audit log entry for every reset.

## Files and folders touched
- `packages/db` (migration), `apps/api/src/modules/auth/*`, `apps/admin/src/pages/login/*`

## Done when
- [ ] A new admin can't reach any page before setting up the second factor
- [ ] A wrong authenticator code is refused, and a correct one signs in
- [ ] Each recovery code works once only
- [ ] A reset appears in `audit_logs`

## Open questions
- None
