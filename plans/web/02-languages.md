# web/02 — English and Urdu

Status: planned · Phase: pilot · Depends on: web/01

## Goal
The buyer's path (landing, search, preview, report) works in English and Urdu, and adding more translated pages later doesn't change any URL.

## Decisions
- **Both languages from the start, English as the default.** Reasons:
  - The garage app is already bilingual, so `packages/i18n` exists.
  - Car owners will reach the site from WhatsApp links sent by garages, and many will be more comfortable in Urdu.
  - Changing URLs later would lose search ranking, so the routes must be right from day one.
- **Only the buyer's path is translated at first.** Dealer pages and legal pages start in English; legal text in Urdu waits for the lawyer's review.
- **Locale in the URL:** `/` (English) and `/ur/...` (Urdu, right-to-left), with `hreflang` tags for search engines.
- **The Urdu font loads only on `/ur` pages,** because Nastaliq fonts are large and would slow down every page on low-end phones.
- **Plates, chassis numbers and kilometres stay in Latin digits** in both languages, because that's how they're written on plates and documents.

## Scope
**In:**
- next-intl (or a similar library) with locale routing and `hreflang`
- Message files from `packages/i18n` (shared with the garage app)
- Right-to-left layout for `/ur` using Tailwind's logical properties (`ms-`, `me-`, `ps-`, `pe-`)
- Language switch in the header that keeps the current page
- Urdu font loaded only for `/ur`

**Out (later items):**
- The page texts themselves (each page item adds its strings in both languages)

## Steps
1. Add the i18n library and `[locale]` route segment.
2. Wire message files from `packages/i18n`, with a type-checked key list so a missing translation fails the build.
3. Add right-to-left support and the font split.
4. Add the language switch and `hreflang` tags.

## Files and folders touched
- `apps/web/src/app/[locale]/*`, `apps/web/src/i18n/*`, `packages/i18n/web/*`

## Done when
- [ ] `/` and `/ur` both render the placeholder in the right language and direction
- [ ] A missing Urdu string fails the type-check
- [ ] English pages don't download the Urdu font

## Open questions
- Who reviews the Urdu copy? Machine translation isn't good enough for the report's warnings.
