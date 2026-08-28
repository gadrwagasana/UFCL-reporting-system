# ERP Final Existing-System Gap Register

Produced by Phase 3 ("Final Existing-System Gap Closure & Production Readiness"), the third and final remediation pass in this program. This register captures every item still open after Phases 1 and 2, re-evaluates the 6 specifically-named "known remaining items" from this phase's own brief, and records what was fixed vs. classified vs. left for a business decision.

| # | Finding | Severity | Category | Existing Backend | UI State (after this phase) | Action |
|---|---|---|---|---|---|---|
| 1 | Log Transport Edit unreachable both platforms | (Phase 2, resolved) | C→A | `logTransportUpdate`, fully governed | Complete both platforms | **Fixed** (Phase 2) |
| 2 | Resolution Engine browse/list — no UI on either platform | Medium | C | `resolutionsList`, governed, workshop-isolated | **Complete on desktop** (4 source types: harvest_waste, production_offcut, rejected_timber, showroom_damage) | **Fixed this phase** (desktop) |
| 3 | Resolution Engine browse/list — mobile | Low | C | Same function, mobile hook already existed unused | Still missing (hook exists, no screen wired) | Deferred — smaller follow-up now that desktop pattern exists |
| 4 | Machine Daily Logs — mobile edit/delete | Medium | C | `machineLogsUpdate`/`Delete`, governed, same class as Vehicle Fuel/Maintenance | **Complete both platforms** | **Fixed this phase** |
| 5 | Machine KPI Definitions — mobile | Low | F | `machineKpiDefinitionsList/Create/Update/Delete` | Desktop-only (intentional) | **Classified — not built.** Admin/config function (define what gets measured and how), not day-to-day field work. Mirrors `Machine Maintenance Schedules`' own explicit in-code "stays on desktop" decision. |
| 6 | Machine KPI Targets — mobile | Low | F | `machineKpiTargetsList/Save` | Desktop-only (intentional) | **Classified — not built.** Same reasoning as #5 — setting numeric targets per machine per KPI is a planning/config task, not field data entry. |
| 7 | Casuals Worker Registry — mobile | Low | F | `casualsList/Create/Update/Delete` | Desktop-only (intentional) | **Classified — not built.** HR/roster administration (names, roles, pay rates) — same class as `Users` management, which is also correctly desktop-only. Distinct from `Casual Labour Requests` (the work-order submission workflow), which already has full mobile parity including delete (fixed Phase 2). |
| 8 | `procurementBenchmark` — dead on both platforms | Low-Medium | C (ambiguous) | `procurementBenchmark`, well-designed, reuses already-computed data, same permission gate as every other exposed report | Still missing both platforms | **Classified: requires business decision.** Plausibly intended (see reasoning below) but was already flagged as awaiting a go/no-go in an earlier phase without resolution; building a comparison UI speculatively risks exactly the "do not create a dashboard merely because the function exists" the brief warns against. |
| 9 | `supplierImprovementPlansRegister` — cross-supplier browse dead both platforms | Low | C | Full backend, gated same as write side | Missing both platforms | Deferred — same size class as `getApprovalDashboard` (item 12) |
| 10 | Vehicle Fuel Log / Maintenance Record delete — desktop | (Phase 2, resolved) | D→A | Governed | Complete both platforms | **Fixed** (Phase 2) |
| 11 | Machine Fuel Log / Casual Labour Request delete — mobile | (Phase 2, resolved) | D→A | Governed | Complete both platforms | **Fixed** (Phase 2) |
| 12 | `getApprovalDashboard` — dead both platforms | Low-Medium | C | Cross-module approval queue summary | Missing both platforms | Deferred (Phase 1 finding, still open — genuine but non-critical) |
| 13 | `performanceKPIs` | Low | B | Superseded by CEO Overview + BI Dashboard | N/A | Confirmed backend-only/superseded (Phase 1) |
| 14 | Downgrade resolution — no mobile UI | — | F | Needs product picker | Desktop-only (intentional, documented in-code) | **Confirmed correct — preserved as-is**, per this phase's own explicit instruction |
| 15 | Generic resolution destinations (Firewood/Scrap/Internal/Other) — mobile restricted to Disposal | — | F | Needs warehouse picker | Mobile partial (intentional, documented in-code) | **Confirmed correct — preserved as-is** |
| 16 | Machine Maintenance Schedules — mobile edit/delete | — | F | Explicit in-code "stays on desktop" comment | Desktop-only (intentional) | Confirmed correct, unchanged |
| 17 | Procurement mobile: 15/22 screens lack client-side permission gating | Medium (UX only — server enforces) | D | Server-side `mustRole` authoritative | Unchanged | Deferred (Phase 1 finding, already scoped, large — 15-screen retrofit) |
| 18 | 4 roles missing `ROLE_PAGES` fallback | (Phase 1, resolved) | G→A | Fixed | Complete | **Fixed** (Phase 1) |
| 19 | `logistics-leader` dead role reference | (Phase 1, resolved) | — | Fixed | Complete | **Fixed** (Phase 1) |
| 20 | `getCeoOverview` CRITICAL crash | (Phase 1, resolved) | E→A | Fixed | Complete | **Fixed** (Phase 1) |
| 21 | BI Dashboard division-by-zero (all `bi`-permission roles) | (Phase 1, resolved) | E→A | Fixed | Complete | **Fixed** (Phase 1) |
| 22 | Desktop CEO Overview omits 2 of 11 returned fields | Low | D | `getCeoOverview` returns `pendingPolesRequests`/`pendingMonthlyApproval`, desktop doesn't render them | Still open | Deferred — cosmetic, found during Phase 1's F-01 fix |
| 23 | Enter-to-submit missing app-wide (140+ `openOverlay` sites) | Low | D | — | Unchanged | Deferred — pre-existing backlog, explicitly out of single-phase scope |
| 24 | No mobile CSV/file export anywhere | Low | F (platform limitation) | — | Unchanged | Deferred — pre-existing backlog |
| 25 | `_QA-RL-TEST` leftover vehicle row | — | Data hygiene | — | Still present | Awaiting user decision (pre-existing, not this program's to unilaterally remove) |
| 26 | ~55-61 leftover QA-pattern accounts | — | Data hygiene | — | Still present | Awaiting user decision (pre-existing) |

## Re-Evaluation of the 6 Specifically-Named Items (Phase 5 of this phase's brief)

1. **Machine Daily Logs mobile edit/delete** — Determined to be a genuine operational requirement (same class of field-entry record as Vehicle Fuel Logs/Maintenance Records, which mobile already needed and got in Phase 2). **Built**: 2 new REST routes (`PUT`/`DELETE /api/machine-logs/:id`), 2 new hooks, dual-mode create/edit screen, delete action on detail screen. Live-verified against a real record, restored afterward, audit trail confirmed (`audit_log` entry: "Machine log updated: #1").
2. **Machine KPI Definitions/Targets** — Determined to be administrative/configuration functions, not operational field work. **Not built.** Classified Category F, consistent with the codebase's own explicit precedent (Machine Maintenance Schedules' in-code comment: "stays on desktop's Machine Registry").
3. **Casual Worker Registry** — Per the brief's explicit instruction, evaluated whether mobile access is part of the existing intended workflow. Determined this is desktop-appropriate admin/HR data (worker roster, pay rates), same class as `Users` management. **Not built.** Classified Category F (intentionally platform-specific), not Category G (it's not a new capability — the roster already exists and works on desktop; extending it to mobile would be new *platform* scope, which is exactly what this classification exists to name).
4. **Resolution Engine Browse** — Investigated whether resolved records show their resolution detail anywhere else in the UI. Found they do not — a "Resolved" badge is the only visible trace; the destination, cost, notes, and resolver are permanently invisible once set. Determined a user-facing history workflow is clearly warranted (the backend was built with full workshop-isolated read access specifically for this). **Built on desktop**: a "Resolution History" view reusing the existing `resolutionsList` function exactly, wired into all 4 originating workflows (Harvest Waste, Production Offcuts, Rejected Timber, Showroom Damage). Mobile deferred (the hook exists; only a screen needs wiring — smaller follow-up).
5. **Procurement Benchmark** — Investigated the function's design and permission gate. It's well-built (reuses already-computed department/workshop/buyer/supplier data, no duplicate queries) and gated identically to every other already-exposed procurement report — plausibly intended. However, it was already flagged as awaiting a go/no-go decision in an earlier phase without resolution, and the brief's own instruction is explicit: "Do not create a dashboard merely because the function exists." **Not built** — classified "requires business decision," with the supporting evidence above so the decision, when made, doesn't need to re-derive this.
6. **Downgrade / Complex Resolution** — Preserved exactly as-is, per explicit instruction. No changes.

## Backend-Only By Design (Category B, confirmed this program)

`performanceKPIs` (superseded by CEO Overview + BI Dashboard), `procurementSupplierToggleBlacklist`/`procurementSupplierPerformance` (superseded), `procurementQuotationsCompare` (redundant — data already inline), legacy `stockTransferApprove` singular (superseded, kept for cached old mobile builds), `harvestList` (superseded), background automation/escalation/workflow-retry engines (internal by design).

## New-Feature / Requires-Business-Decision Items (Category G-adjacent)

- `procurementBenchmark` UI (item 8 above).
- Nyanza sales staffing — no currently-active role stationed at Nyanza holds the `sales` permission (a staffing decision from an earlier phase, not code).
- `_QA-RL-TEST` vehicle and leftover QA accounts (data hygiene decisions, not code).

## Summary Tally

| Status | Count |
|---|---|
| Fixed this phase | 3 items (Resolution History desktop ×4 source types, Machine Daily Logs mobile edit/delete) |
| Fixed in Phases 1-2 (carried into this register for completeness) | 15 items |
| Classified Category F (intentionally platform-specific), confirmed correct | 5 items |
| Classified Category B (backend-only by design), confirmed correct | 6 items |
| Requires business decision, documented not built | 3 items |
| Deferred (real but smaller/lower-priority) | 8 items |
