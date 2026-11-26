# garage-app/11 — Odometer photo and reading

Status: planned · Phase: pre-pilot · Depends on: garage-app/07, garage-app/10

## Goal
Every job has a real, timestamped photo of the car's odometer and a confirmed reading. This is the proof that makes reports trustworthy and catches rolled-back mileage.

## Decisions
- **Camera only, no gallery,** as in the tech doc. Old or downloaded photos can't be reused.
- **Record time and GPS with the photo.** Store both the phone's clock time and the sync time; a big gap is a warning sign. If location permission is denied, the job still saves but gets a `NO_GPS` flag.
- **ML Kit suggests the number; the mechanic confirms or corrects it.** Both the typed value and the suggestion are saved (`ocr_reading`), so the server can flag mismatches.
- **The photo is required.** A job can't be saved without it. If the odometer is broken or unreadable, the mechanic picks "Odometer not working", which saves the job but keeps it out of mileage checks.
- **Warn on a big jump:** if the reading is lower than this garage's last reading for the car, or more than 50,000 km higher, ask the mechanic to check before saving.

## Scope
**In:**
- Odometer camera screen with a guide box and flash toggle (dashboards are dark)
- ML Kit reading of digits, picking the longest number
- Confirm screen with the photo, suggestion and a large numeric keypad
- Time and GPS capture (`expo-location`, one quick reading, no tracking)
- "Odometer not working" option

**Out (later items):**
- Before/after photos (12)

## Steps
1. Camera screen with guide and flash.
2. ML Kit digit reading, tested on sample dashboard photos (analogue and digital).
3. Confirm screen and the sanity-check warnings.
4. Location permission request with a clear reason in Urdu and English.
5. Save the photo to the upload queue (07).

## Files and folders touched
- `apps/garage-app/app/(app)/job/new/odometer.tsx`, `apps/garage-app/src/features/odometer/*`

## Done when
- [ ] A job can't be saved without an odometer photo or the "not working" option
- [ ] There's no way to pick a photo from the gallery
- [ ] Each photo record has a time, GPS (or a `NO_GPS` flag), the typed reading and the suggestion
- [ ] On 30 real dashboard photos, at least 60% of suggestions are correct

## Open questions
- Product question: should "Odometer not working" jobs count toward a garage's photo rate (product doc target: 90% of jobs with a photo)?
