# workers/08 — Data retention and clean-up

Status: planned · Phase: pilot · Depends on: workers/01

## Goal
Data that's no longer needed is removed on a schedule, keeping storage costs down and holding less personal data. This matters for the data protection advice the product doc says is still to be sought.

## Decisions
- **Nightly clean-up job,** registered in the scheduler (workers/01):

| Data | Rule |
|---|---|
| Photos uploaded but never attached to a synced job | Delete after 7 days |
| Expired OTP codes and used refresh tokens | Delete after 1 day |
| Abandoned report orders (unpaid) | Delete after 30 days |
| Message log phone/content details | Keep status and cost only after 90 days |
| Finished BullMQ jobs | Handled by queue settings (workers/01) |

- **Never deleted:** approved jobs, their odometer photos, audit logs (admin/20) and paid orders. These are the product's evidence.
- **Retention periods are kept in one config file,** to be updated after legal advice.
- **Each run logs what it deleted,** as counts only.

## Scope
**In:**
- The clean-up job and rules above
- A dry-run mode that only reports counts
- Customer deletion when a garage leaves: kept as an open question until the legal advice

**Out (later items):**
- Nightly trust score (admin/15), daily metrics (admin/16), monthly dealer credits (admin/18). Those are scheduled jobs owned by the admin plans.

## Steps
1. Write each rule as its own function with tests.
2. Add the nightly job and dry-run mode.
3. Run it in dry-run on staging for a week, then turn it on.

## Files and folders touched
- `workers/src/cleanup/*`, `packages/shared/src/constants/retention.ts`

## Done when
- [ ] A dry run on staging reports sensible counts
- [ ] Orphan photos older than 7 days are gone from storage
- [ ] Nothing in the "never deleted" list is touched (tested)

## Open questions
- When a garage leaves, should its private customer list be deleted? Wait for the legal advice on Pakistan's data protection rules.
