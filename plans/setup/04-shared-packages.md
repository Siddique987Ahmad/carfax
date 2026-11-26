# setup/04 — Shared packages

Status: planned · Phase: pre-pilot · Depends on: setup/01

## Goal
The shared packages exist with their structure and first contents, so the API, apps and workers import one source of truth for types, validation, constants and text.

## Decisions
- **`packages/shared`:** Zod schemas, types and constants: job statuses, flag codes, work types, roles and the permission map (admin/06), and `normaliseRegNo()` (admin/11).
- **`packages/i18n`:** Urdu and English text as JSON, one file per language and feature, used by the garage app and the public site. Urdu is right-to-left; each app handles layout direction.
- **`packages/ui`: not created yet.** Admin keeps its components until the public site needs the same ones (decided in admin/02).
- **Packages are used as TypeScript source,** with no build step. If a consumer can't handle that (e.g. NestJS in production), add a small tsup build to that package only.
- **Work types are a fixed list in code** (oil change, tuning, brakes, denting/painting, engine, suspension, AC, electrical, other), from the product doc, so reports and flags can rely on them.

## Scope
**In:**
- `packages/shared` with folders `schemas/`, `constants/`, `utils/` and tests
- `packages/i18n` with `en/` and `ur/` and a type-safe key helper
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
- `packages/shared/*`, `packages/i18n/*`

## Done when
- [ ] Another package can import from `@carfax/shared` and `@carfax/i18n` with types working
- [ ] `normaliseRegNo` tests pass
- [ ] A missing Urdu key fails the check

## Open questions
- Who checks the Urdu text? Proposed: a native speaker reviews each new screen before release.
