# setup/01 — Monorepo skeleton

Status: done (Nov 26, 2026) · Phase: pre-pilot · Depends on: none

## Goal
An empty but working monorepo, so every later item has a place to put its code and the same lint, type-check and build commands to run.

## Decisions
- **Repo root is this folder** (`carfax/`), next to `docs/` and `plans/`, so plans, docs and code are versioned together.
- **pnpm workspaces + Turborepo**, as the tech doc specifies. Turborepo caches builds and runs tasks across all apps from one command.
- **Node 24 LTS**, pinned in `.nvmrc` and `package.json` `engines`.
- **TypeScript in strict mode** everywhere, from one shared base config.
- **ESLint + Prettier**, because they are the most familiar to developers hired locally.
- **Versions pinned exactly** (no `^`): pnpm 12.23.0 (through Corepack), Turborepo 2.11.13, ESLint 10.15.0 with typescript-eslint 8.74.0, Prettier 3.10.1.
- **TypeScript 6.0.3, not 7.** TypeScript 7 (the native compiler) is out, but typescript-eslint 8.74 supports only TypeScript up to 6.0. Move to 7 when typescript-eslint, Expo and NestJS support it.
- **`eslint.config.mjs`** (not `.js`), so the root needs no `"type": "module"`. Root `pnpm lint` also lints this config file, so it's checked even before any app exists.
- **Prettier skips `docs/` and `plans/`**, so it never rewrites the plans' formatting.
- **Folders only for now.** Each app and package gets scaffolded in its own item (db/01, api/01, garage-app/01, and so on), so this item creates no framework code.

## Scope
**In:**
- `git init`, `.gitignore`, `.editorconfig`, `.nvmrc`
- Root `package.json`, `pnpm-workspace.yaml`, `turbo.json`
- `tsconfig.base.json`, shared ESLint and Prettier config
- Empty `apps/`, `packages/`, `workers/` and `infra/` folders, each with a placeholder `.gitkeep`
- Root scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `format`

**Out (later items):**
- Any app or framework install (Expo, Next.js, NestJS, Vite)
- Drizzle and Postgres (db/01)
- Local Postgres and Redis (setup/03), CI (setup/05), deployment (setup/08)

## Steps
1. `git init` and create a `main` branch.
2. Add `.gitignore` (node_modules, build output, `.env*` except `.env.example`, Expo and Next caches, LibreOffice `.~lock.*` files), `.editorconfig` and `.nvmrc`.
3. Create the root `package.json` (private, `packageManager` set to pnpm, `engines.node` set to 24) and `pnpm-workspace.yaml` listing `apps/*`, `packages/*` and `workers`.
4. Add Turborepo with `turbo.json` pipelines for `build`, `dev` (not cached), `lint`, `typecheck` and `test`.
5. Add `tsconfig.base.json` (strict, `moduleResolution: bundler`, `target ES2022`), which every package will extend.
6. Add a shared ESLint flat config and a Prettier config at the root.
7. Create the empty folders: `apps/`, `packages/`, `workers/`, `infra/`.
8. Add a short root `README.md` that explains the layout and the commands, and points to `plans/` and `docs/`.
9. Run `pnpm install`, `pnpm lint` and `pnpm typecheck`. They should pass with nothing to check yet.
10. Make the first commit.

## Files and folders touched
- `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`
- `eslint.config.mjs`, `.prettierrc`, `.prettierignore`, `.editorconfig`, `.gitignore`, `.nvmrc`
- `apps/`, `packages/`, `workers/`, `infra/`
- `README.md`

## Done when
- [x] `pnpm install` runs cleanly on a fresh clone
- [x] `pnpm lint`, `pnpm typecheck` and `pnpm build` all succeed
- [x] The folder layout matches the tech doc's project structure
- [x] `.env` files cannot be committed by accident
- [x] First commit is on `main`

## Open questions
- GitHub repo name and owner (personal or organisation account)? Needed before setup/05 (CI). The repo is local only for now.
- ~~Lint/format tool~~: ESLint + Prettier, as proposed.
