# api/02 — Test setup and strategy

Status: done (Nov 27, 2026) · Phase: pre-pilot · Depends on: api/01

## Goal
Every later API item ships with tests that run against a real Postgres, so sync, payments and privacy rules can't break silently.

## Decisions
- **From api/01:** reuse `createApp()` (`apps/api/src/app.ts`) to boot the app in tests, and `createTestDatabase()` from `@carfax/db` for a throwaway migrated database with an app-user connection. Add the validation and 500-error checks that api/01 did by hand (a test-only controller is fine). Run tests through Turborepo, whose `globalPassThroughEnv` must list any new variable they need.
- **Vitest + Supertest.** Vitest is fast and works with ESM; Supertest calls the real NestJS app over HTTP.
- **End-to-end tests against a real Postgres** in Docker, not mocks. Most of the risk in this API is in SQL (sync, merges, row-level security).
- **Each test file gets a clean database:** migrations run once per test run, tables are truncated between files.
- **Factories** for users, garages, cars and jobs, so tests are short and readable.
- **Rule for every later item:** each endpoint has at least one success test, one permission test (wrong role or wrong garage gets 403/404) and one validation test.
- **A privacy test** that checks no report or public response ever contains a customer name or phone. It runs on every pull request.
- **Built with these changes:**
  - **No separate test Compose file, and no truncating:** each test file gets its own throwaway, migrated database from `createTestDatabase()` (now exported as `@carfax/db/testing`), connected as `carfax_app` like production, plus its own Redis key prefix (new `REDIS_KEY_PREFIX` setting). Tests use the normal local services (`pnpm services:up`), and CI's service containers.
  - **`startTestApp()`** (`test/harness.ts`) boots the real app with `createApp()`, optional test-only modules and an in-memory log. Vitest uses SWC (`unplugin-swc`) for NestJS decorator metadata.
  - **`asUser(role)` with real tokens moves to api/03,** since tokens don't exist yet. Factories for users, garages, cars, customers and jobs are in `test/factories.ts`.
  - **The privacy test** calls every parameter-free GET route in the OpenAPI document with seeded customer data and fails on any Pakistani phone number (any spelling) or customer name. A deliberately leaky route proves the check catches both. Routes allowed to show customers must be listed with a reason; routes with parameters get explicit cases as they're built.
  - **Permanent tests for api/01's manual checks:** health (and 503 when Redis is unreachable), the error format for validation, unknown routes, `AppError` and crashes, request ids (kept when safe, replaced when not), and no phone numbers or bodies in the logs.
- **Found and fixed while building:**
  - **Nest's own log lines were lost in tests:** with `bufferLogs`, they're only flushed on `listen()`, and tests call `init()`. `createApp()` now flushes right after attaching the logger.
  - **The API's Redis client had no error listener,** so an outage printed an unhandled error per retry. It now logs "connection lost" once and "connection back".
  - **The db package's tests timed out under parallel load** (CI runs all packages at once); its Vitest timeouts now match the API's (20 s per test, 30 s per hook).
  - **nestjs-pino keeps one root logger per process:** a file that starts several apps logs everything into the first app's `logs`. Documented in the harness; log assertions live in single-app files.

## Scope
**In:**
- Vitest config, test Postgres and Redis via `docker compose`
- Test helpers: app bootstrap, sign-in as a given user/role, factories
- CI command `pnpm --filter api test:e2e`
- Example tests for `/health` and the error format

**Out (later items):**
- CI pipeline itself (the setup CI plan runs this command)

## Steps
1. Add Vitest and Supertest with SWC for NestJS decorators.
2. `docker-compose.test.yml` with Postgres 16 and Redis.
3. Global setup: run drizzle-kit migrations; per-file truncate.
4. Factories and an `asUser(role)` helper that issues real tokens.
5. Write the example tests and the privacy test skeleton.

## Files and folders touched
- `apps/api/test/*`, `apps/api/vitest.config.ts`, `docker-compose.test.yml`

## Done when
- [x] `pnpm --filter api test:e2e` passes from a fresh clone with only Docker installed (and Node; the services from `pnpm services:up`)
- [x] Tests can run in parallel files without clashing (separate databases and Redis prefixes, tested; CI simulation with all packages in parallel passed twice)
- [x] The privacy test exists and fails if a customer phone is added to a public response (proven with a leaky test route)

## Open questions
- None
