# Enterprise UI/UX Standardization Program — Phase 1 — Changelog

Design System & Workspace Foundation. See `ERP_ENTERPRISE_UIUX_PHASE1_COMPLETION_REPORT.md` for full detail/reasoning and `ERP_DESIGN_SYSTEM_GUIDE.md` for the enforceable component/pattern reference.

## Database

No migration — this phase touched no schema.

## Desktop (`renderer/app.js`, `renderer/styles.css`)

- **Bug fix**: `bg-success` (undefined CSS class) → `.bg` at 2 sites (Poles status badges, Timber inbound "Available" badge).
- New shared `badgeHtml(metaMap, status, fallbackMeta)` — single rendering code path for all status-badge registries.
- `PROC_STATUS_META`/`MAINT_JOB_STATUS_META` unified onto `{cls, icon?, label}` shape; `procStatusBadge()`/`_mjStatusBadge()` now delegate to `badgeHtml()`.
- New registries, all routed through `badgeHtml()`, replacing hand-rolled closures: `STOCK_TRANSFER_STATUS_META` + `STOCK_TRANSFER_LIST_STATUS_META` (derived, preserves the list view's abbreviated "Partial" label), `MATERIAL_REQUEST_STATUS_META`, `POLES_STATUS_META`, `MACHINE_DUE_STATUS_META`. New `stockTransferStatusBadge(s, list)` helper.
- New shared `kpiTileHtml({icon, label, value, valueColor, valueStyle, borderColor, sub, subCls, trend, cls, id, data})` — `.mc` grid-tile renderer. Applied to `renderMechanicianDashboard` (both KPI rows) and `renderInventory` (Executive KPIs row).
- New spacing/font-size CSS custom properties in `:root`: `--sp-1`…`--sp-6`, `--fs-xs`…`--fs-xl` (purely additive).
- New shared `alertHtml(type, message, dismissible)` + `ALERT_META` — 4 severities (critical/warning/info/success), reuses existing color tokens. Not yet applied to any call site (no existing `.lerr`/ad-hoc banner was retrofitted this phase — see Guide §10).

## Mobile

- `mobile/src/components/StatusBadge.tsx` — `resolveColors()` and `PROC_STATUS_ICON` extended with ~20 status keys merged in from the 3 deleted components below; new `LABEL_OVERRIDES` map for the 2 labels that don't mechanically derive from their status string.
- **Deleted**: `mobile/src/components/DeliveryStatusBadge.tsx`, `TransferStatusBadge.tsx`, `SalesOrderStatusBadge.tsx` — all 8 call sites switched to `StatusBadge` directly:
  - `MaterialRequestDetailScreen.tsx`, `DeliveryDetailScreen.tsx`, `DeliveriesListScreen.tsx`, `SalesOrdersListScreen.tsx` (×2), `StockTransfersListScreen.tsx`, `StockTransferDetailScreen.tsx`.
- New `mobile/src/components/Button.tsx` — 5 variants (Primary/Secondary/Danger/Outline/Ghost), `color` override escape hatch. Applied to `DeliveryDetailScreen.tsx` (2 buttons) and `CasualLabourCreateScreen.tsx` (1 button; dead `submitBtn*` styles removed, unused `ActivityIndicator`/`Layout`/`TouchableOpacity`(partial) imports cleaned up).
- New `mobile/src/components/AlertBanner.tsx` — 4 severities, optional dismiss. Applied to `DeliveryDetailScreen.tsx`'s "remaining SO units" warning (dead `warnBanner`/`warnText` styles removed).
- `mobile/src/components/KpiCard.tsx` — `value` type widened to `string | number`; `icon`/`color` made optional (with safe internal fallbacks for the existing `row` variant); new `variant: 'row' | 'tile'` (default `'row'`, fully backward compatible), new `tileSize: 'sm' | 'md'`, `warn`/`danger`/`style`/`valueStyle` props for the new `tile` variant.
- `mobile/src/components/index.ts` — new exports: `Button`, `ButtonVariant`, `ButtonSize`, `AlertBanner`, `AlertType`.
- `mobile/src/screens/mechanician/MechanicianDashboardScreen.tsx` — local `MiniKpi` component and its 3 dead styles deleted; both KPI grids now use `KpiCard variant="tile"`.
- `mobile/src/screens/procurement/ProcurementDashboardScreen.tsx` — Supplier Intelligence KPI block (8 tiles) migrated to `KpiCard variant="tile" tileSize="md"`. Executive Dashboard KPI block intentionally left as-is (documented next step, Guide §2/§10).

## Verification

- `node --check`: clean on `renderer/app.js`, `electron/main.js`, `electron/preload.js`, `db/migrate.js`, `db/services/data.js`.
- `npx tsc --noEmit` (mobile): clean, checked incrementally after each workstream.
- No schema change, no IPC/REST surface change, no business-logic/workflow/approval/permission/Workshop-Isolation change anywhere in this phase.

## Deliberately not done this phase (see Guide §10 for the full list)

- App-wide `kpiTileHtml`/`KpiCard`/`Button` retrofit beyond the 2 reference screens per component.
- Desktop `.mc`/`.kpi-card` idiom unification (Procurement stays on `.kpi-card`).
- Mobile Procurement Executive Dashboard KPI block migration.
- Retrofitting the pre-existing `.lerr` class / hand-typed amber banners onto `alertHtml()`.
- Retrofitting existing hardcoded `font-size:Npx` values onto the new `--fs-*` tokens.
- Tab-overlay adoption beyond the 4 existing `.smo-tabs` modules.
- Quick Actions pattern — not designed or built.

## Not committed

Per standing release discipline, none of the code above has been committed or pushed.
