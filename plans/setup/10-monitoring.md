# setup/10 — Monitoring and alerts

Status: planned · Phase: pre-pilot (by week 9) · Depends on: setup/09

## Goal
The team finds out about errors, downtime and stuck background jobs before garages call, which the pilot's "bugs fixed same day" promise depends on.

## Decisions
- **Sentry** for errors in the API, workers, admin, public site and garage app (tech doc), with releases tagged so errors point to the right version.
- **Uptime check** on `api.<domain>.pk/v1/health` every minute (a free uptime service).
- **Alerts on what hurts garages and buyers:**
  - API down
  - Error spike
  - Failed sync pushes
  - Queue backlog or failed jobs (workers/01)
  - Backup missed
  - WhatsApp messages failing
- **Alerts go to a channel the team reads on their phones,** not only email.
- **PostHog product analytics is not in this item.** Add it once there are events worth tracking.

## Scope
**In:**
- Sentry projects and source maps for each app
- Uptime monitor with alerts
- `/v1/health` checks database and Redis connections
- Worker queue metrics with alert thresholds
- Backup success check

**Out (later items):**
- Business metrics dashboard (admin/16)

## Steps
1. Create Sentry projects; add the SDK to each app as it exists; upload source maps in deploys.
2. Add the health endpoint checks.
3. Set up the uptime monitor and alert channel.
4. Add queue and failed-job alerts using the worker dashboard data.
5. Trigger each alert once on staging to prove it reaches the team.

## Files and folders touched
- Each app's Sentry setup, `apps/api/src/health/*`, `infra/monitoring.md`

## Done when
- [ ] A thrown test error in each app appears in Sentry with the right release
- [ ] Stopping the staging API sends an alert within 5 minutes
- [ ] A stuck queue sends an alert

## Open questions
- Alert channel: a WhatsApp group, Slack or Telegram? Proposed: whichever the team already checks.
