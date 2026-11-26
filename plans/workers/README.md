# workers — background jobs

Code: `workers/`. Stack: BullMQ + Redis, the same Docker image as the API, Drizzle through `packages/db`. Messaging lives in `packages/messaging` (shared with the API for OTPs).

Each plan can be built and tested on its own. Build them one at a time, in this order. Statuses: `planned` → `in progress` → `done`.

## Pre-pilot
| # | Plan | Status |
|---|---|---|
| 01 | [Worker skeleton](01-skeleton.md) | planned |
| 02 | [Job flag checks](02-flag-checks.md) | planned |
| 03 | [Photo processing](03-photo-processing.md) | planned |
| 04 | [Messaging: WhatsApp, SMS and bills](04-messaging.md) | planned |

## During the pilot
| # | Plan | Status |
|---|---|---|
| 05 | [Service reminders and return tracking](05-reminders.md) | planned |
| 08 | [Data retention and clean-up](08-retention-cleanup.md) | planned |
| 06 | [Report builder](06-report-builder.md) | planned |
| 07 | [Report PDF and delivery](07-report-pdf.md) | planned |

## Reports launch
| # | Plan | Status |
|---|---|---|

## Scheduled jobs owned by other plans
These run on the worker scheduler (01) but are planned elsewhere:
- Nightly garage trust score: [admin/15](../admin/15-trust-and-spot-checks.md)
- Nightly `daily_metrics` snapshots: [admin/16](../admin/16-dashboard-metrics.md)
- Monthly dealer credits: [admin/18](../admin/18-dealer-accounts.md)

## Database changes these plans add
- `job_photos`: storage keys for thumbnail and display versions (03)
- `messages` table and WhatsApp opt-outs (04, 05)
- `reminders` table details: due date, mode, sent_at, outcome (05)
- `report_orders.snapshot` JSON column (06)
