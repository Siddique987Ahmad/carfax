# workers/02 — Job flag checks

Status: planned · Phase: pre-pilot · Depends on: workers/01, db/03

## Goal
Every synced job is checked automatically and is either approved or flagged for review, so only trustworthy records reach reports. This is the product doc's trust rules turned into code.

## Decisions
- **From api/08:** consume `QUEUES.flagChecks` (`@carfax/shared`) with BullMQ prefix `${REDIS_KEY_PREFIX}bull`; each entry is `{ jobId }` with the job id as its BullMQ id. **Build the sweeper too:** jobs still `submitted` 5 minutes after `synced_at` get checked, because the API's queueing is best effort. A photo with `uploaded_at` empty is "still uploading" until the 24-hour grace ends. After checking, set the job to `approved` or `flagged`.
- **Runs after each sync push,** once per job, and again for a whole car when ops edits or merges it (admin/12, admin/13).
- **No flags → approved automatically.** Any flag → `flagged` and into the admin queue (admin/09).
- **Checks, with starting thresholds to tune after the pilot:**

| Code | Rule |
|---|---|
| `MILEAGE_DROP` | Reading is lower than an earlier job, or higher than a later job, for the same car. A job can sync days late, so check both sides. |
| `NO_PHOTO` | No odometer photo after a 24-hour grace period, since the photo upload may still be retrying |
| `OCR_MISMATCH` | Reading from the photo differs from the typed value by more than 1% (and more than 100 km). No flag if the photo couldn't be read. |
| `MANY_JOBS_SHORT_TIME` | More than 3 jobs for one car within 7 days |
| `FAR_FROM_GARAGE` | Photo GPS is more than 2 km from the garage's location |

- **Thresholds live in one config file,** so they can be changed without touching the rules.
- **Each check is a small pure function with tests,** separate from the database code.

## Scope
**In:**
- The five checks, the approve/flag decision, writing `job_flags`
- Delayed re-check for `NO_PHOTO` after 24 hours
- `checkCar(carId)` job used after edits and merges
- Tests with sample cars covering each rule and late-synced jobs

**Out (later items):**
- Garage-level trust score (admin/15)

## Steps
1. Write the check functions and their tests.
2. Write the job: load the car's jobs in date order, run the checks, update status and flags in one transaction.
3. Enqueue it from the sync endpoint (api/08).
4. Add the delayed `NO_PHOTO` re-check.
5. Add `checkCar`.

## Files and folders touched
- `workers/src/flags/*`, `packages/shared/src/constants/flags.ts`

## Done when
- [ ] Each rule has tests that pass, including a job synced out of date order
- [ ] A clean job is approved within a minute of syncing
- [ ] A job whose photo arrives within 24 hours isn't flagged `NO_PHOTO`
- [ ] Editing a reading in admin re-runs the checks for that car

## Open questions
- Should a flagged job appear in reports while it waits for review? Proposed: no. Only approved jobs, as in the tech doc.
