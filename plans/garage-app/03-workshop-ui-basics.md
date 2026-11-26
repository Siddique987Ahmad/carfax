# garage-app/03 — UI basics for workshop phones

Status: planned · Phase: pre-pilot · Depends on: garage-app/02

## Goal
A small set of components that are easy to use with greasy hands, in sunlight, on cheap Android phones, so every screen built later inherits that.

## Decisions
- **Styling with Tailwind through NativeWind** (Tailwind for React Native), so the garage app, the public site and the admin panel share one way of styling and one theme (`packages/tailwind-config`, setup/04). Check which Tailwind version the current NativeWind supports when setting it up in garage-app/01.
- **Large touch targets:** at least 56dp high, with the main action at the bottom within thumb reach.
- **High contrast, light theme only** for the MVP. Workshops are bright and often outdoors.
- **Icons with every label,** because some mechanics read slowly.
- **Built for low-end phones** (2 GB RAM, Android 8–10): no heavy animation libraries, `FlashList` for long lists, images resized before they're shown.
- **Offline is normal, not an error.** A small status chip shows "Saved on phone" / "Synced", never a red error for lack of internet.

## Scope
**In:**
- Theme tokens (colours, spacing, font sizes for Urdu and English), taken from the shared Tailwind theme, with app-only additions such as the 56dp touch-target size
- Components: `BigButton`, `TextField` (with a large numeric keypad option), `Chip` picker, `ListRow`, `Screen` (safe area + keyboard handling), `SyncChip`, `EmptyState`, `Toast`
- A hidden dev screen showing every component, for checking on real phones

**Out (later items):**
- Real screens (08 onwards)

## Steps
1. Set up NativeWind with the shared Tailwind theme, and add the app-only tokens.
2. Build the components, each tested in Urdu (RTL) and English.
3. Add the dev screen.
4. Check the dev screen on a low-end Android phone.

## Files and folders touched
- `apps/garage-app/src/ui/*`, `apps/garage-app/src/theme/*`

## Done when
- [ ] Every component works in RTL and LTR
- [ ] The dev screen scrolls smoothly on a 2 GB RAM phone
- [ ] Buttons are usable with a thumb while holding the phone in one hand

## Open questions
- Which phone models do pilot garages actually use? Ask in the interviews and buy one or two for testing.
