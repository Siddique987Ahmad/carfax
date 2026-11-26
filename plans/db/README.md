# db — PostgreSQL with Drizzle

Code: `packages/db`. Stack: PostgreSQL 16, Drizzle ORM, drizzle-kit migrations (SQL files generated, reviewed and committed; `push` only for local experiments), drizzle-zod for Zod schemas from the tables, exported from `@carfax/db/zod` (not through `packages/shared`, see db/01).

Each plan adds one group of tables (or one safety feature) with its migration, Zod schemas and checks. Build them one at a time, in this order. Statuses: `planned` → `in progress` → `done`.

## Pre-pilot
| # | Plan | Status |
|---|---|---|
| 01 | [Drizzle setup, migrations and client](01-drizzle-setup.md) | done |
| 02 | [Users, roles and admin login data](02-users-and-roles.md) | done |
| 03 | [Garages, staff and customers](03-garages-members-customers.md) | done |
| 04 | [Cars](04-cars.md) | done |
| 04b | [Plate history](04b-plate-history.md) | done |
| 05 | [Jobs, work items, photos, flags and reminders](05-jobs-and-reminders.md) | done |
| 06 | [Audit log and database users](06-audit-log-and-db-users.md) | done |
| 07 | [Row-level security for garage data](07-row-level-security.md) | planned |
| 08 | [Seed data for development and demos](08-seed-data.md) | planned |

## During the pilot
| # | Plan | Status |
|---|---|---|
| 09 | [Spot-checks and daily metrics](09-ops-tables.md) | planned |
| 10 | [Backups, restore test and performance check](10-backups-and-performance.md) | planned |
| 11 | [Searches, report orders and payments](11-report-orders-and-payments.md) | planned (build `searches` early, with web/06 and api/15) |

## Reports launch
| # | Plan | Status |
|---|---|---|
| 12 | [Dealers, car owner claims and disputes](12-dealers-and-disputes.md) | planned |

## Changes from the tech doc's schema
- **Roles:** `users.role` is replaced by a `user_roles` table, so one person can hold several roles. Garage roles move to `garage_members` (db/02, db/03).
- **Cars:** the phone can create the car ID, plus a `car_aliases` table, so cars created offline sync cleanly. A car needs a plate or a chassis number (db/04).
- **Plates are a dated history** in `car_registrations`, not a column on `cars`, because Punjab plates follow their owner since Sept 2025. The chassis number is the car's real identity (db/04b).
- **Photos:** `lat`, `lng` and `gps_accuracy_m` on `job_photos`. `job_flags` gets `created_at` and `details` (db/05).
- **Sync:** synced tables get `updated_at` triggers and `deleted_at` soft deletes for sync pulls (db/03, db/04, db/05).
- **Audit log:** `audit_logs.note`, plus separate database users, so the app can't edit the audit log or skip row-level security (db/06).
- **New tables:** `searches`, `report_snapshot` on orders, and `payment_callbacks` (db/11). Login codes are in Redis, not a table (db/02, api/03).

## Where the admin plans' database changes live
| Change | Needed by | db plan |
|---|---|---|
| `users.is_active`, `totp_secret_enc`, `totp_enabled_at`, `last_login_at` | admin/04, 05, 14 | db/02 |
| `admin_recovery_codes` table | admin/05 | db/02 |
| `garages.status_reason`, `status_changed_at` | admin/08 | db/03 |
| `cars.merged_into_id`, trigram search indexes | admin/13, admin/11 | db/04 |
| `jobs.excluded_from_reports`, photo GPS columns | admin/15, admin/08 | db/05 |
| Revoke UPDATE/DELETE on `audit_logs` for the app user | admin/20 | db/06 |
| `garage_spot_checks`, `daily_metrics` | admin/15, admin/16 | db/09 |
| `payment_callbacks`, refund columns | admin/17 | db/11 |
| `dealer_credit_ledger`, `disputes` columns | admin/18, admin/19 | db/12 |
