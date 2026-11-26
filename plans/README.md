# Plans

Build plans for Carfax for Pakistan: **109 plans in 7 folders**. Every plan is already written, but we **build one at a time**: agree on it, build it, check its "Done when" list, mark it `done`, then take the next one.

Source docs: [Product](../docs/Carfax%20for%20Pakistan%20—%20Product%20Documentation.docx) · [Technical](../docs/Carfax%20for%20Pakistan%20—%20Technical%20Documentation.docx)

## How it works

1. Take the next plan in the build order below. Within a step, follow the folder's own README order and each plan's "Depends on" line.
2. Re-read the plan and answer its open questions before starting. Update the plan if anything changed.
3. Set it to `in progress` in its folder README, build it, and tick every "Done when" line.
4. Set it to `done`. Plans can be reordered, split or added at any time with [_template.md](_template.md).

Statuses: `planned` → `in progress` → `done`.

## Folders

| Folder | Plans | Covers | Code lives in |
|---|---|---|---|
| [setup/](setup/README.md) | 11 | Monorepo, local dev, CI, accounts, environments, monitoring, cost | repo root, `infra/` |
| [db/](db/README.md) | 12 | PostgreSQL schema with Drizzle ORM + drizzle-kit, row-level security, seeds, backups | `packages/db` |
| [api/](api/README.md) | 20 | NestJS REST API (everything except `/admin/*`) | `apps/api` |
| [workers/](workers/README.md) | 8 | BullMQ jobs: flags, photos, WhatsApp/SMS, reminders, report build and PDF | `workers/` |
| [garage-app/](garage-app/README.md) | 20 | React Native + Expo app for workshops, offline-first | `apps/garage-app` |
| [admin/](admin/README.md) | 20 | React + Vite admin panel, including its `/admin/*` API endpoints | `apps/admin` |
| [web/](web/README.md) | 18 | Next.js public site: search, reports, checkout, dealers, owners | `apps/web` |

## Build order

### Pre-pilot (weeks 1–8): garages can log jobs, and ops can review them
| Step | Plans | Notes |
|---|---|---|
| 1 | [setup/02](setup/02-business-accounts.md) | **Start in week 1.** WhatsApp, payment and Play Store approvals take weeks |
| 2 | [setup/01](setup/01-monorepo.md), [03](setup/03-local-dev.md)–[07](setup/07-secrets.md) | Monorepo, local Postgres + Redis, shared packages, CI, domain, secrets |
| 3 | [db/01–08](db/README.md) | Drizzle, all pilot tables, row-level security, seed data |
| 4 | [api/01–13](api/README.md) | Skeleton, tests, login, guards, garages, cars, uploads, sync, jobs, bills, reminders |
| 5 | [workers/01–04](workers/README.md) | Queues, flag checks, photo processing, messaging |
| 6 | [garage-app/01–17](garage-app/README.md) | The workshop app, up to pilot release and onboarding |
| 7 | [admin/01–10](admin/README.md) | Login with second factor, garage approval, flagged-job review |
| 8 | [setup/08](setup/08-staging.md)–[10](setup/10-monitoring.md) | Staging by week 8; production and monitoring by week 9 |

**Gate 2 (product doc):** 5 garages log jobs daily.

### Pilot (weeks 9–16+): grow garages, test free reports
| Step | Plans | Notes |
|---|---|---|
| 9 | [garage-app/18–20](garage-app/README.md), [workers/05](workers/05-reminders.md), [api/14](api/14-rate-limits-abuse.md) | Speed target, customers, reminders, rate limits |
| 10 | [admin/11–16](admin/README.md), [db/09](db/09-ops-tables.md) | Cars, corrections, merges, team, trust score, metrics dashboard |
| 11 | [db/11](db/11-report-orders-and-payments.md), [api/15–17](api/README.md), [workers/06–07](workers/README.md) | Search log, report orders, report builder and PDF. Reports are free |
| 12 | [web/01–12](web/README.md) | Public site, search, preview, buyer login, report page and PDF |
| 13 | [db/10](db/10-backups-and-performance.md), [workers/08](workers/08-retention-cleanup.md), [setup/11](setup/11-cost-tracking.md) | Backup restore test, data clean-up, cost tracking |

**Gate 3 (product doc):** searches find a history (30%+) before charging in a city.

### Reports launch: charge for reports, dealers, owners
| Step | Plans | Notes |
|---|---|---|
| 14 | [db/12](db/12-dealers-and-disputes.md), [api/18–20](api/README.md) | Payments, dealer credits, owner claims and disputes |
| 15 | [web/13–17](web/README.md) | Checkout, my reports, dealer dashboard, owner claim and disputes |
| 16 | [admin/17–20](admin/README.md) | Orders and refunds, dealer accounts, disputes, audit log viewer |

### Expand (year 2)
| Step | Plans | Notes |
|---|---|---|
| 17 | [web/18](web/18-dealer-verified-badge.md) | Verified-history badge for dealer listings |

## Decisions that differ from the tech doc

- **ORM:** Drizzle ORM + drizzle-kit, not Prisma. The database is still PostgreSQL. (Nov 26, 2026)
- **Roles:** a `user_roles` table replaces the single `users.role` column, so one person can hold several roles (db/02).
- **Cars created offline:** the phone creates the car ID. On sync, a duplicate plate or chassis maps to the existing car through `car_aliases` (db/04, api/06).
- **Reports:** free while a city is below its coverage gate. Free or paid per city is set in one config file, `report-pricing.ts` (api/16), not in a database table, until there are several cities.
- **Owner claims:** approved automatically when the owner's phone matches a garage's customer record or the full chassis number matches. There are no document uploads or manual review in the MVP (api/20, web/16).
- **Free preview:** shows a range of record counts, not the exact number, to limit scraping (web/07).
- **Bills and reminders in the pilot:** one tap from the garage's own WhatsApp (`wa.me` link), free and needing no Meta approval. Automatic sending through the WhatsApp Cloud API is built but switched on per garage only after Meta approves the account. The Cloud API (or SMS) is used from day one only for login OTPs. (Nov 26, 2026)
- **Styling:** Tailwind CSS everywhere: the public site and admin panel directly, the garage app through NativeWind. One shared theme lives in `packages/tailwind-config` (setup/04). (Nov 27, 2026)
- **Local file storage:** SeaweedFS stands in for Cloudflare R2 in development, because MinIO no longer publishes Docker images (setup/03).
- **Work types:** oil change, **tuning**, brakes, denting/painting, engine, suspension, AC, electrical, other. Tuning was added to the product doc's list. (Nov 26, 2026)
