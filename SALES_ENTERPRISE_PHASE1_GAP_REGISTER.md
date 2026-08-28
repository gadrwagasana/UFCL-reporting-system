# Sales Enterprise Phase 1 — Gap Register

Every finding from this phase's 3 audit agents, classified per the brief's required categories. Items marked **FIXED** are detailed in `SALES_ENTERPRISE_PHASE1_CHANGELOG.md`; this register's purpose is the classification and forward-looking status of each.

---

## Fixed this phase

| ID | Finding | Severity | Evidence |
|---|---|---|---|
| S-01 | Delivery Orders had zero Workshop Isolation (5 functions) — a workshop-restricted `sales-staff`/`showroom-staff` could view and mutate another workshop's delivery orders | **Critical (security)** | `data.js` `deliveryOrdersList/Create/UpdateStatus/Update/Delete`; live-verified 8/8 (5 negative + 3 positive controls) |
| S-02 | `customersCreate` had no role gate at all on desktop; mobile's independent gate omitted `sales-staff`/`showroom-staff` | High (permission gap + platform disagreement) | `data.js:customersCreate`, `mobile-api/routes/customers.js`; live-verified 3/3 |
| S-03 | `customers.active` had no write path on either platform (Delete/Deactivate entirely missing from Customer CRUD) | Medium | new `customersToggle`; live-verified 4/4 |
| S-04 | `deliveryOrdersCreate` fired zero notifications — Logistics had no way to learn a delivery order was created short of polling | Medium | `data.js:deliveryOrdersCreate`; live-verified 1/1 |
| S-05 | Cancel (via the generic status dropdown/modal) had no extra confirmation, unlike Delete and Close Short | Medium (UX standard) | `renderer/app.js`, `mobile/.../SalesOrdersListScreen.tsx` |
| S-06 | Desktop Sales page had no loading state and no error/retry state | Low (UX standard) | `renderer/app.js:renderSales` |

## Already working — no change needed

| ID | Finding |
|---|---|
| S-07 | Sales × Inventory/Workshop product resolution has no hardcoded category allow-list — any active Product Catalog row from any department is sellable |
| S-08 | Pricing is correctly negotiated-per-order, frozen historically on `sales_orders.unit_price`, never overwritten back to the Product Catalog |
| S-09 | Zero orphaned Sales/Customer/DeliveryOrders backend functions on either platform — every write function has a real UI caller |
| S-10 | Mobile Pay/Close-Short screen wiring — a first-pass grep-only audit flagged this as a possible gap; a direct read of `SalesOrdersListScreen.tsx` confirmed both are real and wired (lines 220-222, 234-248, 338-346) |
| S-11 | Delete confirmation (typed "DELETE" + reason) — real and strong on both platforms |
| S-12 | `Alert.prompt` sweep of Sales/Customers mobile screens — zero violations, `ReasonModal` used correctly throughout |
| S-13 | `salesCreate`'s row-locked concurrency guard — re-confirmed via a fresh two-workshop live test (Scenario I) |
| S-14 | Sales → Delivery → Logistics permission wiring — `logistics`/`logistics-officer` can act on delivery orders on both platforms |

## Intentionally platform-specific — not a gap

| ID | Finding |
|---|---|
| S-15 | `PRODUCT_TYPES`/`TIMBER_SUB_TYPES`/`CURRENCIES` are static category enums on mobile, matching desktop's own hardcoded `<option>` lists — categorical, not a "hardcoded product catalog" violation |
| S-16 | `operations` role lacks `'deliveries'` permission despite holding `'sales'` — pre-existing, already compensated for at the mobile route layer (`mobile-api/routes/sales.js`'s own documented `DELIVER_ROLES` workaround); not a new finding, not touched this phase |

## Business decisions required

| ID | Finding | Status |
|---|---|---|
| S-17 | **Sales Dashboard** — does not exist for the `sales` role on either platform. Real revenue/status KPIs exist (`executiveDashboard`, `getCeoOverview`) but explicitly exclude `sales` from their role gate. | Presented to the user as build-now vs. disclose-only; **user chose disclose-only, deferred**. |
| S-18 | **Sales Reporting** — no `salesReport*`/"Sales by X" function exists anywhere; the only Sales-derived figures (Margin/COGS/Product Profitability) live inside the Timber Inventory module and Executive Dashboard, inaccessible to `sales`. | Same decision as S-17 — **disclosed, deferred**. |

## New features — outside this phase's scope

| ID | Finding |
|---|---|
| S-19 | **Payment ledger** — only a binary Paid/Unpaid `payment_status` column exists on `sales_orders`; no amount, date, partial-payment tracking, or queryable payment history. A real ledger is new schema + new UI, not a fix. |
| S-20 | **Sales order attachments** — the polymorphic `attachments` table's `ATTACHMENT_ENTITY_TYPES` allow-list only includes `harvest_waste`/`production_offcut`; `sales_order` was never added. Enabling it is small on the backend but would need real UI wiring on both platforms to be useful — new scope. |
| S-21 | **Customer Detail / order-history view** — neither platform has one; both have only a flat customer list + edit form, with no drill-down to that customer's own orders/deliveries/payments. Same class of finding as the already-known "no desktop My Requests view" gap from the prior ERP Completion Gate phase — a new page, not a wiring fix. |

## Deferred (carried forward, not re-litigated)

| ID | Finding |
|---|---|
| S-22 | Notification deep-linking for the `'sales'`/`'deliveries'` modules — both fired notifications land in-app but are not tap/click-through-able on either platform. This was already explicitly scoped out as "new feature work" by a prior phase's own code comment (visible directly above `NOTIFICATION_ROUTES` in both `renderer/app.js` and `mobile/src/utils/notificationRouting.ts`); this phase's fix (S-04) only closes the separate "no notification fired at all" gap on delivery-order creation, not this pre-existing, already-documented deep-link gap. |

---

## Production readiness

Sales is **PRODUCTION READY**. The single Critical finding (S-01, Workshop Isolation on Delivery Orders) is fixed and live-verified with both negative and positive controls. All other fixed items are real but lower-severity. All disclosed-not-fixed items (S-17 through S-22) are genuine new-scope capabilities or already-documented, previously-scoped limitations — none blocks any currently-working Sales business process end-to-end.

Per this phase's Stop Rule: no other department starts automatically. Awaiting explicit direction on next steps (including whether/when to act on S-17/S-18's deferred decision).
