# ERP Enterprise Completion — Phase 9 — Changelog

Scope: two real UI-reachability fixes (Sales Order category selector; Value-Added Production reconciliation visibility) found via a fresh backend-to-UI audit and live end-to-end testing of the Nyanza manufacturing architecture built in the prior phase. No schema change, no `data.js` business-logic change, no new permission grant, no Workshop Isolation change.

## Fixed

### Sales Order forms could not sell a "Manufactured Product"
`salesProductsForDropdown` (backend) already returned every active product regardless of type — the gap was entirely in the two forms' own hardcoded category option lists.

- `renderer/app.js` — added `<option value="Manufactured Product">` to both the New Sales Order (`#so-type`) and Edit Sales Order (`#soe-type`) category dropdowns. The existing size-filtering (`rebuildSizes()`) and payload-building logic already handled any non-Timber type generically (confirmed by reading the code before editing) — no other change needed.
- `mobile/src/utils/salesConstants.ts` — `PRODUCT_TYPES` extended with `'Manufactured Product'`. `SalesOrderFormScreen.tsx`'s product filtering/validation was already generic per-type — confirmed before editing, no other mobile change needed.

### `valueAddedProductionReconciliation` was built but never displayed
Fully wired (backend function, IPC channel, REST route, and a ready mobile React Query hook `useVatReconciliation`) since the prior phase, but no screen on either platform ever called it.

- `renderer/app.js` — new `_loadVapReconciliation()` function and a "Production reconciliation" section added to the Value-Added Production page, between the existing Quality report and Input Consumption/Output Production sections. Same loading/error/table pattern as its siblings.
- `mobile/src/screens/vat/VatProcessingScreen.tsx` — new `VapReconciliationCard` component added to the batch list's header, using the already-existing (previously unused) `useVatReconciliation` hook.

## Found, documented, not built (see completion report §25 for full reasoning)

- `performanceKPIs`, `attachmentDelete`, `logTransportUpdate` — Priority B, administrative/secondary-action gaps.
- `machineKpiDefinitionsUpdate`/`Delete` — Priority C.
- `productCatalogList` — Priority C/D, possibly legacy; not investigated further.
- No Nyanza-stationed role currently holds the `sales` permission — a staffing/role-assignment question, not a code defect; no permission grant was made without your approval.

## Verification

- `node --check` clean on `renderer/app.js`.
- `npx tsc --noEmit` clean across the full `mobile/` app.
- Live E2E test against the production database, 26/26 checks passed after fixing two test-script bugs (not application bugs — confirmed via an isolated diagnostic re-run of the underlying `salesCreate` logic): direct timber sale at Nyanza with negotiated-vs-catalog pricing separation, customer-specific batch linkage, manufactured-product QC-accept-then-sell, Downgrade and Disposal resolution for VAP-origin rejection holds, Nyanza→Showroom stock transfer, and three genuine cross-workshop security negative tests (a Gatare-scoped user could not see/act on Nyanza records).
- Regression smoke test: 12 representative read functions across Harvest, Sawmill/Finished Timber, Sales, Stock Transfers, Showroom, Rejection Holds, Security/Governance, and VAP — all returned successfully, no errors.
- QA cleanup verified: zero residue across every table touched by the live test, including one small amount of data from an earlier crashed test run (test-script bug, not application bug) that was found and removed separately.

## Not committed

Per this phase's Stop Rule, nothing above has been committed or pushed. All changes are local working-tree edits pending your review.
