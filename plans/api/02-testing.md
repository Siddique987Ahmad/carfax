# api/02 — Test setup and strategy

Status: planned · Phase: pre-pilot · Depends on: api/01

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
- [ ] `pnpm --filter api test:e2e` passes from a fresh clone with only Docker installed
- [ ] Tests can run in parallel files without clashing
- [ ] The privacy test exists and fails if a customer phone is added to a public response

## Open questions
- None
