# Carfax for Pakistan

Workshops log every job in a free app; buyers check a car's service history by its number plate before they buy.

- Product and technical docs: [docs/](docs/)
- Build plans, one item at a time: [plans/](plans/README.md)

## Layout

```
apps/
  garage-app/   React Native + Expo app for workshops (Android first)
  web/          Next.js public site: search, reports, dealers, owners
  admin/        React + Vite admin panel
  api/          NestJS REST API
packages/       Shared code: db (Drizzle), shared (Zod, types), api-client, i18n, ui
workers/        BullMQ background jobs: flags, photos, messages, report PDFs
infra/          Docker and deployment files
docs/           Product and technical documentation
plans/          Build plans
```

The apps and packages are added one plan at a time, so some folders are still empty.

## Requirements

- Node.js 24 (`nvm use` reads `.nvmrc`)
- pnpm, through Corepack: `corepack enable pnpm`

## Commands

Run these from the repo root. Turborepo runs each one in every app and package that has it.

| Command          | What it does                                           |
| ---------------- | ------------------------------------------------------ |
| `pnpm install`   | Install all dependencies                               |
| `pnpm dev`       | Start everything in development mode                   |
| `pnpm build`     | Build all apps and packages                            |
| `pnpm lint`      | Lint all code                                          |
| `pnpm typecheck` | Type-check all code                                    |
| `pnpm test`      | Run all tests                                          |
| `pnpm format`    | Format code with Prettier (`format:check` only checks) |

## Conventions

- TypeScript in strict mode everywhere. Each package extends `tsconfig.base.json`.
- Each package's `eslint.config.mjs` extends the root `eslint.config.mjs`.
- Secrets never go in git. Only `.env.example` files are committed.
