# Enterprise UI/UX Standardization Program — Phase 3 — Changelog

Enterprise UX Enhancement. See `ERP_ENTERPRISE_UIUX_PHASE3_COMPLETION_REPORT.md` for full detail/reasoning and `ERP_DESIGN_SYSTEM_GUIDE.md` for the underlying component reference.

## Database

No migration — this phase touched no schema. Saved Filters/Recently Viewed are entirely client-side (`localStorage` desktop, `AsyncStorage` mobile), never sent to the server.

## Desktop (`renderer/app.js`, `renderer/styles.css`)

- **`showToast()`** — extended from `success`/`error`/`pending` to also support `warning`/`info`; new `.toast-warning`/`.toast-info` CSS classes. 3 raw `alert()` calls (BI export success, EPM export success, print pop-up-blocked warning) swapped to `showToast()`.
- **New `confirmAction({ title, message, confirmLabel, danger, icon, extraHtml, onConfirm })`** — generalizes `confirmDelete()`'s pattern for non-delete verbs; `extraHtml` lets callers inject one optional/required field (most of the 15+ existing ad hoc confirms collect a reason/notes) without losing the shared wrapper. Built-in Enter-to-submit (scoped to `<input>`, not `<textarea>`). Applied to `renderStockTransfers`' Reject Transfer flow and `renderDispatch`'s Reject Dispatch flow, replacing their hand-rolled `openOverlay()` bodies.
- **New `emptyRowHtml({ colspan, icon, title, subtitle })`** — one consistent empty-table-row shape. Applied to Poles Daily Production, Stock Movements, and Compartments list empty-states.
- **`openOverlay()`/`closeOverlay()`** — Escape-to-close added (`_overlayEscHandler` tracked so repeated opens swap rather than stack listeners); `#ovClose` gained `aria-label="Close dialog"`; `#ovErr` gained `role="alert"`.
- **New Saved Filters helpers**: `loadSavedFilters()`, `saveFilterPreset()`, `removeFilterPreset()`, `savedFiltersBarHtml()`, `wireSavedFiltersBar()` — localStorage-backed, capped at 10, modeled on Global Search's existing `GS_RECENT_KEY` pattern. Applied to `renderProcurementRequisitions` (save/apply/remove current search+status filter combination).
- **New Recently Viewed helpers**: `loadRecentlyViewed()`, `pushRecentlyViewed()`, `recentlyViewedWidgetHtml()`, `wireRecentlyViewedWidget()` — localStorage-backed, capped at 8. Wired into `openRequisitionDetailOverlay` (push on open) and displayed on `renderProcurementRequisitions` (widget + click-to-reopen).
- `renderStockItems`/`openStockItemDetailOverlay` (Stock Catalog) — category/low-stock banners converted to `emptyRowHtml`-adjacent `alertHtml()` calls where applicable (unchanged from Phase 2 markup otherwise; no further changes this phase beyond what's listed above).

## Mobile

- `mobile/src/stores/toastStore.ts` — `ToastType` widened from `'success' | 'error'` to include `'warning' | 'info'`.
- `mobile/src/components/Toast.tsx` — `TYPE_META` lookup replaces the old `success`-vs-`error`-only branch; 4 severities now render with distinct background/icon.
- `mobile/src/components/Button.tsx` — `accessibilityRole="button"`, `accessibilityLabel`, `accessibilityState={{disabled, busy}}` added; `sm` size gained `hitSlop` (visual size unchanged).
- `mobile/src/components/AlertBanner.tsx` — `accessibilityRole="alert"` on the banner; dismiss icon gained `accessibilityRole="button"`/`accessibilityLabel="Dismiss"`.
- `mobile/src/components/KpiCard.tsx` — both `tile` and `row` variants gained `accessibilityRole="button"` (when pressable) or `accessible`+`accessibilityLabel` (when static), combining title/value/subtitle into one announced label.
- `mobile/src/components/StatusBadge.tsx` — wrapping `View` gained `accessible`/`accessibilityLabel="Status: {label}"`.
- `mobile/src/utils/storage.ts` — new generic Saved Filters functions (`loadSavedFilters`, `saveFilterPreset`, `removeFilterPreset`, `SavedFilterPreset` type) and Recently Viewed functions (`loadRecentlyViewed`, `pushRecentlyViewed`, `RecentlyViewedEntry` type) — same capped/JSON/fail-soft `AsyncStorage` architecture as the existing favorite/recent-searches functions.
- `mobile/src/screens/workshops/WorkshopOverviewScreen.tsx` — Material Request reject flow (`confirmMR`) now opens a `ReasonModal` (new `mrRejectTarget`/`mrRejectLoading` state, new `handleMrReject`) instead of a plain `Alert.alert` with no reason field; the reason is passed through as `reviewNotes` (the mutation already accepted this field — no hook/API change needed).
- `mobile/src/screens/automation/AutomationRulesScreen.tsx` — bare `ActivityIndicator` loading state → `LoadingState`; hand-typed empty state → `EmptyState`; dead `center`/`empty`/`emptyText` styles removed.
- `mobile/src/screens/automation/AutomationHomeScreen.tsx` — bare `ActivityIndicator`+text loading state → `LoadingState`; hand-rolled error+retry block → `ErrorState`; dead `center`/`loadingText`/`errorText`/`retryBtn`/`retryText` styles removed.
- `mobile/src/screens/logistics/LogisticsDashboardScreen.tsx` — "No workshops found." hand-typed text → `EmptyState` (the file's separate small-widget empty-text pattern, used by multiple `Widget` instances, was left as-is — a different, appropriate design for a compact sub-panel).
- `mobile/src/screens/stockTransfers/StockTransfersListScreen.tsx` — loading state switched from `LoadingState` to `SearchSkeleton` (proof it generalizes beyond procurement); Saved Filters UI (preset chips + inline save-name row) added above the status-filter chips; Recently Viewed widget (chip row, navigates to detail) added above the workshop banner.
- `mobile/src/screens/stockTransfers/StockTransferDetailScreen.tsx` — `pushRecentlyViewed('stock-transfer', ...)` called from a `useEffect` placed before the loading/error early returns (guarded internally), respecting Rules of Hooks.

## Verification

- `node --check`: clean on `renderer/app.js`, `electron/main.js`, `electron/preload.js`.
- `npx tsc --noEmit` (mobile): clean, checked incrementally after each file.
- No schema, REST/IPC, business-logic, workflow, approval, permission, or Workshop-Isolation change anywhere in this phase.

## Deliberately not done this phase (see completion report §7 for the full list)

- App-wide toast/confirmation/empty-state/loading-state consolidation beyond the reference migrations.
- Saved Filters / Recently Viewed rolled out beyond their one reference screen/record-type each.
- A full accessibility pass (foundation laid on 4 shared components + a few reference screens only).
- A full responsive-design pass.
- Arrow-key list navigation.
- Quick Actions rollout beyond the screens that already have it.

## Not committed

Per standing release discipline, none of the code above has been committed or pushed.
