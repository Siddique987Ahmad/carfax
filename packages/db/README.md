# @carfax/db

PostgreSQL schema, migrations and the database client, using Drizzle ORM and drizzle-kit.

| Import              | What it gives you                                                  |
| ------------------- | ------------------------------------------------------------------ |
| `@carfax/db`        | `createDb(url)`, the `Db` type and all tables as `schema`          |
| `@carfax/db/schema` | The tables only                                                    |
| `@carfax/db/zod`    | Zod schemas made from the tables. Doesn't load the Postgres driver |

## Changing the schema

1. Edit or add a table in `src/schema/` (one file per area, re-exported from `src/schema/index.ts`). Write names in camelCase; they become snake_case in the database.
2. `pnpm db:generate` writes a new SQL file to `migrations/`. **Read it**: it's what will run on production.
3. `pnpm db:migrate` applies it to your local database.
   - drizzle-kit can't write extensions, functions or triggers. Add those by hand to the generated SQL file (see `0004_cars.sql`) or in a `--custom` migration (see `0003_updated_at_triggers.sql`).
   - **Every table with an `updated_at` column needs the `set_updated_at` trigger.** A test fails if one is missing.
4. Commit the schema change and the migration together. CI runs `pnpm db:check`, which fails if a schema change has no migration.

`pnpm db:push` applies the schema directly without a migration. Use it only for quick local experiments, never on staging or production. `pnpm db:studio` opens a browser view of the local database.

All commands run from the repo root and read `.env` (`pnpm env:init`). The local database comes from `pnpm services:up`.

## Two database users

| Variable                 | User                               | Used by                            | Can                                                                                                  |
| ------------------------ | ---------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `MIGRATION_DATABASE_URL` | the table owner (`carfax` locally) | `db:migrate`, `db:generate`, tests | everything                                                                                           |
| `DATABASE_URL`           | `carfax_app`                       | the API and workers                | read and write rows; add (not change) audit rows; not delete jobs, cars or plates; not change tables |

**Never point the app at the owner:** Postgres skips row-level security for a table's owner (db/07). The migrations create `carfax_app` without a password; `pnpm db:provision-app-user` lets it log in with `APP_DB_PASSWORD`. On a new environment: run `pnpm db:migrate`, then `pnpm db:provision-app-user`.

## Garage data is protected by row-level security (db/07)

`customers`, `jobs` (and their items, photos and flags), `reminders` and `garage_members` belong to one garage. Connected as `carfax_app`, **every query on them must run inside a scope helper**, or it sees no rows at all:

```ts
import { withGarage, withSystem } from '@carfax/db';

// Garage app requests: only this garage's rows, even if a query forgets its filter.
const myJobs = await withGarage(db, garageId, (tx) => tx.select().from(schema.jobs));

// Admin panel, workers, report building, login: every garage.
const all = await withSystem(db, (tx) => tx.select().from(schema.jobs));
```

Each helper runs one transaction and sets the scope only for it, so nothing leaks to the next request on a pooled connection. Shared tables (`users`, `garages`, `cars`, plates, `audit_logs`) have no row-level security: the API decides who sees them. A test fails if a new table with a `garage_id` or `job_id` column doesn't switch row-level security on.

## Using the client

Create one client at start-up and share it. Close the pool on shutdown.

```ts
import { createDb } from '@carfax/db';

const { db, pool } = createDb(process.env.DATABASE_URL!);
// ... db.select().from(schema.cars) ...
await pool.end();
```

### NestJS (api/01)

```ts
import { createDb, type Db } from '@carfax/db';
import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';

export const DB = Symbol('DB');
export const InjectDb = () => Inject(DB);

const { db, pool } = createDb(process.env.DATABASE_URL!);

@Global()
@Module({ providers: [{ provide: DB, useValue: db }], exports: [DB] })
export class DbModule implements OnApplicationShutdown {
  async onApplicationShutdown() {
    await pool.end();
  }
}

// In a service: constructor(@InjectDb() private readonly db: Db) {}
```

## Tests

`pnpm --filter @carfax/db test` creates a throwaway database, applies every migration from empty, checks they all ran, and drops it. It needs the local services running.
