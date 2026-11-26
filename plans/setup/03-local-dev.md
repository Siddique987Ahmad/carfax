# setup/03 — Local development environment

Status: planned · Phase: pre-pilot · Depends on: setup/01

## Goal
A new developer clones the repo and runs one command to get Postgres, Redis, file storage and every app running locally, with no outside accounts needed.

## Decisions
- **Docker Compose for services:** PostgreSQL 16, Redis 7, and MinIO standing in for Cloudflare R2 (both use the S3 API).
- **Fake providers locally.** OTPs, WhatsApp messages and SMS are printed to the console instead of sent; payments use provider sandboxes or a fake. So nothing waits on setup/02 approvals.
- **One `.env.example` per app,** listing every variable with a safe local value. Real values are never committed (setup/07).
- **`pnpm dev`** starts Compose (if not already up) and then all apps through Turborepo.

## Scope
**In:**
- `infra/docker-compose.yml` with Postgres, Redis and MinIO (with named volumes and health checks)
- Bucket creation for MinIO on start (`photos`, `reports`)
- `.env.example` files and a copy script (`pnpm env:init`)
- Root scripts: `dev`, `services:up`, `services:down`, `services:reset`
- A `MESSAGING_PROVIDER=console` switch that later plans honour

**Out (later items):**
- Database schema and seed data (db/01, db/02)
- Staging and production (setup/08, setup/09)

## Steps
1. Write the Compose file with the three services and health checks.
2. Add a MinIO init step that creates the buckets.
3. Add `.env.example` files and `pnpm env:init`.
4. Add the root scripts and wire `dev` through Turborepo.
5. Document the steps in the root README, including how to reset data.

## Files and folders touched
- `infra/docker-compose.yml`, `.env.example` files, root `package.json`, `README.md`

## Done when
- [ ] On a fresh machine with Docker and Node, `pnpm install && pnpm env:init && pnpm dev` brings everything up
- [ ] `psql` and `redis-cli` connect with the values from `.env.example`
- [ ] A file can be uploaded to MinIO through a signed URL from a test script
- [ ] `pnpm services:reset` gives a clean database

## Open questions
- None
