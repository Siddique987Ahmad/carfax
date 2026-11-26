# admin — internal admin panel

Code: `apps/admin`. Stack: React + Vite, React Router, TanStack Query, shadcn/ui, and it works on phones. Roles: super admin (`admin`), operations (`ops`), support (`support`).

Each plan is a thin slice: the admin API endpoints it needs, any database change, and the screens. Each one can be built, tested and shipped on its own. Build them one at a time, in this order. Statuses: `planned` → `in progress` → `done`.

## Pre-pilot (tech doc: weeks 6–8)
The tech doc's admin "done when": the team can approve garages and review flagged jobs.

| # | Plan | Status |
|---|---|---|
| 01 | [Vite skeleton](01-skeleton.md) | planned |
| 02 | [App shell and shared UI](02-shell-and-shared-ui.md) | planned |
| 03 | [Typed API client and data layer](03-api-client.md) | planned |
| 04 | [Login with phone OTP](04-login-otp.md) | planned |
| 05 | [Second factor (authenticator app)](05-second-factor.md) | planned |
| 06 | [Session, route guards and roles](06-session-and-roles.md) | planned |
| 07 | [Garages list](07-garages-list.md) | planned |
| 08 | [Garage detail and approval](08-garage-detail-approval.md) | planned |
| 09 | [Flagged jobs queue](09-flagged-jobs-queue.md) | planned |
| 10 | [Review a flagged job](10-job-review.md) | planned |

## During the pilot
| # | Plan | Status |
|---|---|---|
| 11 | [Car search and detail](11-car-search-detail.md) | planned |
| 12 | [Correct a car or job record](12-car-corrections.md) | planned |
| 13 | [Merge duplicate cars](13-car-merge.md) | planned |
| 14 | [Team members and roles](14-team-and-roles.md) | planned |
| 15 | [Garage trust score and spot-checks](15-trust-and-spot-checks.md) | planned |
| 16 | [Dashboard with the product metrics](16-dashboard-metrics.md) | planned |

## Reports launch
| # | Plan | Status |
|---|---|---|
| 17 | [Report orders, payments and refunds](17-orders-payments-refunds.md) | planned |
| 18 | [Dealer accounts and credits](18-dealer-accounts.md) | planned |
| 19 | [Owner disputes](19-disputes.md) | planned |
| 20 | [Audit log viewer](20-audit-log-viewer.md) | planned |

## Database changes these plans need
All of them are now built in the db/ plans. See the table "Where the admin plans' database changes live" in [db/README.md](../db/README.md).
