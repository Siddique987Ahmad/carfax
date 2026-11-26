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
- Docker with Compose v2 or later

## First run

```sh
pnpm install
pnpm env:init   # copies every .env.example to .env (never overwrites)
pnpm dev        # starts the local services, then every app
```

## Local services

`infra/docker-compose.yml` runs everything the apps need, with no outside accounts:

| Service    | Port | Stands in for          | Local login                            |
| ---------- | ---- | ---------------------- | -------------------------------------- |
| PostgreSQL | 5432 | Managed Postgres       | `carfax` / `carfax`, database `carfax` |
| Redis      | 6379 | Upstash Redis          | none                                   |
| SeaweedFS  | 8333 | Cloudflare R2 (S3 API) | `carfax` / `carfax-local-secret`       |

Private buckets `photos` and `reports` are created on start. OTPs, WhatsApp and SMS messages are printed to the terminal (`MESSAGING_PROVIDER=console`), and payments are faked (`PAYMENTS_PROVIDER=fake`).

| Command               | What it does                                         |
| --------------------- | ---------------------------------------------------- |
| `pnpm services:up`    | Start the services and create the buckets            |
| `pnpm services:down`  | Stop the services (data is kept)                     |
| `pnpm services:reset` | Delete all local data and start fresh                |
| `pnpm services:check` | Test a signed upload and download, like the app does |
| `pnpm services:logs`  | Follow the service logs                              |

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
