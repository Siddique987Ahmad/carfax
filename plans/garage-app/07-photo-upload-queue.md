# garage-app/07 — Photo upload queue

Status: planned · Phase: pre-pilot · Depends on: garage-app/06, api: signed photo uploads

## Goal
Odometer and before/after photos upload in the background over weak or expensive mobile data, without blocking the mechanic or losing a photo.

## Decisions
- **Resize and compress on the phone before upload:** longest side 1600 px, JPEG quality 0.7, about 200–400 KB per photo. Odometer digits stay readable.
- **Upload straight to storage with a signed URL** from the API, as in the tech doc; the API never handles the file.
- **One queue on the phone:** each photo has an upload state (`waiting`, `uploading`, `done`, `failed`). Uploads run one at a time, and a failed upload retries with growing waits.
- **Keep the local file until the server confirms the upload,** then delete it after 7 days to free space.
- **Odometer photos go first,** since a job's trust depends on them.

## Scope
**In:**
- Compression with `expo-image-manipulator`
- Queue with states, retries and order (odometer first)
- Ask the API for a signed URL, upload, then confirm the storage key on the photo record (synced by 06)
- Count of photos waiting, shown next to the sync status
- "Wi-Fi only for before/after photos" setting (odometer photos always upload)

**Out (later items):**
- Taking the photos (11, 12)

## Steps
1. Compression helper with a size check.
2. Queue table/fields in the local database and the worker loop.
3. Signed URL request, upload, confirm.
4. Cleanup of old local files.
5. Test on a slow connection (network throttling) and with the app killed mid-upload.

## Files and folders touched
- `apps/garage-app/src/photos/*`, `apps/garage-app/src/db/*`

## Done when
- [ ] A 4 MB camera photo uploads as under 400 KB with readable odometer digits
- [ ] Killing the app mid-upload restarts that upload later, with no duplicate files
- [ ] Photos taken offline all upload after reconnecting, odometer photos first

## Open questions
- None
