# api — NestJS REST API

Code: `apps/api`. Stack: Node.js + NestJS, REST at `/v1`, OpenAPI docs, shared Zod validation, Drizzle through a custom NestJS provider. Only the API touches the database.

Each plan is a thin slice for one module: its endpoints, any database change it needs, and its tests. Build them one at a time, in this order. Statuses: `planned` → `in progress` → `done`.

**Not in these plans:** every `/admin/*` endpoint (owned by [../admin/](../admin/)), the background jobs themselves (owned by [../workers/](../workers/); the API only queues them), and the schema (owned by [../db/](../db/); plans below name the db topic they need).

## Pre-pilot (tech doc: weeks 3–8)
What the garage app needs for the pilot: sign-in, garages, cars, photos, sync, bills and reminders.

| # | Plan | Status |
|---|---|---|
| 01 | [NestJS skeleton](01-skeleton.md) | done |
| 02 | [Test setup and strategy](02-testing.md) | done |
| 03 | [Phone OTP login and tokens](03-otp-auth.md) | done |
| 04 | [Role guards and garage scoping](04-guards-and-scoping.md) | done |
| 05 | [Garage profile and staff](05-garage-profile-staff.md) | done |
| 06 | [Car lookup and offline-created cars](06-car-lookup.md) | done |
| 07 | [Signed photo uploads](07-signed-uploads.md) | done |
| 08 | [Sync push (offline jobs to server)](08-sync-push.md) | done |
| 09 | [Sync pull (server changes to phone)](09-sync-pull.md) | planned |
| 10 | [Garage jobs list and detail](10-garage-jobs.md) | planned |
| 11 | [Customers](11-customers.md) | planned |
| 12 | [Send the bill on WhatsApp](12-send-bill.md) | planned |
| 13 | [Service reminders](13-reminders.md) | planned |

## During the pilot
| # | Plan | Status |
|---|---|---|
| 14 | [Rate limits and abuse protection](14-rate-limits-abuse.md) | planned |
| 15 | [Public search and free preview](15-public-search.md) | planned |
| 16 | [Report orders and the free-until-coverage switch](16-report-orders.md) | planned |
| 17 | [Report delivery](17-report-fetch.md) | planned |

## Reports launch
Reports stay free in every city until its coverage gate is met (product doc, Gate 3). Payment code is built and tested in sandbox, and a per-city switch turns charging on (api/16).

| # | Plan | Status |
|---|---|---|
| 18 | [Payments: JazzCash, Easypaisa and card](18-payments.md) | planned |
| 19 | [Dealer credits](19-dealer-credits.md) | planned |
| 20 | [Owner claim and disputes](20-owner-claim-disputes.md) | planned |

## Database changes these plans add
Not in the tech doc's schema yet; fold them into the db/ plans when those are written.

- `refresh_tokens` table (03)
- `car_aliases` table (06)
- `job_photos`: `lat`, `lng`, `source` (07)
- `updated_at` triggers and `deleted_at` soft-delete columns on every synced table (09)
- `bill_tokens` and `bill_sends` tables (12)
- `search_logs` table (15)
- `car_claims` table (20)

## Changes from the tech doc
- **Public search preview** shows a record range ("3–5"), not an exact count, to make scraping less useful (15).
- **Owner claim** needs a phone match on a job or the full chassis number; plate plus OTP alone is not enough proof (20).
- **Submitted jobs can't be edited from the app**; fixes go through ops (08, 10).
- **Sync uses WatermelonDB's format**, so the app can use its built-in sync (08, 09).
