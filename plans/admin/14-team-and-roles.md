# admin/14 — Team members and roles

Status: planned · Phase: pilot · Depends on: admin/05, admin/06

## Goal
A super admin can add, change and remove team members from the panel, instead of running a seed script.

## Decisions
- **Super admin only.**
- **Add by phone number and role.** The new member signs in with OTP and must set up the second factor on first login.
- **Deactivate, don't delete,** so their past actions in the audit log still show who they were.
- **There must always be at least one active super admin.** The API refuses to remove or downgrade the last one.

## Scope
**In:**
- API: `GET /admin/team`, `POST /admin/team` (phone, name, role), `PATCH /admin/team/:id` (role, active), plus the 2FA reset from admin/05
- UI: team list (name, phone, role, last login, 2FA set up yes/no), add dialog, change role, deactivate, reset 2FA
- All changes audited

**Out (later items):**
- None

## Steps
1. `users.last_login_at` comes from db/02; update it at login.
2. Team endpoints with the last-super-admin check.
3. Team page and dialogs.

## Files and folders touched
- `packages/db` (migration), `apps/api/src/modules/admin/team/*`, `apps/admin/src/pages/team/*`

## Done when
- [ ] A new ops member can be added and can sign in
- [ ] A deactivated member is signed out within 15 minutes (the access token's lifetime) and can't sign in again
- [ ] The last super admin can't be removed or downgraded

## Open questions
- None
