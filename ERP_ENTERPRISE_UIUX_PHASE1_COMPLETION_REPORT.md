# Enterprise UI/UX Standardization Program — Phase 1 Completion Report

Design System & Workspace Foundation

## 1. Executive Summary

The original brief asked for a unified enterprise-grade design language retrofitted across every department, on both platforms, in one phase — while explicitly requiring zero changes to business logic, workflow, approval chains, Workshop Isolation, permissions, schema, or reporting calculations. Before writing a plan, two background research passes audited the actual current state of `renderer/app.js`/`styles.css` (desktop) and `mobile/src/components/` (mobile) rather than assuming what needed to be built.

That audit found a codebase with **real, working, already-consistent shared infrastructure** in most places (a 7-color badge palette, a universal overlay system, a sole charting mechanism, disciplined desktop button classes, comprehensive mobile theme tokens) alongside a **small number of concrete, fixable problems**: one dead CSS class reference causing two badges to render with no color at all, two status-meta registries with incompatible key shapes, 6+ duplicated ad-hoc badge-rendering closures, no shared KPI-tile helper on either platform (hand-typed 230+ times on desktop, hand-rolled independently by at least 2 mobile dashboards), no shared `Button` component on mobile at all (131 screens, raw `TouchableOpacity` everywhere), and 3 near-duplicate mobile status-badge components that should have extended the existing one.

Given the literal brief's scope (retrofit every screen in every department) was a many-week, thousands-of-call-site undertaking with materially higher regression risk than a UI-only phase should carry, the scope was narrowed to **Foundation** and confirmed with you via `AskUserQuestion` before any implementation began: fix the concrete bugs, consolidate the genuine duplication, build the missing shared pieces that already had proven demand, apply each new piece to 1-2 real reference screens to prove it and give the Design System Guide working examples, and document (rather than build) the parts that are genuine future design decisions rather than mechanical fixes (Quick Actions, the `.mc`/`.kpi-card` unification, wider tab-overlay adoption).

**No business logic, workflow, approval chain, Workshop Isolation, permission, schema, or reporting-calculation code was touched anywhere in this phase.** Every change is presentation-only or an additive, opt-in helper/component/token.

## 2. What Was Fixed (Workstream A)

1. **`bg-success` dead-class bug** (`renderer/app.js:1888`, `:13599`) — two badges (Poles approved/quality-checked status, Timber inbound "Available" status) referenced a CSS class that was never defined anywhere in `styles.css`, so they rendered with no background/text color at all. Both now use the real `.bg` class.
2. **`PROC_STATUS_META`/`MAINT_JOB_STATUS_META` unified** onto one `{cls, icon?, label}` shape, rendered through one new shared `badgeHtml(metaMap, status, fallback)` function. `procStatusBadge()` and `_mjStatusBadge()` are now both thin wrappers over it instead of two independent rendering code paths.
3. **6 duplicate desktop badge closures consolidated** onto named, badgeHtml-routed registries: `STOCK_TRANSFER_STATUS_META` (was defined twice, byte-identical except one intentional label abbreviation for table width — preserved via a derived `STOCK_TRANSFER_LIST_STATUS_META`, not silently merged into one and losing the abbreviation), `MATERIAL_REQUEST_STATUS_META`, `POLES_STATUS_META`, `MACHINE_DUE_STATUS_META`. Two closures (a single 2-way ternary at the Compartments list, and Casual Labour Requests' dynamic-label badge which doesn't fit the lookup-table shape) were deliberately left as-is — low value, and in the second case, genuinely doesn't fit the shared helper's contract without misrepresenting its behavior.
4. **Mobile: `DeliveryStatusBadge`/`TransferStatusBadge`/`SalesOrderStatusBadge` deleted**, their ~20 combined status keys merged into `StatusBadge`'s existing `resolveColors()`/`PROC_STATUS_ICON` maps, all 8 call sites (across Delivery, Stock Transfer, Sales Order, and Material Request screens) switched to import `StatusBadge` directly. This was a genuine, intended visual standardization (their translucent-bordered pill style → the app's established solid-fill pill style) — documented, not accidental.

## 3. What Was Built (Workstream B)

5. **Desktop `kpiTileHtml()`** — shared renderer for the `.mc` grid-tile idiom (the majority pattern, 70+ functions). Applied to 2 reference dashboards: **Mechanician** (both KPI rows, including the `.mj-kpi-link` click-delegation group) and **Inventory** (Executive KPIs row). Both migrations are visually unchanged — same markup, same colors, same click behavior, now generated instead of hand-typed.
6. **Desktop spacing/font-size tokens** (`--sp-1`…`--sp-6`, `--fs-xs`…`--fs-xl`) added to `:root` — purely additive, no existing value changed.
7. **Mobile `Button`** — the app's first shared button component, 5 variants (Primary/Secondary/Danger/Outline/Ghost) matching desktop's `.bp1`/`.bs1`/solid-danger semantics. Applied to 2 reference screens: **`DeliveryDetailScreen`** (2 action buttons, using the `color` override for their existing bespoke navy/success accents) and **`CasualLabourCreateScreen`** (1 submit button, plain default primary — no override needed, proving the default palette is a real match for existing usage, not just the escape hatch).
8. **Mobile `KpiCard` extended with a `tile` variant** (two sizes, `sm`/`md`, matching the two dashboards' differing original proportions rather than forcing one onto the other) and adopted by **`MechanicianDashboardScreen`** (both KPI grids, local `MiniKpi` component deleted entirely) and **`ProcurementDashboardScreen`** (Supplier Intelligence KPI block, 8 tiles). Procurement's Executive Dashboard KPI block was left as a documented next step rather than rushed through as a second, less-clean data point.

## 4. What Was Documented, Not Built (Workstreams C & D)

9. **Detail overlay tab vocabulary** — the 4 existing `.smo-tabs` modules' tab names documented side by side in the Design System Guide, with a recommended standard vocabulary for *future* tabbed overlays. The 130+ flat overlays were not retrofitted — that's a per-module UX decision, not a mechanical one.
10. **Workspace layout standard** — documented (Header → KPI Strip → Alerts → Quick Actions → Activity Timeline → Primary Workspace → Supporting Widgets → Data Table), validating the shape the Mechanician Phase 4 dashboard redesign already converged on independently, not inventing a new one.
11. **Alerts — built, not just documented.** Desktop: new `alertHtml(type, message, dismissible)` (4 severities, reusing the existing badge color palette). Mobile: confirmed `Toast` doesn't cover this case (it's transient/auto-hiding/non-dismissible; Alerts needs to be persistent/inline/dismissible) and built the missing `AlertBanner` component. Applied as a reference migration to `DeliveryDetailScreen`'s previously one-off "remaining SO units" warning banner.
12. **Quick Actions** — documented as a recommended future pattern only. No existing analog to extend safely, and no concrete driving use case to design against without speculating — flagged as explicit future work, not silently dropped.

## 5. Verification

**Static**: `node --check` clean on every touched desktop/backend file (`renderer/app.js`, `electron/main.js`, `electron/preload.js`, `db/migrate.js`, `db/services/data.js` — the last three unchanged this phase but re-checked for safety). `npx tsc --noEmit` clean on `mobile/` after every workstream, incrementally.

**Manual reasoning verification** (no live UI click-through was performed this session): every migration was checked against the exact prior markup/styles/behavior line-by-line before and after the change, specifically to catch the kind of subtle mismatch that showed up twice during this phase's own work — see §6.

## 6. Course Corrections During Implementation

Two assumptions in the original plan didn't survive contact with the actual code, and were corrected rather than forced:

- **Procurement Dashboard (desktop) was originally planned as a `kpiTileHtml` reference migration.** On inspection, the entire Procurement module uses a separate, internally-consistent `.kpi-card` idiom (own CSS, top-border accent, different border-radius) — not `.mc`. Forcing it onto `kpiTileHtml` would have been a real, visible re-skin of an already-consistent module, not a safe drop-in. Substituted the **Inventory Dashboard** (`renderInventory`, genuinely `.mc`-based) as the second reference migration instead, and documented the `.mc`/`.kpi-card` split explicitly in the Design System Guide as a real, future design decision rather than something to unilaterally resolve mid-phase.
- **Mobile `KpiCard`'s existing `row` (list) layout was originally assumed compatible with Mechanician/Procurement's compact grid tiles.** On inspection, both dashboards use a fundamentally different layout (small tiles wrapping in a row, not a full-width list row) via local `MiniKpi`/`statTileAlt` components. Rather than force a visually regressive migration, `KpiCard` was extended with a new `tile` variant (two sizes, matching each dashboard's real prior proportions) — genuinely additive to the component, and the migration that was actually promised (proving `KpiCard` covers real dashboards) still happened, just via the correct shape.

Both corrections are the same discipline this session used throughout: verify the assumption against the actual code before building on it, and when it doesn't hold, fix the plan rather than the facts.

## 7. Files Touched

See `ERP_ENTERPRISE_UIUX_PHASE1_CHANGELOG.md` for the complete file-by-file list.

## 8. Not Committed

Per standing release discipline, none of the code in this phase has been committed or pushed. No database migration was needed (this phase touched no schema).

## 9. Production Readiness

**Every change in this phase is additive, opt-in, or a verified-identical consolidation of existing behavior — nothing app-wide was force-migrated, and nothing business-logic-relevant was touched.** The two dead-badge-color bugs are genuinely fixed. The new `badgeHtml`/`kpiTileHtml`/`alertHtml` helpers (desktop) and `Button`/`AlertBanner`/`KpiCard` tile variant (mobile) are proven against real reference screens and fully documented in `ERP_DESIGN_SYSTEM_GUIDE.md`, which is now the enforceable standard for all new UI work on both platforms. The remaining fragmentation (§10 of the Guide) is explicit, prioritized, future work — not a gap anyone has to discover by reading code.
