# api/07 — Signed photo uploads

Status: done (Nov 27, 2026) · Phase: pre-pilot · Depends on: api/04

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
- **Built with these decisions:**
  - **The job is usually not on the server yet** when its photo is signed (offline-first: the app uploads photos, then syncs the job). So the check "another garage's job" applies only when the job already exists (403). The real protection is that **the server builds the key from the caller's own garage** (`jobs/{garageId}/{jobId}/{photoId}.jpg`), so a garage can never write into another garage's folder; sync push (api/08) checks the key matches the job's garage.
  - **Size is enforced by the signature, not a policy:** R2 has no presigned POST (which would allow a size range), so the PUT URL is signed for exactly the declared `content-length` and `content-type: image/jpeg`. Storage refuses any other size or type, even one byte off (tested). Declared sizes over 2 MB are refused by the API.
  - **Whether the bytes really are a JPEG** is checked when the photo is processed (workers/03), since a signed URL can't inspect content.
  - **`S3_PUBLIC_ENDPOINT`** (optional): the address phones use to reach storage, e.g. this computer's LAN IP so a phone on the same Wi-Fi can upload to local SeaweedFS. Defaults to `S3_ENDPOINT`.
  - **`StorageService`** (global): `signUpload`, `signDownload` (5 minutes by default), `head` (size and type, or null), with the checksum setting from setup/03.
  - **No `source` column:** the app only allows in-app camera capture (garage-app/11), so every photo would say the same thing.
  - **Tests and CI use real S3-compatible storage** (SeaweedFS). CI starts the `s3` service from `infra/docker-compose.yml`, because GitHub's service containers can't pass SeaweedFS its start command.
  - **Pending and suspended garages get no upload URLs** (`jobs.create` is a write).

## Scope
**In:**
- `StorageService` (R2 client): sign PUT, sign GET, check exists
- `POST /uploads/sign` with `{ jobId, photoId, kind: odometer|before|after, contentType, size }`
- DB: `job_photos.lat`, `job_photos.lng` (already in db/05; `source` dropped, see Decisions)

**Out (later items):**
- Photo records in sync (api/08), flagging GPS problems (workers)

## Steps
1. R2 bucket per environment, private, with CORS allowing PUT from the app only.
2. `StorageService` with the AWS S3 SDK pointed at R2.
3. Sign endpoint with key building and limits.
4. Tests against a local S3-compatible store (MinIO) in the test compose file.

## Files and folders touched
- `apps/api/src/storage/storage.module.ts`, `apps/api/src/uploads/*`, `apps/api/test/uploads.test.ts`, `apps/api/src/config.ts`
- `.github/workflows/ci.yml` (storage step, S3 variables), `.env.example`, `turbo.json`

## Done when
- [x] The app can upload a photo with the signed URL, and an expired or altered URL is refused (tested with real uploads to SeaweedFS)
- [x] A garage can't get a URL for another garage's job (when the job exists; otherwise the key is always under the caller's garage)
- [x] Files over 2 MB or not JPEG are refused (declared: by the API; actual size and type: by storage, through the signature)

## Open questions
- Keep original photos forever, or shrink them after 1 year to save storage? Proposed: keep for now; R2 storage is cheap.
