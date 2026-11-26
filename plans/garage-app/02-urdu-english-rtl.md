# garage-app/02 — Urdu and English, with right-to-left layout

Status: planned · Phase: pre-pilot · Depends on: garage-app/01

## Goal
Every screen works in Urdu (right-to-left) and English, so workshop owners and mechanics can use the app in the language they read best.

## Decisions
- **i18next + react-i18next**, with the text kept in `packages/i18n` (shared with the web app later).
- **Language picked on first launch,** with Urdu first in the list. It can be changed in settings.
- **RTL through React Native's `I18nManager`.** Switching direction needs a reload, so changing language restarts the app (`expo-updates` `reloadAsync`).
- **Western digits (0–9) in both languages** for plates, odometer readings and rupee amounts, as most Pakistanis read numbers on bills and plates.
- **Urdu font: Noto Nastaliq Urdu,** with taller line height. Test it on low-end phones; switch to Noto Naskh Arabic if it's slow or gets clipped.
- **No text in code.** Every string goes through a translation key, and a lint rule catches plain strings in JSX.

## Scope
**In:**
- `packages/i18n` with `ur` and `en` files and typed keys
- Language picker on first launch and in settings
- RTL switching and restart
- Bundled Urdu font
- Number and money formatting helpers (`Rs. 12,500`)

**Out (later items):**
- Translating each screen's text (done in each screen's own item)

## Steps
1. Create `packages/i18n` with typed keys and a few starter strings.
2. Set up i18next in the app and persist the chosen language.
3. Add the RTL toggle and restart on language change.
4. Bundle the Urdu font with `expo-font` and set the line height.
5. Add the plain-string lint rule.

## Files and folders touched
- `packages/i18n/*`, `apps/garage-app/src/i18n/*`, `apps/garage-app/assets/fonts/*`

## Done when
- [ ] Switching to Urdu mirrors the layout and shows Urdu text without clipping
- [ ] Numbers show as 0–9 in both languages
- [ ] A missing translation key fails the type-check

## Open questions
- Who checks the Urdu wording? A garage owner or mechanic should review it before the pilot.
