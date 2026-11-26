# web/01 — Next.js skeleton and deploy

Status: planned · Phase: pilot · Depends on: setup/01, setup (CI and deployment plans)

## Goal
An empty public site that runs locally and deploys to staging and production on every merge, so later web items only add pages.

## Decisions
- **Next.js App Router + Tailwind CSS**, as in the tech doc. Pages are server components by default, so phones download as little JavaScript as possible.
- **Hosted on Vercel**, as in the tech doc, with server functions in the region nearest Pakistan (e.g. Mumbai).
- **Domains:** the site at `<domain>.pk`, the API at `api.<domain>.pk`. Same parent domain, so login cookies work without cross-site settings (same plan as admin/06).
- **Built after the pilot starts,** as the product doc and tech doc say: reports are worthless until garages log jobs.

## Scope
**In:**
- `apps/web` scaffolded with Next.js (App Router, TypeScript), extending `tsconfig.base.json`
- Tailwind set up, with a base layout (header, footer, content width)
- Typed config for `NEXT_PUBLIC_API_URL` and server-only secrets, with `.env.example`
- Uses the typed client from `packages/api-client` (admin/03)
- Vercel project: preview deploys for pull requests, staging from `main`, production from a tag
- Placeholder home page

**Out (later items):**
- Languages (web/02), real pages (web/03 onwards)

## Steps
1. Scaffold `apps/web` and hook `dev`, `build`, `lint` and `typecheck` into Turborepo.
2. Add Tailwind and the base layout.
3. Add config loading that fails the build if a required variable is missing.
4. Connect the Vercel project; set environments and the region.
5. Point the staging domain at the staging deploy.

## Files and folders touched
- `apps/web/*`, `infra/` (deploy notes)

## Done when
- [ ] `pnpm --filter web dev` runs, and `pnpm build` succeeds from the repo root
- [ ] A pull request gets its own preview URL
- [ ] Merging to `main` updates staging; a tag updates production

## Open questions
- Final brand and domain name (the product doc says the brand isn't decided).
