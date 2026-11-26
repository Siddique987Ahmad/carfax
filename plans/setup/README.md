# setup — monorepo, tooling, accounts, deployment

Code: repo root and `infra/`. Covers the pnpm + Turborepo monorepo, local services, shared packages, CI/CD (GitHub Actions), hosting, monitoring and business accounts.

Each plan can be built and checked on its own. Build them one at a time, in this order. Statuses: `planned` → `in progress` → `done`.

## Pre-pilot (tech doc: weeks 1–2, plus hosting by week 8–9)
setup/02 starts in week 1 alongside everything else, because outside approvals take weeks.

| # | Plan | Status |
|---|---|---|
| 01 | [Monorepo skeleton](01-monorepo.md) | done |
| 02 | [Business accounts and approvals](02-business-accounts.md) | planned |
| 03 | [Local development environment](03-local-dev.md) | done |
| 04 | [Shared packages](04-shared-packages.md) | done |
| 05 | [CI on pull requests](05-ci.md) | in progress |
| 06 | [Domain, DNS and email](06-domain-dns-email.md) | planned |
| 07 | [Secrets management](07-secrets.md) | planned |
| 08 | [Staging environment and deploy](08-staging.md) | planned |
| 09 | [Production environment and release process](09-production-and-releases.md) | planned |
| 10 | [Monitoring and alerts](10-monitoring.md) | planned |

## During the pilot
| # | Plan | Status |
|---|---|---|
| 11 | [Cost tracking](11-cost-tracking.md) | planned |

## Decisions to make in week 1
- Business identity to apply under (02)
- Hosting provider for API, workers and Postgres (08)
- Brand and domain name (06)
