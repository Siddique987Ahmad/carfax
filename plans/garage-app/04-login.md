# garage-app/04 — Login with phone OTP

Status: planned · Phase: pre-pilot · Depends on: garage-app/03, api: OTP login

## Goal
Owners and mechanics sign in with their phone number and a one-time code, and stay signed in for weeks, even while offline.

## Decisions
- **From api/03:** handle `OTP_INVALID` (show `details.attemptsLeft`), `OTP_EXPIRED`/`OTP_LOCKED` (offer a new code) and `RATE_LIMITED` (`details.retryAfterSeconds`). **Send one refresh at a time:** queue other requests while a refresh is in flight. The server forgives one retry within 60 seconds of a lost response, but parallel refreshes with the same token look like theft and sign the device out.
- **Phone + 6-digit OTP,** WhatsApp first with SMS fallback, as in the tech doc.
- **Tokens in `expo-secure-store`,** never in plain storage.
- **Offline use never needs a valid token.** The app keeps working with an expired access token and refreshes it once online. Only syncing needs the server.
- **If the session is revoked** (e.g. a mechanic is removed), unsynced jobs are **not** wiped. The app asks for login again and syncs afterwards. If a different person logs in, unsynced jobs from the previous user are uploaded first.
- **Autofill the code** from SMS where Android allows it.

## Scope
**In:**
- Phone screen (+92 prefix, format check) → code screen with resend timer
- Token storage, refresh on reconnect, logout
- Session state that tells the app who the user is, their garage and role
- "Waiting for approval" state for a garage not yet approved by the team

**Out (later items):**
- Owner vs mechanic permissions (14)

## Steps
1. Build the two login screens with the UI kit.
2. Store tokens in secure storage; add a refresh helper.
3. Load the session on app start, offline-safe.
4. Handle revoked sessions without deleting local data.
5. Show the garage approval status.

## Files and folders touched
- `apps/garage-app/app/(auth)/*`, `apps/garage-app/src/auth/*`

## Done when
- [ ] A user can sign in and is still signed in after closing the app and a week offline
- [ ] Logging in again after a revoked session keeps and syncs unsynced jobs
- [ ] Tokens are only in secure storage

## Open questions
- None
