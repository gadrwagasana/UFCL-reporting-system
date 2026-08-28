# ERP UI/UX Remediation Phase 1
## Executive Dashboard Hotfix & Priority UI Remediation

## 1. Executive Summary

This phase closed the CEO Executive Dashboard's CRITICAL crash (F-01) plus 8 more real findings from `ERP_ENTERPRISE_UI_UX_FINAL_GAP_REGISTER.md`, and — as important a result as the fixes themselves — discovered that **5 previously-registered findings had already been resolved by earlier work** the register's citations hadn't re-verified against current source. All fixes reuse existing architecture exactly: no new tables, no new approval engine, no new inventory ledger, no permission redesign, no Workshop Isolation change.

**Fixed this phase (9 findings):** F-01 (CEO dashboard crash), F-29 (BI Dashboard division-by-zero — turned out to break the *entire* dashboard, not just one metric), F-08 (procurement escalation notification routing), F-07 (log_transport missing edit-approval panel), F-13 (4 roles missing permission-fallback safety net), F-14 (roleLabel cosmetic gap), F-15 (dead `logistics-leader` role reference in the approval engine), F-04 (machine KPI definitions could be created but never fixed or retired).

**Found already resolved, re-verified and closed with no further action (5 findings):** F-16 (goods-receipt auto-inventory-update), F-17 (Procurement Settings screen), F-18 (3 silent-no-op notification events), F-06 (machine archive/deactivate), F-11 (mobile Stock Adjustment screen). All five were built in an earlier "Phase 2B" pass; the register cited an older audit memory for them without re-reading current source.

**Investigated, does not reproduce (1 finding):** F-25 (harvesting-supervisor governance bypass) — current `harvestUpdate`/`harvestDelete` route through the standard `applyGovernance` engine with no special-casing found. No change made, per the "if a reported finding is no longer valid, document it" instruction.

**Deferred, documented with reasoning (remainder):** F-02, F-03 (dead dashboards — Class C, superseded by BI Dashboard/CEO Overview), F-05, F-12 (real parity gaps needing new list/report screens — scheduled, not built this phase), F-19 (Procurement mobile permission-gating consistency pass — large, 15-screen surface, previously deferred by explicit user choice, kept deferred), F-21, F-22 (confirmed still genuinely dead, Low priority, bundled into a future phase), F-24 (staffing decision, not code), F-30 (cosmetic code-style-only, functionally correct, left alone).

## 2. Findings Re-Verified

Before changing anything, every finding in scope was re-read against current source (not assumed from the register). This surfaced the 5 false positives above and confirmed F-25 doesn't reproduce. All other in-scope findings were confirmed still accurate before being fixed.

## 3. CEO Dashboard Fix (F-01, Priority 1)

**Root cause**: `getCeoOverview` (`db/services/data.js`) queried `monthly_approvals.status`, a column that has never existed on that table. The real schema is `month_key, approved (boolean), approved_by, approved_at` (`db/schema.sql:126-131`).

**Fix**: Replaced the invalid query with the exact pattern already used correctly elsewhere in the same file for the same check (`getBootstrap`, line ~543): fetch the `approved` boolean for the current `month_key` and derive `pendingMonthlyApproval` as its negation. No new column, no schema change, no calculation logic changed beyond the one broken field.

```
- pool.query(`select count(*)::int as n from monthly_approvals where status='Pending' and month_key=$1`, [month])
+ pool.query(`select approved from monthly_approvals where month_key=$1`, [month])

- pendingMonthlyApproval: Number(pendingMonthly.rows[0].n) > 0,
+ pendingMonthlyApproval: !(pendingMonthly.rows[0]?.approved),
```

**Verified live**: `getCeoOverview(1)` (admin) now returns `ok:true` with correct production/harvest/sales/machine/governance figures instead of throwing. `getCeoOverview` for a workshop-restricted `storekeeper` still correctly returns `Access denied` — no authorization was loosened. Both platforms consume the same unchanged field shape (`mobile-api/routes/ceo.js` destructures the same field names with no changes needed).

**Note for a future phase (not fixed here, out of this phase's scope)**: while verifying this fix, the desktop `renderCeoOverview()` was found to never render 2 of the 11 fields the backend now correctly returns (`pendingPolesRequests`, `pendingMonthlyApproval`) — mobile's `CeoOverviewScreen` does render `pendingMonthlyApproval`. This wasn't in the register (the dashboard crashed before anyone could notice the field was missing from the desktop layout) and is a new, minor, desktop-only display gap — documented in §11, not fixed, since it's outside this phase's approved scope.

## 4. Broken UI Fixes (Category E, Priority 2)

**F-29 — BI Dashboard division-by-zero.** The register had classified this as "already mitigated — fails cleanly." Live-testing during this phase found that was **incorrect**: `businessIntelligenceDashboard()` — used by `admin`, `ceo`, `operations`, `supervisor`, and 6 department leader/supervisor roles — threw `division by zero` on every single call, for every role, unconditionally. Root cause: `_biPredictStockRunout`'s WHERE/ORDER BY clauses used `NULLIF(x, 1e-9)` intending to guard against a zero divisor, but `NULLIF` only substitutes NULL when its two arguments are *equal* — `NULLIF(0, 1e-9)` evaluates to `0`, not `NULL`, so the guard never actually engaged for a genuinely-zero consumption rate (the exact case it needed to catch). Fixed by changing both instances to `NULLIF(x, 0)`, matching the already-correct guard pattern used earlier in the same query. Verified live: the dashboard now returns real data (6 stock shortage rows in the current dataset) instead of throwing, for a `supervisor` account; a role with no BI section (`logistics`) is still correctly denied.

**F-08 — Procurement escalation notifications couldn't deep-link.** `_escalateEntity()` built `relatedModule` by title-casing the internal entity-type string (`procurement_requisition` → `"Procurement requisition"`), which matched neither platform's routing registry (`'procurement-requisitions'` etc). Added a small `ENTITY_ESCALATION_MODULE` lookup, mirroring the existing `ENTITY_ESCALATION_ROLES` map that already sits beside `_escalateEntity`, mapping the 3 entity types with a real destination screen (`procurement_requisition`, `procurement_rfq`, `procurement_invoice`) to their correct routing keys — confirmed identical on both `renderer/app.js`'s `NOTIFICATION_ROUTES` and `mobile/src/utils/notificationRouting.ts`. Entity types without a mapped destination keep the prior fallback (unchanged behavior).

**F-14 — `roleLabel()` cosmetic gap.** Added the 4 missing supervisor sub-role display names (`harvesting-supervisor`, `sawmill-supervisor`, `poles-supervisor`, `vat-supervisor`) to the existing label map, matching the sibling "-leader" roles' naming convention already present.

**F-04 — Machine KPI definitions could be created but never fixed or removed.** Backend (`machineKpiDefinitionsUpdate`/`Delete`) and IPC/preload were already fully wired with zero UI caller. Added Edit and Delete (soft-deactivate — existing target/performance history is preserved, matching the backend's own behavior) buttons to the existing "Configure KPI Definitions" desktop overlay, reusing that same overlay's list/create pattern and the app's existing `confirmDelete()` helper. Desktop-only, matching this admin-config screen's existing desktop-only footprint (mobile has no machine-KPI-definitions screen at all, and building one wasn't part of this fix — see §13).

**F-16, F-17, F-18 — already resolved, no code changed.** See §11.

## 5. Navigation Fixes / Unreachable UI (Category F, Priority 3)

**F-07 — `log_transport` had no edit-approval panel.** 7 of 8 governed entity types had both `insertPendingPanel` and `insertDeletionPanel` calls on their desktop page; `log_transport` only had the deletion panel. Added the missing `insertPendingPanel($('page-log-transport'), ['log_transport'], renderLogTransport)` call, in the exact position and pattern every sibling entity already uses — a pure, generic UI component (`insertPendingPanel` takes no entity-specific logic; it filters the existing `pendingEditsList` API result by `entity_type`). Verified live: `pendingEditsList` still returns correctly-shaped data (4 rows currently in the queue, none yet of type `log_transport`, which is expected — the panel now exists and will populate whenever one is submitted).

## 6. Permission/UI Fixes (Category G, Priority 4)

**F-13 — 4 roles missing from the `ROLE_PAGES` fallback.** `sales-staff`, `showroom-staff`, `logistics-officer`, and `mechanician` had no entry in the hardcoded fallback `getRolePages()` uses when a role's live `role_definitions.permissions` is empty/null — every other role had this safety net. This was latent (not currently causing an outage, since these roles' DB permissions are populated), but a genuine future-lockout risk. Fixed by adding fallback entries for all 4, each copied exactly from that role's **current live-granted permissions** (queried directly from `role_definitions`), so the fallback is accurate to today's real intent, not a guess.

**F-15 — `logistics-leader` was never a real, assignable role.** It appeared in `LEADER_APPROVERS` (the first-tier governance approver bucket) but nowhere else — absent from `ROLE_PAGES`, `roleLabel()`, and mobile routing — meaning that bucket permanently had one fewer real approver than every other department. Replaced with `logistics` (the real Logistics Manager role) in `LEADER_APPROVERS`, and added the same to `LEADER_NOTIFY_ROLES` for consistency (every other role appears in both lists; `logistics-leader` had only ever been in one). This does not grant `logistics` any new page or permission — it only adds that role to the existing pool of people who can act on/be notified about leader-tier governance requests, the same bucket `supervisor`/`harvesting-leader`/`sawmill-leader`/`poles-leader`/`vat-leader` already sit in.

**F-25 — investigated, does not reproduce.** See §1 and §11.

**F-19, F-24, F-30 — reviewed, correctly left unchanged.** See §11.

## 7. Desktop/Mobile Parity (Category C, Priority 6)

**F-11 — confirmed already resolved.** `StockMovementFormScreen.tsx` already wires `useStockAdjustmentRequestCreate`; the register's "Unverified" flag is resolved — this is a false positive, not a gap.

**F-05, F-12 — confirmed still open, not built this phase.** See §11 (Deferred Findings) for reasoning.

## 8. Workshop Isolation Verification

No fix in this phase touches `isWorkshopRestricted`, any `workshop_id` filter, or any workshop-scoped query. Regression-verified live:

- A workshop-restricted `storekeeper` (Gatare-scoped) is still correctly denied `getCeoOverview` (`Access denied`) — the F-01 fix didn't loosen this.
- A role with no `BI_SECTIONS` entry (`logistics`) is still correctly denied `businessIntelligenceDashboard` — the F-29 fix didn't loosen this.
- `stockItemsForDropdown` (an unrelated, unmodified function) remains callable for a `vat-leader` (Nyanza-scoped) user — sanity check that nothing in the surrounding module broke.
- No fix added, removed, or altered any `workshop_id` condition anywhere.

## 9. Regression Testing

- `node --check` clean on `db/services/data.js`, `renderer/app.js`, `electron/main.js`, `electron/preload.js`.
- `npx tsc --noEmit` clean across the full `mobile/` app (no mobile source was changed this phase, run as a safety check regardless).
- No new test data was created — every verification in this phase was a read-only function call against real, unmutated production data (per [[feedback_live_db_testing_safety]]), so no QA cleanup was required.

## 10. Live Verification

| Finding | Verification | Result |
|---|---|---|
| F-01 | `getCeoOverview(1)` (admin) | Returns real data, no error |
| F-01 | `getCeoOverview(<storekeeper>)` | Still `Access denied` |
| F-29 | `businessIntelligenceDashboard(<supervisor>)` | Returns real data (6 stock alerts), no error |
| F-29 | `businessIntelligenceDashboard(<logistics>)` | Still `Access denied` (no BI section) |
| F-04 | `machineKpiDefinitionsList(1)` | Still returns correctly after the overlay change |
| F-07 | `pendingEditsList(1)` | Still returns correctly-shaped data; panel logic is generic and entity-agnostic |
| F-16/17/18/06/11 | Direct source read | Confirmed already fully wired, no regression risk since nothing was touched |

Full interactive click-through (Electron GUI / mobile device) was not available in this environment — consistent with every prior phase's disclosed limitation. All verification is via direct, read-only backend function calls plus source-level confirmation of UI wiring.

## 11. Deferred Findings

| ID | Reasoning |
|---|---|
| F-02 | `getApprovalDashboard` — dead on both platforms, but represents a genuine, moderately valuable cross-module "approval queue summary" not fully covered elsewhere (BI Dashboard's governance section is a subset). Real capability, Class A, but a new screen on both platforms is beyond this phase's approved scope — scheduled for a future phase. |
| F-03 | `performanceKPIs` — Class C, superseded. Its ~15 flat KPI values are already covered, more richly, by `getCeoOverview` + `businessIntelligenceDashboard` + department dashboards. No UI recommended. |
| F-05 | Desktop Resolution Engine list view — confirmed still genuinely missing (`resolutionsList` has zero desktop callers). Real gap, needs a new list screen; deferred to a future data-visibility phase, not built here. |
| F-12 | Mobile Inventory Loss Reports — confirmed still genuinely missing on mobile. Real gap, needs a new screen; deferred for the same reason as F-05. |
| F-19 | Procurement mobile: 15/22 screens lack client-side permission gating (server-side `mustRole` already enforces correctly — not a security issue, a UX-polish item). Explicitly deferred by prior user choice in an earlier phase; kept deferred here rather than silently expanding this phase's scope to a 15-screen retrofit. |
| F-21 | `procurementBenchmark` (mobile hook exists, `useProcurementBenchmark`, but zero screen renders it) and `supplierDocumentsRegister` (fully dead) — re-verified still open. Already explicitly awaiting a go/no-go decision from an earlier phase; not built without that decision. |
| F-22 | `attachmentDelete`, `logTransportUpdate` — re-verified still fully dead on both platforms. Low-severity secondary admin actions; recommended to bundle into whichever future phase next touches Attachments or Log Transport, not a dedicated build. |
| F-24 | No Nyanza-stationed role currently holds the `sales` permission — a staffing/role-assignment decision, not a code defect. Nothing to implement; restated here for completeness. |
| F-25 | Investigated — does not reproduce against current code. `harvestUpdate`/`harvestDelete` correctly route through the standard `applyGovernance` engine; `harvesting-supervisor` is not in `GOVERNANCE_PRIVILEGED`. No special-casing found anywhere in the write path. Documented as reconciled rather than changing approval-chain code speculatively, per this phase's own "if a finding is no longer valid, document it" instruction. |
| F-30 | `compartmentsCreate/Update/Delete`'s hardcoded role array is stylistically inconsistent with the `mustRole()` pattern used elsewhere, but was checked against the live `ROLE_PAGES`/`role_definitions` grants for `admin`/`ceo`/`operations`/`supervisor` and found functionally correct — not a real access gap. Left unchanged, per the register's own original classification. |

## 12. Production Readiness

The CEO Executive Dashboard — the sole blocker the prior audit identified against a "production ready" claim — now works on both platforms. Combined with this phase's other 8 fixes and the 5 items found to already be resolved, the ERP's UI/UX completeness position is materially better than the register described, on both counts (fewer real open gaps, and several "open" items were stale). The remaining deferred items (§11) are all either genuinely lower-priority, already-pending-a-business-decision, or appropriately sized for their own dedicated phase — none block core operational use of any department.

## 13. Remaining UI/UX Backlog

Carried forward, unchanged by this phase, for whichever future phase picks them up: F-02, F-03 (as documented above — likely no action needed for F-03), F-05, F-12 (new list/report screens), F-19 (permission-gating retrofit), F-21 (awaiting go/no-go), F-22 (low-priority secondary actions), F-24 (staffing decision), the newly-noted desktop CEO Overview 2-field display gap (§3), plus the full pre-existing backlog already on record in prior phases' own memory (Enter-to-submit app-wide, mobile CSV export, the `_QA-RL-TEST` leftover vehicle decision, the ~55-61 leftover QA accounts, etc.) — none of which were in this phase's scope and none of which were touched.

---

**Nothing in this phase was committed or pushed.** Per the Stop Rule, this report and the accompanying changelog are the final output — no Phase 2 starts automatically.
