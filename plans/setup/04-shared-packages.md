# setup/04 — Shared packages

Status: done (Nov 27, 2026) · Phase: pre-pilot · Depends on: setup/01

## Goal
The shared packages exist with their structure and first contents, so the API, apps and workers import one source of truth for types, validation, constants and text.

## Decisions
- **`packages/shared`:** Zod schemas, types and constants: job statuses, flag codes, work types, roles and the permission map (admin/06), and `normaliseRegNo()` (admin/11).
- **`packages/i18n`:** Urdu and English text as JSON, one file per language and feature, used by the garage app and the public site. Urdu is right-to-left; each app handles layout direction.
- **`packages/tailwind-config`:** one shared Tailwind theme (brand colours, spacing, fonts including an Urdu font, the RTL setup) used by the public site, the admin panel and the garage app (through NativeWind), so all three look like one product.
- **`packages/ui`: not created yet.** Admin keeps its components until the public site needs the same ones (decided in admin/02).
- **Packages are used as TypeScript source,** with no build step. If a consumer can't handle that (e.g. NestJS in production), add a small tsup build to that package only.
- **Tailwind 3 and 4 from one source.** Stable NativeWind (4.2.7) supports only Tailwind 3; the web and admin apps use Tailwind 4. So `src/tokens.ts` is the single source, exported as a Tailwind 3 preset (garage app) and a generated `theme.css` (Tailwind 4). A test fails if `theme.css` drifts from the tokens; `pnpm --filter @carfax/tailwind-config generate` rewrites it. When NativeWind 5 (Tailwind 4) is stable, the garage app can switch to `theme.css` and the preset can go.
- **Brand colours are placeholders** until the brand is chosen. A test checks every 600 and 700 shade passes 4.5:1 contrast with white text.
- **What `@carfax/shared` holds now:** work types, job and garage statuses, flag codes (from workers/02), platform and garage roles (db/02, db/03), the admin permission map with `can()` (admin/06), `normaliseRegNo()` and `normaliseChassisNo()` (they also convert Urdu digits), and Zod schemas for these. Zod 4.6.7.
- **i18n:** English is the source. Urdu must match it exactly: a missing key fails both the type-check and the test, and so do mismatched `{placeholders}`. `t(locale, key, params)` and `dir(locale)` are the whole API for now. The Urdu text is a first draft; see the open question.
- **Tests use Vitest 5.1.2,** installed once at the root.
- **Work types are a fixed list in code** (oil change, tuning, brakes, denting/painting, engine, suspension, AC, electrical, other), from the product doc, so reports and flags can rely on them.

## Scope
**In:**
- `packages/shared` with folders `schemas/`, `constants/`, `utils/` and tests
- `packages/i18n` with `en/` and `ur/` and a type-safe key helper
- `packages/tailwind-config` with the shared theme (tokens, Tailwind 3 preset, generated Tailwind 4 `theme.css`)
- A check that every English key has an Urdu translation (runs in CI)

**Out (later items):**
- Database schema (`packages/db`, db/ plans)
- API client (`packages/api-client`, admin/03)

## Steps
1. Create both packages with `package.json` exports pointing to `src/`.
2. Add the constants and their types.
3. Add `normaliseRegNo()` with tests for common plate spellings.
4. Add the i18n structure and the missing-translation check.
5. Import one constant from each package in a test to prove the wiring.

## Files and folders touched
- `packages/shared/*`, `packages/i18n/*`, `packages/tailwind-config/*`, root `package.json` (Vitest, `@types/node`), `turbo.json`

## Done when
- [x] Another package can import from `@carfax/shared` and `@carfax/i18n` with types working (checked with a throwaway package: wrong work types and unknown keys are type errors)
- [x] `normaliseRegNo` tests pass (with `normaliseChassisNo`: 30 tests in shared)
- [x] A missing Urdu key fails the check (fails both the test and the type-check)
- [x] The theme builds with Tailwind 4.3.5 (`theme.css`) and Tailwind 3.4.19 (preset), checked outside the repo

## Open questions
- Who checks the Urdu text? Proposed: a native speaker reviews each new screen before release. The current text (buttons, sync status, work types) uses the English loanwords mechanics use (آئل چینج، ٹیوننگ) and needs that review.
- Brand name and colours, to replace the placeholder blue.
