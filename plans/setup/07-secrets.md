# setup/07 — Secrets management

Status: planned · Phase: pre-pilot · Depends on: setup/03

## Goal
Every key and password has one known place, never sits in the repo, and can be changed quickly when someone leaves or a key leaks.

## Decisions
- **Database secrets (db/06):** `DATABASE_URL` (app user `carfax_app`), `MIGRATION_DATABASE_URL` (table owner, only for the migration step) and `APP_DB_PASSWORD`. The app's runtime must never receive `MIGRATION_DATABASE_URL`.
- **Runtime secrets live in each host's secret store** (API/worker host, Vercel, Cloudflare), separately for staging and production, as the tech doc says.
- **Deploy secrets live in GitHub Actions secrets,** scoped to the staging and production environments.
- **Team logins** (Meta, payment portals, Play Console, hosting) live in a shared password manager (Bitwarden or 1Password), never in chat.
- **Each app checks its environment at startup** with a Zod schema and refuses to start if a variable is missing.
- **An inventory of secret names** (no values) lists where each is stored, who owns it and how to rotate it.

## Scope
**In:**
- `infra/secrets.md`: the inventory
- Env validation in each app (added as each app is created; this item adds the shared helper)
- Password manager set up with a shared vault
- Secret scanning in CI (e.g. gitleaks) so an accidental commit is caught

**Out (later items):**
- Specific keys: the TOTP encryption key (admin/05), payment keys (api/18)

## Steps
1. Create the password manager vault and move existing logins into it.
2. Write the inventory.
3. Add the shared `loadEnv(schema)` helper to `packages/shared`.
4. Add gitleaks to CI.
5. Write the rotation checklist for when a team member leaves.

## Files and folders touched
- `infra/secrets.md`, `packages/shared/src/env.ts`, `.github/workflows/ci.yml`

## Done when
- [ ] A commit containing a fake key fails CI
- [ ] An app started with a missing variable stops with a clear error
- [ ] The inventory lists every secret used in staging

## Open questions
- None
