# UFCL ERP — Sawmill Enterprise Audit
### Backend + Desktop + Mobile + End-to-End Business Process Audit

**Read-only.** No code, schema, workflow, or permission changes were made in the course of this audit. Findings synthesized from three parallel research passes (Backend/`db/services/data.js`+`db/schema.sql`+`db/migrate.js`, Desktop/`renderer/app.js`, Mobile/`mobile/src/`), cross-checked against each other, plus a small number of direct verification greps to resolve discrepancies between the three passes. Every finding below is backed by a file:line reference. Methodology matches the Mechanician and Harvesting enterprise audits that preceded this one.

---

## 1. Executive Summary

Sawmill is **functionally the most mature of the three most-recently-audited departments on the production side** (production entry itself — CRUD, validation, multi-size volume tracking, inbound-stock enforcement — was just rebuilt this session and is genuinely enterprise-grade), but it is **the least connected department end-to-end**. Three findings dominate:

1. **The pipeline has a real, confirmed break, not just a UI inconvenience**: Finished Timber Inventory (`mv_stock_summary`) and Stock Transfer (`stock_catalog`/`stock_levels`) are two parallel, disconnected stock systems. A live database query confirms **zero Timber-category items have ever existed in `stock_catalog`**, so Timber stock has never once moved through a Stock Transfer in production data — the "Stock Transfer" stage of the requested workflow diagram does not functionally exist for Timber today.
2. **Mobile has Create+Read only** for the core Sawmill Timber Entry — no Edit, no Delete, and the mobile-api backend has no `PUT`/`DELETE` route to support them even if a screen were built. This is a full-stack gap, not just a missing screen.
3. **Zero cross-navigation exists anywhere in the pipeline** on desktop — every hop (Harvesting→Sawmill, Sawmill→Inventory, Inventory→Transfer, Transfer→VAT, VAT→Sales) is reachable only by manually using the sidebar; pages show consistent numbers but never a "continue to next stage" link.

Everything downstream of a Stock Transfer (VAT intake linking, Sales drawing from shared stock figures) is correctly wired *in code*, but is currently unreachable in practice because the Stock Transfer stage itself is inert for Timber. Recovery/yield tracking (the volume-comparison feature built this session) is real and live but explicitly excludes grading — no A/B/C timber-grade concept exists anywhere in the system.

---

## 2. Business Process Verification

Requested workflow: **Raw Logs → Log Reception → Log Selection → Sawing → Timber Production → Recovery/Yield → Finished Timber → Finished Timber Inventory → Stock Transfer → VAT Production → Sales**

| Stage | Exists? | Evidence |
|---|---|---|
| Raw Logs | ✅ | `harvest_logs` (Harvesting module) |
| Log Reception | ✅ (as a computed balance, not a discrete receiving event) | `_rawLogAvailableStock()` (`data.js:681-693`) — cumulative `harvest_logs.logs_handrolled − daily_logs.logs_received`, workshop-scoped. No individual log/lot is "received" as a record — it's a running balance check. |
| **Log Selection** | ❌ **Does not exist** | No code anywhere selects, reserves, or grades specific logs before sawing. `logs_received` is a plain count entered on the production form; there's no lot/batch identity connecting a specific harvested log to a specific production entry. |
| Sawing | ✅ | `dailyCreate`/`dailyUpdate` (`data.js:723`, `6130`) — machine + multi-size `daily_log_items` |
| Timber Production | ✅ | `daily_logs.timber_units` (+ kiln-dried/CCA/untreated sub-type buckets) |
| Recovery / Yield | ⚠️ **Partial** | `actualVolumeM3`/`expectedVolumeM3` computed per entry (`dailyList`, `data.js:641-643`) and a recovery % is derivable client-side — but the backend never stores or returns a yield % itself, and **no grading concept exists at all** (confirmed: zero hits for "grade" outside of an unrelated supplier-health-score field). `log_diameter_cm` is captured but explicitly documented as unused in any calculation. |
| Finished Timber | ✅ | `mv_stock_summary`'s `produced` CTE, fed by `daily_logs.timber_units` (`migrate.js:445-481`) |
| Finished Timber Inventory | ✅ | `timberInventoryList` (`data.js:5305`), desktop `renderTimberInventory` (`app.js:12976`), mobile `TimberInventoryScreen.tsx` |
| **Stock Transfer** | ❌ **Confirmed broken/inert for Timber** | `stock_transfers` moves items from `stock_catalog`/`stock_levels` — a completely separate model from `mv_stock_summary`. Live query: `select distinct category from stock_catalog` → `{CHAIN, Consumables, FOOD, Spare Parts}`, zero Timber items ever catalogued; `count(*) from stock_transfers where item joined to a Timber-category stock_catalog row` → **0**. The stage is architecturally possible (the generic Stock Transfer functions would work for any catalogued item) but has never been used for Timber and nothing populates it. |
| VAT Production | ⚠️ **Confirmed integration, but sources from the (inert) Stock Transfer stage, not from Finished Timber Inventory directly** | `vatInboundList`/`valueAddedTimberCreate` (`data.js:7078`, `7126`) validate against `stock_transfers.received_qty`. Given Stock Transfer's inertness above, this validation path is real but **currently dormant** — VAT entries in practice appear to be created with `source_transfer_id = null` (no validation applied), bypassing the intended chain. |
| Sales | ✅ (accounting), ⚠️ (no availability enforcement) | `sales_orders` feeds `mv_stock_summary`'s `sold` CTE — confirmed integration. But `salesCreate` (`data.js:1016`) has **no stock-availability check** at all before insert (unlike `dailyCreate`'s log-yard check or the poles-delivery check) — a sale can push computed `timber_stock` negative with nothing preventing it. |

**Conclusion:** the requested 10-stage diagram is roughly **6.5 of 10 stages genuinely functional**, 1 stage (Log Selection) doesn't exist as a concept, 1 stage (Stock Transfer) is code-complete but has zero live usage and is architecturally disconnected from the Timber stock model, and Recovery/Yield is a partial, non-graded implementation.

---

## 3. Page-by-Page Audit

| Page | Page-key | Backend | Desktop | Mobile |
|---|---|---|---|---|
| **Sawmill Timber Entry** | `daily-timber` (desktop/backend) / `sawmill.write` (mobile permission string — see §9) | `dailyList/Create/Update/Delete` (`data.js:587,723,6130,6188`) | `renderDailyTimber`/`renderPageDailyTimber` (`app.js:1655,1755`) — full CRUD, richly featured (recently rebuilt) | `SawmillProduction{List,Create,Detail}Screen.tsx` — **Create + Read only** |
| **Timber Inventory** | `timber-inventory` | `timberInventoryList` (`data.js:5305`) | `renderTimberInventory` (`app.js:12976`) — read-only, zero interactive elements | `TimberInventoryScreen.tsx` — exists, feature-rich, but **not reachable by any Sawmill role** (wired only into CEO/Logistics/Operations/Supervisor navigators; `sawmill-leader`/`sawmill-supervisor` don't hold the `timber.inventory` mobile permission) |
| **Value-Added Timber (VAT)** | `value-added-timber` | `vatInboundList`, `valueAddedTimber{List,Create,Update,Delete}` (`data.js:7078,7103,7126,12086,7163`) | `renderValueAddedTimber` (`app.js:14713`) — full CRUD | `Vat{Inbound,Intake,Processing,Detail}Screen.tsx` — full-featured, but a **separate role/department** (`vat-leader`/`vat-supervisor`), no cross-link to/from Sawmill on either platform |
| **Product Catalog** ("Timber sizes" reference data) | `products` | Two **parallel, non-equivalent** backend systems exist (see finding in §13): `productsList/Create/Update/ActiveForForm` (`data.js:1106,1134,12175,1194`) — this is what desktop actually uses; and a separate, fully orphaned `productCatalogList` (`data.js:824`) wired all the way through IPC (`main.js:321`, `preload.js:98` as `UFCL.productsCatalog`) but **never called from `renderer/app.js` at all** | `renderProducts` (`app.js:4246`) — Create + Activate/Deactivate only. **`productsUpdate` exists in the backend but is never called from desktop** — a real, narrow backend-not-exposed gap. | No mobile screen |
| **Machine Registry / Machine Logs** (cross-department, includes Sawmill machines) | `machines` / `machine-logs` | Full CRUD families (`data.js:10653-10944` range) | `renderMachines`/`renderMachineLogs` (`app.js:13053,13590`) — full enterprise toolkit (search/sort/filter/bulk) | Shared `MaintenanceJobs` tab only (generic, not sawmill-machine-specific); no dedicated Machine Registry/Logs screens exposed to Sawmill roles |
| **Executive Dashboard / BI** | `executive` / `bi` | `executiveDashboard`/`businessIntelligenceDashboard` (`data.js:8609,9627`) | `renderExecutiveDashboard`/`renderBI` (`app.js:5221,5727`) — Workshop Production chart (Timber+Poles combined, not broken out) | `CeoOverviewScreen.tsx` Production section (combined Timber+Poles units); `ExecutiveScreen.tsx` "Workshop output" trend (same combination) |
| **Log Transport** (upstream feeder) | `log-transport` | `logTransportList` etc. (Harvesting module) | `renderLogTransport` (`app.js:14486`) — Add+Delete only, no Edit/search/sort | (Harvesting module, out of this audit's scope) |
| Legacy "Daily Production Log" | `daily` | `dailyList` (shared) | `renderDaily` (`app.js:1579`) — **confirmed orphaned/dead**: still has a `case` in `showPage()` and a container div in `index.html`, but no NAV entry and nothing calls `showPage('daily')` | — |

---

## 4. Backend vs Desktop Comparison

**Backend capabilities desktop fully exposes:** Sawmill Timber Entry CRUD (incl. the new multi-size/diameter/time fields), Timber Inventory read, VAT full CRUD, Machine Registry/Logs/KPI/Fuel full CRUD, Product Catalog create + activate/deactivate.

**Backend capabilities desktop does NOT expose:**
- `productsUpdate` (`data.js:12175`) — Product Catalog has no Edit button on desktop despite the backend supporting it.
- `productCatalogList`/the entire `product_catalog` table path — fully wired through IPC (`products:catalog` → `UFCL.productsCatalog`) but never invoked anywhere in `app.js`. This is dead, unused plumbing sitting alongside the real `products` table system desktop actually uses — worth a decision (remove the dead path, or determine if it was meant for something that never got built).
- Per-record detail/view and audit-history for `daily_logs` — **this one isn't a UI gap, it's a shared gap**: the backend itself has no `dailyGet`/dailyDetail function and `daily_logs` isn't in `logisticsRecordHistory`'s permission map, so there's nothing for desktop to call even if a "View Details" button were added.

**Desktop UI gaps not attributable to backend (pure presentation debt):** Daily Timber, Timber Inventory, VAT, and Product Catalog have never been upgraded to the shared enterprise table toolkit (`procFilterBarHtml`/`wireSortableTable`/`emptyRowHtml`) that Machine Registry, Machine Logs, and Stock Transfers already use — see §11.

---

## 5. Backend vs Mobile Comparison

**Backend capabilities mobile fully exposes:** Sawmill Timber Entry Create + List (with the full new multi-size/diameter/time/volume feature set).

**Backend capabilities mobile does NOT expose, and the gap is full-stack (not just a missing screen):**
- **Update**: no `SawmillProductionEdit` screen, no `useSawmillUpdate` hook, no `SAWMILL_UPDATE` endpoint constant, **and no `PUT` route in `mobile-api/routes/sawmill.js` at all** — confirmed the mobile-api backend itself only registers `GET /` and `POST /`.
- **Delete**: same story — no screen, no hook, no endpoint constant, **no `DELETE` route in `mobile-api/routes/sawmill.js`**.
- Timber Inventory: the mobile screen (`TimberInventoryScreen.tsx`) exists and calls a real endpoint (`GET /api/timber-inventory`), but is unreachable by Sawmill roles due to navigator wiring + permission gating (§9), not a missing screen.
- VAT: fully built on mobile, but as a separate role/department, same as desktop.
- Machine Registry/KPI-target management: desktop-only; Sawmill mobile roles only get the shared Maintenance Jobs tab (create/view jobs on machines, not register/edit machines or set KPI targets).

**Permission-string mismatch worth flagging for reconciliation:** desktop/backend gate Sawmill via the page-key `daily-timber`; mobile gates the identical capability via a synthetic, unrelated string `sawmill.write` mapped 1:1 to the `sawmill-leader`/`sawmill-supervisor` roles rather than to the backend's actual permission key. The two systems currently produce the same practical result only because roles happen to be configured consistently — there is no structural guarantee they'll stay in sync if permissions are edited independently on either side.

---

## 6. CRUD Audit

| Capability | Backend | Desktop | Mobile |
|---|---|---|---|
| Create (production entry) | ✅ `dailyCreate` | ✅ | ✅ |
| Read — list | ✅ `dailyList` | ✅ | ✅ |
| Read — single-record detail | ❌ no dedicated function anywhere | ❌ no view-only overlay (only Edit doubles as view) | ✅ (route-param display only, no live re-fetch) |
| Update | ✅ `dailyUpdate`, governance-gated | ✅ | ❌ **not built, no route exists** |
| Delete | ✅ `dailyDelete`, governance-gated, soft-delete | ✅ | ❌ **not built, no route exists** |
| Archive | — (soft-delete via Trash *is* the archive mechanism) | — (same) | — |
| Restore | ✅ `trashRestore`, generic, `admin/ceo/operations` only | ✅ via generic Trash page only (no restore control on the Daily Timber page itself) | Not present |
| Duplicate | ❌ absent everywhere (repo-wide, not Sawmill-specific) | ❌ | ❌ |
| Cancel | N/A (no status/workflow-state column on `daily_logs`) | Overlay Cancel button only (form dismissal, not a business "cancel") | N/A |
| Audit/edit history per record | ❌ `daily_logs` excluded from `logisticsRecordHistory`'s permission map (unlike Machines/Vehicles/Stock Transfers) | — | — |

**Product Catalog CRUD** (the `products` table desktop actually uses): Create ✅, Read ✅, Update ⚠️ (backend exists, no UI), Delete — soft toggle (Active/Inactive) only, no true delete.

**VAT CRUD**: Create/Read/Update/Delete all ✅ on backend + desktop; absent on the generic Sawmill mobile role (VAT is its own mobile role/app section entirely).

---

## 7. Workflow Audit

- **Production planning**: does not exist for Sawmill (no equivalent of Harvesting's `harvest_plans`) — production is purely reactive/logged-after-the-fact, no forward scheduling.
- **Daily production**: ✅ fully built (this session).
- **Machine operation**: ✅ via `machine_daily_logs` (shared with all departments), workshop-scoped.
- **Timber grading**: ❌ does not exist (confirmed, §2).
- **Timber dimensions**: ✅ fully built this session (`daily_log_items`).
- **Timber recovery/yield**: ⚠️ partial — computed per-entry, not stored as a standalone %, no historical trend of recovery over time exists anywhere (contrast with Harvesting Phase 3's `harvestPerformance()` daily/weekly/monthly trend — no Sawmill equivalent).
- **Waste recording**: ✅ `timber_waste` field + `wasteRate` computed in `timberInventoryList`.
- **Production completion**: N/A — no discrete "complete" state for a production entry (no status column).
- **Inventory handoff**: ✅ automatic via `mv_stock_summary`, no manual handoff step needed — but see §2's Stock Transfer break for the *next* handoff.

**Backend capabilities unreachable from either UI:** `productsUpdate` (desktop-only gap, mobile has no Product Catalog screen at all so it's doubly unreachable there); the entire `productCatalogList`/`product_catalog` path (unreachable from both UIs, confirmed dead code); Sawmill Timber Entry Update/Delete on mobile (backend has them, mobile-api route layer doesn't).

---

## 8. Dashboard Audit

| Metric | Desktop | Mobile | Management/Executive | CEO |
|---|---|---|---|---|
| Daily production | ✅ Timber Inventory "Last 7 days" table | ✅ `TimberInventoryScreen` (unreachable by Sawmill role) / `TodayBanner` on Sawmill list (today only) | — | — |
| Weekly production | ✅ `weeklyPerformanceReport` backend exists; not workshop-scoped (flagged as a possible bug) | — | ✅ Workshop Production chart (12wk, Timber+Poles combined) | — |
| Monthly production | — (no monthly rollup found anywhere) | — | — | — |
| Yield / Recovery % | ✅ per-entry only, no trend | ✅ per-entry (detail screen) | — | — |
| Waste % | ✅ `timberInventoryList.wasteRate` | ✅ same, on the unreachable Timber Inventory screen | — | — |
| Timber output | ✅ | ✅ | ✅ (combined w/ Poles) | ✅ (combined w/ Poles, "Timber Units" KPI) |
| Finished inventory | ✅ `mv_stock_summary` breakdown | ✅ (unreachable) | — | — |
| Production trend | — (no dedicated Sawmill-only trend; only the combined Workshop chart) | — | ✅ combined w/ Poles | ✅ combined w/ Poles (`ExecutiveScreen` "Workshop output") |
| Machine utilization | ✅ `machineKpiPerformance` | Not surfaced for Sawmill roles specifically | ✅ `topMachines` (efficiency %) | — |
| Downtime | ✅ per-entry `downtime_hours`/`downtime_reason` | ✅ per-entry | — | ✅ combined-production "Downtime Hours" KPI (red if review-required) |
| Performance (BI) | ✅ `businessIntelligenceDashboard`, `sawmill-leader`/`sawmill-supervisor` see `['health','fuel','machines','workshop']` sections | — (mobile has no BI screen equivalent found) | ✅ | Partial (`reports.bi` yes, `reports.executive` no for either Sawmill role) |

**No dashboard anywhere breaks Sawmill out from Poles** — every production trend/chart figure found (desktop Executive Dashboard, BI, mobile CEO Overview, mobile ExecutiveScreen) sums `daily_logs.timber_units + poles_units` together with no way to isolate Sawmill's own contribution.

---

## 9. Permission Audit

**Live `role_definitions` grants** (queried read-only), condensed:

| Role | daily-timber | timber-inventory | value-added-timber | machine-logs | machines | machine-kpi | stock-transfers |
|---|---|---|---|---|---|---|---|
| admin / ceo / operations | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| supervisor | ✔ | ✔ | ✔ | ✔ | — | — | ✔ |
| **sawmill-leader** | ✔ | ✔ | — | ✔ | — | — | — |
| **sawmill-supervisor** | ✔ | — | — | — | — | — | — |
| vat-leader | — | ✔ | ✔ | — | — | — | — |
| showroom-staff | — | ✔ | — | — | — | — | — |

**Notable mismatches/gaps found:**
- `sawmill-supervisor` can create/edit production entries but **cannot view Timber Inventory** (no `timber-inventory` grant) — a role that produces the data can't see the aggregate result of its own work on desktop.
- Neither `sawmill-leader` nor `sawmill-supervisor` holds `machines`/`machine-kpi` live — they can log daily machine activity and fuel, but cannot register/edit machines or set KPI targets. Only `admin/ceo/operations` can.
- `showroom-staff` (a sales-facing role) holds `timber-inventory` despite having no production responsibility — plausibly intentional (checking stock before quoting a sale) but worth confirming with the business.
- **Mobile's permission string (`sawmill.write`) is entirely disconnected from the backend/desktop permission key (`daily-timber`)** — see §5. There's no code-level guarantee these stay aligned.
- `executive` and `bi` desktop pages have **no checkbox in the role-editor UI at all** (`renderPermissionCheckboxes`, `app.js:364-431`) — an admin cannot grant or revoke access to the Timber/Poles Workshop Production chart from the Roles screen; it must be edited directly in the database/role JSON.
- `mustRole`-gated VAT functions fall back to a **hardcoded role array** (`['admin','ceo','operations','supervisor']`) rather than pure `mustRole`, and Delete's fallback array is narrower (`['admin','ceo','operations']`, no `supervisor`) than Create/Update's — an inconsistency worth reconciling.
- `productCatalogList` uses a **hardcoded role array** instead of `mustRole`, meaning a custom role granted `products`/`daily-timber` via the Roles admin UI would silently be denied by this specific function (though moot given the function is dead code per §4).

---

## 10. Cross-Department Integration Audit

| Integration | Status | Evidence |
|---|---|---|
| Harvesting → Sawmill | **Confirmed** (computed balance, no FK) | `_rawLogAvailableStock()` (`data.js:681-693`) |
| Sawmill → Finished Timber Inventory | **Confirmed** | `mv_stock_summary`'s `produced` CTE reads `daily_logs.timber_units` directly |
| Finished Timber Inventory → Stock Transfer | **Missing / Broken** | Two disconnected stock models (`mv_stock_summary` vs. `stock_catalog`); zero Timber items ever catalogued, zero transfers ever moved Timber (live DB confirmed) |
| Stock Transfer → VAT Production | **Confirmed in code, dormant in practice** | `vatInboundList`/`valueAddedTimberCreate` validate against `stock_transfers`, but that table has never carried Timber; VAT entries appear to be created without a source transfer in practice |
| VAT → Sales | **Confirmed** (data-consistent, no navigation link) | Both independently read the same `mv_stock_summary`-derived stock figures |
| Sawmill → Procurement | **Missing** (structural) | No table links `machines`/production to a requisition; Sawmill roles can submit generic free-text requisitions only |
| Sawmill → Mechanician | **Confirmed, working** | `maintenance_jobs.machine_id → machines(id)`; Sawmill-category machines are ordinary `machines` rows, fully addressable by the shared maintenance system; `sawmill-leader`/`poles-leader` hold `maintenance-jobs` live |
| Sawmill → Fleet | **Confirmed no link** (by design — different domains) | `machines`/`daily_logs` never reference `vehicles`; only a shared fuel-log dropdown convenience-unions the two for UI purposes |
| Sawmill → Sales | **Confirmed** (accounting only, no availability enforcement) | `sales_orders` feeds `mv_stock_summary`'s `sold` CTE; `salesCreate` has no stock-check guard (a Sales-module gap surfaced by this audit, not strictly a Sawmill-module defect) |

---

## 11. UI/UX Audit

| Page | Search | Sort | Filters | Status badges | Empty state | Loading state | Export | Bulk actions | Quick Actions |
|---|---|---|---|---|---|---|---|---|---|
| Daily Timber (desktop) | ❌ | ❌ | ❌ | Partial (Pending Deletion only) | Hand-typed | ✅ | Global Exports page only (mixed Timber+Poles, not filtered) | ❌ | ❌ |
| Timber Inventory (desktop) | ❌ | ❌ | ❌ | ❌ | Hand-typed | **❌ none** | ❌ | ❌ | ❌ |
| VAT (desktop) | ❌ | ❌ | ❌ | ✅ | Hand-typed | ✅ | ❌ | ❌ | ❌ |
| Product Catalog (desktop) | ❌ | ❌ | ✅ chip filters | ✅ | Hand-typed | **❌ none** | ❌ | ❌ | ❌ |
| Machine Registry/Logs (desktop, for comparison) | ✅ | ✅ | ✅ | ✅ | Richer hand-built | ✅ | ❌ | ✅ (Registry only) | ❌ |
| Sawmill list (mobile) | ✅ (`searchModule="production"`) | N/A | N/A | N/A | `EmptyState` component | `LoadingState`/`ErrorState` | N/A | N/A | N/A |
| Sawmill create (mobile) | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| Timber Inventory (mobile, unreachable) | ✅ | N/A | N/A | N/A | Full | Full | N/A | N/A | N/A |

**None of the four core desktop Sawmill pages** (Daily Timber, Timber Inventory, VAT, Product Catalog) have been upgraded to the shared enterprise table toolkit (`procFilterBarHtml`/`wireSortableTable`/`emptyRowHtml`) that Machine Registry/Logs and Stock Transfers already use, despite sitting immediately adjacent to those pages in the actual workflow. This is presentation debt, not a functional blocker.

**No `window.print()` anywhere in the four core Sawmill pages** (print exists elsewhere — Executive Dashboard, BI, some Procurement/report screens) — no print support for Timber Inventory or VAT records. No CSV export scoped to Timber specifically (only the generic mixed Timber+Poles "Daily logs" export on the separate Exports page).

---

## 12. End-to-End Workflow Audit

Can an operator complete Raw Log Reception → Production → Finished Timber → Inventory → Stock Transfer → VAT/Sales purely through the UI?

1. Log a Sawmill Timber Entry → ✅ works, rich feature set.
2. → See it in Timber Inventory → ⚠️ **partially**: the entry's `timber_units` total does flow through, but the redesigned entry form hard-codes `timber_kiln_dried: 0, timber_cca_treated: 0, timber_untreated: 0` in its save payload (`app.js:1919, 2005-2008`) — a plain Sawmill Timber Entry **never populates** the Kiln/CCA/Untreated sub-type breakdown Timber Inventory displays; only VAT entries populate those buckets. The "Timber produced" total and the sub-type breakdown table below it don't reconcile for raw sawmill output.
3. → Move stock via Stock Transfer → ❌ **breaks here**: no UI action anywhere initiates a transfer of Timber Inventory stock; a user must manually go to the generic Stock Transfers page and pick from an unrelated warehouse-stock dropdown not demonstrably tied to any specific Sawmill entry.
4. → See it consumed in VAT Production → ✅ *if* a transfer happened to get created and land in `vatInboundList`, VAT's "Link to inbound transfer" dropdown is the single best-connected hop in the entire chain — but per §10 this is dormant in live data.
5. → See it sold in Sales → ✅ data-consistent (shared stock figures), zero navigation link.

**Every transition in this chain is possible in principle, but transition #3 has no supporting UI and no live usage — it is the actual break point**, not a cosmetic inconvenience.

---

## 13. Business Gaps

1. **No "Log Selection" stage** — logs aren't identified/reserved/graded before sawing; production only records an aggregate count against a running balance.
2. **No timber grading** (A/B/C or equivalent) anywhere in the system — only size and a fixed 50% recovery-rate assumption.
3. **No production planning** for Sawmill (Harvesting has `harvest_plans`; Sawmill has no equivalent forward-scheduling capability).
4. **Stock Transfer is architecturally disconnected from Finished Timber Inventory** — the single biggest business-process gap found (§2, §10).
5. **Sales has no stock-availability enforcement** for Timber (can oversell; a Sales-module issue surfaced by this Sawmill audit).
6. **No recovery/yield trend over time** — only a per-entry snapshot, no daily/weekly/monthly rollup (contrast with Harvesting's `harvestPerformance()`).
7. **`weeklyPerformanceReport` is not workshop-scoped**, unlike nearly every other Sawmill-adjacent query — a likely oversight worth a dedicated look before relying on it for multi-workshop reporting.

---

## 14. UI Functional Gaps

1. Mobile: no Edit/Delete for production entries (full-stack, §5/§6).
2. Mobile: Timber Inventory screen built but unreachable by any Sawmill role (navigator + permission gap, §3/§9).
3. Desktop: no Edit for Product Catalog despite backend support (`productsUpdate` unused, §4).
4. Desktop: dead/orphaned `productCatalogList`/`product_catalog` IPC path — fully wired, never called (§4).
5. Desktop: legacy `renderDaily`/"Daily Production Log" page is orphaned dead code (no NAV entry, unreachable) — same pattern as the `renderHarvest` dead-code finding from the Harvesting audit.
6. Desktop: zero search/sort/filter on Daily Timber, Timber Inventory, VAT, Product Catalog (§11).
7. Desktop: no loading-state indicator on Timber Inventory or Product Catalog (brief blank-then-populate flash).
8. Desktop: `executive`/`bi` pages have no role-editor checkbox — access can't be toggled from the Roles UI.
9. No print/export scoped to Timber specifically anywhere.
10. No "View Details" (read-only) overlay for a production entry on desktop — only Edit doubles as the detail view.
11. No per-record audit/edit-history for `daily_logs` (backend + UI both lack it).

---

## 15. Broken Workflows

1. **Finished Timber Inventory → Stock Transfer**: confirmed non-functional in live data (§2, §10, §12 transition #3) — the single confirmed "broken," not just "missing," workflow in this audit.
2. **Sawmill Timber Entry → Timber Inventory sub-type breakdown**: silently non-reconciling (plain entries never populate Kiln/CCA/Untreated; only VAT does) — a data-shape mismatch a user could misread as a bug in the inventory numbers.

Everything else catalogued in this report is a **gap** (missing capability) rather than a **break** (existing capability behaving incorrectly).

---

## 16. Priority Matrix

**Critical**
- Fix or formally deprecate the Finished Timber Inventory → Stock Transfer disconnect (§2, §10, §15#1) — this is the one true broken workflow and blocks the entire downstream chain (VAT sourcing, ultimately Sales) from ever reflecting reality.
- Build mobile Edit/Delete for Sawmill Timber Entry, including the missing `mobile-api` routes (§5, §6) — governance/data-integrity risk: field staff currently have no way to correct a mistaken mobile entry without switching to desktop.

**High**
- Reconcile the plain-entry vs. VAT-entry sub-type breakdown mismatch on Timber Inventory (§15#2) — silent data-reconciliation issue, not just cosmetic.
- Grant `sawmill-supervisor` visibility into `timber-inventory` (§9) — a producing role that can't see its own aggregate output.
- Give mobile Sawmill roles a reachable path to Timber Inventory (§3, §9) — screen already exists, this is a navigator/permission fix, not new construction.
- Add stock-availability enforcement to `salesCreate` for Timber (§13#5) — data-integrity risk (negative stock).

**Medium**
- Add search/sort/filter to the four core desktop Sawmill pages, matching the Machine Registry/Stock Transfers toolkit (§11).
- Add cross-navigation links between pipeline stages on desktop (§10, §12) — no page in the chain links to the next.
- Expose `productsUpdate` on the desktop Product Catalog page, or remove it if genuinely unneeded (§4, §14#3).
- Remove or repurpose the dead `productCatalogList`/`product_catalog` path (§4, §14#4) and the orphaned `renderDaily` legacy page (§14#5).
- Build a recovery/yield trend (daily/weekly/monthly), matching Harvesting's `harvestPerformance()` pattern (§13#6).

**Low**
- Add role-editor checkboxes for `executive`/`bi` (§9, §14#8).
- Add a loading state to Timber Inventory/Product Catalog (§14#7).
- Add print/export scoped to Timber specifically (§14#9).
- Investigate whether `weeklyPerformanceReport`'s missing workshop-scope is intentional (§13#7).
- Reconcile VAT's inconsistent hardcoded-role-array fallbacks (Create/Update vs. narrower Delete) (§9).

---

## 17. Recommended Implementation Phases

Following the same phase-per-department-maturity-stage approach used for Harvesting:

- **Phase 1 — Operational Completion**: mobile Edit/Delete (incl. missing mobile-api routes) for Sawmill Timber Entry; fix the Timber Inventory sub-type-breakdown reconciliation gap; grant `sawmill-supervisor` Timber Inventory visibility; give mobile Sawmill roles a reachable path to Timber Inventory. (Mirrors what Harvesting Phase 1 did: close the most consequential mobile/backend-exposure gaps first.)
- **Phase 2 — Inventory & Transfer Integrity**: design and implement the actual Finished Timber Inventory ↔ Stock Transfer bridge (the Critical broken workflow) — likely requires either catalog-ing Timber as real `stock_catalog` items or building a dedicated Timber-transfer mechanism; add Sales stock-availability enforcement while touching this area.
- **Phase 3 — Field Operations, Performance & Executive Visibility**: recovery/yield trend reporting (daily/weekly/monthly), decision-support rankings (best/worst-performing machines, sizes, waste outliers) matching Harvesting Phase 3's pattern; break the combined Timber+Poles dashboard figures apart wherever a department-specific view is wanted.
- **Phase 4 — Final UI/UX & Operational Completion**: search/sort/filter toolkit adoption across the four core desktop pages; cross-navigation links between pipeline stages; dead-code cleanup (orphaned `renderDaily`, `product_catalog` path); Product Catalog Edit UI; role-editor completeness (`executive`/`bi` checkboxes); print/export.

**This audit makes no implementation decisions and starts no phase.** Per the brief, it is the blueprint for a future Sawmill implementation program — proceeding to Phase 1 requires a separate, explicit go-ahead, exactly as was required after the Harvesting and Mechanician audits.
