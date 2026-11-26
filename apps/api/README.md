# @carfax/api

The NestJS REST API, under `/v1`. Only the API touches the database.

| Command                           | What it does                                                             |
| --------------------------------- | ------------------------------------------------------------------------ |
| `pnpm dev` (repo root)            | Starts local services, migrates, then runs the API with reload on change |
| `pnpm --filter @carfax/api build` | Bundles to `dist/` and writes `openapi.json`                             |
| `pnpm --filter @carfax/api start` | Runs the built API                                                       |

Locally: `http://localhost:3000/v1/health`, and interactive docs at `http://localhost:3000/docs` (never in production).

## Rules for every module

- **Database:** inject it with `@InjectDb()`. The API connects as `carfax_app` (db/06) and refuses to start as a table owner.
- **Every query on garage data goes through `withGarage` or `withSystem`** from `@carfax/db` (db/07). Without one, row-level security returns no rows.
- **Validation:** request bodies, queries and params use Zod DTOs (`createZodDto`) from shared schemas. Invalid input becomes `VALIDATION_FAILED`.
- **Errors:** throw `AppError(code, status, message, details?)` with a code from `ERROR_CODES` (`@carfax/shared`). Every error leaves as `{ error: { code, message, details?, requestId } }`; unexpected ones become a generic 500 and go to Sentry.
- **Never log personal data.** Bodies aren't logged; sensitive query values, auth headers and any Pakistani phone number in a log line or error report are scrubbed. Don't add body logging.

## Tests

`pnpm --filter @carfax/api test` (needs `pnpm services:up`). Each test file calls `startTestApp()` from `test/harness.ts`: the real app on its own throwaway database (as `carfax_app`) and its own Redis key prefix, with logs captured in memory. Data comes from `test/factories.ts`.

Every endpoint gets at least a success test, a permission test (wrong role or garage) and a validation test. **`test/privacy.test.ts` must pass:** no public response may contain a phone number or a customer's name. Add explicit cases there for new routes with parameters.

## How it's built

NestJS needs decorator metadata, which esbuild can't produce, and the `@carfax/*` packages are TypeScript source. So tsup bundles the API with SWC and compiles the workspace packages into `dist/main.js`; other dependencies stay in `node_modules`.
