# Sales Department — Enterprise Completion Program, Sales Phase 1

**Completion Report**

Scope: full backend capability inventory, CRUD parity, Sales Order lifecycle, Inventory integration, Product coverage, Customer management, Pricing, Delivery/Logistics collaboration, cross-department collaboration, Approval/Governance, Notifications, Desktop UI, Mobile UI, cross-platform CRUD parity, Dashboard, Reporting, Permissions, Workshop Isolation, Audit Trail, live end-to-end scenarios A–I, UI/UX professional standard, data integrity. No architecture redesign, no parallel Sales workflow, no redesign of Workshop Isolation or the QC/Resolution engine — every fix below reuses an idiom that already exists elsewhere in the codebase.

Method: 3 parallel, read-only audit agents (backend capability matrix + CRUD/Customer/Pricing; delivery/inventory/notifications/permissions/isolation; dashboard/reporting/UI completion), each citing `file:line` for every finding. Every genuine defect found was fixed and live-verified against the production database with disposable, uniquely-tagged QA data (`_QA-P1-*`), independently re-verified via a fresh query after cleanup — never trusting a cleanup script's own printed output.

---

## 1. Sales Backend Capability Inventory

Confirmed real, working functions in `db/services/data.js` for every Sales/Customer/Delivery/Dispatch capability: `salesList/Create/Update/UpdateStatus/UpdatePayment/CloseShort/Delete`, `customersForDropdown/List/Create/Update`, `deliveryOrdersList/Create/Update/UpdateStatus/RecordPOD/Delete`, `dispatchList/Create/Review/Delete`. Every one of these has a real desktop IPC caller (`electron/preload.js` → `renderer/app.js`) and a real mobile REST route + hook + screen caller — zero orphaned backend actions found on either platform (confirmed by the UI-completion audit's exhaustive `UFCL.<name>(` and hook-usage cross-reference).

No `sales`-prefixed pricing function exists; pricing is negotiated per order (see §7). No dedicated Sales dashboard or reporting function exists anywhere in the codebase (see §14–15).

## 2. CRUD Completion

| Entity | Backend | Desktop | Mobile | Notes |
|---|---|---|---|---|
| Sales Order | PASS | PASS | PASS | Strictly one product per order — confirmed architectural fact (`sales_orders.product_type/size/quantity/unit_price` are singular columns, `salesCreate` inserts exactly one row per call), not a gap. |
| Customer | PASS (Create/Read/Update; Delete/Deactivate **fixed this phase**) | PASS | PASS | See §3. |
| Delivery Order | PASS (Workshop Isolation **fixed this phase**) | PASS | PASS | See §4. |
| Payment record | **No distinct entity exists** | — | — | `payment_status` is a binary Paid/Unpaid toggle column on `sales_orders`, no amount/date/partial-payment tracking, no ledger. Documented, not fixed — a real ledger would be new scope (§16). |
| Sales attachments | **Not supported** | — | — | The polymorphic `attachments` table's `ATTACHMENT_ENTITY_TYPES` allow-list (`data.js:10166`) only includes `harvest_waste`/`production_offcut` — `sales_order` was never added. New scope, not fixed this phase (§16). |
| Customer Detail / order history view | **Does not exist** | FAIL | FAIL | Both platforms have only a flat customer list + edit form; no drill-down to a customer's own orders/deliveries/payments. New scope, not fixed this phase (§16), same class of finding as the already-known "no desktop My Requests view" gap from the prior ERP Completion Gate phase. |

## 3. Fixed defects (all live-verified)

### 3.1 Delivery Orders had zero Workshop Isolation — CRITICAL, security

**Finding**: `deliveryOrdersList/Create/UpdateStatus/Update/Delete` had no workshop scoping at all, despite `delivery_orders` rows being tied 1:1 to a workshop-scoped `sales_orders` row via `sales_order_id`. `sales-staff`/`showroom-staff` (both workshop-restricted, per `db/migrate.js`'s own "Phase 2 — Sales roles (all workshop-restricted, no approval rights)" comment) hold the `'deliveries'` permission. This is the exact same bug class already fixed twice earlier in this program (`procurementApprovalAction`, legacy `stockTransferApprove`) — left unfixed on this module's 5 write/read functions.

**Fix**: `delivery_orders` has no `workshop_id` column of its own; isolation is enforced by joining to the linked `sales_orders.workshop_id`, using the codebase's own established idiom (`isWorkshopRestricted(user) && record.workshop_id && Number(record.workshop_id) !== Number(user.workshop_id)` on write; `so.workshop_id is null or so.workshop_id = $user` on read — the "null means unscoped, not blocked" convention already used everywhere else). Applied to all 5 functions in `db/services/data.js`.

**Live verification** (`_qa_sales_p1_fixes.js`, deleted after use): a real `sales-staff` account (workshop 3/Gatare) was denied Create/UpdateStatus/Update/Delete against a real sales order at workshop 4/Nyanza, and denied seeing the Nyanza delivery order in `deliveryOrdersList` — 5/5 negative checks passed, with 3 positive controls (same account succeeding against its own workshop's records) confirming the fix isn't over-broad. 8/8 checks passed.

### 3.2 `customersCreate` had no role gate at all (desktop) / disagreed with mobile

**Finding**: on desktop, `customersCreate` only checked `if (!user)` — any authenticated user of any role, including departments with nothing to do with Sales, could register a customer via IPC. On mobile, the route's own `CUSTOMER_ROLES` array (`['admin','ceo','operations','sales']`) independently gated the same action but omitted `sales-staff`/`showroom-staff` — the two platforms disagreed, and neither matched the actual business need (anyone who can sell should be able to register a walk-in customer; nobody else should).

**Fix**: `customersCreate` now requires the `customers` or `sales` permission. Mobile's `POST /api/customers` route now uses a dedicated `CUSTOMER_CREATE_ROLES` list that adds `sales-staff`/`showroom-staff` for Create only — List/Update remain on the narrower `customers`-only gate, unchanged.

**Live verification**: `sales-staff` and `showroom-staff` (neither holds `'customers'`) now succeed; a `mechanician` account (holds neither `'sales'` nor `'customers'`) is correctly denied. 3/3 checks passed.

### 3.3 `customers.active` had no write path on either platform

**Finding**: the `active boolean` column on `customers` has existed since the table was created, is selected and displayed by `customersList` on both platforms, but no function anywhere ever wrote to it — Customers had Create/Read/Update but no Delete or Deactivate at all.

**Fix**: new `customersToggle(userId, customerId, reason)` in `data.js`, mirroring `productsToggle`'s existing reasoned soft-toggle exactly (soft toggle, not hard delete — customers are referenced by historical `sales_orders` rows). Gated on the `customers` permission, requires a non-empty reason for the audit trail. Wired end-to-end: new IPC channel (`customers:toggle`) + preload binding on desktop, new `PATCH /api/customers/:id/toggle` route + `useCustomerToggle` hook on mobile. Desktop `renderCustomers` gained a Status column and a Deactivate/Reactivate button (reason-required overlay, same pattern as the existing Product toggle). Mobile `CustomersListScreen` gained the same action via `ReasonModal` (not `Alert.prompt`), matching `ProductsListScreen`'s own toggle UI.

**Live verification**: deactivate → DB confirms `active=false` → reactivate → DB confirms `active=true` → empty reason correctly rejected. 4/4 checks passed.

### 3.4 `deliveryOrdersCreate` fired zero notifications

**Finding**: a Sales user creating a delivery order previously had no way to alert Logistics short of Logistics proactively polling the Delivery Orders list — `deliveryOrdersCreate` never called `pushNotification`, unlike its sibling `dispatchCreate`.

**Fix**: added a `pushNotification` call on successful creation, notifying `['admin','ceo','logistics','operations']` with `relatedModule:'deliveries', relatedId:<new id>` — same category as the two existing `deliveries`-module notifications (`salesCloseShort`, `_applyDeliveryOrderPOD`'s rejection notice). Per the existing, explicitly-documented scoping decision from the prior ERP Completion Gate phase, `'deliveries'`/`'sales'` are intentionally not yet deep-linkable from the notification bell on either platform (no reusable detail-overlay exists) — this fix closes the "no notification at all" gap, not the separately-scoped "not clickable" gap, which remains as previously documented.

**Live verification**: confirmed a real notification row is written with the correct title/body/`related_module`/`related_id` on delivery-order creation. 1/1 check passed.

### 3.5 Cancel had no confirmation step (both platforms)

**Finding**: Cancel is reachable only through the generic status-update dropdown/modal shared with 7 other statuses, and submitted immediately with no extra confirmation — unlike Delete (typed "DELETE" + reason) and Close Short (its own dedicated confirm overlay).

**Fix**: **Desktop** — selecting "Cancelled" in the status overlay now reveals a warning notice and a "type CANCEL to confirm" field; every other status is unaffected and submits exactly as before. **Mobile** — selecting Cancelled in `StatusModal` now reveals a warning + an explicit "Yes, cancel this order" checkbox that must be checked before the Update button is enabled; every other status is unaffected.

### 3.6 Desktop Sales page had no loading state and no error/retry state

**Finding**: `renderSales` rendered nothing until every request resolved (unlike `renderExecutiveDashboard`/`renderMachines`, which show a loading placeholder), and had no `try/catch` at all — a genuine network/DB failure (a thrown rejection, not `{ok:false}`) left the page blank with no recovery path short of navigating away and back.

**Fix**: added the same loading placeholder convention used elsewhere, and wrapped the initial `Promise.all` in `try/catch` with a "Could not load Sales orders" error state and a Retry button that re-invokes `renderSales()`.

## 4. Not fixed — genuine gaps, disclosed (see Gap Register for full detail)

- **Sales Dashboard**: does not exist for the `sales` role on either platform. Revenue/status KPIs that do exist (`executiveDashboard`, `getCeoOverview`) are real SQL aggregates, but both explicitly exclude `sales` from their role gate. Discussed with the user; **decision: disclose only, build later** — this is real new feature work (new query + new UI), not a fix to something broken, and the user chose not to expand this phase's scope to build it now.
- **Sales Reporting**: no `salesReport*`/"Sales by X" function exists anywhere. The only Sales-derived figures (Margin/COGS/Product Profitability) live inside the Timber Inventory module and Executive Dashboard, both inaccessible to `sales`. Same decision as above — disclosed, not built.
- **Payment ledger** (§2), **Sales attachments** (§2), **Customer Detail/history view** (§2) — all confirmed real, all new-scope, none fixed this phase.
- **Mobile Pay/Close-Short screen wiring** — the first audit agent flagged a possible gap (hooks defined, grep found no screen caller) but the UI-completion audit's direct read of the same screen source confirmed both **are** wired (`SalesOrdersListScreen.tsx:220-222,234-248,338-346`) — the first agent's grep-only method produced a false lead; resolved by direct source inspection, no code change needed.

## 5. Verified, no code change needed

- Sales × Inventory/Workshop product resolution: confirmed no hardcoded category allow-list — any active Product Catalog row from any department is sellable (`salesProductsForDropdown`/`salesCreate`/`salesUpdate` all filter only on `active=true`).
- Pricing model: confirmed negotiated-per-order, frozen historically on `sales_orders.unit_price`, never overwritten back to `products.default_price`, and Sales never writes to `products`/`stock_catalog` pricing columns.
- Sales → Delivery → Logistics permission wiring: `logistics`/`logistics-officer` can act on delivery orders on both platforms; the `operations`-lacks-`'deliveries'` asymmetry is pre-existing and already compensated for at the mobile route layer (`mobile-api/routes/sales.js`'s own `DELIVER_ROLES` comment) — not a new finding.
- Desktop/mobile action-wiring sweep: zero orphaned Sales/Customer/DeliveryOrders backend functions on either platform.
- Delete confirmation (typed "DELETE" + reason, both platforms), Edit flow (governance-routed for supervisors), `Alert.prompt` sweep (zero violations in Sales/Customers screens — `ReasonModal` used correctly throughout).
- `salesCreate`'s row-locked concurrency guard — re-confirmed via a fresh two-workshop live test this phase alongside the isolation testing.

## 6. Live end-to-end scenarios

Per the brief's own instruction to reuse rather than duplicate prior evidence, scenarios substantially covered by live testing earlier in this program were cited rather than re-run from scratch; two genuinely new scenarios (Cancellation, Concurrency) were run fresh this phase.

| Scenario | Status | Evidence |
|---|---|---|
| A — Timber sale | Covered | `ERP_ENTERPRISE_COMPLETION_GATE_REPORT.md` Scenario A (Harvest→Sawmill→Offcut→Resaw→QC→Sale→Delivery→POD, 12/12) |
| B — Manufactured product via Sales | Covered | `ERP_ENTERPRISE_COMPLETION_GATE_REPORT.md` Scenario D (Nyanza Pallet: VAT batch→real consumption→QC→**Sale**, 13/13 — first-ever live proof the generic manufacturing model sells a non-timber product) |
| C — Pallet via Sales | Covered | Same evidence as B (Pallet is the concrete manufactured product exercised) |
| D — Poles via Sales | Covered | `POLE_PRODUCTION_PHASE1_COMPLETION_REPORT.md`/`POLE_PRODUCTION_PHASE2_COMPLETION_REPORT.md` — both manufactured and purchased pole paths sold live |
| E — Showroom | Covered | `ERP_ENTERPRISE_COMPLETION_GATE_REPORT.md` Scenario E (Transfer→Condition Check→Sale/Damage→Resolution, 10/10) |
| F — Rejection | Covered | Delivery POD rejection exercised in Scenario A above and in the delivery-rejection stock-reversal fix's own live test (prior phase) |
| G — Short Close | Covered | `salesCloseShort`'s full-volume/race fixes live-tested in the prior ERP Cross-Department Verification phase, re-confirmed 3 more times in the Completion Gate phase |
| **H — Cancellation** | **Run fresh this phase** | 3-unit sale → cancel → full stock reversal confirmed → re-cancel → confirmed idempotent no-op (no double-reversal). 4/4 checks passed. |
| **I — Concurrency** | **Run fresh this phase** | Two truly concurrent `Promise.all` sales of 7 units each against 12 available (combined demand 14 > 12): exactly one succeeded, the other cleanly rejected, final stock never negative, no double-deduction. 3/3 checks passed. |

Scenario H/I test script (`_qa_sales_hi.js`) and its QA data (2 sales orders, 1 QC, 1 offcut, 1 daily log, 4 stock movements, restored `stock_levels`) fully cleaned up and independently re-verified — zero residue.

## 7. Fix-verification (this phase's own code changes)

New test script `_qa_sales_p1_fixes.js`: real Sawmill production top-up → real Stock Transfer Gatare→Nyanza → two real sales orders (one per workshop) → all 5 Workshop Isolation checks on Delivery Orders (5 negative + 3 positive) → notification check → customer permission checks (2 positive, 1 negative) → customer toggle checks (4). **26/26 checks passed.** All QA data (1 daily log, 1 offcut, 1 QC, 1 stock transfer + dispatch row, 2 sales orders, 2 delivery orders, 2 customers, 5 stock movements, 7 notifications) fully deleted after testing; `stock_levels` for item 20 restored to its exact pre-test values at both workshops (Gatare: 2, Nyanza: 0); zero residue independently re-verified via a fresh query. The 57 pre-existing `_QA`-tagged notifications found during the residue check are confirmed to be stray leftovers from earlier, unrelated phases (same already-documented pattern as `[[project_stray_qa_test_accounts]]`), not from this phase's own testing — left untouched.

## 8. Static verification

`node --check` clean on every touched backend/desktop file (`db/services/data.js`, `electron/main.js`, `electron/preload.js`, `renderer/app.js`, `mobile-api/routes/customers.js`) after every fix and again after all fixes combined. `npx tsc --noEmit` clean across `mobile/` after every mobile change and again after all changes combined.

## 9. Production readiness determination

**Sales is PRODUCTION READY, with the Workshop Isolation fix (§3.1) classified as the most significant defect closed this phase** — it was a genuine, exploitable gap (not theoretical) allowing a workshop-restricted Sales user to view and mutate another workshop's delivery orders. All other fixes are real but lower-severity (permission-consistency, missing-write-path, missing-notification, UX-standard gaps). The disclosed-not-fixed items (Dashboard, Reporting, Payment ledger, Attachments, Customer history) are genuine new-scope capabilities, not defects in what already exists, and do not block any currently-working Sales business process end-to-end. Per this phase's Stop Rule, no other department starts automatically — awaiting explicit direction.
