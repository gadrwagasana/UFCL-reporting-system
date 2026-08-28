# Procurement Module — Phase 1 Review

**No code, database, or API changes were made to produce this document.** Every claim is verified directly against the current source (`db/services/data.js`, `db/migrate.js`, `electron/main.js`/`preload.js`, `renderer/app.js`, `renderer/styles.css`, and the `mobile/` app) and a live query of the database — not assumption. File:line references are given wherever a finding is specific enough to need one.

This review builds on and restructures an earlier pass (`PROCUREMENT_MODULE_AUDIT.md`) into the exact ten sections requested here, and adds the UI/CSS standardization plan and navigation review that the earlier pass didn't cover.

---

## 1. Current Procurement Architecture

The module follows the app's standard three-layer architecture with no deviation:

```
Electron Desktop  ──┐
                     ├──►  db/services/data.js  ──►  PostgreSQL
React Native Mobile ─┘         (single source of truth for all business logic)
      via mobile-api/ (Express, 5 route files, 38 endpoints,
                        every handler a thin wrapper calling data.js)
```

- **Backend:** 47 functions in `data.js` (`procurement*`), lines 10830–11900. No business logic exists outside this file — routes and IPC handlers call it directly.
- **Database:** 16 tables (`procurement_config`, `procurement_suppliers`, `procurement_supplier_contacts`, `procurement_supplier_contracts`, `procurement_requisitions`, `procurement_requisition_items`, `procurement_approval_steps`, `procurement_rfqs`, `procurement_rfq_suppliers`, `procurement_quotations`, `procurement_purchase_orders`, `procurement_po_items`, `procurement_goods_receipts`, `procurement_goods_receipt_items`, `procurement_invoices`, `procurement_payments`).
- **Mobile API:** `mobile-api/routes/procurement{Suppliers,Requisitions,Rfq,Orders,Invoices}.js` — 38 REST endpoints, every one a pass-through to a `data.js` function (verified: no duplicated logic in the route files themselves).
- **Electron IPC:** `electron/preload.js:368-426` exposes ~45 `procurementX` bridge functions, each a 1:1 `ipcRenderer.invoke` wrapper around the same `data.js` functions the REST routes call — **confirmed no logic divergence between the two transport layers**.
- **Desktop UI:** 8 pages in `renderer/app.js` (`procurement-dashboard/suppliers/requisitions/rfq/orders/goods-receipt/invoices/reports`), each a single render function using the app's existing overlay-modal convention.
- **Mobile UI:** 17 screens under `mobile/src/screens/procurement/`, plus 6 hook files, `ApprovalTimeline` component, and a dedicated `ProcurementNavigator` for the procurement-specific roles.
- **Roles:** 3 new (`procurement-officer`, `procurement-manager`, `department-manager`), added via the same two-step `role_definitions` seed pattern already used for every prior role addition (`db/migrate.js:1385-1457`).

**Conclusion: this is one system, not two parallel implementations.** Both clients consume the identical backend surface. Where mobile and desktop differ (§4, §7, §8), the divergence is in the UI layer only, never in business logic.

---

## 2. Existing Features

| Sub-module | What exists today |
|---|---|
| **Suppliers** | Full CRUD, blacklist toggle (admin/ceo/procurement-manager only), contacts, contracts, computed performance stats (PO count, receipts, reject rate). |
| **Purchase Requisitions** | Draft → submit → multi-stage approval → approved/rejected/cancelled → po_issued. Any role can raise one; free-text line items (description/qty/unit/est. price). |
| **Approval Chain** | Generic, reusable 4–6 stage engine (`procurement_approval_steps` + one dispatcher, `procurementApprovalAction`) shared by requisitions, invoices, and payments — the first true multi-stage approval mechanism in this codebase. |
| **RFQ / Quotations** | Create RFQ from an approved requisition, invite suppliers, manually record quotes (suppliers have no login), compare, select a winner. |
| **Purchase Orders** | Auto-generated from a selected quotation, auto-numbered (`PO-00001`), PDF export (desktop only, via Electron's `printToPDF` — the first real PDF in this codebase; everything else is CSV). |
| **Goods Receipt** | Per-line received/rejected quantity entry, transactional (the one place in this module using an explicit DB transaction), designed to auto-update stock (see §6 — doesn't fire in practice). |
| **Invoice Matching** | 3-way match (PO vs. received value vs. invoice amount, 2% variance threshold), Finance approve/reject. |
| **Payments** | Initiate (Finance/admin/ceo only) → approve → invoice marked paid. |
| **Dashboard** | Status breakdowns, 7-day receipt count, 15-row recent activity, monthly spend trend. |
| **Reports** | Spend by Supplier, Supplier Performance, Delivery Performance, Budget Utilization, plus an Analytics tab (cycle time, late deliveries, top products, supplier rankings). |
| **Permissions** | Page-level grants via `role_definitions`, resolved by `mustRole`; every role gets Dashboard + Requisitions, 8 roles get more (exact matrix in §5 of the earlier audit — unchanged, reproduced in §5 below). |
| **Notifications** | Reuses the app's existing shared `pushNotification` system — no procurement-specific channel, by design (matches every other module). |
| **Inventory integration** | Code exists to update `stock_levels`/`stock_movements` on goods receipt — see §6 for why it's currently unreachable. |

---

## 3. Missing Features

Compared against a complete enterprise procurement cycle (Request → Sourcing → Ordering → Receiving → Matching → Payment → Reporting → Configuration), the gaps found by tracing the actual code:

| # | Missing item | Severity | Evidence |
|---|---|---|---|
| 1 | **Procurement Settings screen** — the CEO approval threshold has full backend/IPC/REST support (`procurementConfigGet/Update`) but **zero UI on either platform**. | Critical | `grep procurementConfig renderer/app.js` → 0 matches. `grep procurementConfig mobile/src/` → 0 matches. |
| 2 | **Stock-item picker on requisition/PO line items** — no form on either platform lets a user link a line to the stock catalog, so the goods-receipt inventory update (§6) can never fire in real use. | Critical | Neither `RequisitionFormScreen.tsx` nor the desktop `procItemRowHtml` line-item row exposes a `stock_item_id` field. |
| 3 | **Search / filter UI** — absent on all 8 desktop pages and all 17 mobile screens, despite the backend already supporting `filters.status` on requisitions/POs/invoices/suppliers. | Important | Every list call site passes `{}` as filters (`renderer/app.js:13190,13338,13711,13785` and the mobile hooks' default `filters = {}`). |
| 4 | **Notification coverage for invoice approve, invoice reject, payment reject** — 3 of 7 real workflow events produce no notification. | Important | `notifyProcurementEvent`'s `EVENTS` map (`data.js:10853-10911`) has no `invoice_approved`/`invoice_rejected`/`payment_rejected` keys, but `procurementApprovalAction` generates exactly those keys via string templating (`data.js:11311,11330`). |
| 5 | **Mobile: add-contact / add-contract forms** — `SupplierDetailScreen` only displays existing contacts/contracts; the add-forms exist only in desktop's "Manage" overlay. | Important | Confirmed by reading `SupplierDetailScreen.tsx` — no form/button calling `addContact`/`addContract`, though the mobile hook exposes both. |
| 6 | **Mobile PDF export** — no PDF/print capability exists on mobile at all (no `expo-print`, no WebView dependency installed). | Important | `grep expo-print\|react-native-webview mobile/package.json` → 0 matches. |
| 7 | **"Supplier acknowledged PO" status transition** — `acknowledged` is a defined PO status with no code path that ever sets it. | Optional | `grep "status='acknowledged'" data.js` → 0 matches. |
| 8 | **Quantity/price validation** — no form on either platform rejects a negative or zero quantity/price. | Optional | Consistent with the rest of the codebase's general looseness here — not procurement-specific, but worth listing since money is involved. |
| 9 | **A live "in_approval" requisition status** — see §5, listed here too because it's functionally a missing piece of the status vocabulary, not just a bug: no report or dashboard anywhere can currently answer "how many requisitions are mid-chain right now?" | Critical | `data.js` writes `procurement_requisitions.status` in exactly 4 places (11225, 11240, 11327, 11472) — `'in_approval'` is never one of them. |

No implementation was attempted for any of these — this is a list, not a patch.

---

## 4. Workflow Review

### 4.1 Existing workflow (as designed)

```
Requisition Drafted → Submitted
        │
        ▼
Supervisor → Dept. Manager → Procurement Review → Finance → [CEO if est. total > threshold]
        │                                                          │
        └───────────────────── Rejected (short-circuits) ──────────┘
                                                                     │
                                                              Fully Approved
                                                                     │
                                                    RFQ → Invite Suppliers → Record Quotes
                                                                     │
                                                          Compare → Select Winner
                                                                     │
                                                            Purchase Order Issued
                                                                     │
                                                       Goods Receipt Recorded (stock update*)
                                                                     │
                                                     Invoice Raised → 3-Way Match → Finance Decision
                                                                     │
                                                       Payment Initiated → Finance Approves
                                                                     │
                                                                Invoice Paid
```
`*` intended, not currently reachable — §6.

### 4.2 What the database actually records (workflow gap, not a diagram simplification)

`procurement_requisitions.status` only ever transitions through **`draft → submitted → approved | rejected | cancelled → po_issued`**. It:

- **Never reaches `'in_approval'`** — a requisition sits at `status='submitted'` for the entire multi-stage chain, whether it's on stage 1 or stage 5.
- **Never reaches `'completed'`** — a requisition freezes permanently at `'po_issued'`, even after goods receipt, invoice matching, and payment are all fully complete. The requisition record never reflects that its own downstream cycle has closed.

This is the single root cause of the dashboard defect in §5.3 below, and it means the "workflow" as experienced through the requisition record itself is shorter than the diagram above — the last four steps (receipt → match → pay) happen entirely on *other* tables with no back-reference status update on the requisition that started the chain.

### 4.3 Navigation-efficiency finding — desktop and mobile diverge after the same action

Directly relevant to the "Electron and Mobile must behave identically" rule: they currently **do not**, specifically at the two moments a new record is created mid-workflow.

| Action | Mobile behavior | Desktop behavior |
|---|---|---|
| Create RFQ from an approved requisition | Navigates **directly into the new RFQ's detail screen** (`RfqCreateScreen.tsx:28`, `navigation.replace('RfqDetail', {rfqId: res.id})`) | Returns to the **RFQ list**; user must find and click the new RFQ manually (`renderer/app.js:13487`, `showPage('procurement-rfq')`) |
| Generate PO from a selected quotation | Navigates **directly into the new PO's detail screen** (`RfqDetailScreen.tsx:67`) | Returns to the **PO list**; user must find and click the new PO manually (`renderer/app.js:13564`, `showPage('procurement-orders')`) |

Mobile already implements the better pattern in both cases. This is not a UI-polish item — it's a direct, verified violation of the stated behavioral-parity requirement, and the fix is mechanical (desktop needs to open the new record's detail overlay instead of the list) once Phase 2 is scoped.

---

## 5. Approval Review

### 5.1 Mechanics (verified against `data.js:11270-11332`)

One generic dispatcher, `procurementApprovalAction(userId, entityType, entityId, decision, notes)`, drives requisitions, invoices, and payments. Per call:
1. Re-reads the current pending stage from the database (no client-trusted state).
2. Requires `step.assigned_role === user.role`, or `user.role === 'admin'` — the only universal override. `ceo` does **not** bypass stages it isn't assigned to.
3. On rejection: marks the record `rejected` and every remaining pending stage `skipped` in the same call — the chain does not continue.
4. On approval: advances to the next stage, or finalizes the record as `approved` if none remain.

### 5.2 Stage sequence

- **Requisitions:** `supervisor → department_manager → procurement_review (procurement-manager) → finance`, +`ceo` only if the requisition's estimated total exceeds the configurable `procurement_config.ceo_threshold` (default 5,000,000 — see §3 item 1, this value can't currently be changed through the UI).
- **Invoices / Payments:** single-stage, `finance` only.

### 5.3 Confirmed defect: "Pending Approvals" always reads 0

Both dashboards compute the stat as:
- Desktop: `byStatus(res.requisitionsByStatus, 'in_approval')`
- Mobile: `data.requisitionsByStatus.find(r => r.status === 'in_approval')?.n ?? 0`

Both read `procurementDashboard()`'s `select status, count(*) from procurement_requisitions group by status` (`data.js:11801`). Per §4.2, `'in_approval'` is never written — every mid-chain requisition is grouped under `'submitted'` instead. **The tile will show 0 regardless of how many requisitions genuinely await a decision, on both platforms, today.**

### 5.4 Missing approvals

- No PO-level approval exists — a PO is generated automatically the moment a quotation is selected, with no separate sign-off step. (This may be intentional, since the requisition that authorized the spend was already fully approved — flagged for the user to confirm intent, not asserted as a defect.)
- No re-approval / escalation path if a requisition is edited after partial approval — `procurementRequisitionUpdate` doesn't reset or re-validate in-progress approval steps.

---

## 6. Inventory Integration Review

The integration code is correct and was verified working in isolation (calling the backend function directly with a supplied `stock_item_id`), but **cannot be triggered by any real user today**:

- `procurementGoodsReceiptCreate` (`data.js:11596-11611`) inserts into `stock_levels` and logs a `stock_movements` row only when a PO line item has `stock_item_id` set **and** the PO has a `workshop_id`.
- **No requisition or PO line-item form on either platform exposes a stock-catalog picker** — every line is free-text description/qty/unit/price only.
- **`workshop_id` is only auto-populated for workshop-restricted requesters** (storekeepers, supervisors, etc.). For the roles who actually run this module day to day — procurement-officer, procurement-manager, admin, ceo — it is never set, and no form offers a manual workshop picker either.

**Net effect:** the condition gating the stock update will essentially never be true in production use. This is the single highest-value item in the missing-features list, because the backend work to support it is already done — only the UI linkage is missing.

---

## 7. Mobile Review

**Screens (17):** `ProcurementDashboardScreen`, `SuppliersListScreen`/`SupplierDetailScreen`/`SupplierFormScreen`, `RequisitionsListScreen`/`RequisitionDetailScreen`/`RequisitionFormScreen`, `RfqListScreen`/`RfqDetailScreen`/`RfqCreateScreen`, `PurchaseOrdersListScreen`/`PurchaseOrderDetailScreen`, `GoodsReceiptListScreen`/`GoodsReceiptCreateScreen`, `InvoicesListScreen`/`InvoiceDetailScreen`, `ProcurementReportsScreen`.

**What mobile does well / better than desktop:**
- Direct-navigation-to-new-record after RFQ/PO creation (§4.3) — desktop should match this, not the other way around.
- Pull-to-refresh on every list screen (`FlatList` `refreshing`/`onRefresh`), consistent with the rest of the app.
- Reuses the existing `HorizontalExpenseChart` component for the Spend report rather than adding a new charting dependency — correct reuse discipline.
- `ApprovalTimeline` is a clean, purpose-built component (the first multi-stage stepper in the app) reused identically across requisition/invoice/payment detail screens.

**Mobile-specific gaps (beyond the missing-features list in §3):**
- **No skeleton loading anywhere in Procurement.** A reusable skeleton component already exists in this codebase — `SearchSkeleton.tsx` — but only Global Search uses it. Every procurement screen uses `LoadingState` (`components/LoadingState.tsx`), a plain spinner, for every loading moment including full-list loads that would benefit from a skeleton.
- **No success feedback.** Save/create actions across every procurement screen call `navigation.goBack()` (or similar) silently on success — there is no toast/snackbar component in this codebase at all (`OfflineBanner` is the only persistent-message component, and it's for offline state specifically, not success confirmation). Errors use `Alert.alert`; successes use nothing.
- **Confirmation dialogs** exist only for destructive actions (blacklist supplier, cancel requisition) via native `Alert.alert` — consistent with the rest of the app, not a gap.
- Search/filter absence (§3 item 3) applies identically here.

---

## 8. Electron Review

**Pages (8):** `procurement-dashboard/suppliers/requisitions/rfq/orders/goods-receipt/invoices/reports`, each a single render function using the existing sidebar-NAV + content-page + modal-overlay convention already used by every other module (Vehicles, Material Requests, Stock Transfers, etc.) — **Procurement did not introduce a new UI pattern**, which is correct per the "reuse existing architecture" rule.

**What desktop does well:**
- Consistent use of the existing `openOverlay`/`closeOverlay`/`confirmDelete`/`showOverlayError`/`showOverlaySuccess` helpers — no duplicated overlay logic.
- The PO PDF export is a genuinely new, well-integrated capability (hidden `BrowserWindow` + `printToPDF`), the first real PDF in the app, added with zero new dependencies.
- Reuses the existing badge class system (`.badge.bg/br/ba/bb/bp/bt`) rather than inventing new status-color logic.

**Desktop-specific gaps:**
- **After-create navigation lands on the list, not the new record** (§4.3) — the most concrete, fixable finding in this review.
- **No sticky page headers.** `.ptitle`/`.psub` (the title + subtitle at the top of every page, including all 8 procurement pages) are plain block elements inside the scrollable `.content` container (`renderer/styles.css:75-80`) — they scroll away with the rest of the page. Only the global `.topbar` is sticky (`renderer/styles.css:43`, `position:sticky;top:0`); no page-level header is.
- **No sticky table headers.** Zero occurrences of `position: sticky` on any `thead`/table element anywhere in `styles.css` — on a long requisitions/invoices/PO list, the column headers scroll out of view.
- **No skeleton loading.** Same spinner-only pattern as mobile (`ti-loader-2` spin animation + text), no skeleton anywhere in the app, desktop or mobile.
- **A pre-existing, app-wide CSS defect that Procurement inherited by following convention:** `var(--bdr)` is referenced 84 times in `app.js` (and twice more in `styles.css` itself) but **is never defined** in any `:root` block — `grep "\-\-bdr:" styles.css` returns nothing. This isn't a procurement-specific bug (it affects every module that borrows the same border-color pattern, which is most of the app), but it's worth flagging here because every procurement page uses it too, and it should be fixed at the token layer, not per-module.
- Search/filter absence (§3 item 3) applies identically here.

---

## 9. Professional UI/CSS Improvement Plan

This is a plan, not implementation. It's written against the design tokens that **already exist**, per the "reuse, don't rewrite" rule — the goal is applying them more completely and consistently across Procurement's 8+17 screens, not introducing a new design system.

### 9.1 What already exists and should be reused as-is

- **Desktop tokens** (`renderer/styles.css:1-15`): a real color system — `--g-dark/mid/soft/light/pale` (primary green scale), `--amber/red/blue/purple/teal` + `-l` light variants (status/accent colors), `--t1-t4` (4-step text hierarchy), `--border`/`--border2`, a 4-step radius scale (`--r-sm` 6px → `--r-xl` 20px), two shadow tokens, and defined font families. This is already a coherent, ERP-appropriate palette — it does not need replacing.
- **Mobile tokens** (`mobile/src/theme/spacing.ts`): an already-8px-rooted `Spacing` scale (`sm:8, md:12, base:16, lg:20...`), a `Radius` scale, and 3-level `Shadow` presets (sm/md/lg with proper elevation for Android). Also already ERP-appropriate.
- **Reusable state components already built:** `LoadingState`, `ErrorState`, `EmptyState`, `StatusBadge`, `SearchSkeleton` (mobile); `openOverlay`/`confirmDelete`/`confirmDeleteSoft`/`showOverlayError`/`showOverlaySuccess`, badge classes `.bg/.br/.ba/.bb/.bp/.bt` (desktop). **The improvement plan is to extend these into every procurement screen consistently, not to build new ones.**

### 9.2 Concrete improvements, mapped to the user's requirement list

| Requirement | Current state in Procurement | Plan |
|---|---|---|
| Modern cards | `.card`/`.mc` classes already used consistently across all 8 desktop pages and mobile screens | No change needed — already consistent |
| 8px grid spacing | Desktop uses ad-hoc `rem`/`px` inline styles in several places (e.g. `margin-bottom:.75rem`, `padding:1rem 1.25rem`) rather than a token; mobile already uses `Spacing.*` consistently | Desktop: replace ad-hoc spacing values in procurement render functions with a small set of standard step values aligned to the existing 4px/8px rhythm already implied by `--r-sm`/`--r-md` |
| Consistent typography | Both platforms reuse existing type scale (`Typography.*` mobile, existing font-size conventions desktop) | No change needed — already consistent |
| Better alignment | No misalignment found in review — table columns and form rows follow the existing `.frow`/`.fg` grid | No change needed |
| Responsive desktop layout | `.content{overflow-y:auto}` already handles varying viewport heights; not tested at narrow desktop widths | Verify table `overflow-x` wrapping (`.tw` class) is applied consistently on every procurement table — confirmed present, no gap found |
| Responsive mobile layout | Standard RN Flexbox layout throughout, consistent with rest of app | No change needed |
| Better colors | Palette already exists and is used correctly (status badges map to it) | No change needed |
| Better tables | `.tbl`/`.dt` classes reused correctly; **no sticky headers** (§8) | Add `position: sticky; top: 0` to table `thead` for the 4 procurement list pages most likely to grow long (requisitions, POs, invoices, suppliers) |
| Better filters | **Absent entirely** (§3 item 3, §7, §8) | Add a filter bar reusing the existing Audit Trail page's filter-bar pattern (`sel()` helper + `.fg` layout, `renderer/app.js:5900-5940`) — that pattern already exists in the codebase for exactly this purpose and should be reused, not redesigned |
| Better search bars | Absent (same finding) | Same reuse plan as above; the app already has a global search bar convention (`AppHeader`'s search icon on mobile, topbar search on desktop) that could be scoped per-page |
| Better action buttons | `.bp1`/`.bs1` button classes already used consistently | No change needed |
| Sticky page headers | **Absent** (§8 — `.ptitle`/`.psub` scroll away) | Wrap each procurement page's title/subtitle/primary-action row in a sticky container, matching how `.topbar` already achieves this one level up |
| Sticky table headers | **Absent** (§8) | See "Better tables" above |
| Professional status badges | Already implemented and reused correctly (`procStatusBadge`/`StatusBadge`) | No change needed |
| Empty states | Already implemented per list (`EmptyState` mobile, inline "No X yet" desktop) | No change needed |
| Loading skeletons | **Not used anywhere in Procurement** — spinner only, on both platforms (§7, §8) | Extend the existing `SearchSkeleton` pattern (mobile) to procurement lists; add an equivalent skeleton-row treatment to desktop tables during load |
| Error states | Already implemented (`ErrorState` mobile, `renderDenied` + inline error text desktop) | No change needed |
| Success messages | Desktop has `showOverlaySuccess` and uses it consistently; **mobile has none** (§7) | Mobile needs a lightweight success-feedback mechanism — no toast/snackbar component exists in this codebase today, so this is a genuine new small addition, not a reuse |
| Confirmation dialogs | Already implemented and reused (`confirmDelete`/`confirmDeleteSoft` desktop, `Alert.alert` mobile) | No change needed |
| Accessible color contrast | Not audited pixel-by-pixel in this pass; the existing `--t1`-`--t4` hierarchy and badge colors were designed with contrast in mind elsewhere in the app (per prior work on the Global Search badge contrast fix) | Spot-check procurement-specific color combinations (e.g. amber-on-white priority badges) against WCAG AA in Phase 2, using the same relative-luminance method already applied once before in this codebase |

### 9.3 One defect to fix at the token layer, not per-screen

The undefined `--bdr` variable (§8) should be fixed once in `styles.css` (either defining it as an alias for the existing `--border` token, or replacing all 86 usages with `--border`) rather than patched inside procurement's render functions specifically — fixing it locally would leave the same bug live everywhere else that already uses `var(--bdr)`.

---

## 10. Phase 2 Implementation Roadmap

No code is proposed here — priorities only, sequenced by dependency and risk.

**Priority 1 — fix defects in already-shipped functionality (small, self-contained, highest trust impact):**
1. Write `status='in_approval'` in `procurementApprovalAction` — fixes the dashboard stat (§5.3) on both platforms from one backend change.
2. Add the 3 missing notification `EVENTS` map entries (§3 item 4) — additive, no risk to existing entries.
3. Bring desktop's post-create navigation in line with mobile's (§4.3) — the one confirmed parity violation of the stated "must behave identically" rule.

**Priority 2 — activate already-built-but-unreachable capability:**
4. Add stock-item + workshop linkage to requisition/PO line-item forms on both platforms (§6) — highest business value on this list, since the backend work is already done and tested; only the UI is missing.
5. Build the Procurement Settings screen (§3 item 1) on both platforms — small, unblocks CEO-threshold tuning without database access.

**Priority 3 — UI standardization pass (per §9), sequenced by page traffic:**
6. Sticky page headers + sticky table headers on the 4 highest-traffic pages (Requisitions, POs, Invoices, Suppliers) on desktop.
7. Filter bar reusing the existing Audit Trail pattern, same 4 pages, both platforms.
8. Skeleton loading extended from the existing `SearchSkeleton` component to procurement lists, both platforms.
9. Mobile success-feedback mechanism (new, small — no existing component to reuse here).
10. Fix the `--bdr` token defect app-wide (technically out of Procurement's scope alone, but Procurement inherited it and should not be excluded from the fix).

**Priority 4 — parity and convenience (lower urgency):**
11. Mobile supplier contact/contract add-forms (§3 item 5).
12. Mobile PDF export (§3 item 6) — flagged last because it's the only item in this entire roadmap that requires a new dependency, and should be scoped deliberately rather than bundled into a UI pass.
13. Optional items from §3 (acknowledged-PO status, quantity/price validation) as capacity allows.

---

*This document reflects the module as it exists in the repository at the time of writing. No files were modified to produce it.*
