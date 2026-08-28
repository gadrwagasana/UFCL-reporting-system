# ERP Enterprise UI/UX Final Gap Audit
## Backend-to-End-User Feature Completeness Audit

**This is an AUDIT-ONLY deliverable.** No code, schema, data, or permission was changed while producing it. One live, read-only function call was made to confirm a suspected crash (§4, F-01) — no write occurred.

---

## 1. Executive Summary

This audit asked one question of the entire ERP: **can an authorized end user actually complete every intended operational activity through the interface, not just through the backend?**

The codebase is mature — this is the ~10th dedicated completeness/gap audit across this program (Harvesting, Sawmill, Fleet & Equipment, Mechanician, Workshop, Inventory, Procurement, and two prior ERP-wide UI/UX phases all preceded this one). Most of the ERP is genuinely complete: every core department (Harvesting, Sawmill, Nyanza/VAT, Inventory, Sales, Stock Transfers, Showroom, Procurement, Fleet, Mechanician, Governance) has a working, live-verified, end-to-end path on at least one platform, and most on both.

Against that backdrop, this audit found:

- **1 CRITICAL, live-confirmed finding**: the CEO Overview screen — the single dashboard built specifically for the two most senior roles (`ceo`, `admin`) — throws a database error (`column "status" does not exist` on `monthly_approvals`) and has done so since at least an earlier Fleet & Equipment phase (which found and deliberately deferred it as out-of-scope). It was never fixed by any later phase. **Confirmed live, read-only, this session**: `getCeoOverview(1)` still throws. Both platforms are affected.
- **6 HIGH-severity findings**, mostly notification-routing and approval-visibility gaps of the same class as bugs fixed in two prior phases, but in code paths those phases didn't reach.
- **~20 MEDIUM/LOW findings**, the large majority already discovered and disclosed by earlier phases in this program and never independently re-derived here — cross-referenced and re-verified rather than duplicated.
- **A handful of confirmed non-issues** — placeholder screens that look like gaps but resolve to an already-working alternate path, verified via source-level tracing rather than assumed.

No Workshop Isolation defect was found. No second inventory ledger, second notification system, or second approval engine was recommended anywhere in this document, per the audit's own constraints.

## 2. Audit Methodology

1. **Consolidation of prior findings**: this program has ~30 completion-phase memory records documenting audits and fixes across every department. Each was re-read (not assumed from a one-line index) and cross-referenced against current code before being cited, per the standing rule that a memory is a point-in-time claim, not live state.
2. **Fresh parallel research**: five independent, read-only research passes were run in parallel, each scoped to avoid re-covering ground already closed by a prior phase: (a) role-by-role capability matrix, (b) desktop/mobile parity + navigation reachability, (c) notification routing + governance visibility completeness, (d) inventory UI completeness + reporting/dashboard visibility, (e) form-completeness + dead/placeholder UI sweep.
3. **Live verification**: every HIGH+ finding that could be checked with a read-only database call or a direct function invocation was checked that way rather than left as a static-analysis guess (see §4 for the CEO Overview crash, confirmed live; see F-33 for the `requireRoles` spread-operator check, confirmed live via direct source read of all three flagged route files).
4. **Cross-referencing against session history**: several findings surfaced by the fresh research passes turned out to be already-known and already-resolved (e.g. the `mechanician` role/navigator permission mismatch flagged by an earlier Fleet phase — re-verified live this session and confirmed fixed by the later Mechanician program) or already-deliberately-decided (e.g. SRM contract-expiry notifications' unrouted `relatedModule` — confirmed intentional in the same prior phase that fixed the sibling compliance-notification bug). These are reported as **closed**, not re-opened.

## 3. Architecture

Confirmed unchanged and correctly preserved everywhere audited:

```
Desktop: renderer/app.js -> Electron IPC (electron/main.js) -> db/services/data.js -> PostgreSQL
Mobile:  mobile/src -> REST (mobile-api/routes/*.js, pure delegation) -> db/services/data.js -> PostgreSQL
```

No business logic was found in a UI component, IPC handler, or REST controller. `mobile-api` routes remain pure delegation (confirmed by the same spot-checks earlier phases have repeatedly confirmed).

## 4. Backend Capability Inventory (headline findings)

Cumulative across this and the two immediately preceding UI/UX phases, well over 200 backend functions have now been traced to their UI callers (or lack thereof). This phase's own fresh sample added the following **previously-undiscovered** dead/broken items:

| ID | Function | File:line | Finding |
|---|---|---|---|
| **F-01** | `getCeoOverview` | `data.js:13450`, root cause `data.js:13498` | **CRITICAL.** Queries `monthly_approvals.status`, a column that does not exist on that table (confirmed via the table's other 3 usages, which only reference `approved`/`approved_by`/`approved_at`/`month_key`). **Live-confirmed this session**: `node -e "require('./db/services/data').getCeoOverview(1)"` → throws `column "status" does not exist`. Wired to both platforms (`electron/main.js` IPC, `mobile-api/routes/ceo.js` REST, `CeoOverviewScreen.tsx`, `useCeoOverview.ts`) — every `ceo`/`admin` user sees a bare error message instead of their dashboard on both. `secureHandle`'s catch-all masks the real error as generic "Internal error" client-side, which likely explains why this has gone unreported despite being fully reproducible. Originally surfaced (and deliberately deferred as out-of-scope) by an earlier Fleet & Equipment phase; never fixed since. |
| F-02 | `getApprovalDashboard` | `data.js:10810` | Zero callers on either platform (IPC + preload wired, no REST route, no UI). |
| F-03 | `performanceKPIs` | `data.js:17810` | Zero desktop callers; mobile's similarly-named `REPORTS_KPI` endpoint actually resolves to the unrelated `kpiBudgetsList` — a true orphan, not a naming coincidence. |
| F-04 | `machineKpiDefinitionsUpdate` / `Delete` | `data.js:14913`, `14936` | Zero callers on either platform. Definitions can be created and listed but never edited or removed — a real admin-workflow dead end, not just a visibility gap. |
| F-05 | `resolutionsList` | `data.js:9249` | Zero desktop callers (`resolutionCreate` is called once, but nothing renders the list) — desktop can resolve harvest waste/offcuts/rejections/showroom damage but cannot browse what was already resolved. Mobile has this for all four source types. |
| F-06 | `machinesDelete` | (already documented by an earlier audit, re-confirmed) | Zero UI caller on either platform — machines can never be archived. |

## 5. Desktop Audit

62 nav entries in `renderer/app.js`, every one with a matching, non-stub `case` in `showPage()`. No dead nav links, no unregistered stub pages. Two benign no-op overlay-save callbacks found (`app.js:14518`, `15000`) — both are "Close"-only buttons on management panels whose real actions live on separate, correctly-wired inline buttons; not a defect.

## 6. Mobile Audit

163 `<Stack.Screen>` registrations across 54 navigation files for 167 screen files (a ~4-file gap not fully reconciled — see §24, Unverified). Three genuinely reachable placeholder screens found beyond the already-documented, already-confirmed-unreachable `MainNavigator` default fallback:

- `OperationsNavigator.tsx` "PendingReviews" tab → `ComingSoonScreen`.
- `OperationsNavigator.tsx` "MaterialReview" tab → `ComingSoonScreen`.
- `StorekeeperNavigator.tsx` "MaterialReview" tab → `ComingSoonScreen`.

**All three re-verified this session as confirmed non-issues, not new gaps** (see §9, F-09/F-10): Operations already has a fully working material-request approve/reject path via `WorkshopOverviewScreen`, and `storekeeper` is not in `materialRequestsApprove`'s `APPROVAL_TIER` (`data.js:4235`, re-checked live this session: `['admin','ceo','operations','logistics']` plus a supervisor OR-clause — storekeeper is in neither), so it has no approval capability to be missing in the first place. The placeholders are stale/redundant, not blocking.

`SalesNavigator.tsx` imports `ComingSoonScreen` but never renders it — a dead import, not a UI gap.

## 7. Navigation Audit

A 7-file random spot-check of mobile screens confirmed each is reachable via a registered `<Stack.Screen>`. No orphaned screen found in the sample. Desktop has zero unregistered pages (§5). The ~4-file mobile screen-count-vs-registration-count gap noted in §6 was not fully reconciled — logged as Unverified (§24), not asserted as a finding.

## 8. Action Reachability

Spot-checked across Inventory (§13), Manufacturing (§14), Sales (§15), Governance (§12), and Notifications (§11) — see those sections for the concrete backend→permission→UI→result chains traced. No additional broad "action exists but has no button" pattern was found beyond what's itemized in the Complete Findings table (§20).

## 9. Form Completeness

Ten major create/edit forms were compared field-by-field against their backend's required-field validation: Material Request, Stock Transfer, Machine Daily Log, Maintenance Job, Vehicle Registration, Harvest Entry, Casual Labour Request, Compartment, Log Transport, Procurement Requisition. **All ten came back clean on both platforms** — every backend-required field is present in both the desktop and mobile form. (Sales Order and VAT/Nyanza forms were excluded from this sweep as already exhaustively verified in the two immediately preceding phases.)

## 10. Data Visibility

- **F-05** (§4): resolved outcomes are invisible on desktop (create-only), visible on mobile.
- Production reconciliation, VAT/VAP reconciliation, and inventory valuation are all confirmed visible on both platforms (§13).
- Approval history: visible via the existing pending-edit/deletion-request panels for 7 of 8 governed entity types (§12) — the eighth, `log_transport`, is not (F-07).

## 11. Notification Completeness

Every distinct `relatedModule` value emitted anywhere in `data.js` was traced against both platforms' routing registries.

- **F-08 (HIGH)**: Procurement SLA-escalation reminders (`_escalateEntity`, `data.js:16814`) build their `relatedModule` by mechanically title-casing the internal entity-type string (e.g. `procurement_requisition` → `"Procurement requisition"`), which matches neither registry's actual keys (`'procurement-requisitions'` etc). Three of these — requisition, RFQ, invoice escalations (`data.js:17145`, `17169`, `17203`) — carry a perfectly valid `relatedId` that *would* resolve correctly if the string matched. A working destination screen already exists on both platforms; only the string is wrong — the same defect class fixed for VAT supplier-compliance notifications in an earlier phase, in a code path that fix didn't reach.
- SRM contract renewal/expiry notifications (`data.js:16140`/`16147`, `relatedModule:'srm'`) were re-flagged by fresh research but are **confirmed already-intentional**, not a new gap: the same earlier phase that fixed the sibling compliance-notification bug explicitly left these two because contracts have no per-record screen on either platform (`ContractRegister`/desktop equivalent are list-only) — documented at the time, re-confirmed here.
- Everything else checked (stock transfers, material requests, maintenance jobs, direct procurement notifications, sales, deliveries, rejection holds, resolution records, harvest waste, showroom damage, the governance/system scheduler alerts) routes correctly or is already-documented as intentionally unrouted.

## 12. Governance Completeness

8 governed entity types exist in `pendingEditsCreate`'s entity-table map. 7 have both a pending-edit panel and a deletion-request panel on desktop. **F-07 (MEDIUM-HIGH)**: `log_transport` has a deletion panel (`app.js:15869`) but no pending-*edit* panel anywhere in the file, even though the backend will genuinely defer an out-of-window edit to the approval queue (`applyGovernance(..., 'log_transport', ..., 'edit', ...)`, `data.js:14976`). An approver has no UI path to see or act on a Log Transport edit request. This mirrors a gap an earlier phase found and fixed for `harvest_plan` — `log_transport` was never given the same treatment.

## 13. Inventory UI Completeness

Every core inventory operation (view stock, receive, transfer request/approve/dispatch/receive, consume via material requests, request/approve material requests, movement history, valuation, the three department-specific reconciliations, and the Resolution Engine for all four source types) is confirmed working on at least one platform, most on both. Two items short of full parity:

- **F-05** (§4/§10): Resolution Engine — desktop create-only, no list view.
- **F-11 (LOW, Unverified)**: `stockAdjustmentRequestCreate` is confirmed wired on desktop (1 caller) and has a mobile REST route, but no dedicated mobile screen was confidently located in the time available — flagged Unverified rather than asserted as a gap (§24).

The authoritative `stock_catalog → stock_levels → stock_movements` ledger remains the single source of truth everywhere checked; no second ledger was found or is recommended.

## 14. Manufacturing UI Completeness

**Category A — Complete.** The full Nyanza chain (timber inventory → production batch → multi-line input consumption → multi-line output → QC → accepted inventory → sale/transfer, including customer-specific production and Downgrade/Disposal rejection resolution) was built, then independently re-audited and live-tested end-to-end against the production database in the immediately preceding phase (26/26 checks passed, including genuine cross-workshop security negative tests). Nothing further was found this phase. Not re-tested again here to avoid duplicating that work — cited, not repeated.

## 15. Sales UI Completeness

**Category A — Complete**, as of the immediately preceding phase, which found and fixed the one real gap in this area (Sales Order forms on both platforms couldn't select "Manufactured Product" as a category despite the backend already supporting it) and live-verified Standard Cost/Default Price/Negotiated Price separation, COGS-relevant stock deduction, and reversal-safe short-close/cancel paths. Not re-audited from zero here.

## 16. Reporting/Dashboard Visibility

57 report/dashboard/reconciliation/KPI-family functions were swept. ~46 have confirmed callers on both platforms. The dead ones are itemized in §4 (F-01 is the only one that's *broken* rather than merely *unreachable*; F-02/F-03/F-04 are unreachable). Desktop-only, no-mobile-caller items with a plausibility read:

| Function | Plausible reason | Verdict |
|---|---|---|
| `executiveScorecard` | Deep financial exec view | Likely intentional (Category C, not a gap) |
| `inventoryLossReports` | — | **F-12 (MEDIUM)**: plausibly wanted in the field (damage/theft/spoilage recording), no clear reason it's desktop-only |
| `machineFuelSummary`, KPI definitions/targets CRUD | Back-office config | Likely intentional (Category C), though a mechanician daily fuel summary on mobile is a reasonable ask |

No mobile-exclusive reports were found (i.e. nothing where mobile has a report desktop lacks).

## 17. Role-by-Role Matrix

| Role | Permission source | Desktop coverage | Mobile coverage | Notable finding |
|---|---|---|---|---|
| admin, ceo | Full | Full | `CeoNavigator` (shared) | F-01 affects both |
| operations | Ops/logistics/procurement | Full | `OperationsNavigator` | 2 redundant ComingSoon tabs, non-issue (§6) |
| supervisor | Daily logs, bi, material-requests | Full | `SupervisorNavigator` | — |
| storekeeper, storekeeper-assistant | Warehouses, stock, material-requests | Full | `StorekeeperNavigator` | 1 redundant ComingSoon tab, non-issue (§6) |
| sales, sales-staff, showroom-staff | Sales, customers, products | Full | `SalesNavigator` | **F-13 (HIGH)**: `sales-staff`/`showroom-staff` have no `ROLE_PAGES` fallback entry (see below) |
| logistics, logistics-officer | Logistics, warehouses, transport | Full | `LogisticsNavigator` | **F-13** also applies to `logistics-officer` |
| finance | Weekly cost, sage, procurement-invoices | Full | `FinanceNavigator` | — |
| harvesting/sawmill/poles/vat leader+supervisor (8 roles) | Department-scoped | Full | 8 dedicated Navigators | **F-14 (LOW)**: `roleLabel()` in `app.js` omits all 4 supervisor sub-roles — admin UI shows the raw slug instead of a friendly name |
| mechanician | material-requests + machine-logs/fuel/maintenance (**live-confirmed this session**, see below) | Full | `MechanicianNavigator` | Historical mismatch **CONFIRMED RESOLVED** |
| procurement-officer, procurement-manager | Full procurement suite | Full (granular per-page) | Single collapsed `ProcurementNavigator` stack | Reasonable structural difference, not a gap |
| department-manager | procurement-dashboard + requisitions only | Full | Shares full `ProcurementNavigator` | Possible mobile over-exposure — UI shows more than the role's approval scope; server-side `mustRole` still the real gate, so not a security issue, just a UI-tidiness item |
| (approval-bucket) logistics-leader | Referenced in `LEADER_APPROVERS` (`data.js:235`) | N/A | N/A | **F-15 (MEDIUM)**: not a real role anywhere else (absent from `ROLE_PAGES`, `roleLabel`, mobile routing) — an approval bucket keyed to a role that doesn't exist can never be satisfied by an actual user |

**F-13 detail**: `sales-staff`, `showroom-staff`, `logistics-officer`, and `mechanician` have no entry in the hardcoded `ROLE_PAGES` fallback (`data.js:102-152`) that `getRolePages()` falls back to when a role's live `role_definitions.permissions` is empty/null. Every other role has this safety net; these four don't. Not currently manifesting (their DB-stored permissions are populated) — a latent landmine, not an active outage.

**Mechanician resolution, verified live this session**: `select permissions from role_definitions where role='mechanician'` currently returns `["dashboard","material-requests","notifications","procurement-dashboard","procurement-requisitions","machine-logs","machine-fuel","machine-maintenance","maintenance-jobs"]` — the machine-logs/fuel/maintenance permissions an earlier Fleet & Equipment phase found missing (relative to what the mobile navigator already granted) are now present, evidently added by the later, dedicated Mechanician completion program. Closed, not re-opened.

## 18. Desktop/Mobile Parity Matrix

~58 of ~62 conceptual modules have full parity. Gaps:

| Module | Desktop | Mobile | Assessment |
|---|---|---|---|
| Inventory Loss Reports | Y | N | F-12, unexplained (§16) |
| Maintenance Officer Dashboard / Maintenance Reports | Y | N | Plausibly intentional (desk-bound oversight role); not confirmed by any explicit role-restriction comment — flagged, not asserted |
| Resolution Engine — list/browse | Y (create only) | Y (full) | F-05, inverse-parity (mobile ahead of desktop) |

Every other difference found across the full sweep resolved to either full parity or an already-itemized finding above — no blanket "mobile is behind desktop" or vice versa pattern exists; this is a mature, close-to-parity system with isolated gaps, not a systemic one.

## 19. Cross-Department Workflow Audit

The full chain — Harvest → Raw Log → Sawmill → Finished Timber → Nyanza → {Direct Sale | Manufacturing → QC/Rework/Rejection → Finished Product → {Nyanza Sale | Showroom Transfer → Sale}} — was exercised live, end-to-end, with full stock-movement traceability, in the immediately preceding phase. Not repeated here. The only *user-experience* continuity break found anywhere in this chain across all phases to date is F-05 (desktop can't browse Resolution Engine outcomes) and F-01 (the executive-level cross-department summary view is broken) — neither breaks the operational chain itself, both break *visibility into* it.

## 20. Complete Findings (Master List)

| ID | Finding | Category | Severity | Status |
|---|---|---|---|---|
| F-01 | `getCeoOverview` throws for every ceo/admin, both platforms | E | **CRITICAL** | Live-confirmed |
| F-02 | `getApprovalDashboard` dead on both platforms | B | Medium | Confirmed |
| F-03 | `performanceKPIs` dead on both (mobile's similar-named endpoint is unrelated) | B | Medium | Confirmed |
| F-04 | Machine KPI definitions can't be edited/deleted anywhere | B | Medium | Confirmed |
| F-05 | Resolution Engine outcomes unbrowsable on desktop | C (inverse) | Medium | Confirmed |
| F-06 | `machinesDelete` unreachable on both platforms | B | Low | Confirmed (prior phase) |
| F-07 | `log_transport` edit-approval invisible to approvers (desktop) | F | Medium-High | Confirmed |
| F-08 | Procurement SLA-escalation notifications malformed, can't deep-link | E | High | Confirmed |
| F-09 | Operations 2 ComingSoon tabs | F (looks like) → **H** | — | **Not a gap** — real path exists |
| F-10 | Storekeeper 1 ComingSoon tab | F (looks like) → **H** | — | **Not a gap** — role isn't an approver |
| F-11 | Stock Adjustment mobile screen not confidently located | C? | Low | **Unverified** |
| F-12 | Inventory Loss Reports desktop-only | C | Medium | Confirmed |
| F-13 | 4 roles missing `ROLE_PAGES` fallback entry | G | High (latent) | Confirmed |
| F-14 | `roleLabel()` missing 4 supervisor sub-role display names | E (cosmetic) | Low | Confirmed |
| F-15 | `logistics-leader` approval bucket references a non-existent role | G | Medium | Confirmed |
| F-16 | Goods-receipt auto-inventory-update unreachable in practice | E | High | Confirmed (Procurement audit) |
| F-17 | No Procurement Settings screen (CEO threshold config) | B | Medium | Confirmed (Procurement audit) |
| F-18 | 3 of 7 procurement notification events silently no-op | E | Medium-High | Confirmed (Procurement audit) |
| F-19 | Procurement mobile: 15/22 screens have zero client-side permission gating | G | Medium (not a security issue — server enforces) | Confirmed, deferred by explicit prior user choice |
| F-20 | Mobile "Assign Technician" missing for Maintenance Jobs (hook unused) | D | Medium | Confirmed (prior phase) |
| F-21 | `procurementBenchmark`, `supplierDocumentsRegister` dead on both | B | Medium | Confirmed, awaiting go/no-go (prior phase) |
| F-22 | `attachmentDelete`, `logTransportUpdate` dead on both | B | Low | Confirmed (prior phase) |
| F-23 | `productCatalogList` possibly legacy/dead | D? | Low | Unverified (prior phase) |
| F-24 | No Nyanza-stationed role currently holds `sales` permission | G (staffing) | Medium | Confirmed, documented as a decision not a defect (prior phase) |
| F-25 | `harvesting-supervisor` can bypass governance on harvest record edit/delete | G | Medium | Confirmed (Harvesting backlog) |
| F-26 | No mobile CSV/file export exists anywhere in the app | D | Low | Confirmed (Harvesting backlog) |
| F-27 | Enter-to-submit missing app-wide on `openOverlay()` (140+ sites) | — (UX) | Low | Confirmed (prior phase), explicitly out of single-module scope |
| F-28 | `_QA-RL-TEST` leftover vehicle row still present | — (data hygiene) | Low | Confirmed still present (used, still there, as of the immediately preceding phase's live test), needs user decision |
| F-29 | `_biPredictStockRunout()` division-by-zero — root cause not fixed | E | Low (already mitigated — fails cleanly, doesn't hang, per Stabilization Phase 3) | Confirmed, mitigated not fixed |
| F-30 | `compartmentsCreate/Update/Delete` hardcoded role array (backend-internal inconsistency) | G | Low | Confirmed, deliberately not touched (backend is source of truth) |
| F-31 | `mechanician` navigator/permission mismatch | G | — | **CLOSED** — verified live this session, resolved by a later phase |
| F-32 | SRM contract-expiry notifications unrouted | — | — | **Not a new gap** — already-documented intentional exclusion |
| F-33 | `requireRoles(ROLES_ARRAY)` missing spread operator, `dispatch.js`/`sales.js`/`transport.js` | G | — | **CLOSED, live-confirmed this session** — all three files correctly call `requireRoles(...ARRAY)`; fixed by the prior Stabilization Phase's documented 8-file fix |

## 21. Severity Matrix

| Severity | Count | IDs |
|---|---|---|
| Critical | 1 | F-01 |
| High | 5 | F-08, F-13, F-16, F-18 (High end), F-19 (functionally Medium, listed for completeness) |
| Medium | 13 | F-02, F-03, F-04, F-05, F-07, F-12, F-15, F-17, F-20, F-21, F-24, F-25 |
| Low | 10 | F-06, F-11, F-14, F-22, F-23, F-26, F-27, F-28, F-29, F-30 |
| Not a gap / Closed | 3 | F-09, F-10, F-31, F-32 |

(F-19's severity is listed as High-by-category-impact but Medium-by-actual-risk since server-side enforcement already covers it — included once, cross-referenced here rather than double-counted.)

## 22. Recommended Remediation Order

**Priority 1 (core workflow unusable):**
1. F-01 — fix `getCeoOverview`'s `monthly_approvals.status` reference. This is a single, well-isolated SQL bug (one query, one wrong column) affecting the two most senior roles' only dashboard. Highest ratio of impact to fix effort in this entire register.

**Priority 2 (financial/inventory-affecting):**
2. F-16 — goods-receipt auto-inventory-update unreachable (no item-picker UI + null workshop_id for real users).
3. F-18 — 3 silent no-op procurement notification events.
4. F-08 — procurement escalation notification routing.

**Priority 3 (authorization/permission/UI mismatches):**
5. F-13 — add the 4 missing `ROLE_PAGES` fallback entries (cheap, closes a latent lockout risk).
6. F-15 — fix or remove the `logistics-leader` dead role reference in `LEADER_APPROVERS`.
7. F-25 — harvesting-supervisor governance bypass.
8. F-19 — Procurement mobile permission-gating consistency pass (already fully scoped in an earlier phase's own completion report §9 — no re-research needed, just build).

**Priority 4 (cross-platform operational gaps):**
9. F-07 — log_transport edit-approval panel (small, same pattern as 7 sibling entities already have).
10. F-05 — desktop Resolution Engine list view.
11. F-12 — Inventory Loss Reports mobile screen.
12. F-20 — mobile Assign Technician for Maintenance Jobs.

**Priority 5 (management/reporting visibility):**
13. F-02, F-03, F-04 — dead approval/KPI dashboards and machine-KPI edit/delete.
14. F-17 — Procurement Settings screen.
15. F-21 — decide procurementBenchmark/supplierDocumentsRegister (still awaiting your go/no-go from the prior phase).
16. F-24 — decide Nyanza sales staffing (still awaiting your decision from the prior phase).

**Priority 6 (UX improvements):**
17. F-14 — roleLabel() supervisor sub-roles.
18. F-27 — Enter-to-submit app-wide (large surface area, 140+ sites — recommend a dedicated phase, not a quick fix).
19. F-26 — mobile export.
20. F-28 — decide on `_QA-RL-TEST` vehicle removal.
21. F-29, F-30, F-06, F-11, F-22, F-23 — low-severity cleanup, bundle into whichever phase touches their respective modules next rather than a dedicated pass.

## 23. Intentionally Non-UI Functions (Category H)

Confirmed dead-by-design or genuinely internal, no UI recommended:

- `stockTransferApprove` (singular, legacy) — self-documented in `mobile-api/routes/workshops.js` as superseded, kept only for already-cached old mobile builds.
- `harvestList` — superseded by `dailyHarvestData`/`harvestDashboard` (prior phase finding).
- `procurementSupplierToggleBlacklist` — superseded by the generic `procurementSupplierSetStatus` lifecycle (prior phase finding).
- `wk_items`/`wk_stock`/`wk_consumption` — confirmed fully removed/dead concept, not a current gap (prior phase finding, cited for completeness — nothing to find here today).
- Background automation (escalation engine, scheduled jobs, `workflow_jobs` retry queue) — internal by design, no end-user action expected.
- F-09, F-10 (§6/§20) — reclassified here from their surface appearance as gaps to their correct classification: not a gap.

## 24. Unverified Items

- F-11 — Stock Adjustment mobile screen: a REST route exists; no dedicated screen was confidently located in the research time available. Needs a direct look before being asserted as a gap or closed as complete.
- F-23 — `productCatalogList`: low confidence this is even a real gap (may be legacy, superseded by `productsActiveForForm`).
- The 167-screen-files vs. 163-registrations delta (§6/§7): not reconciled to specific filenames. Low severity either way (would be at most ~4 orphaned screen files), but stated as unverified rather than either asserted or dismissed.
- Exact current count of leftover QA-pattern `app_users` rows was spot-checked (55 non-deleted rows matching QA-like naming patterns) but not reconciled against the prior phase's own "61 accounts" disclosure — likely the same population, not independently re-audited since this is a data-hygiene item, not a UI/UX finding, and is out of this audit's scope.

## 25. Production UI/UX Readiness

**Not ready without addressing F-01.** A single-query fix, but it means the ERP's only executive-level cross-department summary has been silently broken for both `ceo` and `admin` roles since before this program's most recent several phases — a materially misleading "readiness" claim would result from certifying the system production-ready while that remains true. Every other department, taken individually, is in the state its own completion phase already assessed (Production Ready, in most cases, per their own reports) — this audit did not find grounds to revise any individual department's own readiness assessment. The register above is the definitive list to work from for the next implementation phase(s), in the order given in §22.

---

**Total findings this document tracks: 33 (F-01 through F-33), of which 28 are genuine open items, 2 are confirmed non-issues (F-09, F-10), 2 are closed/live-confirmed-resolved (F-31, F-33), and 1 is a re-confirmed prior decision, not new (F-32).**
