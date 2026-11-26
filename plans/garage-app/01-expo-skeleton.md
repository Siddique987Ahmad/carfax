# garage-app/01 — Expo skeleton and dev builds

Status: planned · Phase: pre-pilot · Depends on: setup/01

## Goal
An empty garage app that installs on a real Android phone as a development build, so the native modules later items need (ML Kit, WatermelonDB, secure storage) work from day one.

## Decisions
- **Expo + Expo Router + TypeScript**, as in the tech doc.
- **Development builds from the start, not Expo Go.** ML Kit text recognition and WatermelonDB need native code that Expo Go doesn't include.
- **Android first.** iOS stays configured but untested until the expand phase.
- **EAS Build with three profiles:** `development` (dev client), `preview` (internal APK for the team and pilot), `production` (Play Store).
- **Minimum Android 8 (API 26),** so older workshop phones are covered.

## Scope
**In:**
- `apps/garage-app` created with the Expo Router TypeScript template, extending `tsconfig.base.json`
- `app.config.ts` with app name, package id, version and environment values (`API_URL`)
- `eas.json` with the three profiles
- Placeholder routes: `(auth)/login` and `(app)/index`
- Scripts wired into Turborepo (`dev`, `lint`, `typecheck`)

**Out (later items):**
- Language and layout (02, 03), login (04), local database (05)

## Steps
1. Scaffold the app with `create-expo-app` (Expo Router template).
2. Move config to `app.config.ts`, reading `API_URL` per build profile.
3. Add `eas.json` and link the project to an Expo account.
4. Make a `development` build and install it on a real Android phone.
5. Hook the scripts into the root pipeline.

## Files and folders touched
- `apps/garage-app/*`

## Done when
- [ ] A development build installs on a physical Android phone and hot-reloads code changes
- [ ] Root `pnpm lint` and `pnpm typecheck` include the app and pass
- [ ] `API_URL` differs between development and preview builds

## Open questions
- Package id, e.g. `pk.<brand>.garage`? It can't change after the first Play Store upload, and the brand isn't final.
