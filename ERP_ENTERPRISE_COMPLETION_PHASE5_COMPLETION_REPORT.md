# ERP Enterprise Completion Phase 5 — Notification & Workflow Navigation

**Completion Report — 2026-08-09**

## 1. Objective

Make actionable notifications operationally useful: `Backend Event → Notification → Recipient → Payload → Notification Center → Deep Link → Correct Module → Correct Record → Correct Workflow Context`, without redesigning the notification system, without introducing a second Workshop Isolation mechanism, and without letting a notification's payload become an authorization bypass.

## 2. Pre-Implementation Audit

Traced the full chain against current source (Workstream 1):

- **Schema**: `notifications(id, type, title, body, roles[], created_at, for_user_id, related_module, related_id, category)` + `notifications_read(notification_id, user_id, read_at)` — a per-user read-tracking join table, no `workshop_id` column on either table.
- **Creation**: the shared `pushNotification({...})` primitive (`data.js:476`), called at 51 physical sites (Phase 3's inventory), fire-and-forget (never `await`ed) throughout the entire codebase — a pre-existing, systemic pattern, not something this phase touched.
- **Read/API**: `notificationsList` (role-broadcast OR `for_user_id` match — **no workshop filter at all**, confirmed from the query itself), `notificationsMarkRead`, `notificationsMarkAllRead`, `notificationsPoll` (unread count only). All four gated on `mustRole(user,'notifications')`, otherwise unchanged this phase.
- **Desktop UI**: `renderNotifications`/`_loadNotifItems` (`app.js:7316-7515`) — bell + badge, full-page list, category/type filters, mark-read. Before this phase: `related_module`/`related_id` were displayed as inert text; no click handler existed beyond the "Mark read" button (confirmed, matching Phase 3's finding).
- **Mobile UI**: `NotificationsScreen.tsx` (registered app-wide via the root-level pattern Phase 3 built) — same shape, tap only marked read.
- **Existing deep-link precedent found and reused**: Global Search's own `DIRECT_NAV_MODULE` registry (`mobile/src/constants/searchModules.ts:91`) had already solved — and explicitly documented — this exact cross-navigator problem for two modules (`vehicles`, `machines`) via a bare `navigation.navigate(screen, params)` call, with everything else falling back to a read-only preview rather than attempting a nested-navigator jump it couldn't guarantee. This became the direct architectural precedent for Workstream 4's mobile registry (see §6).

## 3. Notification Inventory

Confirmed relatedModule/relatedId presence across every producer (extending Phase 3's inventory, re-verified against current source):

| Status before this phase | Modules |
|---|---|
| Already carried a specific, routable `relatedModule` | `stock_transfers`, `maintenance_jobs`, `rejection_holds`, `resolution_records`, `harvest_waste`, `showroom_damage_reports`, `deliveries`, `sales`, `srm` |
| Carried a **generic, non-differentiating** `relatedModule` — blocked routing entirely | `procurement` (all 28 event keys of `notifyProcurementEvent`, hardcoded to the single literal `'procurement'` regardless of whether the record was a requisition, PO, invoice, RFQ, or supplier) |
| Carried **no `relatedModule`/`relatedId` at all** | The entire Pending-Edit/Deletion-Request governance engine (`autoRequestEdit`, `autoRequestDelete`, `processApprovalDecision`, `pendingEditsCreate`, `deletionRequestCreate` — 5 producers, all 3 of the Phase-4-built mobile GovernanceScreen's own workflow) |
| Generic/administrative, not about a single record — correctly left unmapped | Escalation engine's `'Governance'`/`'Security'`/`'System'` alerts (capitalized, a distinct value from the new lowercase `'governance'` — confirmed no collision), budget/forecast warnings |

## 4. Existing Architecture (kept unchanged)

- Notification creation, `pushNotification`'s fire-and-forget behavior, the `notifications`/`notifications_read` schema, `mustRole`-based read/list authorization, mark-read/mark-all-read — **all unchanged**.
- Workshop Isolation architecture (`isWorkshopRestricted()`) — **not touched anywhere**; every fix in this phase reuses it exactly as Phases 2–3 established.
- No new notification lifecycle action was added (no dismiss/delete/unread — confirmed the backend doesn't support them, so none were invented, per Workstream 9's explicit instruction).

## 5. Deep-Link Contract (Workstream 3)

Per the explicit instruction to reuse existing fields before adding anything: **no schema change was made.** `related_module`/`related_id` already existed and were sufficient — the actual gap was that many producers didn't populate them usefully. Three minimal, additive fixes to existing notification producers:

1. **`notifyProcurementEvent`** (`data.js:17277`) — added a `module` property to each of its 28 event definitions (e.g. `'procurement-requisitions'`, `'procurement-orders'`, `'procurement-invoices'`, `'procurement-rfq'`, `'procurement-suppliers'` — reusing the exact existing desktop page-permission-id strings, not inventing new ones), and changed the dispatch call from the hardcoded `relatedModule:'procurement'` to `relatedModule: e.module || 'procurement'`. Events with no reliable single-record destination (`payment_approved`/`payment_rejected` — `entity.id` there is a payment row, not an invoice, and there's no dedicated Payment Detail screen; budget/forecast warnings, which aren't about one record) were deliberately left unmapped, falling back to the original generic value, which the routing registry doesn't match to anything — safe, not a wrong destination.
2. **`autoRequestEdit`/`autoRequestDelete`/`processApprovalDecision`** (the automatic-deferral governance path) and **`pendingEditsCreate`/`deletionRequestCreate`** (the manual/direct submission path, used by e.g. `mobile-api/routes/compartments.js`) — all 5 governance notification producers now set `relatedModule:'governance', relatedId:<request id>`. This was caught mid-implementation: the first pass only fixed the automatic path; live testing (Scenario E, §15) caught that the manual path — the one Phase 4's mobile submission flow actually uses — was still missing it, and both were fixed together for consistency.

**Justification for touching `data.js` in a phase framed as "not a notification redesign"**: per Workstream 15's own Bug Discipline, a notification with no way to identify its module isn't a UI limitation, it's a data completeness gap that directly "blocks deep-link functionality" for two of this codebase's largest workflows (Procurement's 17 approval functions; the Phase-4-built governance engine) — both fixes are one-line-per-event value changes to an already-existing field, not a new field, not a new mechanism.

## 6. Routing Architecture (Workstream 4)

**Desktop** (`renderer/app.js`) — a single `NOTIFICATION_ROUTES` object (module string → `{ page, open? }`) plus one `navigateToNotification(module, id)` resolver, calling `showPage(route.page)` then the already-existing, already-globally-callable `open*DetailOverlay(id)` function for that page. Zero new authorization logic — every `open*DetailOverlay` function already fetches through the same backend function its own page uses, and already has its own graceful error handling (`showOverlayError`).

**Mobile** (`mobile/src/utils/notificationRouting.ts`) — deliberately mirrors Global Search's own `DIRECT_NAV_MODULE` pattern exactly (§2): a lookup table of `(relatedId) => { screen, params }` for confirmed id-based self-fetching detail screens, resolved by `resolveNotificationRoute()`. Governance is a special `{kind:'root'}` case (Phase 3/4's root-level screen pattern, no per-record id needed since GovernanceScreen is a list). Anything unmapped resolves to `{kind:'none'}`.

**Coverage decision, both platforms**: only modules with a *confirmed* id-based (or, for governance, list-level) destination were mapped. `material-requests` was investigated and deliberately excluded — its mobile detail screen requires the full fetched object (no dedicated single-record fetch hook exists to build one cheaply), and its desktop overlay function is declared inside `renderMaterialRequests()`'s own closure, not globally callable, without a larger refactor. `rejection_holds`/`resolution_records`/`harvest_waste`/`showroom_damage_reports` have no per-record detail screen on mobile at all (confirmed inline-action list/dashboard screens per the Phase 3 UI audit) — desktop gets screen-level routing for these (correct page, not a pre-selected record); mobile does not, and is documented as deferred rather than guessed. This is exactly Workstream 5's explicit instruction: *"Do not invent destinations where no corresponding UI page exists... it must never crash or navigate to the wrong module."*

## 7. Desktop Implementation

- `NOTIFICATION_ROUTES` + `navigateToNotification()` (`app.js`, ~40 lines, added just before Global Search's own section).
- `_loadNotifItems()`'s row template: rows with a `related_module` now render with `cursor:pointer` and `data-nid`/`data-nmodule`/`data-nrelid` attributes; a new `.nitem-linkable` click handler marks the notification read (reusing the exact existing `notificationsMarkRead` call) and calls the resolver. The existing "Mark read" button's handler gained `e.stopPropagation()` so it doesn't double-fire the new row click. Non-actionable rows (no `related_module`) render exactly as before — zero visual or behavioral change for them.
- No CSS change was needed — `.nitem:hover` already existed and already provides hover feedback.

## 8. Mobile Implementation

- `mobile/src/utils/notificationRouting.ts` (new file) — the registry and resolver described in §6.
- `NotificationsScreen.tsx` — `NotifCard` now shows a chevron only when a route resolves (matching the "clickable actionable notifications" / "linked-record indication" requirement, Workstream 13); its `onPress` now passes the full item instead of just the id. The screen's `handlePress` marks read (unchanged call) then navigates via `resolveNotificationRoute`, or shows an informational `Alert` ("No linked page available") only when the notification *had* a `related_module` but no known destination — notifications with no `related_module` at all keep their exact prior silent-mark-read-only behavior.

## 9. Permission Verification (Workstream 7)

Confirmed and live-tested (§15, Scenario C): the routing layer on both platforms contains **zero authorization logic**. Every destination is one of two things — (a) an existing screen/overlay that already calls an existing, already-`mustRole`-gated backend function, or (b) the governance engine's existing `LEADER_APPROVERS`/`MANAGER_APPROVERS` tier check. A user without `'maintenance-jobs'` permission who is handed a valid job id via the resolver and attempts the underlying fetch directly (bypassing any UI) is still rejected server-side with `Access denied` — confirmed live.

## 10. Workshop Isolation Verification (Workstream 8)

**Critical finding, fixed**: `stockTransfersDispatchHistory` — the exact function `StockTransferDetail`'s new deep link calls — had no workshop check at all. This was already known and documented as a *deferred, low-severity* finding in the Phase 3 report, on the reasoning that nothing linked to it directly at the time. Phase 5's own deep-link feature is what changes that calculus: a notification now actively surfaces a `transferId` to any role holding `'stock-transfers'` company-wide and makes it one tap away, regardless of workshop. Per this phase's own Bug Discipline ("Fix immediately: ... creates an authorization bypass ... exposes unauthorized data"), this was fixed now using the exact same `isWorkshopRestricted()` idiom Phase 3 already applied to this function's sibling write-side actions — confirmed live (Scenario D, §15): a Nyanza storekeeper is denied a Gatare transfer's dispatch history; a Gatare storekeeper opens the same record successfully.

`maintenanceJobDetail` (the other Tier-1 mobile-linkable module with workshop-scoped records) was checked and confirmed to already enforce `isWorkshopRestricted` correctly — no change needed.

**Company-wide governance preserved, not accidentally restricted**: confirmed live (Scenario E, §15) that a `poles-leader` at Nyanza can still open and approve a `leader`-level governance request submitted by a `supervisor` at Gatare — the intentional, Phase-4-confirmed company-wide oversight tier is completely unaffected by adding `relatedModule`/routing to these notifications; routing is purely navigational and never touches the authorization decision.

## 11. Notification Coverage Matrix

| Notification family | relatedModule | Desktop link | Mobile link | Permission | Workshop |
|---|---|---|---|---|---|
| Stock Transfer (create/approve/reject/dispatch/receive/discrepancy) | `stock_transfers` | ✅ record | ✅ record | ✅ | ✅ (Phase 3 write-side + **Phase 5 read-side fix**) |
| Maintenance Job (create/assign/parts/external/close) | `maintenance_jobs` | ✅ record | ✅ record | ✅ | ✅ (existing) |
| Procurement Requisition | `procurement-requisitions` | ✅ record | ✅ record | ✅ (per-stage) | N/A — intentionally company-wide (Phase 3-confirmed) |
| Procurement PO / shortage / issued | `procurement-orders` | ✅ record | ✅ record | ✅ | N/A |
| Procurement Invoice | `procurement-invoices` | ✅ record | ✅ record | ✅ | N/A |
| Procurement RFQ | `procurement-rfq` | ✅ record | ✅ record | ✅ | N/A |
| Supplier blacklist/restore | `procurement-suppliers` | ✅ record | ✅ record | ✅ | N/A |
| Payment approved/rejected/overdue | `procurement` (generic, unmapped) | ⛔ none | ⛔ none | ✅ | N/A |
| Governance edit/deletion request (submit/decide) | `governance` | ⛔ none (no consolidated desktop page) | ✅ list (root Governance screen) | ✅ (LEADER/MANAGER tier) | N/A — intentionally company-wide (Phase 4-confirmed) |
| Material Request (create/approve/reject) | `material-requests` | ✅ page only (closure-scoped overlay, not auto-opened) | ⛔ none (object-required screen) | ✅ | ✅ (existing) |
| Sawmill/VAT Rejection Holds | `rejection_holds` | ✅ page only | ⛔ none (inline-action list) | ✅ | ✅ (existing) |
| Resolution Engine (waste resolved) | `resolution_records` | ✅ page only | ⛔ none | ✅ | ⚠ deferred (Phase 3) |
| Harvest Waste recorded | `harvest_waste` | ✅ page only | ⛔ none | ✅ | ✅ (existing) |
| Showroom Damage reported | `showroom_damage_reports` | ✅ page only | ⛔ none | ✅ | N/A |
| Sales Order closed short | `sales` | ⛔ none (unmapped) | ⛔ none | ✅ | N/A |
| Delivery rejection recorded | `deliveries` | ⛔ none (unmapped) | ⛔ none | ✅ | N/A |
| SRM contract/compliance due | `srm` | ⛔ none (unmapped) | ⛔ none | ✅ | N/A |
| Escalation/Security/Governance alerts | `Governance`/`Security`/`System` (capitalized, generic) | ⛔ none (intentional — informational) | ⛔ none | ✅ | N/A |
| Casual Labour submit/review | *(no relatedModule ever set)* | ⛔ none | ⛔ none | ✅ | ✅ (existing) |
| Automation Engine alerts | varies | ⛔ none (out of scope) | ⛔ none | ✅ | N/A |

Every ⛔ above is a deliberate, documented decision (§6, §20), not an oversight — no notification was left unmapped by omission.

## 12. Stale/Invalid Notification Handling (Workstream 10)

Confirmed live (Scenario F, §15): tapping/clicking a notification whose record was deleted after the notification was created does not crash or expose data. `stockTransfersDispatchHistory` returns `{ ok:true, transfer:null, dispatches:[] }` for a missing id (a defensive early-return added as part of the Phase 5 fix in §10) — both destination screens already render an empty/error state from their existing `LoadingState`/`ErrorState`/`transfer == null` handling, inherited for free from reusing the screens' own existing code paths rather than building anything new.

## 13. UI/UX Verification (Workstream 13)

No new visual language: desktop reuses `showToast`'s existing 4-severity system (the `'info'` toast for "no linked page available" already existed, added in an earlier UI/UX phase) and the existing `.nitem:hover` styling; mobile reuses `Ionicons`' `chevron-forward` (already used elsewhere in the app for list-row affordance) and the existing `Alert.alert` pattern for the same "no linked page" case. All required states are present: loading/error (inherited from the destination screens themselves), unauthorized (the destination's own existing `Access denied` handling), the new graceful "no linked page available" state, and unchanged read/unread visuals.

## 14. Security Verification (Workstream 14)

Confirmed by design and live-tested: `relatedModule`, `relatedId`, and (on mobile) the `action` concept were never given any authorization meaning anywhere in this implementation — both registries are pure `string → {screen, params}` lookup tables with no database access, no permission check, and no way to influence what the destination screen is allowed to fetch. The server-side function the destination screen calls is unconditionally the same one that function's normal, non-notification-triggered UI path already calls. Scenario C (§15) proves an unauthorized role is rejected even when handed a resolved, valid-looking route directly. Scenario D proves the same for a valid-but-wrong-workshop id. No notification can be used to view another user's records, bypass a role permission, bypass Workshop Isolation, or reach a deleted record's data.

## 15. End-to-End Testing

All scenarios ran against the production database using real accounts (admin id 1, operations id 20, supervisor "derrick" id 45/Gatare, storekeeper id 12/Gatare & id 49/Nyanza, mechanician id 14, poles-leader id 16/Nyanza, vat-leader id 17). 19/19 pass (two initial failures were test-script type-comparison bugs of my own — Postgres `bigint` columns return as strings via node-pg, compared with strict `===` against a JS number — fixed in the test script, not the product code; one real gap was found and fixed mid-testing, §5).

| Scenario | Test | Result |
|---|---|---|
| A (Desktop) | Stock Transfer created via MR-approve chain → notification carries `stock_transfers`/correct id | PASS |
| A | Desktop resolver maps `stock_transfers` → `stock-transfers` page | PASS |
| A | "Click" (call the resolved function as the authorized user) opens the correct record | PASS |
| B (Mobile) | Maintenance Job created+assigned → notification carries `maintenance_jobs`/correct id | PASS |
| B | Mobile resolver maps to `MaintenanceJobDetail` with the correct `jobId` param | PASS |
| B | "Tap" opens the correct record (title matches fixture) | PASS |
| C (Unauthorized) | A role with no `maintenance-jobs` permission calls the resolved destination directly | Access denied — PASS |
| D (Workshop Isolation) | Nyanza storekeeper attempts a Gatare transfer's resolved destination | Access denied (Phase 5 fix) — PASS |
| D | Gatare storekeeper (correct workshop) opens the same transfer | PASS |
| E (Company-wide governance) | Governance notification now carries `governance`/correct id (Phase 5 fix) | PASS |
| E | Mobile resolver routes it to the root Governance screen | PASS |
| E | Nyanza poles-leader still opens/approves the Gatare-submitted request | PASS — company-wide behavior unaffected |
| F (Stale record) | Deleted-after-notification record resolves gracefully, no crash | PASS |
| G (Regression) | 6 spot-checks across Phase 2/3/4/5-sibling fixes | 6/6 PASS |

## 16. Regression Testing

Phase 2 (`materialRequestsApprove` APPROVAL_TIER), Phase 3 (`rejectionHoldsList` isolation, `polesDeliveryQualityCheck` cross-workshop denial), Phase 4 (`casualLabourRequestsReview` gate, `pendingEditsList`), and Phase 5's own sibling fix (`stockTransfersApproveReject`) were all re-exercised live — 6/6 pass (§15, Scenario G). No regression found.

## 17. QA Data Cleanup

Created and cleaned across the 6 scenarios: 1 `material_requests` + 1 auto-created `stock_transfers` (Scenario A), 1 `maintenance_jobs` (Scenario B), 2 additional throwaway `stock_transfers` (Scenarios D and F), 1 `compartments` + 1 `pending_edits` (Scenario E). All hard-deleted in FK-safe order; the notifications this activity generated (non-immutable table) were also cleaned. Independently re-verified via fresh `COUNT` queries: **0 leftover rows for every entity type**. No QA user accounts were created this phase (all test actors were real, existing accounts). No production business data or stock was touched. `audit_log` entries this legitimate QA activity generated were not deleted (immutable, per the established rule).

## 18. Bugs Found

1. **Procurement notifications carried a single hardcoded `relatedModule:'procurement'`** for all 28 event types, making the entire module (17 approval functions) unroutable — found during Workstream 3's audit, before any test.
2. **The entire governance engine's notifications carried no `relatedModule`/`relatedId` at all** — found during the same audit pass.
3. **The manual governance submission path (`pendingEditsCreate`/`deletionRequestCreate`) still lacked `relatedModule` after the first fix pass** — found by the live test itself (Scenario E initially failed), not by static audit; I had only fixed the automatic-deferral path (`autoRequestEdit`/`autoRequestDelete`).
4. **`stockTransfersDispatchHistory` had no Workshop Isolation check** — previously known and documented as deferred/low-severity in the Phase 3 report; re-classified as a live blocker once Phase 5's own deep-link feature made it directly, easily reachable.
5. **`material-requests` cannot be deep-linked on either platform without further work** — desktop's overlay function is closure-scoped (not globally callable); mobile's detail screen needs a full fetched object with no cheap single-record fetch path available. Documented, not fixed (§20).

## 19. Bugs Fixed

Bugs 1–4 above, all fixed this phase (§5, §10), all live-verified (§15).

## 20. Bugs Deferred

- **Bug 5** (`material-requests` deep-linking) — requires either a small desktop refactor (hoist `openMaterialRequestDetailOverlay` out of `renderMaterialRequests()`'s closure) or a new mobile single-record fetch hook; both are reasonable, small follow-ups but weren't required to ship deep-linking for the other 12+ modules this phase covers, and Bug Discipline doesn't classify "a module has no destination yet" as a blocking defect when the notification still displays and remains readable.
- **`rejection_holds`/`resolution_records`/`harvest_waste`/`showroom_damage_reports` on mobile** — no dedicated per-record detail screens exist; would need new screens, out of this phase's "reuse existing screens" mandate.
- **`sales`/`deliveries`/`srm` notifications** — no confirmed single-record destination screen was audited with enough confidence this phase; left unmapped rather than guessed.
- **`payment_approved`/`payment_rejected`** — `entity.id` is a payment row id, not usable against the Invoice Detail screen's expected `invoiceId`; would need the payment-approval call sites to also pass the parent invoice id, a small data.js change outside this phase's minimal-footprint scope.
- **Notification list itself has no workshop filter** (by design, matching the schema) — confirmed intentional (§2, §10), not a defect; the *destination*, not the *notification list*, is where isolation must and does apply.

None of the deferred items are security issues, Workshop Isolation gaps, or regressions — all are "notification remains readable, no linked page available" outcomes, exactly as this phase's own brief permits.

## 21. Files Changed

4 files:
- **New**: `mobile/src/utils/notificationRouting.ts`
- **Modified**: `db/services/data.js` (7 notification producers updated: `notifyProcurementEvent`'s 28 events + dispatch call, `autoRequestEdit`, `autoRequestDelete`, `processApprovalDecision`, `pendingEditsCreate`, `deletionRequestCreate`; plus the `stockTransfersDispatchHistory` Workshop Isolation fix), `renderer/app.js` (routing registry + resolver + notification row click wiring), `mobile/src/screens/notifications/NotificationsScreen.tsx` (chevron indicator + press handler)

## 22. Production Verification

- `node --check db/services/data.js`, `renderer/app.js` — clean, re-run after every edit and once more at the end.
- `cd mobile && npx tsc --noEmit` — clean, full project.
- 19/19 live production-database checks (§15).
- All QA data cleaned and independently re-verified at 0 (§17).
- `git status` confirms exactly the 4 files in §21 were touched.

## 23. Remaining Enterprise Gaps

- `material-requests`, `sales`, `deliveries`, `srm`, and the 4 inline-action-list modules on mobile (§20) remain without a specific-record deep link.
- Desktop has no consolidated governance review page (mobile does, from Phase 4) — a governance notification on desktop still requires navigating to the relevant per-source page manually.
- The generic `procurement` fallback (payment events, budget/forecast warnings) has no destination.

## 24. Recommendation for Phase 6

Two well-scoped follow-ups, in priority order: (1) close the `material-requests` gap specifically — it's the single highest-volume notified workflow left unmapped, and the fix is small and well-understood on both platforms (§20); (2) build the small number of missing single-record fetch hooks/screens needed for `sales`/`deliveries` (both already have list screens, just not id-routable detail screens). Neither should begin automatically — both require separate approval per the Stop Rule.

---

**Final Success Criteria — verified honestly:**
- Actionable notifications deep-link on desktop — ✅ (§7 confirmed modules).
- Actionable notifications deep-link on mobile — ✅ (§7 confirmed modules).
- Correct record opens — ✅ live-verified (§15, A/B).
- Stale/invalid links fail safely — ✅ live-verified (§15, F).
- Permissions remain enforced — ✅ live-verified (§15, C).
- Workshop Isolation remains intact — ✅ live-verified, one real gap found and fixed (§10, §15 D).
- Company-wide governance remains company-wide — ✅ live-verified (§15, E).
- No notification becomes an authorization bypass — ✅ verified by design and live test (§14).
- Audit logging remains intact — ✅ zero changes to any `logAudit` call this phase.
- Phase 2/3/4 functionality remains intact — ✅ (§16).
- All QA data cleaned — ✅ (§17).
- Static checks pass — ✅ (§22).
- Live verification passes — ✅ 19/19 (§15).
- Completion report and changelog written — ✅.

Per the Stop Rule: this phase is complete. No further phase has been started automatically. Nothing was committed or pushed. Awaiting review and approval before any next step.
