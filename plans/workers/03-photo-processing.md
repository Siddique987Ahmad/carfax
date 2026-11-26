# workers/03 — Photo processing

Status: planned · Phase: pre-pilot · Depends on: workers/01, api/07

## Goal
Uploaded photos get small versions for fast review screens, and copies shown to people don't carry hidden personal data, while the original stays as evidence.

## Decisions
- **Keep the original untouched** in the private bucket, as evidence for disputes.
- **Make two versions with sharp:** a thumbnail (~300px) and a display version (~1280px), both with EXIF data removed.
- **GPS and time are stored in database columns** from the app's own capture data, not read back from EXIF. If the original has EXIF GPS/time that disagrees with what the app sent, flag it for review, since that may mean a tampered photo.
- **Admin screens load the display version;** the original is opened only on request.

## Scope
**In:**
- Job triggered when a photo row is created (api/07)
- Thumbnail and display versions saved next to the original
- EXIF comparison and a `PHOTO_METADATA_MISMATCH` flag
- Storage keys for the versions on `job_photos`

**Out (later items):**
- Reading the odometer from the photo. That happens on the phone (garage-app/11).

## Steps
1. Add sharp to workers.
2. Write the job: download, make versions, upload, save keys.
3. Compare EXIF data with the stored GPS and time.
4. Test with real phone photos from a few Android models.

## Files and folders touched
- `workers/src/photos/*`, `packages/db` (columns for version keys)

## Done when
- [ ] Every new photo gets both versions within a minute
- [ ] The versions have no EXIF data
- [ ] A photo with mismatched metadata is flagged

## Open questions
- None
