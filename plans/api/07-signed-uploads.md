# api/07 — Signed photo uploads

Status: planned · Phase: pre-pilot · Depends on: api/04

## Goal
The app uploads odometer and before/after photos straight to private storage, without the files passing through the API server.

## Decisions
- **`POST /uploads/sign`** (tech doc) returns a short-lived presigned PUT URL for Cloudflare R2 (S3-compatible API).
- **The server picks the storage key**, not the app: `jobs/{garageId}/{jobId}/{photoId}.jpg`. The app can't write anywhere else.
- **Create the S3 client with `requestChecksumCalculation: 'WHEN_REQUIRED'`** (and `responseChecksumValidation: 'WHEN_REQUIRED'`). Recent AWS SDK versions otherwise sign a checksum of an empty body into presigned URLs, and every real upload fails with `BadDigest`. Found and fixed in setup/03's `scripts/check-services.mjs`.
- **Limits:** JPEG only, max 2 MB (the app compresses before upload), URL valid for 10 minutes.
- **Time and GPS travel with the photo record in sync push** (`taken_at`, `lat`, `lng`, `source: 'in_app_camera'`), not read from EXIF, which is easy to fake. The app enforces in-app capture (garage-app plan); the API can't prove it, so missing GPS or a far-away GPS point becomes a flag (workers: flag checks).
- **Sync push checks the file exists** in storage before accepting the photo record.
- **Reading photos** always uses short-lived signed GET URLs; the bucket is never public.

## Scope
**In:**
- `StorageService` (R2 client): sign PUT, sign GET, check exists
- `POST /uploads/sign` with `{ jobId, photoId, kind: odometer|before|after, contentType, size }`
- DB: `job_photos.lat`, `job_photos.lng`, `job_photos.source` — add to db: job tables

**Out (later items):**
- Photo records in sync (api/08), flagging GPS problems (workers)

## Steps
1. R2 bucket per environment, private, with CORS allowing PUT from the app only.
2. `StorageService` with the AWS S3 SDK pointed at R2.
3. Sign endpoint with key building and limits.
4. Tests against a local S3-compatible store (MinIO) in the test compose file.

## Files and folders touched
- `apps/api/src/modules/uploads/*`, `apps/api/src/common/storage/*`, `docker-compose.test.yml` (MinIO)

## Done when
- [ ] The app can upload a photo with the signed URL, and an expired or altered URL is refused
- [ ] A garage can't get a URL for another garage's job
- [ ] Files over 2 MB or not JPEG are refused

## Open questions
- Keep original photos forever, or shrink them after 1 year to save storage? Proposed: keep for now; R2 storage is cheap.
