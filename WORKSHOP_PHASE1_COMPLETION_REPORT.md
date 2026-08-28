# Workshop Department — Phase 1 Completion Report

**Critical Issues, Security & Operational Foundation**

Implements every verified finding from `WORKSHOP_ENTERPRISE_AUDIT.md`. No business process was redesigned, no new maintenance workflow was invented, and no UI modernization was attempted — that is Phase 2's job. This phase corrects security defects, restores workshop isolation, closes two verified operational-collaboration gaps, and delivers the one clear mobile/Electron parity gap the audit identified.

---

## 1. Executive Summary

- **3 Critical security findings, all fixed**: hardcoded role arrays bypassing the permission system on Machine Registry writes and Material Request approval; the `machines` table never being workshop-scoped anywhere it was queried; and `workshopOverview` checking the wrong permission key entirely.
- The permission-key fix was more consequential than it looked on paper — it was live-verified against the database that 6 roles (`harvesting-leader`, `poles-leader`, `sawmill-leader`, `storekeeper-assistant`, `supervisor`, `vat-leader`) were **already explicitly granted** `'workshop-overview'` but were being silently denied because the code checked `'inventory'` instead. Fixing the key restores access these roles were always supposed to have. The one role that relied on the old (wrong) check — `logistics`, via its `'inventory'` grant — was given `'workshop-overview'` directly (`db/migrate.js`) so this fix is a pure correction, not a narrowing, for anyone.
- Two genuinely missing notifications (material request submitted, material request approved/rejected) were added — the audit's Priority 2 mandate to "maintain notifications" surfaced a real gap: neither function fired any notification at all before this phase.
- Finance visibility was added for maintenance costs — `maintenance_records.cost` was captured on every record and never summed anywhere. It now appears as a read-only figure on Workshop Overview for full-access roles, with zero accounting logic introduced.
- Machine KPI Performance — the one dedicated desktop NAV page with zero mobile presence — now has a full mobile screen, hook, types, and REST route.
- What was **not** done, deliberately: no maintenance-request/work-order workflow was invented, no automatic machine-status↔maintenance-record synchronization was built (same class of gap already documented and deliberately deferred for the analogous vehicle case in Logistics Phase 3 — it requires a new "in-progress vs. completed" concept that doesn't exist in the schema), and no UI/navigation redesign was attempted.

---

## 2. Critical Security Fixes

### 2.1 Hardcoded role arrays removed
Every Workshop write/approval function that checked a literal role-name array instead of the permission engine was converted to `mustRole`, matching its own sibling read function's gate — the exact pattern already established fixing Logistics' `dispatchReview` in Phase 1:

| Function | Was | Now |
|---|---|---|
| `machinesCreate`, `machinesUpdate`, `machinesDelete` | `['admin','ceo','logistics']` | `mustRole(user,'machines')` |
| `machineCategoriesCreate`, `machineCategoriesUpdate`, `machineCategoriesDelete` | `['admin','ceo','operations','logistics']` | `mustRole(user,'machines')` |
| `materialRequestsApprove` | `['admin','ceo','operations','logistics','supervisor']` | `mustRole(user,'stock-movements')` (matches `materialRequestsList`/`Create`'s own gate) |

**Live-verified concrete effect**: the `operations` role has always had `'machines'` granted but was never in the old hardcoded array — meaning `operations` could view the Machine Registry but could never actually register or edit a machine. Confirmed via a throwaway QA account: `machinesCreate` was denied before this fix and succeeds after it. Similarly, `storekeeper` has `'stock-movements'` granted (used for viewing/creating material requests) but was excluded from the old approve array — confirmed via QA account that `materialRequestsApprove` now correctly succeeds for this role.

Stock Transfer approval functions (`stockTransfersApproveReject`/`Dispatch`/`Receive`) share the identical anti-pattern but were left untouched — they're a general Inventory feature, not Workshop-specific, and weren't named in this phase's brief. Flagged for whichever phase covers Inventory.

### 2.2 Workshop isolation restored on the `machines` table
`machinesList`, `machineKpiPerformance`, and `machineFuelSummary` all queried `machines` with no workshop filter at all — a workshop-restricted user saw every machine, every KPI row, and every fuel-reconciliation row company-wide. `machineLogsList`'s own log rows were already correctly scoped, but its embedded machine-picker dropdown wasn't. All four now apply the same `(workshop_id = $N or workshop_id is null)` pattern already used correctly elsewhere in the codebase — no new isolation mechanism was invented.

**Live-verified**: created a control machine in a different workshop from a restricted QA supervisor's own workshop, confirmed it does **not** appear in that supervisor's `machinesList` or `machineKpiPerformance` results, while their own workshop's machines still do.

### 2.3 `workshopOverview` permission key corrected
Changed from `mustRole(user,'inventory')` to `mustRole(user,'workshop-overview')` — the key the role-permission system and the NAV entry both actually use. To avoid narrowing access for the `logistics` role (which relied on `'inventory'` and never had `'workshop-overview'`), `db/migrate.js`'s `logistics` permission grant was extended to include `'workshop-overview'`, with an explanatory comment, and the migration was run against the live database.

**Live-verified**: confirmed via direct query that `logistics` now has `'workshop-overview'` in `role_definitions`, and that a QA account with `'workshop-overview'` but not `'inventory'` (simulating `supervisor`) can now access `workshopOverview` — it was denied before this fix.

---

## 3. Workshop Isolation Verification

All three previously-unscoped queries (§2.2) were fixed and live-tested with a genuine cross-workshop control case (not just "the query ran without erroring" — an actual machine in a different workshop was confirmed excluded). `materialRequestsList`, `materialRequestsCreate`, `workshopOverview`, and `machineLogsList`'s own row query were already correctly scoped before this phase and were re-confirmed, not changed.

---

## 4. Permission Corrections

Covered in §2.1 and §2.3. No other permission-key mismatches were found in the audited scope.

---

## 5. Cross-Department Improvements

- **Inventory**: Material Requests → Stock Movement → Stock Levels was already sound (verified, unchanged). The audit's stock-availability-before-approval gap was intentionally left for Phase 2, per this phase's own roadmap in the audit.
- **Procurement**: `procurementWorkshopPerformance` was verified as already real and functioning; surfacing it back inside Workshop Overview itself was intentionally left for Phase 2/3 (UI work).
- **Logistics**: vehicle-availability filtering on delivery/transport-job forms was re-confirmed sound (already verified during the Logistics Phase 3 audit). No Workshop-side change needed.
- **Fleet**: machines and vehicles remain two separate registries with no shared reporting — confirmed as an accepted, pre-existing design, not something this phase should merge (would be a redesign).
- **Finance**: see §6.
- **Management**: `workshopOverview` and `machineKpiPerformance` were already the strongest links in the whole audit; no change needed beyond the isolation/permission fixes above.

---

## 6. Finance Visibility Improvements

`workshopOverview` now returns a `financeVisibility` block (full-access roles only — `null` for workshop-restricted roles, since maintenance costs are inherently a company-wide figure given vehicles have no `workshop_id` column at all):

```
financeVisibility: {
  maintenanceCostThisMonth: number,
  maintenanceRecordCountThisMonth: number,
  maintenanceCostByType: [{ type, total, count }, ...]
}
```

Pure aggregation of `maintenance_records.cost` — no new table, no accounting logic. Surfaced with a small, existing-card-style block on the desktop Workshop Overview page (no new component family, no table toolkit — that's Phase 2 territory). Machine-related costs could not be exposed the same way: neither `machine_daily_logs` nor `machine_fuel_logs` capture a cost/monetary field anywhere in the schema, so there is nothing to aggregate for machines specifically — noted rather than fabricated.

---

## 7. Mobile/Desktop Parity

Machine KPI Performance — the audit's one clear, unambiguous parity gap — now has full mobile coverage:
- `mobile-api/routes/machines.js`: new `GET /api/machines/kpi-performance?month=` route, with the same `numeric`-string-to-number normalization convention already used by every other mobile-api route.
- `mobile/src/types/api.ts`: `MachineKpiPerformanceRow`, `MachineKpiResult`, `MachineKpiPerformanceResponse`.
- `mobile/src/hooks/useMachines.ts`: new `useMachineKpiPerformance(month?)`.
- `mobile/src/screens/machines/MachineKpiPerformanceScreen.tsx`: new screen — utilization %, efficiency %, downtime, fuel, production, and KPI-target achievement per machine, mirroring the desktop table's data exactly.
- Wired into `MachinesStack`/navigation types, reachable via a new header icon on `MachinesListScreen`.

---

## 8. Files Modified

**Backend**
- `db/services/data.js` — hardcoded-role-array fixes (§2.1); workshop-isolation fixes on `machinesList`, `machineKpiPerformance`, `machineFuelSummary`, `machineLogsList` (§2.2); `workshopOverview` permission-key fix + `financeVisibility` block (§2.3, §6); notifications added to `materialRequestsCreate`/`materialRequestsApprove` (§Priority 2).
- `db/migrate.js` — `logistics` role granted `'workshop-overview'` (§2.3); migration run against the live database.

**Desktop**
- `renderer/app.js` — `renderWorkshopOverview` gained a minimal, existing-style Finance visibility card (§6). No other UI changes.

**Mobile API**
- `mobile-api/routes/machines.js` — new `GET /kpi-performance` route.

**Mobile**
- `mobile/src/types/api.ts`, `mobile/src/api/endpoints.ts`, `mobile/src/hooks/useMachines.ts` — new KPI types/endpoint/hook.
- `mobile/src/screens/machines/MachineKpiPerformanceScreen.tsx` — new screen.
- `mobile/src/navigation/types.ts`, `mobile/src/navigation/stacks/MachinesStack.tsx`, `mobile/src/screens/machines/MachinesListScreen.tsx` — navigation wiring + header action.

---

## 9. Verification Results

- `node --check`: clean on `data.js`, `migrate.js`, `renderer/app.js`, `mobile-api/routes/machines.js`.
- `npx tsc --noEmit` (mobile): clean.
- **Live database smoke test**, using three throwaway QA accounts (`_qa_p1_ops`/operations, `_qa_p1_supervisor`/supervisor with `workshop_id=3`, `_qa_p1_storekeeper`/storekeeper), all deactivated and their test data removed afterward:
  - Confirmed `operations` can now create a machine (previously blocked by the hardcoded array).
  - Confirmed `storekeeper` can now approve/reject material requests (previously blocked).
  - Confirmed a workshop-restricted account sees only its own workshop's machines in both `machinesList` and `machineKpiPerformance` — proven with a genuine control machine registered in a *different* workshop and confirmed excluded (the first pass of this test was insufficiently rigorous, since every pre-existing machine in this environment happened to share one workshop; a proper cross-workshop control machine was added specifically to prove real exclusion).
  - Confirmed `supervisor` (granted `'workshop-overview'`, never `'inventory'`) can now access `workshopOverview`, and correctly receives `financeVisibility: null` (workshop-restricted), while `operations` (full access) receives a populated `financeVisibility` block.
  - Confirmed both new notifications fire and are correctly targeted (broadcast on submission, targeted `forUserId` on approval/rejection).

---

## 10. Remaining Phase 2 Recommendations

Per the audit's own roadmap, unchanged by this phase:
- Consolidate Workshop-related NAV entries into one section (currently spread across 5).
- Apply the Logistics-proven table toolkit (search/filter/sort/bulk actions/detail-overlay+history) to Machine Registry, Machine Daily Logs, and Machine KPI Performance — all three are still on the pre-upgrade plain table.
- Add pagination/limits to `machinesList` and `machineKpiPerformance` (currently unbounded).
- Stock-availability check before Material Request approval.
- Downtime-reason breakdown report.
- Standalone Machine Maintenance Schedule list screen on mobile (currently create-only, embedded in Machine Detail).
- (Noted, not actioned) `mobile-api/routes/machines.js`'s own `requireRoles(...)` Express-layer role list shares the same "hardcoded array" class as the Priority 1 defects fixed in `data.js` — this is an app-wide convention used identically across dozens of other route files, not a Workshop-specific defect the audit flagged, so it was intentionally left alone this phase.

---

## 11. Commit Discipline

Per standing release discipline, nothing in this phase has been committed or pushed. Awaiting explicit user review/approval before any commit.
