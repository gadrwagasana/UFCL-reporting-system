# Sales Enterprise Phase 2 — Changelog

## Backend (`db/services/data.js`)

- `salesDashboard(userId, workshopId)` — added two parallel queries and response fields:
  - `topCustomers`: top 5 customers by value this month (grouped by `customer_id`/`customer_name`, falls back to walk-in text name).
  - `byWorkshop`: sales value/order count per workshop this month, computed only for unrestricted (non-workshop-scoped) users; `[]` for restricted users.
- `salesReport(userId, filters)` — added `payment_due_date`, and `cogs`/`margin` per row via a new `left join products p on p.id = so.product_id` (`standard_cost`-based, `null` when no cost basis is known — not fabricated). Summary extended with `totalCogs`, `totalMargin`, `marginKnownOrders`.
- `customersOrders(userId, customerId)` — two fixes:
  1. **Permission**: now accepts either the `'customers'` or `'sales'` permission (previously `'customers'`-only), per the user's approved `AskUserQuestion` decision.
  2. **Workshop Isolation**: restricted viewers now only see orders from their own workshop for the given customer; a `hiddenOtherWorkshopOrders` count is returned and disclosed rather than silently dropped or silently shown. Also added the `salesList`-style delivery lateral join (`delivery_count`/`delivery_number`/`delivery_status`) and `payment_due_date` to the orders query.

## Desktop (`renderer/app.js`)

- `renderSalesDashboard()` — added "Top Customers This Month" (always shown) and "Sales by Workshop This Month" (shown only when data exists) cards. Sales History table gained a `Margin` column and a payment due-date sub-line; CSV export gained `COGS`/`Margin`/`Payment Due` columns and totals.
- `openCustomerDetailOverlay(customerRef)` — refactored to take a minimal `{id, name}` reference and self-fetch everything via a single cached `customersOrders` call (previously required the full row object). Orders tab gained a `Delivery` column and the `hiddenOtherWorkshopOrders` disclosure sentence.
- `renderSales()` — added a "View customer history" icon-button next to each order's customer name (when `customer_id` is present), opening `openCustomerDetailOverlay`.

## Mobile (`mobile/`)

- `src/types/api.ts` — added `SalesDashboardTopCustomer`, `SalesDashboardWorkshopEntry`; extended `SalesDashboardResponse`, `SalesReportRow`, `SalesReportResponse.summary`, `CustomerOrderRow`, `CustomerOrdersResponse` (new `hiddenOtherWorkshopOrders`) to match the backend.
- `src/screens/salesOrders/SalesDashboardScreen.tsx` — added Top Customers and (conditional) Sales by Workshop sections.
- `src/screens/salesOrders/SalesHistoryScreen.tsx` — added payment status/due-date and margin per report row; summary line shows total margin + known-cost-order count when available.
- `src/screens/customers/CustomerDetailScreen.tsx` — added payment/delivery info per order; **refactored** to accept `{customerId, customerName}` route params instead of a full `Customer` object, sourcing the full record from `useCustomerOrders`'s own `data.customer` (mirrors the desktop refactor). Edit-customer header action now sources the customer object from fetched data instead of route params.
- `src/navigation/types.ts` — `CustomersStackParamList.CustomerDetail` changed to `{customerId, customerName}`. `SalesOrdersStackParamList` gained `CustomerDetail` and `CustomerForm` entries (reusing the same screens as the Customers stack, stack-push pattern, not a new tab).
- `src/navigation/stacks/SalesOrdersStack.tsx` — registered `CustomerDetail`/`CustomerForm` screens.
- `src/screens/customers/CustomersListScreen.tsx` — updated its `CustomerDetail` navigation call to the new minimal param shape.
- `src/screens/salesOrders/SalesOrdersListScreen.tsx` — added a "View Customer" link on each order's customer name (when `customer_id` is present), navigating to the in-stack `CustomerDetail`.
- `src/navigation/SalesNavigator.tsx` — the `Customers` tab is now shown only to `role === 'sales'` (previously shown to `sales`/`sales-staff`/`showroom-staff` unconditionally, despite the latter two lacking `customersList` access — a permanently-broken tab for them, fixed by removing it and relying on the new "View Customer" entry point instead).

## Verification artefacts

Temporary QA scripts (`_qa_sales_p2*.js`, `_qa_cleanup_p2*.js`) were used for live verification against the production database and deleted after use; see the Completion Report §14–§17 for results and §16/§20 for QA-residue disclosures.
