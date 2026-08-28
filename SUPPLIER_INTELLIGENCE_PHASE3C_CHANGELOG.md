# Supplier Intelligence — Phase 3C Changelog

Analytics layer only — no procurement workflow, governance rule, or database schema was changed. Full rationale in `SUPPLIER_INTELLIGENCE_PHASE3C_COMPLETION_REPORT.md`.

## Added

**Backend (`db/services/data.js`) — the Supplier Intelligence Engine, single source of truth for both platforms:**
- `_supplierIntelRows(user, filters)` — one consolidated query (6 pre-aggregated CTEs: POs, receipts, delivery timing, invoices, RFQ response time, contracts) computing every raw metric per supplier.
- `_computeSupplierIntelligenceRow(row)` — pure scoring function: 5 weighted sub-scores (Delivery 30%, Quality 25%, Cost 15%, Compliance 15%, Responsiveness 15%), a 0–100 overall score, a tier (Excellent/Good/Average/High Risk), risk indicators, and a templated recommendation.
- `supplierIntelligenceDashboard(userId, filters)` — 8 executive KPIs (Total/Active/Preferred/Blacklisted/High Risk Suppliers, Contracts Expiring, Total Spend, Average Score), Top Performers (with month-over-month spend trend), High Risk Suppliers (with primary issue + recommendation), Contract Summary, Spend Distribution.
- `procurementSupplierIntelligenceProfile(userId, supplierId)` — full single-supplier intelligence: score/sub-scores/risk/recommendation, purchase history (POs+invoices+receipts merged), timeline (transactional + audit-log lifecycle events merged), 6-month trend (spend, PO count, on-time rate, reject rate).
- `procurementSupplierComparison(userId, supplierIds)` — side-by-side intelligence for 2+ suppliers.
- `procurementSupplierIntelligenceReports(userId, reportType, filters)` — 9 executive report types (Best/Worst/Preferred/High Risk/Blacklisted/Highest Spend/Most Reliable/Lowest Performing/Inactive/Contracts Near Expiry) via one function.
- All 4 exported functions gated on the existing `procurement-reports` permission — no new permission, no migration.

**Transport (thin wrappers only, zero business logic):**
- Electron: `secureHandle('supplier-intel:dashboard'|'profile'|'compare'|'report', ...)` (`electron/main.js`) + matching `window.UFCL.supplierIntelligence*` (`electron/preload.js`).
- Mobile: `GET/POST /api/procurement/requisitions/meta/intelligence/{dashboard,profile/:id,compare,reports/:type}` (`mobile-api/routes/procurementRequisitions.js`) + endpoint constants (`endpoints.ts`) + `useProcurementIntelligence.ts` (4 thin fetch hooks).

**Desktop UI (`renderer/app.js`):**
- Procurement Dashboard: 8-KPI Supplier Intelligence section, Top Performing Suppliers table, High Risk Suppliers table, Contract Summary, Spend Distribution bar chart, Procurement Spend Trend line chart.
- Suppliers page: compare-selection checkboxes + "Compare" toolbar button.
- New `openSupplierComparisonOverlay()` — side-by-side metric comparison table with winner highlighting.
- Supplier "Manage" overlay: score gauge, 5 sub-score bars, risk indicators, recommendation, Purchase History table, Timeline, 6-month trend chart (spend + reject rate).
- Procurement Reports page: new 6th "Intelligence" tab — report-type selector, search, sortable columns, CSV export (reusing the existing `execExport` mechanism).

**Mobile UI:**
- `ProcurementDashboardScreen`: same 8-KPI/Top-Performers/High-Risk/Contract-Summary/Spend-Distribution content as desktop.
- `SupplierDetailScreen`: score circle, 5 sub-score bars, risk/recommendation cards, Purchase History card, Timeline card, trend sparklines (spend + reject rate).
- New `SupplierComparisonScreen` — chip-based 2–4 supplier picker + side-by-side comparison table; reachable from a new "Compare" header action on `SuppliersListScreen` and from Dashboard Quick Access.
- `ProcurementReportsScreen`: new 6th "Intelligence" tab — report-type picker, results list, Share/CSV export (reusing the existing `Share.share` pattern from `ExportScreen.tsx`).
- `StatusBadge` component: extended with 4 score-tier colors/icons (additive, all 28+ existing status keys unaffected).

## Changed
- `_svgGauge(score, labelOverride)` (desktop) — gained one optional parameter so it can display "Excellent/Good/Average/High Risk" instead of its original bands; defaults to prior behavior, every existing Executive/BI caller unaffected.
- Desktop Procurement Dashboard and Supplier Manage overlay: the Phase 3B 6-tile "Supplier Overview"/3-tile performance summary were superseded by the richer Phase 3C sections (consolidated, not duplicated — the old sections' data is a strict subset of what the new sections show).
- Mobile Procurement Dashboard and Supplier Detail screen: same consolidation as desktop, for platform parity.

## Fixed
- N/A — this phase adds new capability; no defects were in scope to fix (governance/blacklist/lifecycle fixes were Phase 3B).

## Explicitly not changed (out of scope for this phase)
- No RFQ, Purchase Order, Goods Receipt, Invoice, or Approval workflow logic — every function in those areas is untouched; the only prior touch to `procurementRfqDetail`/`procurementPoDetail` (adding a `blacklisted` column to their `SELECT`) was Phase 3B, not this phase.
- No Supplier Governance change (activate/deactivate/blacklist/restore/delete, and their permission model) — Phase 3B's `procurementSupplierSetStatus`/`procurementSupplierDelete` and the `procurement-suppliers-governance` permission are untouched.
- No new database table or column — the Phase 3B lifecycle columns and all pre-existing PO/RFQ/quotation/receipt/invoice/contract tables were sufficient for every Phase 3C feature.
- No new chart library on either platform — desktop reuses its existing hand-rolled SVG helpers; mobile reuses `react-native-gifted-charts`-backed `HorizontalExpenseChart` and the raw-SVG `SparklineChart`.
- No AI/ML — the "recommendation" text is deterministic, rule-based templating over the computed tier and top risk indicator, not a generative or learned system.
