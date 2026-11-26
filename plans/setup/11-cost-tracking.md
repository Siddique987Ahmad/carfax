# setup/11 — Cost tracking

Status: planned · Phase: pilot · Depends on: setup/09

## Goal
Running costs are known each month and compared with the tech doc's estimate (about $50–150 a month plus WhatsApp and SMS), so a surprise bill is caught early.

## Decisions
- **One monthly table** of every service's cost: hosting, database, Redis, storage, Vercel, Expo, Sentry, WhatsApp, SMS, payment fees, domain and email.
- **Billing alerts** on every provider that supports them, set just above the expected monthly amount.
- **Message costs come from the message log** (workers/04), so WhatsApp and SMS spend can be split by kind: OTP, bill or reminder.
- **Cost per active garage** is the number to watch: running costs ÷ active garages.

## Scope
**In:**
- `infra/costs.md` with the monthly table, filled in from the first full month
- Billing alerts on each provider
- A monthly 15-minute review

**Out (later items):**
- Revenue (admin/17)

## Steps
1. List every paid service with its billing page and alert setting.
2. Set the billing alerts.
3. After the first month, fill in actual costs next to the estimate.
4. Add cost per active garage once garages are live.

## Files and folders touched
- `infra/costs.md`

## Done when
- [ ] Every paid service has a billing alert or a note saying it can't have one
- [ ] The first month's actual costs are recorded next to the estimate
- [ ] WhatsApp and SMS costs are split by message kind

## Open questions
- None
