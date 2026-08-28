# ERP UI/UX Remediation Phase 1 — Changelog

Scope: 9 findings fixed from `ERP_ENTERPRISE_UI_UX_FINAL_GAP_REGISTER.md`, all minimal-footprint fixes reusing existing patterns. No schema change, no new tables, no new approval/notification/inventory subsystem, no permission model change, no Workshop Isolation change. Nothing committed or pushed.

## Fixed

### `db/services/data.js`

- **`getCeoOverview` (F-01, CRITICAL)** — replaced an invalid query against a nonexistent `monthly_approvals.status` column with the correct, already-established pattern (`select approved from monthly_approvals where month_key=$1`, negated) used elsewhere in the same file for the identical check. This was the sole blocker for both platforms' CEO/admin dashboards.
- **`_biPredictStockRunout` (F-29)** — fixed a division-by-zero guard that didn't actually guard: `NULLIF(x, 1e-9)` only nulls out the literal value `1e-9`, not `0`, so a genuinely-zero consumption rate still divided by zero. Changed to `NULLIF(x, 0)` in both affected clauses, matching the correctly-guarded `CASE` expression 2 lines above in the same query. This was breaking `businessIntelligenceDashboard` — and therefore the BI page — for every role with `bi` permission (admin, ceo, operations, supervisor, and 6 department leader/supervisor roles), not just producing a bad number as the register had assumed.
- **`_escalateEntity` (F-08)** — added an `ENTITY_ESCALATION_MODULE` lookup (mirroring the existing `ENTITY_ESCALATION_ROLES` map beside it) so procurement requisition/RFQ/invoice escalation notifications carry a `relatedModule` that actually matches both platforms' routing registries, instead of a mechanically title-cased string that matched nothing.
- **`ROLE_PAGES` (F-13)** — added fallback entries for `sales-staff`, `showroom-staff`, `logistics-officer`, `mechanician`, each copied from that role's current live-granted permissions. Closes a latent lockout risk (these 4 roles had no safety net if their DB permissions row ever went empty).
- **`LEADER_APPROVERS` / `LEADER_NOTIFY_ROLES` (F-15)** — replaced the phantom `logistics-leader` role (never assignable — absent from `ROLE_PAGES`/`roleLabel`/mobile routing) with the real `logistics` role in both arrays, restoring the Logistics department's seat in the first-tier governance approver/notify bucket every other department already had.

### `renderer/app.js`

- **`roleLabel()` (F-14)** — added display names for `harvesting-supervisor`, `sawmill-supervisor`, `poles-supervisor`, `vat-supervisor`.
- **`renderLogTransport()` (F-07)** — added the missing `insertPendingPanel(..., ['log_transport'], ...)` call; the deletion-approval panel already existed, the edit-approval panel didn't, on this one entity type out of 8.
- **Machine KPI Definitions overlay (F-04)** — added Edit and Delete (soft-deactivate) buttons per row, reusing the overlay's own list/create pattern and the app's existing `confirmDelete()` helper. Backend (`machineKpiDefinitionsUpdate`/`Delete`) and IPC/preload were already fully wired with no caller.

## Found already resolved — no code changed

Re-verified against current source before starting work, per this phase's "reproduce before changing" instruction, and found already fixed by earlier work the register's citation (an older audit memory) hadn't been re-checked against:

- **F-16** — goods-receipt auto-inventory-update: both the per-line stock-item picker and the (privileged-role) workshop picker already exist on both platforms' requisition forms (a "Phase 2B, Priority 4" pass, evidently bundled into the Procurement Exception Management work).
- **F-17** — Procurement Settings screen: `renderProcurementSettings()` (desktop) and `ProcurementSettingsScreen.tsx` (mobile) already exist and are already wired into navigation.
- **F-18** — 3 previously-missing notification events (`invoice_approved`, `invoice_rejected`, `payment_rejected`): already present in `notifyProcurementEvent`'s `EVENTS` map, with an explicit "Phase 2B" comment documenting the fix.
- **F-06** — machine archive: `.mch-archive` button already wired to `machinesDelete` on desktop; mobile has an equivalent path via `useMachines.ts`/`MachineDetailScreen.tsx`.
- **F-11** — mobile Stock Adjustment: `StockMovementFormScreen.tsx` already wires `useStockAdjustmentRequestCreate`.

## Investigated, does not reproduce — no code changed

- **F-25** — harvesting-supervisor governance bypass: current `harvestUpdate`/`harvestDelete` route through the standard `applyGovernance` engine with no special-casing for `harvesting-supervisor` found anywhere in the write path. Not changed, since the claim doesn't hold up against current source.

## Deferred — documented, not built

F-02 (Class A but out of scope), F-03 (Class C, superseded), F-05 and F-12 (real gaps, need new screens, scheduled for a future phase), F-19 (large 15-screen retrofit, already deferred once by explicit user choice), F-21 (awaiting a prior go/no-go decision), F-22 (low-priority, bundle into a future phase), F-24 (staffing decision, not code), F-30 (stylistically inconsistent but functionally correct, left as-is). Full reasoning for each in the completion report §11.

## New item noted, not fixed (outside this phase's scope)

While verifying F-01, found that desktop's `renderCeoOverview()` never displays 2 of the 11 fields the (now-fixed) backend returns (`pendingPolesRequests`, `pendingMonthlyApproval`) — mobile does display `pendingMonthlyApproval`. Not in the original register (masked by the crash), not fixed here, documented for a future phase.

## Verification

- `node --check` clean on `db/services/data.js`, `renderer/app.js`, `electron/main.js`, `electron/preload.js`.
- `npx tsc --noEmit` clean across `mobile/`.
- Live, read-only verification against production data (no QA data created, nothing to clean up): `getCeoOverview` works for admin, still denies a workshop-restricted storekeeper; `businessIntelligenceDashboard` works for a supervisor, still denies a role with no BI section (logistics); `pendingEditsList` and `machineKpiDefinitionsList` still function correctly after their respective UI changes.
- Workshop Isolation: no fix touched `isWorkshopRestricted`, any `workshop_id` filter, or any workshop-scoped query; regression-verified no role gained unintended access.

## Not committed

Per this phase's Stop Rule, nothing above has been committed or pushed. All changes are local working-tree edits pending review.
