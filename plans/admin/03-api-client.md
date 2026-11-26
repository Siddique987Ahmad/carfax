# admin/03 — Typed API client and data layer

Status: planned · Phase: pre-pilot · Depends on: admin/01, api/01

## Goal
The admin app calls the API through a typed client, so a wrong field name or type fails at build time instead of in front of the ops team.

## Decisions
- **Client generated from the API's OpenAPI spec** into `packages/api-client`, as the tech doc specifies, and shared with the web app later.
- **TanStack Query** for every request: caching, retries and refetching.
- **One error format.** Every API error shows as a toast with the message. A 401 sends the user to login (wired up in admin/06).
- **Forms use React Hook Form + the shared Zod schemas** from `packages/shared`, so admin forms and the API validate the same way.

## Scope
**In:**
- Generation script for `packages/api-client`, run in the build pipeline
- Query client setup, a fetch wrapper that adds the access token, and error mapping
- Form helper with a Zod resolver
- A health-check call shown on the placeholder home page

**Out (later items):**
- Tokens and refresh (admin/04, admin/06)

## Steps
1. Add a generator (e.g. openapi-typescript + openapi-fetch) to `packages/api-client`.
2. Add a `generate` task to Turborepo that depends on the API's spec output.
3. Create `queryClient` and an `apiFetch` wrapper in admin.
4. Add the toast-based error handler.
5. Call `GET /v1/health` on the home page to prove the connection.

## Files and folders touched
- `packages/api-client/*`, `apps/admin/src/lib/api.ts`, `apps/admin/src/lib/query.ts`

## Done when
- [ ] Changing an API response type breaks the admin type-check until the admin code is fixed
- [ ] The home page shows the API health status
- [ ] A failing API call shows a readable toast

## Open questions
- None
