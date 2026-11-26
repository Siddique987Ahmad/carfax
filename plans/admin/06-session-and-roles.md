# admin/06 — Session, route guards and roles

Status: planned · Phase: pre-pilot · Depends on: admin/05

## Goal
A signed-in admin stays signed in safely, and each role sees only the screens and buttons it's allowed to use.

## Decisions
- **From api/04:** the API side is built. `@AdminPermission('…')` checks `ADMIN_PERMISSIONS` against the user's platform roles, read fresh from the database on every request, so a role removed in admin/14 applies at once. This item only adds the admin panel's guards and the `can()` hook.
- **Tokens as in the tech doc:** an access token (15 minutes) kept in memory only, and a refresh token (30 days, shortened to **12 hours for admin**) in an httpOnly, Secure cookie.
- **Same site for cookies.** Put the API and admin on the same parent domain (`api.<domain>.pk`, `admin.<domain>.pk`) so the cookie can be `SameSite=Lax`. Avoid cross-site cookies.
- **Role names:** the `user_roles` table (db/02) holds `admin`, `ops` and `support`, and one person can hold more than one role. In the UI, `admin` is shown as "Super admin."
- **One permission map** in `packages/shared` (e.g. `garages.approve: ['admin','ops']`), used by both the API guards and the UI. The UI hides what a role can't do; the API still refuses it.

| Permission | Super admin | Ops | Support |
|---|---|---|---|
| View garages, jobs, cars | ✓ | ✓ | ✓ |
| Approve/suspend garages, review jobs | ✓ | ✓ | — |
| Correct/merge cars | ✓ | ✓ | — |
| Disputes | ✓ | ✓ | ✓ |
| Refunds, dealer credits | ✓ | — | — |
| Team and audit log | ✓ | — | — |

## Scope
**In:**
- Silent refresh on app load and when a request gets a 401, logout, and a "session expired" screen
- `RequireAuth` and `RequirePermission` route guards; menu items filtered by permission
- `can(permission)` hook for hiding buttons
- The permission map in shared code, used by NestJS guards

**Out (later items):**
- Managing team members (admin/14)

## Steps
1. Set up the refresh cookie for the admin audience on the API.
2. Build an auth context: load the session, refresh it, log out.
3. Add the permission map and the `can()` helper to `packages/shared`.
4. Add the route guards and filter the navigation.
5. Make the NestJS role guard read the same map.

## Files and folders touched
- `packages/shared/src/permissions.ts`, `apps/api/src/modules/auth/*`, `apps/admin/src/auth/*`

## Done when
- [ ] Reloading the page keeps the user signed in; logout clears the session everywhere
- [ ] A support user can't see or open super-admin pages, and the API returns 403 if they try
- [ ] An expired session redirects to login and returns to the same page afterwards

## Open questions
- Confirm the domain plan (also asked in admin/01).
