# api/01 — NestJS skeleton

Status: planned · Phase: pre-pilot · Depends on: setup/01, db: Drizzle setup

## Goal
An API that starts, connects to Postgres through Drizzle, validates input with the shared Zod schemas and publishes its OpenAPI spec, so every later module only adds routes.

## Decisions
- **NestJS + TypeScript** in `apps/api`, everything under `/v1`.
- **Drizzle through one custom provider** (`DbModule` exporting a `DB` token). NestJS has no official Drizzle module, and one provider keeps it to a single place.
- **Zod for validation**, not class-validator: one `ZodValidationPipe` using schemas from `packages/shared`, so the apps and the API validate the same way.
- **OpenAPI generated from the Zod schemas** (e.g. nestjs-zod or zod-to-openapi) and written to `openapi.json` at build time. `packages/api-client` is generated from this file (admin/03).
- **One error format** for every failure: `{ error: { code, message, details? } }`, with stable `code` strings the apps can translate into Urdu.
- **Structured JSON logs** (pino) with a request ID, and **Sentry** for errors. Phone numbers and OTPs are never logged.

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
1. Scaffold the NestJS app and extend `tsconfig.base.json`.
2. Config module with a Zod env schema; fail fast on missing values.
3. `DbModule` with a pooled `pg` connection and the Drizzle instance; a `RedisModule` for BullMQ and rate limits.
4. Validation pipe, exception filter, error codes enum in `packages/shared`.
5. Logger with request ID; Sentry init.
6. Health endpoint.
7. OpenAPI generation script; Turborepo task that `packages/api-client` depends on.
8. Dockerfile (multi-stage, non-root user).

## Files and folders touched
- `apps/api/*`, `packages/shared/src/errors.ts`

## Done when
- [ ] `pnpm --filter api dev` starts and `GET /v1/health` reports DB and Redis as up
- [ ] An invalid request body returns 400 in the standard error format
- [ ] `openapi.json` is generated on build and the API client builds from it
- [ ] A thrown error appears in Sentry with the request ID; no phone numbers in logs

## Open questions
- Hosting region decides the DB latency; confirm in the setup deployment plan.
