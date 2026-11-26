# db/01 — Drizzle setup, migrations and client

Status: done (Nov 27, 2026) · Phase: pre-pilot · Depends on: setup/01 (monorepo), setup/03 (local Postgres and Redis)

## Goal
`packages/db` exists with Drizzle ORM and drizzle-kit, a safe migration workflow, and one database client that the API and workers import. Every later db plan only adds tables.

## Decisions
- **PostgreSQL 16 + Drizzle ORM + drizzle-kit**, replacing Prisma from the tech doc.
- **Migrations are SQL files** made by `drizzle-kit generate`, reviewed in the pull request and committed. CI and deploys run `drizzle-kit migrate`. **`drizzle-kit push` is for local experiments only** and is never used against staging or production.
- **Driver:** `node-postgres` (`pg`) with a pool. It works with NestJS, workers and any managed Postgres.
- **Schema split by area:** `src/schema/users.ts`, `garages.ts`, `cars.ts`, `jobs.ts` and so on, re-exported from `src/schema/index.ts`.
- **Naming:** `snake_case` in the database, `camelCase` in TypeScript, using Drizzle's `casing: 'snake_case'` option.
- **Zod from the tables:** every table file also exports insert and select Zod schemas made with drizzle-zod, collected in **`@carfax/db/zod`**. *Changed while building:* they are **not** re-exported through `packages/shared`. That would make `shared` depend on `db` (and the Postgres driver), pull the driver into the garage app, and create a cycle once `db` imports work types from `shared`. The direction is one-way: `db` may import `shared`, never the reverse. `@carfax/db/zod` doesn't load the driver, so the admin panel can use it. Request-only schemas (forms, filters) stay hand-written in `packages/shared`.
- **Versions:** the stable Drizzle line: drizzle-orm 0.45.4, drizzle-kit 0.31.11, drizzle-zod 0.8.3, pg 8.23.1. Drizzle 1.0 is still a release candidate; moving to it later changes the migrations folder layout and replaces drizzle-zod with `drizzle-orm/zod`.
- **`db:check` runs `drizzle-kit check` and then `drizzle-kit generate` into a scratch copy of `migrations/`**, so it never changes the repo. Any new file means a schema change without its migration. CI runs it on every pull request.
- **pnpm runs install scripts only for allowed packages** (`allowBuilds` in `pnpm-workspace.yaml`). esbuild is allowed, because drizzle-kit needs it.
- **One `DATABASE_URL`** per environment. The migration user and the app user are different users (see db/06).

## Scope
**In:**
- `packages/db` package: `drizzle.config.ts`, `src/client.ts` (`createDb(url)` returning the Drizzle instance and pool), `src/schema/index.ts`
- Scripts: `db:generate`, `db:migrate`, `db:push` (local only), `db:studio`, `db:check`
- A first empty migration, to prove the pipeline
- drizzle-zod set up, exported from `@carfax/db/zod` (not `packages/shared`, see Decisions)
- A NestJS provider example in the README (`DB` injection token), used later in api/01

**Out (later items):**
- Tables (db/02 onward), database users and permissions (db/06), seed data (db/08)

## Steps
1. Create `packages/db` with `drizzle-orm`, `pg`, `drizzle-kit` and `drizzle-zod`.
2. Write `drizzle.config.ts` (dialect postgresql, schema folder, `migrations/` output, snake_case).
3. Write `createDb()` and export the schema and the inferred types.
4. Add the scripts (also at the root: `pnpm db:generate`, `db:migrate`, `db:studio`, `db:check`). Running migrations before the API's `dev` moved to api/01, since the API doesn't exist yet.
5. Make the first migration and run it on the local Postgres from setup/03.
6. Add a `db:check` step for CI that fails if the schema changed without a new migration file.

## Files and folders touched
- `packages/db/*` (`drizzle.config.ts`, `src/client.ts`, `src/schema/index.ts`, `src/zod.ts`, `scripts/check-migrations.mjs`, `migrations/`, `README.md` with the NestJS example)
- Root `package.json`, `pnpm-workspace.yaml`, `.gitignore`, `.prettierignore`, `.github/workflows/ci.yml`

## Done when
- [x] `pnpm db:migrate` runs on a fresh local database (also tested on every test run: a throwaway database is migrated from empty, twice)
- [x] Changing a table without generating a migration fails `db:check` (names the missing files, leaves nothing behind)
- [x] The API and workers can import `createDb` and the schema types (checked with a throwaway package)
- [x] A Zod schema made from a table is usable, from `@carfax/db/zod` instead of `packages/shared` (see Decisions). Tested with a test-only table; the first real schemas come in db/02.

## Open questions
- None
