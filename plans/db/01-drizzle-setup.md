# db/01 — Drizzle setup, migrations and client

Status: planned · Phase: pre-pilot · Depends on: setup/01 (monorepo), setup/03 (local Postgres and Redis)

## Goal
`packages/db` exists with Drizzle ORM and drizzle-kit, a safe migration workflow, and one database client that the API and workers import. Every later db plan only adds tables.

## Decisions
- **PostgreSQL 16 + Drizzle ORM + drizzle-kit**, replacing Prisma from the tech doc.
- **Migrations are SQL files** made by `drizzle-kit generate`, reviewed in the pull request and committed. CI and deploys run `drizzle-kit migrate`. **`drizzle-kit push` is for local experiments only** and is never used against staging or production.
- **Driver:** `node-postgres` (`pg`) with a pool. It works with NestJS, workers and any managed Postgres.
- **Schema split by area:** `src/schema/users.ts`, `garages.ts`, `cars.ts`, `jobs.ts` and so on, re-exported from `src/schema/index.ts`.
- **Naming:** `snake_case` in the database, `camelCase` in TypeScript, using Drizzle's `casing: 'snake_case'` option.
- **Zod from the tables:** every table file also exports insert and select Zod schemas made with drizzle-zod. `packages/shared` re-exports them, so apps and API validate with the same rules. Request-only schemas (forms, filters) stay hand-written in `packages/shared`.
- **One `DATABASE_URL`** per environment. The migration user and the app user are different users (see db/06).

## Scope
**In:**
- `packages/db` package: `drizzle.config.ts`, `src/client.ts` (`createDb(url)` returning the Drizzle instance and pool), `src/schema/index.ts`
- Scripts: `db:generate`, `db:migrate`, `db:push` (local only), `db:studio`, `db:check`
- A first empty migration, to prove the pipeline
- drizzle-zod set up, with one example schema exported through `packages/shared`
- A NestJS provider example in the README (`DB` injection token), used later in api/01

**Out (later items):**
- Tables (db/02 onward), database users and permissions (db/06), seed data (db/08)

## Steps
1. Create `packages/db` with `drizzle-orm`, `pg`, `drizzle-kit` and `drizzle-zod`.
2. Write `drizzle.config.ts` (dialect postgresql, schema folder, `migrations/` output, snake_case).
3. Write `createDb()` and export the schema and the inferred types.
4. Add the scripts and wire `db:migrate` into the Turborepo pipeline for the API's `dev`.
5. Make the first migration and run it on the local Postgres from setup/03.
6. Add a `db:check` step for CI that fails if the schema changed without a new migration file.

## Files and folders touched
- `packages/db/*` (`drizzle.config.ts`, `src/client.ts`, `src/schema/index.ts`, `migrations/`)
- `packages/shared/src/db-schemas.ts`

## Done when
- [ ] `pnpm db:migrate` runs on a fresh local database
- [ ] Changing a table without generating a migration fails `db:check`
- [ ] The API and workers can import `createDb` and the schema types
- [ ] A Zod schema made from a table is usable from `packages/shared`

## Open questions
- None
