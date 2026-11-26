# setup/08 — Staging environment and deploy

Status: planned · Phase: pre-pilot (by week 8) · Depends on: setup/05, setup/06, setup/07

## Goal
Every merge to `main` deploys automatically to a staging copy of the whole system, so features are tested on real hosting before pilot garages use them.

## Decisions
- **Photo storage (from api/07):** a private R2 bucket per environment (`S3_BUCKET_PHOTOS`), no public access. The mobile app needs no CORS (native uploads); add CORS only if a web page ever uploads directly. Set `S3_ENDPOINT` to the account's R2 endpoint, `S3_REGION=auto`, `S3_FORCE_PATH_STYLE=false`.
- **Hosting as in the tech doc:**
  - API and workers: Render, Railway or DigitalOcean (Docker)
  - Postgres: managed Postgres with backups
  - Redis: Upstash
  - Public site: Vercel
  - Admin panel: Cloudflare Pages
  - Files: Cloudflare R2
- **API, workers and Postgres in the same provider and region,** as close to Pakistan as possible (Mumbai or Singapore), because every sync and every page goes through them.
- **Migrations run as a step before the new API version starts.** If a migration fails, the deploy stops and the old version keeps running.
- **No real customer data in staging.** It uses seed data only.
- **API and workers are built from one Docker image** with different start commands.

## Scope
**In:**
- `Dockerfile` for API and workers
- Staging services, database, Redis and R2 buckets (`staging-photos`, `staging-reports`, private)
- `.github/workflows/deploy-staging.yml`: on merge to `main`, build, run migrations, deploy API, workers, web and admin
- Staging garage app build pointing at the staging API (EAS channel `staging`)

**Out (later items):**
- Production (setup/09), monitoring (setup/10)

## Steps
1. Compare the three hosts on region, price and managed Postgres; pick one and record why.
2. Write the Dockerfile; check that the image starts locally.
3. Create the staging services and set their secrets.
4. Write the deploy workflow with the migration step.
5. Connect Vercel and Cloudflare Pages to the repo for staging.
6. Seed staging and run a full job sync from a staging app build.

## Files and folders touched
- `infra/Dockerfile`, `.github/workflows/deploy-staging.yml`, `infra/hosting.md`

## Done when
- [ ] A merge to `main` is live on staging within 15 minutes without manual steps
- [ ] A broken migration stops the deploy and leaves staging working
- [ ] A phone with the staging app can log a job that appears in the staging admin panel

## Open questions
- Which host? Decide in week 1 so setup/02 and this item can use it. Record the choice in `infra/hosting.md`.
