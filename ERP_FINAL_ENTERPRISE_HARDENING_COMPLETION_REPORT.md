# ERP Final Enterprise Hardening & HR Completion Phase — Completion Report

Companion files: `ERP_FINAL_ENTERPRISE_HARDENING_CHANGELOG.md` (full code diff detail),
`ERP_FINAL_ENTERPRISE_HARDENING_GAP_REGISTER.md` (FH-01 to FH-05, itemized).

---

## 1. Executive Summary

This phase closed the two remaining cross-cutting Yellow-status systems from the ERP
Remaining Departments Completion Program (Notifications, Reporting — both now Green), ran a
light confirmatory CRUD-parity check that found and fixed one real regression (mobile Pole
Production Batch delete), and produced the required audit/documentation for four HR
capability questions (Attendance→Casual Labour Hours, Attendance notifications, Attendance
correction approval, Payroll). Per the brief's explicit instruction, none of the four HR
questions were implemented — each was either confirmed blocked on an unmade business
decision (documented as a full rule gate) or investigated and concluded with "no change
needed." No business rule was guessed, no second approval engine was invented, and Workshop
Isolation was not touched. Nothing was committed or pushed.

## 2. Scope of This Phase

In scope: Priorities 1-6 exactly as specified in the brief, plus a CRUD parity final check,
static verification, and live verification. Out of scope (explicitly, per the Stop Rule): no
new department, no implementation of any guessed business rule, no new approval engine, no
Workshop Isolation redesign, no automatic commit/push.

## 3. Methodology

Consistent with every prior phase in this program: audit the current source code and (where
relevant) the live production database first; only implement where a real gap and a safe,
evidence-based fix both exist; document rather than guess wherever a business decision is
missing; verify statically (`node --check`, `npx tsc --noEmit`) and, where safe, live against
production with either disposable data or pure read-only queries.

## 4. Priority 1 — Attendance → Casual Labour Hours (Business Rule Gate)

**Status: Blocked on business decision — documented only, nothing implemented.**

The `attendance` table (`db/migrate.js`, `createAttendanceTables()`) has zero rate-bearing
columns. The only compensation-shaped field anywhere near this feature is
`casuals.salary_per_action`, which is never referenced by any calculation anywhere in
`data.js` — it is pure CRUD (stored/edited only). Its own name ("per **action**", not "per
hour") actively suggests a piece-rate model, which would contradict an hourly-attendance
calculation if one were built without confirming which model is actually intended. The
separate `casual_labour_requests` table/workflow is a staffing *request* ("we need N casuals
for task X"), not a payment calculation, and has no rate fields either.

18 specific business rules were checked against the current schema and confirmed undefined
(regular hours, overtime threshold/multiplier, partial-day handling, break deduction,
late/early policy, weekend/holiday multiplier, min/max payable hours, rounding, hourly vs.
daily vs. per-action rate model, rate-by-category, missing-checkout handling, retroactive
recalculation on correction, absent-worker handling, where the approved rate itself would be
stored, and who approves a calculated amount). Full table in Gap Register FH-01.

## 5. Priority 2 — Attendance Notifications (Business Decision Register)

**Status: Documented only, not implemented, per the brief's explicit instruction.**

7 candidate events (absent, late arrival, missing check-out, correction, unusual pattern,
daily submission complete, period closed) were catalogued with the specific
trigger/recipient/threshold/severity/platform decision each one needs. The underlying
notification infrastructure (`pushNotification`, the automation-rule engine) is proven and
reusable — this phase itself extended it for 3 unrelated automation rules (see §8) — so
implementation, once rules are approved, is mechanical. Full table in Gap Register FH-02.

## 6. Priority 3 — Attendance Correction Approval Model

**Status: Investigated — conclusion is "keep the current model, no change."**

`attendanceUpdate`/`attendanceDelete` perform direct, immediate mutations (no
`applyGovernance`/`pending_edits` call), gated by `_canAccessAttendance`
(`admin`/`ceo`/`operations`/`supervisor`) plus standard Workshop Isolation, with a full
before/after diff captured in `logAudit` on every edit. This is genuinely "Option A"
(authorized-edit-only), confirmed by direct code inspection, not an oversight — and it's
consistent with how this codebase already treats this same 4-role tier elsewhere (governance
gates in this codebase are for roles that don't otherwise hold broad edit authority). No
incident or business signal was found suggesting a second approval layer is needed. No code
change made. Full reasoning in Gap Register FH-03.

## 7. Priority 4 — Payroll (New Capability Classification)

**Status: Confirmed absent. Classified as a NEW ENTERPRISE CAPABILITY. Not implemented.**

A full sweep of `db/schema.sql` and `db/migrate.js` for
payroll/payslip/salary/wage/deduction/allowance/overtime_rate/tax_rate/compensation found
zero matches except `casuals.salary_per_action` (stored-only, see §4). `app_users` has no
compensation field at all. No payroll function, IPC channel, REST route, desktop page, or
mobile screen exists anywhere. The full Payroll Business Rule Gate and Data Safety
requirements (employee types, earnings/deduction components, attendance linkage, pay period
definition, approval chain — must reuse existing governance, never a second engine, payslip
distribution, statutory/tax handling, immutability of a finalized run, full audit trail) are
documented in Gap Register FH-04 as the prerequisite for any future dedicated design phase.

## 8. Priority 5 — Notification Completion

**Status: Complete — Notifications is now Green.**

Closed all remaining gaps disclosed by the prior phase's audit:

- 4 of 10 `ENTITY_ESCALATION_MODULE` entity types had no mapping (`delivery`, `security`,
  `approval_edit`, `approval_del`) — all 4 mapped to real, existing destinations.
  `workflow`/`procurement_improvement_plan` remain intentionally unmapped (confirmed no real
  destination exists for either).
- 8 automation-engine `_autoAct` call sites used capitalized literal strings
  (`Stock`/`Machines`/`Logistics`/`System`/`Security`/`Approvals`/`Fuel`/`Harvest`) that
  matched no routing key on either platform. Each was re-mapped based on its `relatedId`
  semantics (not a blind lowercase) — 3 needed brand-new page-only routing entries
  (`stock`/`fuel`/`harvest`, added to both platforms), 5 reused already-existing keys where
  the real destination was the same page (`machines`, `deliveries`, `governance` ×2,
  `audit`).
- Full detail and the reasoning per call site is in the Changelog.

**Verification**: a static cross-check script confirmed all 10 distinct
`module`/`relatedModule` strings the backend can emit now resolve on both platforms with zero
mismatches — used instead of firing the live automation engine, which would have pushed real
alerts to real admin/ceo accounts rather than disposable test data.

## 9. Priority 6 — Reporting Completion

**Status: Complete — Reporting is now Green.**

Added CSV export to every report previously flagged as lacking one: Poles reconciliation +
source report, Sawmill production reconciliation (extended the existing combined dashboard
export), Harvest Waste, and VAT/Nyanza's reuse of the quality report plus its own
reconciliation/input-output data (previously had no export at all, unlike Sawmill's own use
of the same underlying report). The shared Rejection Holds component and the Resolution
History modal (used by Sawmill/VAT/Poles) also gained export buttons. No new export
mechanism was introduced — every addition reuses the existing `downloadCsv()` helper. Full
detail in the Changelog.

**Verification**: a read-only live check against production confirmed all 6 report functions
behind these buttons execute cleanly (`ok: true`, zero side effects, pure `SELECT`-based
reads): `poleProductionReconciliation`, `polesSourceReport`, `productionReconciliation`,
`valueAddedProductionReconciliation`, `valueAddedProductionReport`, `harvestWasteList`.

## 10. CRUD Parity Final Check

A light confirmatory spot-check (one representative entity per department, 16 total) — not a
new full audit, since ERP Remediation Phase 2 already completed one — found 15/16 clean and
one real regression: **Pole Production Batch delete** had full
Backend/IPC/REST/Desktop support and even a correctly-implemented mobile hook, but no mobile
screen ever called it. This is the identical bug shape already found and fixed once before
for VAT's `useVatDelete` in an earlier phase, confirming it was a genuine, undocumented
oversight rather than a scope decision. Fixed by wiring the existing hook into
`PoleBatchListScreen.tsx`, reusing the exact `ReasonModal` + `pendingApproval`-aware pattern
already established by `VatDetailScreen.tsx`. Full detail in Gap Register FH-05 and the
Changelog.

## 11. Workshop Isolation Confirmation

Not touched, not redesigned. Every change this phase was either (a) notification routing
(navigation only, never authorization — matches this codebase's established "routing tables
are never authorization" rule), (b) CSV export (client-side formatting of already-fetched,
already-authorized data), or (c) the Pole Batch delete fix, which calls the pre-existing,
already-Workshop-Isolated `poleProductionBatchDelete` backend function unchanged. No new
`isWorkshopRestricted` logic was added or modified anywhere this phase.

## 12. Live Verification

- **Reporting**: read-only live execution of all 6 backing report functions against
  production — see §9.
- **Notifications**: static cross-check of every possible `relatedModule` value against both
  platforms' routing tables (chosen over firing the live automation engine, which would have
  sent real alerts to real users) — see §8.
- **Attendance / Payroll**: no live verification applicable — Priorities 1-4 produced no code
  changes to verify.
- **CRUD parity fix**: verified via `npx tsc --noEmit` (clean) and direct code-path tracing
  of the governance response shape end-to-end (backend → `respond()` middleware → REST
  envelope → `unwrapEnvelope` → hook → UI), matching the exact mechanism already proven live
  for the VAT precedent this fix mirrors. No device was available for an actual tap-through,
  the same disclosed limitation carried from every prior mobile-UI phase in this program.

## 13. Static Verification

`node --check` clean on `db/services/data.js`, `renderer/app.js`, `electron/main.js`,
`electron/preload.js`, `db/migrate.js`, `mobile-api/server.js`. `npx tsc --noEmit` clean
across `mobile/` after every change, including the final Pole Batch delete wiring.

## 14. Historical Data Handling

No historical data was modified, corrected, or deleted this phase. No QA data was created for
Priority 5/6 (verification was either read-only or purely static). No QA data was needed for
the CRUD parity fix (verified statically, not via a live create/delete cycle, since a real
delete against a real batch was not warranted for a mechanical UI-wiring fix already proven
correct by an identical, already-live-tested precedent).

## 15. Files Changed Summary

- `db/services/data.js` — `ENTITY_ESCALATION_MODULE` (4 new mappings), 8 `_autoAct` call
  sites (module string fixes).
- `renderer/app.js` — 3 new `NOTIFICATION_ROUTES` entries; CSV export additions across
  Poles/Sawmill/Harvest Waste/VAT/Rejection Holds/Resolution History.
- `mobile/src/utils/notificationRouting.ts` — 3 new routing entries (parity).
- `mobile/src/types/api.ts` — new `PolePendingApproval` type.
- `mobile/src/hooks/usePoles.ts` — `usePoleProductionBatchDelete` fixed to handle the
  governance `pendingApproval` response correctly.
- `mobile/src/screens/poles/PoleBatchListScreen.tsx` — wired the delete hook into the UI.

No `db/schema.sql` or `db/migrate.js` changes this phase (no new tables/columns needed for
anything actually implemented).

## 16. Gap Register Summary

FH-01 (Attendance→Casual Labour Hours — blocked, needs approval), FH-02 (Attendance
notifications — documented, needs approval), FH-03 (Attendance correction approval — no
change needed, resolved), FH-04 (Payroll — new capability, needs a dedicated design phase),
FH-05 (CRUD parity — 1 found, fixed). Plus prior-phase carry-forwards unchanged (Automation
Rule management UI, vehicle compliance docs desktop-only, `delivery_orders` missing from
`TRASH_TABLES`, 4 backend functions with no `secureHandle` on desktop, 57 permanently-retained
QA accounts). Full detail in the Gap Register file.

## 17. Final Capability Table

| Capability | Backend | Desktop | Mobile | CRUD | Approval | Audit | Notifications | Reporting | Status |
|---|---|---|---|---|---|---|---|---|---|
| Attendance (mark/edit/void) | Yes | Yes | Yes | Yes | N/A (direct-edit model, confirmed correct) | Yes (before/after diff) | None (documented, business decision required) | Dashboard + report exist | Green |
| Attendance → Casual Labour Hours | No | No | No | N/A | N/A | N/A | N/A | N/A | Blocked — business rule gate documented (FH-01) |
| Payroll | No | No | No | N/A | N/A | N/A | N/A | N/A | Absent — new capability, needs design phase (FH-04) |
| Notification routing (all producers) | Yes | Yes | Yes | N/A | N/A | Yes | Yes — every relatedModule now resolves | N/A | Green |
| Reporting exports (Poles/Sawmill/Harvest/VAT) | Yes | Yes | N/A (desktop reports) | N/A | N/A | N/A | N/A | Yes — CSV on all | Green |
| Pole Production Batch (incl. delete) | Yes | Yes | Yes (fixed this phase) | Yes | Yes (governed) | Yes | N/A | N/A | Green |
| CRUD parity (system-wide, spot-checked) | Yes | Yes | Yes | Yes | Where applicable | Yes | — | — | Green (15/16 clean, 1 fixed) |

## 18. Production Readiness & Recommendations

Notifications and Reporting — the two cross-cutting systems left Yellow by the ERP Remaining
Departments Completion Program — are now Green. The one CRUD regression found this phase is
fixed and statically verified. Attendance remains production-ready exactly as HR Phase 2 left
it (mark/edit/void, dashboard, report — all live) but its extension into a payable Casual
Labour amount, its own event notifications, and Payroll as a whole all remain correctly
un-built pending explicit business decisions — implementing any of them on a guessed rule
would produce real financial or paging behavior without a contractual basis, which this phase
correctly declined to do.

**Recommended next steps** (in order, pending business input): (1) answer the FH-01 rule
table to unblock Attendance→Casual Labour Hours; (2) approve/reject the FH-02 notification
event table; (3) commission a dedicated Payroll design phase using FH-04's rule gate as the
starting brief. None of these require further engineering investigation — the blocking
questions are entirely business decisions at this point.

Per the Stop Rule, no other department was started and nothing was committed or pushed.
