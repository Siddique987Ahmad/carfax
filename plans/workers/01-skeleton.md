# workers/01 — Worker skeleton

Status: planned · Phase: pre-pilot · Depends on: setup/03, db/01

## Goal
A worker process that every background job plugs into, with retries, failure handling and a dashboard, so each later worker plan only adds its own job logic.

## Decisions
- **BullMQ + Redis,** as in the tech doc.
- **One queue per kind of work** (`flags`, `messages`, `reports`, `photos`, `scheduled`), so a slow PDF can't hold up a bill.
- **Every job is safe to run twice.** Jobs use a stable job ID (e.g. `flags:<jobId>`), and handlers check before writing.
- **Retries with backoff** (e.g. 5 attempts). After the last attempt, the job goes to a failed list that ops can see and retry by hand.
- **Same Docker image as the API,** with a different start command (setup/08). Workers use the same Drizzle client from `packages/db`.
- **Ops dashboard:** Bull Board, mounted on the API under `/admin/queues` and restricted to super admins.
- **Scheduled jobs** (nightly, monthly) use BullMQ repeatable jobs. They're registered in one place, so it's clear what runs when.

## Scope
**In:**
- `workers/` package: entry point, queue definitions, a typed `enqueue()` helper used by the API, and graceful shutdown
- Retry and failed-job settings; automatic clean-up of completed jobs
- Scheduler registry
- Bull Board behind the super-admin guard
- Queue depth and failed-count metrics for alerts (setup/10)
- One example job with tests

**Out (later items):**
- Each real job (workers/02–08)

## Steps
1. Create the package and connect to Redis and Postgres.
2. Define the queues and the typed `enqueue()` helper in shared code.
3. Add retry, backoff and clean-up defaults.
4. Add the scheduler registry.
5. Mount Bull Board in the API with the role guard.
6. Write the example job and a test that runs it twice with the same ID.

## Files and folders touched
- `workers/src/*`, `packages/shared/src/queues.ts`, `apps/api/src/modules/admin/queues/*`

## Done when
- [ ] The API can enqueue a job that a worker runs
- [ ] A job that keeps failing ends up in the failed list after 5 tries and can be retried from the dashboard
- [ ] Running the same job twice changes nothing the second time
- [ ] Stopping the worker finishes the current job before exiting

## Open questions
- None
