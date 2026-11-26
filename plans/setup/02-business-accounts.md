# setup/02 — Business accounts and approvals

Status: planned · Phase: pre-pilot (start week 1) · Depends on: none

## Goal
Every outside account the product needs is applied for in week 1, because approvals take weeks and would otherwise block the pilot and the reports launch.

## Decisions
- **Apply for everything in week 1,** in parallel. The code can use fake providers locally (setup/03) until approval comes through.
- **One business identity for all accounts:** the same registered business name, address, website and email, so verification checks match.
- **Track each application in one table** in this file, with owner, date applied and status.
- **Buy the domain first,** because Meta and the payment providers ask for a website and a business email (DNS and email setup are in setup/06).

| Account | Needed for | Needed by | Notes |
|---|---|---|---|
| Domain (`.pk` via PKNIC, plus `.com`) | Website, email, verification | Week 1 | Blocks the rest |
| Meta Business verification + WhatsApp Business Cloud API | OTP, bills, reminders | Pilot (week 9) | Message templates also need approval (workers/04) |
| SMS gateway (local provider) | OTP and message fallback | Pilot (week 9) | Compare price per SMS and delivery to all networks |
| JazzCash merchant account | Report payments | Reports launch | Check: refund API? |
| Easypaisa merchant account | Report payments | Reports launch | Check: refund API? |
| Card gateway (Safepay or PayFast) | Card payments | Reports launch | Compare fees and onboarding time |
| Google Play developer account | Garage app | Pilot (week 9) | Organisation accounts need a D-U-N-S number |
| Apple developer account | iPhone app | Later | Not in the MVP |

## Scope
**In:**
- Buying the domain
- Submitting each application, with the documents it needs
- Recording, per payment provider: refund API (yes/no), sandbox access, settlement time, fees
- The status table above, kept current

**Out (later items):**
- DNS and email setup (setup/06)
- Code integrations (workers/04, api/18)

## Steps
1. Decide the business identity to apply under (registered company or sole proprietor) and collect its documents.
2. Buy the domain and put up a one-page holding site with contact details.
3. Start Meta Business verification; once approved, add the WhatsApp number.
4. Apply to JazzCash, Easypaisa and one card gateway; request sandbox keys straight away.
5. Pick an SMS provider and open an account.
6. Open the Google Play developer account.
7. Review the status table every week until all are approved.

## Files and folders touched
- `plans/setup/02-business-accounts.md` (status table)

## Done when
- [ ] Every application in the table is submitted in week 1
- [ ] Sandbox keys exist for at least one payment provider by week 4
- [ ] WhatsApp Cloud API can send a test template message before the pilot
- [ ] Refund API support is recorded for each payment provider (admin/17 depends on it)

## Open questions
- Is there a registered company yet? Meta, the payment providers and a Google Play organisation account all ask for business documents.
- A new personal Google Play account must run a closed test with testers before it can publish to production. For the pilot, is installing through internal testing or a direct APK enough? Proposed: yes, internal testing.
