# garage-app/09 — New job: plate scan and typing

Status: planned · Phase: pre-pilot · Depends on: garage-app/03, garage-app/05

## Goal
The mechanic gets a car's plate number into the app in a few seconds, by photo or by typing, in the same normalised form the server and reports use.

## Decisions
- **Take a still photo, then read it with Google ML Kit text recognition** on the phone (works offline). A still photo is simpler and more reliable on cheap phones than live camera scanning.
- **Typing is always one tap away,** and it's the default if scanning fails twice. Pakistani plate styles vary a lot (provinces, fonts, custom plates, Urdu text), so scanning will often miss.
- **One shared `normaliseRegNo()`** in `packages/shared` (also used by the API and admin): upper case, strip spaces and dashes (`lea-1234` → `LEA1234`).
- **The plate photo isn't stored.** Only the text is kept; it's not evidence like the odometer photo.
- **Measure scan accuracy:** log whether the mechanic changed the scanned text (no plate text in analytics, just yes/no).

## Scope
**In:**
- Camera screen (`expo-camera`) with a plate-shaped guide box
- ML Kit text recognition, then picking the most plate-like text (letters + digits pattern)
- Editable result with a plate-friendly keyboard
- Registration year field, if the plate format needs it (see open question)
- `normaliseRegNo()` with tests for common plate formats

**Out (later items):**
- Finding or creating the car (10)

## Steps
1. Add the ML Kit text recognition library and rebuild the development build.
2. Camera screen with the guide box.
3. Plate text picker with tests on sample plate photos.
4. Manual entry screen; switch after two failed scans.
5. `normaliseRegNo()` in shared code, with tests.

## Files and folders touched
- `packages/shared/src/reg-no.ts`, `apps/garage-app/app/(app)/job/new/*`, `apps/garage-app/src/features/plate/*`

## Done when
- [ ] On 30 real plate photos from the target city, at least 70% read correctly without editing
- [ ] Typing a plate takes under 10 seconds
- [ ] `lea 1234`, `LEA-1234` and `LEA1234` all normalise the same way

## Open questions
- Is a Punjab plate unique without its registration year? If not, the year must be captured and included in the normalised form (same question as admin/11).
