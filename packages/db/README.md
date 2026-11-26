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
4. Commit the schema change and the migration together. CI runs `pnpm db:check`, which fails if a schema change has no migration.

`pnpm db:push` applies the schema directly without a migration. Use it only for quick local experiments, never on staging or production. `pnpm db:studio` opens a browser view of the local database.

All commands run from the repo root and read `DATABASE_URL` from `.env` (`pnpm env:init`). The local database comes from `pnpm services:up`.

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
