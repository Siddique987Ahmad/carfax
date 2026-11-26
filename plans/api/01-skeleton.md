# api/01 — NestJS skeleton

Status: done (Nov 27, 2026) · Phase: pre-pilot · Depends on: setup/01, db: Drizzle setup

## Goal
An API that starts, connects to Postgres through Drizzle, validates input with the shared Zod schemas and publishes its OpenAPI spec, so every later module only adds routes.

## Decisions
- **NestJS + TypeScript** in `apps/api`, everything under `/v1`.
- **Drizzle through one custom provider** (`DbModule` exporting a `DB` token). NestJS has no official Drizzle module, and one provider keeps it to a single place.
- **Zod for validation**, not class-validator: one `ZodValidationPipe` using schemas from `packages/shared`, so the apps and the API validate the same way.
- **OpenAPI generated from the Zod schemas** (e.g. nestjs-zod or zod-to-openapi) and written to `openapi.json` at build time. `packages/api-client` is generated from this file (admin/03).
- **One error format** for every failure: `{ error: { code, message, details? } }`, with stable `code` strings the apps can translate into Urdu.
- **Structured JSON logs** (pino) with a request ID, and **Sentry** for errors. Phone numbers and OTPs are never logged.
- **Built with these decisions and fixes:**
  - **NestJS 11, not 12.** NestJS 12 is out (Aug 2026), but nestjs-zod 5.6 supports only NestJS 11 and Swagger 11. Versions: NestJS 11.2.10, @nestjs/swagger 11.4.8, nestjs-zod 5.6.0, nestjs-pino 5.3.1, @sentry/nestjs 11.12.0, ioredis 6.0.0.
  - **Bundled with tsup + SWC into `dist/main.js` (CommonJS).** NestJS needs decorator metadata, which esbuild/tsx can't emit, and Node can't run the `@carfax/*` TypeScript source; tsup compiles them into the bundle (as setup/04 planned).
  - **The API refuses to start as a table owner** (it checks `current_user` at startup), and config refuses `DATABASE_URL` equal to `MIGRATION_DATABASE_URL`: the owner would bypass row-level security (db/06, db/07).
  - **Errors** include a `requestId`: `{ error: { code, message, details?, requestId } }`. Codes are `ERROR_CODES` in `@carfax/shared`. Validation details give path and reason only, never the submitted value.
  - **Phone numbers can't reach logs or Sentry:** bodies aren't logged; sensitive query values are scrubbed; and every log line and Sentry error message is passed through `redactPhoneNumbers()` (new in `@carfax/shared`). Found while testing: a thrown error's message carried a phone number into the log, as a Postgres duplicate-key error would.
  - **Sentry 11 collects bodies, headers, cookies, query and database values by default.** All switched off with `dataCollection`; checked against a local fake Sentry server: the event arrives with the `request_id` tag, no body, no token, phone redacted.
  - **openapi.json is generated in preview mode,** with no database, Redis or environment (found when the Docker build failed: the logger read the config too early). It's build output, not committed. A typed client was generated from it as a check.
  - **Swagger UI (`/docs`) only outside production;** health checks aren't logged.
  - **`pnpm dev` migrates first** (Turborepo: `@carfax/api#dev` depends on `@carfax/db#db:migrate`).
  - **Turborepo 2 runs tasks in strict environment mode,** so variables set in CI never reached the tests (found here; CI's database tests have most likely failed since db/01). `globalPassThroughEnv` in `turbo.json` now lists them. Proven with a CI simulation: fresh Postgres, no `.env`, fails without the fix and passes with it.
  - **pnpm install scripts:** `@swc/core` allowed (its binary); `@scarf/scarf` denied (install analytics pulled in by Swagger UI).
  - **Docker:** multi-stage, non-root `node` user, health check; 443 MB, mostly NestJS, Swagger UI and Sentry (worth slimming before production).

## Scope
**In:**
- `apps/api` app, config module (env read and checked with Zod at startup; `.env.example`)
- `DbModule`, `ZodValidationPipe`, global exception filter, request-ID middleware, pino logger, Sentry
- `GET /v1/health` (API up, DB reachable, Redis reachable)
- OpenAPI JSON + Swagger UI (Swagger UI disabled in production)
- `dev`, `build`, `lint`, `typecheck` wired into Turborepo; Dockerfile

**Out (later items):**
- Tests setup (api/02), auth (api/03), any business module

## Steps
0. Run `pnpm db:migrate` before the API starts in `dev` (moved here from db/01), and use the NestJS `DbModule` example in `packages/db/README.md`. Connect with `DATABASE_URL` (the app user, db/06), and run every query on garage data inside `withGarage` or `withSystem` (db/07); say so in the API README.
1. Scaffold the NestJS app and extend `tsconfig.base.json`.
2. Config module with a Zod env schema; fail fast on missing values.
3. `DbModule` with a pooled `pg` connection and the Drizzle instance; a `RedisModule` for BullMQ and rate limits.
4. Validation pipe, exception filter, error codes enum in `packages/shared`.
5. Logger with request ID; Sentry init.
6. Health endpoint.
7. OpenAPI generation script; Turborepo task that `packages/api-client` depends on.
8. Dockerfile (multi-stage, non-root user).

## Files and folders touched
- `apps/api/*` (src, `tsup.config.ts`, `Dockerfile`, `README.md`), `.dockerignore`
- `packages/shared/src/errors.ts`, `packages/shared/src/utils/identifiers.ts` (`redactPhoneNumbers`)
- `turbo.json` (passthrough env, migrate before dev), `pnpm-workspace.yaml`, `.env.example`, `.gitignore`

## Done when
- [x] `pnpm --filter api dev` starts and `GET /v1/health` reports DB and Redis as up (and 503 within 0.1 s when Redis is down; also checked from the Docker image)
- [x] An invalid request body returns 400 in the standard error format (checked with a temporary route, removed afterwards; api/02 adds permanent tests)
- [x] `openapi.json` is generated on build and the API client builds from it (generated with openapi-typescript as a check; the real `packages/api-client` is admin/03)
- [x] A thrown error appears in Sentry with the request ID; no phone numbers in logs (local fake Sentry server; log and event both scrubbed)

## Open questions
- Hosting region decides the DB latency; confirm in the setup deployment plan.
