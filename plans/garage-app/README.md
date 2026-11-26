# garage-app — workshop mobile app

Code: `apps/garage-app`. Stack: React Native + Expo (Expo Router), Android first, Urdu and English with right-to-left layout, offline-first with WatermelonDB, plate and odometer reading on the phone with Google ML Kit.

Each plan is a thin slice that can be built and tested on its own. Database tables are planned in [db/](../db/), endpoints in [api/](../api/), and automatic WhatsApp sending in [workers/](../workers/). Build them one at a time, in this order. Statuses: `planned` → `in progress` → `done`.

## Pre-pilot (tech doc: weeks 3–8)
The tech doc's garage app "done when": a mechanic can log a job offline with plate scan and odometer photo, and it syncs.

| # | Plan | Status |
|---|---|---|
| 01 | [Expo skeleton and dev builds](01-expo-skeleton.md) | planned |
| 02 | [Urdu and English, with right-to-left layout](02-urdu-english-rtl.md) | planned |
| 03 | [UI basics for workshop phones](03-workshop-ui-basics.md) | planned |
| 04 | [Login with phone OTP](04-login.md) | planned |
| 05 | [Local database (WatermelonDB)](05-local-database.md) | planned |
| 06 | [Sync engine](06-sync-engine.md) | planned |
| 07 | [Photo upload queue](07-photo-upload-queue.md) | planned |
| 08 | [Home screen](08-home-screen.md) | planned |
| 09 | [New job: plate scan and typing](09-plate-scan.md) | planned |
| 10 | [Confirm or create the car](10-car-confirm-create.md) | planned |
| 11 | [Odometer photo and reading](11-odometer-photo.md) | planned |
| 12 | [Job card](12-job-card.md) | planned |
| 13 | [Bill and sending it on WhatsApp](13-bill-whatsapp.md) | planned |
| 14 | [Garage settings, staff and roles](14-settings-staff-roles.md) | planned |
| 15 | [Crash reporting and usage analytics](15-errors-analytics.md) | planned |
| 16 | [Pilot release and same-day fixes](16-pilot-release.md) | planned |
| 17 | [Pilot onboarding helpers](17-pilot-onboarding.md) | planned |

## During the pilot
| # | Plan | Status |
|---|---|---|
| 18 | [Under 30 seconds per job](18-speed-target.md) | planned |
| 19 | [Customers list](19-customers.md) | planned |
| 20 | [Service reminders](20-reminders.md) | planned |

## Things these plans need from other folders
- **api/ sync:** use WatermelonDB's change format for `/sync/push` and `/sync/pull` (06).
- **api/ car lookup:** map a phone-created car to an existing car with the same plate or chassis, and tell the phone (10).
- **workers/ flag checks:** treat a job whose photo hasn't uploaded yet as "photo pending" for 48 hours, not "no photo" (06, 07); add a `NO_GPS` flag (11).
- **db/:** `jobs.odometer_not_working`; `job_photos` GPS columns and device time; `jobs.next_service_due_date` / `next_service_due_km`; reminder `sent_at`, `snoozed_until`, `returned_job_id`.
- **packages/shared:** `normaliseRegNo()`, the car make/model list, work types, and the permission map.
