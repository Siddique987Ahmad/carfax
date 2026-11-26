# admin/01 — Vite skeleton

Status: planned · Phase: pre-pilot · Depends on: setup/01

## Goal
An empty admin app that runs locally and builds for production, with the UI kit and routing ready, so every later admin item only adds screens.

## Decisions
- **React + Vite + TypeScript**, as in the tech doc.
- **React Router** for routes: the most familiar option for new hires.
- **Tailwind CSS + shadcn/ui** for components. The components are copied into the repo, so we own them and can change them.
- **English only.** The admin panel is internal, so it doesn't need the Urdu that the garage app has.
- **Mobile-first.** Every screen must work at phone width, because the tech doc drops the separate admin mobile app.

## Scope
**In:**
- `apps/admin` created with Vite's React + TS template, extending `tsconfig.base.json`
- Tailwind and shadcn/ui set up, with a few base components (button, input, card, dialog, toast)
- Routes: `/login` and `/` (placeholder)
- Environment config: `VITE_API_URL`, with `.env.example`
- `dev`, `build`, `lint` and `typecheck` scripts wired into Turborepo

**Out (later items):**
- Layout and navigation (admin/02), API calls (admin/03), login (admin/04)

## Steps
1. Scaffold `apps/admin` with Vite (React + TS).
2. Add Tailwind and run the shadcn/ui init. Add the base components.
3. Add React Router with the two placeholder routes.
4. Read `VITE_API_URL` through one typed `config.ts`, and fail fast if it is missing.
5. Hook the scripts into the root Turborepo pipeline.

## Files and folders touched
- `apps/admin/*`

## Done when
- [ ] `pnpm --filter admin dev` serves the app, and `pnpm build` produces `dist/`
- [ ] Root `pnpm lint` and `pnpm typecheck` include the admin app and pass
- [ ] The placeholder page looks right at 360px wide and at desktop width

## Open questions
- Admin domain, e.g. `admin.<domain>.pk`? This affects login cookies (see admin/06).
