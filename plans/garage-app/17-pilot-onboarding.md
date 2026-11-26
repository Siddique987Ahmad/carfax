# garage-app/17 — Pilot onboarding helpers

Status: planned · Phase: pre-pilot · Depends on: garage-app/16

## Goal
Setting up a garage on the first visit takes under 30 minutes, and the owner and mechanics know how to log a job before we leave.

## Decisions
- **We install the app ourselves,** as the product doc's pilot plan says. The app supports that with a checklist rather than a long tutorial.
- **A practice mode:** the first job can be a practice job, marked as practice and never synced or used in reports, so mechanics can try without fear of mistakes.
- **A 3-screen intro on first launch,** in Urdu first, focused on money: reminders bring customers back, a professional bill on WhatsApp, and it's free. The product doc says to lead with money, not data.
- **A "Help" button that opens WhatsApp chat with our team.**

## Scope
**In:**
- First-launch intro (3 screens, skippable)
- Practice job mode (watermark on screens, excluded from sync)
- Setup checklist for the owner: garage location set, phone on bills, first mechanic added, first real job logged
- Help button in settings and on the home screen
- A one-page field checklist for the team, kept in `docs/` (not in the app)

**Out (later items):**
- None

## Steps
1. Intro screens with translated text.
2. Practice mode flag on jobs; skip practice jobs in sync.
3. Setup checklist card on the home screen, hidden once complete.
4. Help button with our WhatsApp number from config.
5. Write the field checklist.

## Files and folders touched
- `apps/garage-app/app/(app)/onboarding/*`, `apps/garage-app/src/features/onboarding/*`, `docs/pilot-field-checklist.md`

## Done when
- [ ] A practice job never reaches the server
- [ ] The setup checklist disappears once all four steps are done
- [ ] A test install with someone outside the team takes under 30 minutes

## Open questions
- None
