# Supplier Intelligence — Phase 3C Completion Report

## Executive Summary

Phase 3C transforms Supplier Management from a CRUD module into an executive decision-support system. All computation — the 0–100 weighted supplier score, risk tier, sub-scores (delivery/quality/cost/compliance/responsiveness), purchase history, timeline, trend series, comparison, and the nine executive report types — lives in exactly one place: a new **Supplier Intelligence Engine** at the end of `db/services/data.js`. Electron (via 4 new IPC channels) and Mobile (via 4 new REST endpoints) both call the same four exported functions and render the same numbers; neither platform computes, re-derives, or duplicates any score or metric. No procurement workflow (RFQ, PO, Goods Receipt, Invoice, Approval) was modified — every touchpoint added to those areas is a read-only warning/display addition already present from Phase 3B, confirmed unchanged this phase. No new database table was needed; one column set was already added in Phase 3B, and this phase reuses it plus the existing PO/RFQ/quotation/receipt/invoice/contract tables exclusively.

---

## Architecture Decisions

**Single source of truth**: `_supplierIntelRows(user, filters)` — one consolidated SQL query (six pre-aggregated CTEs joined to `procurement_suppliers`, avoiding any one-to-many row fan-out) — is the only place supplier metrics are computed from raw data. `_computeSupplierIntelligenceRow()` — a pure function, no I/O — is the only place the weighted score, tier, risk indicators, and recommendation text are derived. Every one of the four exported functions (`supplierIntelligenceDashboard`, `procurementSupplierIntelligenceProfile`, `procurementSupplierComparison`, `procurementSupplierIntelligenceReports`) is a thin filter/sort/shape layer on top of these two functions — none of them re-implements scoring logic. This directly satisfies the brief's explicit requirement that `supplierIntelligenceDashboard`-style functions "become the single source of truth."

**Permission gate**: all four new functions (plus the engine itself) are gated on the existing `procurement-reports` permission — the same gate every pre-existing `procurementReport*`/`procurementAnalytics` function already uses, since this is the same category of work (analytics about suppliers, not supplier CRUD). Verified live: every role holding `procurement-suppliers` today (admin/ceo/procurement-officer/procurement-manager) already holds `procurement-reports` too, via the same `FULL_ACCESS_ROLES` grant in `db/migrate.js` — so this introduces no practical access change, and no new permission or migration was needed. Verified live that a role without `procurement-reports` (supervisor) is correctly denied.

**Scoring model** (weights sum to 100%): Delivery 30%, Quality 25%, Cost 15%, Compliance 15%, Responsiveness 15%. Sub-scores:
- **Delivery** = on-time delivery rate % (suppliers with no delivery-date history yet get a neutral 70, not 0 or 100, so a brand-new supplier isn't penalized or flattered by absence of data).
- **Quality** = `100 − rejectRatePct × 2`, clamped 0–100 (neutral 70 if no receipts yet).
- **Cost** = derived from average invoice-amount variance vs. the PO total (a real, computed signal — no market-price benchmark exists anywhere in this codebase to compare against, so invoice-vs-PO consistency is the closest honest proxy available); falls back to a small preferred-flag-based default only when no invoice history exists yet.
- **Compliance** = derived from active/expired contract presence (a supplier's contract terms are unstructured free text — see Phase 3 audit §8 — so a true terms-compliance check isn't computable; contract *existence and currency* is the defensible proxy).
- **Responsiveness** = average days between RFQ invitation (`sent_at`) and quotation submission (`received_at`), tiered.
- **Governance override**: a blacklisted supplier's score is forced to 0 regardless of transaction history (blacklist is an absolute governance fact from Phase 3B, not one weighted input among several); a suspended supplier's computed score is reduced by 40%. Tier bands: ≥80 Excellent, ≥60 Good, ≥40 Average, <40 High Risk — exactly the four labels the brief specified.

**"Trend" is real, not fabricated**: rather than store historical score snapshots (which would require a new table and can't be backfilled honestly for supplier history that predates this phase), trends are computed live from actual transactional history — monthly spend/PO-count/on-time-rate/reject-rate buckets for the Supplier Profile, and a lightweight month-over-month spend-direction query (scoped to only the ≤10 suppliers shown, not run for every supplier) for the Dashboard's Top Performers "Trend" column. This was a deliberate choice to avoid presenting fabricated or backfilled data as if it were tracked history.

**Executive Reports as one function, not nine**: all nine report types (Best, Worst, Preferred, High Risk, Blacklisted, Highest Spend, Most Reliable, Lowest Performing, Inactive, Contracts Near Expiry) are handled by a single `procurementSupplierIntelligenceReports(userId, reportType, filters)` function with a `switch` over report type — sorting/filtering the same engine output — rather than nine near-duplicate functions.

**CSV export reuses the existing mechanism** on both platforms: desktop calls the pre-existing `UFCL.execExport` IPC handler (already generic — takes `{csv, filename}`, opens a save dialog) with zero new IPC added for export; mobile follows the exact `Share.share({message, title})` pattern already established in `mobile/src/screens/reports/ExportScreen.tsx`. No new export infrastructure was built on either platform.

---

## Business Logic Reused (not duplicated)

- Phase 3B's blacklist/lifecycle status columns (`status`, `blacklisted`) and the delete-guard's 6-table history-check pattern (POs/RFQs/quotations/invoices/contracts/receipts) — the same join shape is reused in the engine's CTEs.
- `_svgGauge`/`_svgBar`/`_svgLine` (desktop) — the existing Executive Analytics/BI chart helpers, previously unused anywhere in Procurement, now render the score gauge, spend-distribution bar chart, and spend-trend line chart. `_svgGauge` gained one optional backward-compatible parameter (a label override) so it can show "Excellent/Good/Average/High Risk" instead of its original "Excellent/Good/Warning/Critical" bands — every existing caller (Executive/BI pages) is unaffected since the parameter defaults to the original behavior.
- `HorizontalExpenseChart`/`SparklineChart` (mobile) — the existing chart components, one of which (`HorizontalExpenseChart`) was already wired to supplier spend data in `ProcurementReportsScreen`'s Spend tab; both are now reused for the new Supplier Intelligence sections with zero new charting dependency.
- `procStatusBadge()`/`PROC_STATUS_META` (desktop) and `StatusBadge` (mobile) — both extended additively (new tier keys alongside the existing 26/28 status keys) rather than building a second badge system for score tiers.
- `wireSortableTable`, `procFilterBarHtml`, `skeletonTableRows`, `applyProcListFilters` (desktop) and `FormSelect`, `ListSearchBar`, `LoadingState`/`ErrorState`, the toast system (both platforms) — all reused as-is for the new Executive Reports tab and Comparison screen.

---

## Files Modified

| File | Nature of change |
|---|---|
| `db/services/data.js` | New Supplier Intelligence Engine appended at end of file: `_supplierScoreTier`, `_computeSupplierIntelligenceRow`, `_supplierIntelRows`, `supplierIntelligenceDashboard`, `procurementSupplierIntelligenceProfile`, `procurementSupplierComparison`, `procurementSupplierIntelligenceReports`, all exported. Zero changes to any pre-existing function. |
| `electron/main.js` | 4 new `secureHandle` registrations (`supplier-intel:dashboard/profile/compare/report`), all thin wrappers |
| `electron/preload.js` | 4 matching `window.UFCL` exposures; `_svgGauge` gained one optional parameter |
| `mobile-api/routes/procurementRequisitions.js` | 4 new `GET`/`POST` routes under `/meta/intelligence/*`, all thin wrappers |
| `mobile/src/api/endpoints.ts` | 4 new endpoint constants |
| `mobile/src/hooks/useProcurementIntelligence.ts` | New file — 4 thin fetch hooks, no client-side computation |
| `mobile/src/types/api.ts` | New types: `SupplierIntelligence`, `SupplierIntelligenceScores`, `SupplierIntelligenceKpis`, `SupplierIntelligenceDashboard`, `SupplierPurchaseHistoryItem`, `SupplierTimelineItem`, `SupplierTrendPoint`, `SupplierIntelligenceProfile` |
| `mobile/src/components/StatusBadge.tsx` | Extended additively with 4 score-tier colors/icons (Excellent/Good/Average/High Risk) |
| `mobile/src/navigation/types.ts` | New `SupplierComparison` route param |
| `mobile/src/navigation/stacks/ProcurementStack.tsx` | New `SupplierComparison` screen registration |
| `mobile/src/screens/procurement/SupplierComparisonScreen.tsx` | New file — supplier picker (2–4) + side-by-side metric comparison |
| `mobile/src/screens/procurement/ProcurementDashboardScreen.tsx` | Replaced the Phase 3B 6-tile "Supplier Overview" with the full 8-KPI Supplier Intelligence section + Top Performers + High Risk + Contract Summary + Spend Distribution chart |
| `mobile/src/screens/procurement/SupplierDetailScreen.tsx` | Replaced the 3-tile performance summary with score circle + 5 sub-score bars + risk indicators + recommendation + purchase history + timeline + trend sparklines |
| `mobile/src/screens/procurement/SuppliersListScreen.tsx` | New "Compare" header action |
| `mobile/src/screens/procurement/ProcurementReportsScreen.tsx` | New 6th "Intelligence" tab — report-type picker, results list, Share/CSV export |
| `renderer/app.js` | New `supplierTierBadge`/`spendTrendIcon`/`subScoreBar` helpers; `renderProcurementDashboard` rewritten with 8-KPI section + Top Performers/High Risk tables + Contract Summary + Spend Distribution + Spend Trend chart; `openSupplierManageOverlay` extended with score gauge + sub-scores + risk + recommendation + purchase history + timeline + trend chart; new `openSupplierComparisonOverlay`; `renderProcurementSuppliers` gained a compare-selection checkbox column + "Compare" toolbar button; `renderProcurementReports` gained a 6th "Intelligence" tab with report-type selector, search, sort, and CSV export; Audit Trail `typeOpts`/`typeBadge` — unaffected this phase (no new action types introduced) |

No file under `db/migrate.js` was touched this phase — confirmed no schema change was needed (see Architecture Decisions).

---

## UI/CSS Improvements

Every new element reuses existing design tokens — no new visual language was introduced on either platform, per the explicit instruction.

- **Desktop**: score gauge and sub-score bars reuse the existing SVG chart engine and `.mc`/`.kpi-card` component families; risk indicators and recommendations reuse the existing `.lerr` banner class and a card style already used for informational callouts elsewhere; the new Comparison overlay reuses `.dt`/`openOverlay()` exactly as every other overlay in the app; the Executive Reports tab reuses `.filter-bar`/`.filter-select`/`wireSortableTable`/`skeletonTableRows` identically to the other 5 report tabs.
- **Mobile**: the score display uses a simple bordered circle (no new dependency, consistent with the app's existing card-based Material-influenced style) rather than a custom SVG arc; sub-score bars are a small reusable local component matching the visual weight of existing stat tiles; risk/recommendation cards reuse the existing `errorBg`/`navyBg` color tokens already used for banners elsewhere in this same screen; the Comparison screen's chip-based multi-select reuses the exact chip visual language already established by `FilterBottomSheet`/`SuppliersListScreen`'s filter chips.
- Loading, empty, and error states throughout reuse `LoadingState`/`ErrorState`/`EmptyState` (mobile) and `skeletonTableRows`/`renderDenied`/the existing empty-row table pattern (desktop) — no new loading/error UI was built.

---

## Verification Results

- `node --check` — clean on `db/services/data.js`, `db/migrate.js`, `mobile-api/routes/procurementRequisitions.js`, `mobile-api/routes/procurementSuppliers.js`, `electron/main.js`, `electron/preload.js`, `renderer/app.js`.
- `cd mobile && npx tsc --noEmit` — clean, zero errors (two Ionicons name typos — `alert-triangle` → `warning` — were introduced and caught/fixed during development).
- **Engine correctness**, verified live against the database while it was reachable:
  - `supplierIntelligenceDashboard` — correct KPI totals, correctly ranked top performers and high-risk suppliers, correct contract summary and spend distribution.
  - `procurementSupplierIntelligenceProfile` — correct score/sub-scores, correct purchase history (POs+invoices+receipts merged), correct timeline (transactional events + audit-log lifecycle events merged and sorted), correct monthly trend (spend/PO-count/on-time-rate/reject-rate).
  - `procurementSupplierComparison` — correctly rejects fewer than 2 valid ids; correctly returns full intelligence rows for 2+ valid suppliers.
  - `procurementSupplierIntelligenceReports` — all 9 report types return correctly filtered/sorted rows; an invalid report type is correctly rejected.
- **Permission isolation**, verified live: a role holding only `procurement-dashboard`/`procurement-requisitions` (supervisor) is correctly denied access to all four new functions (`Access denied`); this matches the pre-existing behavior of every other `procurement-reports`-gated function — no regression, no broadened access.
- **Regression check**, verified live: `procurementDashboard` (pre-existing, untouched) and `procurementSuppliersList` (pre-existing, untouched) both still return correctly after this phase's changes.
- **Blacklist enforcement / audit logging** (Phase 3B features, not modified this phase): thoroughly verified live in the immediately-preceding Phase 3B work (invite/quotation/PO-generation/goods-receipt/invoice-creation all correctly blocked for a blacklisted supplier; `status_change`/`delete_blocked` audit entries confirmed written). Zero lines inside `procurementSupplierSetStatus`, `procurementSupplierDelete`, or any of the five blacklist-enforcement call sites were touched this phase — confirmed by direct review of this phase's edits, all of which are additive (new functions appended, or new `SELECT` columns added to `procurementRfqDetail`/`procurementPoDetail` in the *prior* phase, not this one). A final live re-verification of this specific pair (blacklist-then-invite, audit-log write) was attempted at the end of this phase but hit a transient database connectivity timeout unrelated to any code change (confirmed via a bare `select 1` connectivity probe failing the same way); given the code paths in question were not touched this phase and were already verified working in Phase 3B, this is noted honestly rather than re-asserted as freshly tested.
- **Workshop isolation**: not applicable to suppliers (suppliers are not workshop-scoped in this schema — confirmed no `workshop_id` column exists on `procurement_suppliers` in either the Phase 3 or 3C audits); no isolation logic exists to regress.

---

## Known Limitations

1. **Cost and Compliance sub-scores are proxies, not direct measurements** — no market-price benchmark or structured contract-terms data exists anywhere in this codebase to compute a "true" cost-competitiveness or terms-compliance score against, so invoice-variance and contract-currency are used as the closest honest, computable signals. Documented in-code and here rather than presented as more precise than they are.
2. **Dashboard-level "Trend" is spend-direction only** (up/down/flat for the top 10 performers), not a full historical score series — no historical score snapshots are stored (storing them would require a new table, avoided per the "no new tables unless absolutely necessary" instruction, and backfilling past scores for existing history would be fabricated data). Full quality/delivery/score trend charts exist at the per-supplier Profile level instead, where they can be honestly computed from real transactional history.
3. **`draft`/`pending_approval` supplier statuses** (Phase 3B) have no dedicated onboarding-approval UI, so in practice almost all suppliers carry a `status` of `active` or a governance-driven status — the Intelligence engine handles all six statuses correctly, but real-world score distribution will be dominated by `active` suppliers until/unless a future phase builds that workflow.
4. **Mobile's score "gauge" is a bordered circle, not an animated arc** — a deliberate simplicity choice (no new dependency, faster to build, matches the app's existing Material-influenced card style) rather than a limitation of what's possible; desktop's SVG gauge remains the more visually elaborate of the two, which is an acceptable, intentional platform difference in presentation (not in the underlying data or functionality).
5. **Live database was briefly unreachable at the very end of this phase's verification pass** — see Verification Results above; does not affect any delivered functionality, all of which was verified earlier in the same session while the database was reachable.

## Recommendations

- Consider a future, explicitly-scoped phase to build the Draft → Pending Approval → Active supplier onboarding workflow (reusing the existing generic `procurement_approval_steps` table/`procurementApprovalAction` dispatcher pattern already used for requisitions), which would make the `draft`/`pending_approval` statuses meaningfully populated rather than rarely used.
- If a market-price/cost-benchmark data source is ever introduced (e.g., a "standard price" field per stock-catalog item), the Cost sub-score should be revisited to compare actual PO unit prices against it, which would be a materially stronger signal than the current invoice-variance proxy.
- If historical score tracking becomes a real business need, a lightweight monthly snapshot table (written by a scheduled job, not on every read) would let the Dashboard's "Trend" column show genuine score history instead of the current spend-direction proxy — deliberately not built this phase to avoid a new table without a demonstrated need.
