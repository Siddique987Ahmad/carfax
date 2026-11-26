# garage-app/16 — Pilot release and same-day fixes

Status: planned · Phase: pre-pilot · Depends on: garage-app/01–15, staging API deployed

## Goal
The 5 pilot garages install a stable app, and we can ship a fix to their phones the same day, as the product doc's pilot plan requires.

## Decisions
- **Google Play internal testing track** for the pilot: install by link, up to 100 testers, updates arrive through the Play Store. The Play developer account costs $25 once (tech doc); apply in week 1.
- **Fallback: a direct APK** from an EAS `preview` build, installed by hand, for any phone without a working Play account.
- **EAS Update for JavaScript-only fixes,** pushed over the air to a `pilot` channel. Native changes (new libraries) need a new store build.
- **Runtime version tied to the app version,** so an over-the-air update never reaches a build it can't run on.
- **The pilot app points at the staging API,** with real but pilot-only data.

## Scope
**In:**
- EAS `production` build profile and Play Console app (internal testing)
- EAS Update channels: `pilot`, later `production`
- Version numbering and a short release checklist (build, smoke test on two phones, publish)
- App icon, name and Urdu/English store text for the internal listing

**Out (later items):**
- Public Play Store listing (after the pilot gate)

## Steps
1. Create the Play Console app and the internal testing track.
2. Set up the `production` profile, signing, and runtime version policy.
3. Set up EAS Update channels.
4. Write the release checklist in `apps/garage-app/RELEASING.md`.
5. Do a dry run: build, install on a team phone, push an over-the-air text change.

## Files and folders touched
- `apps/garage-app/eas.json`, `apps/garage-app/app.config.ts`, `apps/garage-app/RELEASING.md`, `apps/garage-app/assets/*`

## Done when
- [ ] A team phone installs the app from the internal testing link
- [ ] A text fix pushed with EAS Update appears on the phone after restarting the app
- [ ] A new release takes under an hour from merge to phones

## Open questions
- Brand name for the store listing (still "working name" in the product doc).
