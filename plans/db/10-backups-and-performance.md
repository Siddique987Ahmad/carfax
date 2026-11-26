# db/10 — Backups, restore test and performance check

Status: planned · Phase: pilot · Depends on: db/05, db/07, setup/ hosting item

## Goal
Before real garages rely on the system, prove that the database can be restored from a backup and that the most-used queries stay fast as data grows.

## Decisions
- **Backups as in the tech doc:** daily, kept 30 days, from the managed provider, plus point-in-time recovery if the provider offers it.
- **Monthly restore test** (tech doc): restore the latest backup into a scratch database, run a script that checks row counts and runs a few key queries, then delete it. A backup that has never been restored doesn't count.
- **Connection pooling:** use the provider's pooler in transaction mode. This is safe because RLS settings use `set_config(..., true)` (db/07).
- **Measure before optimising.** Load 50× the pilot data (about 100,000 jobs), run `EXPLAIN ANALYZE` on the key queries, and only add indexes where a query is slow.
- **Turn on `pg_stat_statements`** to find slow queries in production.

## Scope
**In:**
- Restore-test script and a written runbook (who runs it, how often, where it's recorded)
- Load-test seed (a large option for the db/08 seed)
- `EXPLAIN ANALYZE` on:
  - A car's timeline
  - The flagged-jobs queue
  - The garages list with activity counts
  - Plate search
  - Sync pull for one garage
  - The nightly metrics queries
- Indexes added only where those show a problem
- `pg_stat_statements` enabled

**Out (later items):**
- Read replicas or partitioning (not needed at one-city scale)

## Steps
1. Turn on the provider's backups and point-in-time recovery.
2. Write `scripts/restore-test.sh` and the runbook in `packages/db/README.md`.
3. Run the first restore test and record the result.
4. Load the large seed on staging and run the query checks.
5. Add any needed indexes as a normal migration.

## Files and folders touched
- `packages/db/scripts/restore-test.sh`, `packages/db/README.md`, `packages/db/seed/*`, `packages/db/migrations/*`

## Done when
- [ ] A backup has been restored and checked, with the date written in the runbook
- [ ] Every key query runs in under 100 ms on the large data set
- [ ] `pg_stat_statements` shows query stats on staging

## Open questions
- Which provider? This decides whether point-in-time recovery and creating database users (db/06) are available.
