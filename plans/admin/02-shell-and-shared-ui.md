# admin/02 — App shell and shared UI

Status: planned · Phase: pre-pilot · Depends on: admin/01

## Goal
One layout and a small set of shared building blocks, so every list and detail screen in later items looks and behaves the same on phone and desktop.

## Decisions
- **Navigation:** a sidebar on desktop and a bottom bar with "More" on phones.
- **Lists:** one `DataList` component that shows a table on desktop and a card per row on phones, built on TanStack Table.
- **Every screen has loading, empty and error states.** Shared components for these mean none get forgotten.
- **Filters and page number live in the URL**, so a filtered list can be shared with a teammate as a link.

## Scope
**In:**
- `AppLayout`: header with the user menu, a navigation menu with placeholder items, and the content area
- `DataList` (table/cards, pagination, sorting), `FilterBar`, `StatusBadge`
- `PageHeader`, `EmptyState`, `ErrorState`, `LoadingSkeleton`, `ConfirmDialog` (with a required reason field option)
- `useUrlState` hook for filters and paging

**Out (later items):**
- Real data (admin/03), menu items hidden by role (admin/06)

## Steps
1. Build `AppLayout` with responsive navigation.
2. Build `DataList` with mock data, in both layouts.
3. Add the state components and `ConfirmDialog`.
4. Add `useUrlState` and use it in a demo list page.

## Files and folders touched
- `apps/admin/src/components/*`, `apps/admin/src/layout/*`, `apps/admin/src/hooks/useUrlState.ts`

## Done when
- [ ] The demo list switches between table and cards at the phone breakpoint
- [ ] Reloading the page keeps filters and the page number
- [ ] `ConfirmDialog` can require a reason before confirming

## Open questions
- Should `ui` be shared with the public site now (`packages/ui`), or kept in admin until the web app exists? Proposed: keep it in admin and extract later.
