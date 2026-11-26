# setup/03 — Local development environment

Status: done (Nov 27, 2026) · Phase: pre-pilot · Depends on: setup/01

## Goal
A new developer clones the repo and runs one command to get Postgres, Redis, file storage and every app running locally, with no outside accounts needed.

## Decisions
- **Docker Compose for services:** PostgreSQL 16.16, Redis 7.4.7, and **SeaweedFS 4.53** standing in for Cloudflare R2 (both use the S3 API). Image versions are pinned.
- **SeaweedFS, not MinIO.** MinIO stopped publishing Docker images in 2025; `minio/minio`, `quay.io/minio/minio` and `bitnami/minio` can no longer be pulled. SeaweedFS is mature, actively released and supports signed URLs. LocalStack now needs an account, and S3Mock is only a test mock.
- **Buckets are created by a one-off `s3-init` container** in a Compose profile, run by `pnpm services:up` after the services are healthy. Inside `up --wait` it fails randomly, because `--wait` treats a finished container as an error.
- **One root `.env.example` for now** (database, Redis, S3, provider switches). Each app adds its own `.env.example` in its skeleton plan; `pnpm env:init` copies every one it finds.
- **Fake providers locally.** OTPs, WhatsApp messages and SMS are printed to the console instead of sent; payments use provider sandboxes or a fake. So nothing waits on setup/02 approvals.
- **One `.env.example` per app,** listing every variable with a safe local value. Real values are never committed (setup/07).
- **`pnpm dev`** starts Compose (if not already up) and then all apps through Turborepo.

## Scope
**In:**
- `infra/docker-compose.yml` with Postgres, Redis and SeaweedFS (with named volumes and health checks)
- Bucket creation on start (`photos`, `reports`), private
- `.env.example` files and a copy script (`pnpm env:init`)
- Root scripts: `dev`, `services:up`, `services:down`, `services:reset`, `services:check`, `services:logs`
- A `MESSAGING_PROVIDER=console` switch that later plans honour

**Out (later items):**
- Database schema and seed data (db/01, db/02)
- Staging and production (setup/08, setup/09)

## Steps
1. Write the Compose file with the three services and health checks.
2. Add an init step that creates the buckets.
3. Add `.env.example` files and `pnpm env:init`.
4. Add the root scripts and wire `dev` through Turborepo.
5. Document the steps in the root README, including how to reset data.

## Files and folders touched
- `infra/docker-compose.yml`, `infra/seaweedfs/s3.json`, `.env.example`, `scripts/env-init.mjs`, `scripts/check-services.mjs`, root `package.json`, `README.md`

## Done when
- [x] On a fresh machine with Docker and Node, `pnpm install && pnpm env:init && pnpm dev` brings everything up
- [x] `psql` and `redis-cli` connect with the values from `.env.example`
- [x] A file can be uploaded to S3 storage through a signed URL from a test script (`pnpm services:check`), and the bucket refuses unsigned reads
- [x] `pnpm services:reset` gives a clean database

## Open questions
- None

## Notes
- **Ports used:** 5432 (Postgres), 6379 (Redis), 8333 (S3). Stop any local Postgres or Redis first, or change the ports in the Compose file.
- **Phones on the same Wi-Fi** reach these through the computer's LAN IP, not `localhost`. That's set up in garage-app/01.
