# setup/09 — Production environment and release process

Status: planned · Phase: pre-pilot (by week 9) · Depends on: setup/08

## Goal
Production exists before the pilot, since pilot garages log real jobs, and there is a safe, repeatable way to release and roll back.

## Decisions
- **Production mirrors staging** (same host, region and services), with its own database, Redis, buckets and secrets.
- **Release by tag,** as in the tech doc: pushing a tag `vX.Y.Z` promotes the exact image already tested on staging.
- **Migrations are forward-only and backward-compatible.** Add the new thing, switch the code to it, then remove the old thing in a later release. Rolling back code then never needs a database rollback.
- **Rollback = redeploy the previous tag.**
- **Backups:** daily, kept 30 days, with a restore test every month (tech doc).
- **Garage app releases:**
  - JavaScript-only fixes go out through EAS Update on the `production` channel.
  - Native changes go through a Play Store build.
  - The API refuses app versions older than a minimum supported version, which forces an update when sync changes.

## Scope
**In:**
- Production services and secrets
- `.github/workflows/release.yml` triggered by tags
- Release checklist and rollback steps in `infra/releasing.md`
- Minimum app version header check (shared with garage-app/16 and the API skeleton, api/01)
- First monthly restore test, done and written up

**Out (later items):**
- Monitoring and alerts (setup/10)

## Steps
1. Create the production services, matching staging.
2. Write the release workflow (promote image, run migrations, deploy).
3. Write the release and rollback checklist; practise a rollback on staging.
4. Turn on backups; restore one into a temporary database and check row counts.
5. Set up EAS `production` channel and a Play Store internal testing track.

## Files and folders touched
- `.github/workflows/release.yml`, `infra/releasing.md`

## Done when
- [ ] A tag releases to production with no manual steps besides creating it
- [ ] A rollback to the previous tag works in under 10 minutes
- [ ] A backup was restored successfully and the result recorded
- [ ] An old garage app version gets a clear "please update" message

## Open questions
- Who can create release tags? Proposed: the two developers, with the other reviewing.
