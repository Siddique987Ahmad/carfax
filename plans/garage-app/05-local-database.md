# garage-app/05 — Local database (WatermelonDB)

Status: planned · Phase: pre-pilot · Depends on: garage-app/01, db: core and job tables

## Goal
A database on the phone that holds this garage's jobs, cars and customers, so the app works fully without internet.

## Decisions
- **WatermelonDB on SQLite with JSI,** as in the tech doc, using the Expo config plugin (needs the development build from 01).
- **Mirror only what this garage needs:** its jobs, job items, photos (metadata), the cars it has serviced, its customers and reminders. Never other garages' data.
- **Same IDs as the server:** UUIDs created on the phone for jobs, cars, customers and photos, so syncing never needs ID swapping (except duplicate cars, see 10).
- **Same column names as the server tables** (snake_case), so the sync format maps one to one.
- **Local-only fields** for sync state: `upload_state` on photos, and the device-side timestamps.

## Scope
**In:**
- WatermelonDB setup with the Expo plugin
- Local schema and models: `cars`, `customers`, `jobs`, `job_items`, `job_photos`, `reminders`
- A schema migration setup for future changes
- Small helpers: create a job with items in one write, query today's jobs

**Out (later items):**
- Syncing with the server (06), photo files (07)

## Steps
1. Add WatermelonDB and the Expo config plugin; rebuild the development build.
2. Write the schema and models, matching the server tables.
3. Add the migration setup.
4. Write the helpers, with tests running on the JS SQLite adapter.

## Files and folders touched
- `apps/garage-app/src/db/*`

## Done when
- [ ] 5,000 jobs load and query in under a second on a low-end phone
- [ ] A job with items saves in a single write and survives killing the app
- [ ] A schema change runs as a migration without losing data

## Open questions
- None
