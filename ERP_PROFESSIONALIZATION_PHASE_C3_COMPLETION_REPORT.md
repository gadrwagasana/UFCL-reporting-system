# Phase C3 — Automation Custom Rules — Completion Report

Companion files: `_GAP_REGISTER.md` (every finding, classified), `_CHANGELOG.md` (exact
file-by-file diff summary).

## 1. Selected Priority

**PR-22/PR-23 — Automation Custom Rules** (`createAutomationRule`/`deleteAutomationRule`) from
`ERP_MASTER_PROFESSIONALIZATION_GAP_REGISTER.md`.

## 2. Why It Was Selected

Read the current master register plus the Phase C1/C2 gap registers first (Priority 0). Of the
24 originally-open P2 findings (3 already resolved by C1/C2 — PR-01, PR-19, PR-21), PR-22/23 is
the **one genuine "backend fully built, zero UI" finding** across the entire 407-function audit
— every other open item is a usability/filter/export gap on an already-reachable capability.
It carries **zero business-decision risk** (unlike PR-33, which needs a decision about a shared
function's persisted status value, or PR-20, which spans 5 separate dashboards), and real
production data (14 live automation rules) confirmed the feature area is actively maintained,
not dormant. Re-verified against current code before implementing (Stop Rule requirement) — the
finding held up exactly as described, and re-verification additionally surfaced one real,
previously-undetected bug (see §17).

## 3. Initial Audit

Backend: `createAutomationRule`/`deleteAutomationRule` (`db/services/data.js`) — both fully
validated (rule_key format, severity/auto_action enums, notify_roles array, threshold JSON
shape), admin/ceo-gated, audit-logged. IPC (`electron/main.js:412-413`) and preload
(`electron/preload.js:163-164`) already wired. Desktop `renderAutomationCenter()` had Enable/
Disable and Edit per rule, no Create, no Delete. Mobile had a full parallel module (list screen,
detail/edit screen, escalations/history/jobs screens, a dashboard hook) — view + edit only, same
gap. `mobile-api/routes/automation.js` had `GET`/`PUT` for rules, no `POST`/`DELETE`.

## 4. Backend/UI Parity Matrix

| Capability | Backend | IPC | REST | Desktop | Mobile | Permission | Audit | Notification | Status (before → after) |
|---|---|---|---|---|---|---|---|---|---|
| List rules | `getAutomationRules` | ✅ | ✅ | ✅ | ✅ | admin/ceo/ops | n/a | n/a | Unchanged |
| View rule detail | `getAutomationRule` | ✅ | ✅ | ✅ (inline edit) | ✅ | admin/ceo/ops | n/a | n/a | Unchanged |
| Update rule | `updateAutomationRule` | ✅ | ✅ | ✅ | ✅ | admin/ceo | ✅ | n/a | Unchanged |
| Toggle enabled | `toggleAutomationRule` | ✅ | ✅ (via PUT) | ✅ | ✅ | admin/ceo | ✅ | n/a | Unchanged |
| **Create rule** | `createAutomationRule` | ✅ | ❌→✅ | ❌→✅ | ❌→✅ | admin/ceo | ✅ | n/a | **FIXED both platforms** |
| **Delete rule** | `deleteAutomationRule` | ✅ | ❌→✅ | ❌→✅ | ❌→✅ | admin/ceo | ✅ | n/a | **FIXED both platforms** |
| Run automation now | `triggerAutomationNow` | ✅ | ✅ | ✅ | n/a (desktop-only, rate-limited) | admin/ceo/ops | n/a | n/a | Unchanged |
| History/log | `getAutomationLog` | ✅ | ✅ | ✅ (+ CSV export) | ✅ | admin/ceo/ops | n/a | n/a | Unchanged |
| Escalation resolve/ack | `resolveEscalation`/`acknowledgeEscalation` | ✅ | ✅ | ✅ | ✅ | mgr roles | n/a | n/a | Unchanged |

## 5. CRUD Matrix

Create: **added** (both platforms). Read/List/Detail: already complete. Update: already
complete. Delete: **added** (both platforms), with correct built-in-rule protection (verified
live, including a bug fix — §17). Deactivate: N/A (rules use enable/disable via Update, already
complete, distinct from delete). Approve/Reject/Cancel/Resolve: N/A — this entity has no
approval workflow by design (admin-only configuration, no governance layer, confirmed
intentional, not a gap — Gap Register G-07). Export: already complete (rule-firing history has
CSV export; the rule *definitions* list itself is small admin config data, not flagged for
export in the original finding and out of this phase's scope).

## 6. Search

Not applicable — the Rule Status panel lists a small, bounded set of rules (14 currently); no
search control existed before and none was needed (matches the original master audit's own
framing — this was never flagged as a search/filter gap, only a missing-capability gap).

## 7. Filters

Automation Center's History panel already has a rule-key filter dropdown (`ac-log-filter`,
pre-existing, unchanged). No new filter needed for the rule list itself.

## 8. Sorting

Not applicable — same reasoning as §6.

## 9. Pagination

Not applicable — 14 rows total; no pagination gap exists or was flagged.

## 10. Desktop UX

Added "New Rule" button (Rule Status panel header) and a per-row Delete button, both following
the exact overlay/confirm patterns already established for Edit (`_acEditRule`) and other
destructive actions elsewhere in the app. No new UI pattern invented. Success/error feedback
reuses the existing overlay error banner (`#ovErr`) and `alert()`/refresh pattern the rest of
this page already uses.

## 11. Mobile UX

Added a "+" header action (permission-gated) on the rules list and extended the existing detail
screen with a create-mode render path plus a Delete button in edit mode — both reusing components
and patterns already proven elsewhere in the app (the Sales Order Form's create/edit dual-mode
screen from Phase C1; `LoadingState`/`ErrorState`/`OfflineBanner` already present and unchanged).
No dead buttons, no placeholder tabs introduced.

## 12. Permissions

Reused the existing `automation.edit_rules` permission key (mobile) and the backend's existing
`['admin','ceo']` role gate (desktop has no separate client-side permission check for this page,
consistent with how the rest of Automation Center already works) — no new permission key
invented, no widening beyond what already existed for Edit. Verified live: a role without the
permission (`sawmill-leader`) is correctly denied both `createAutomationRule` and
`deleteAutomationRule`.

## 13. Workshop Isolation

Not applicable — automation rules are a company-wide configuration concept with no workshop
dimension (confirmed: `automation_rules` table has no `workshop_id` column, and neither
`admin` nor `ceo`, the only roles that can reach this feature, are workshop-scoped roles).

## 14. Governance

Confirmed intentional, not a gap: `createAutomationRule`/`deleteAutomationRule` were already
built without routing through the `applyGovernance`/`pending_edits` approval engine — consistent
with other admin-only system-configuration actions in the app that don't have an "owner" concept
to govern. No new or duplicate approval mechanism was created.

## 15. Notifications

Verified via grep that no `pushNotification` call exists for rule create/update/delete (only for
a rule's own automated *firing*, an unrelated concept) — nothing to route, nothing missing.

## 16. Reporting

Not in scope — Automation Center's existing History CSV export (`_acExportHistoryCsv`) is
unrelated to rule create/delete and was not touched.

## 17. Data Integrity

Re-verification surfaced a real, evidenced bug beyond the originally-scoped finding:
`BUILT_IN_RULES` (the set that blocks deletion) only listed the original 8 rule keys, but
`db/migrate.js`'s `seedProcurementAutomationRules()` re-seeds 6 more `procurement_*` rules on
every app startup via the identical `ON CONFLICT DO UPDATE` mechanism as the original 8 — meaning
those 6 are equally "permanent" but weren't protected. This was harmless before this phase (no
Delete UI existed to trigger it) but would have become a real, confusing bug — "delete succeeds,
then the rule silently reappears after the next restart" — the moment the new Delete button
shipped. Fixed by extending `BUILT_IN_RULES` to match what `migrate.js` actually re-seeds.
Verified live (§19) that both an original rule and a procurement rule are now correctly
protected, and that a rejected delete leaves the row completely untouched.

## 18. Concurrency

Tested live: 2 simultaneous `createAutomationRule` calls with the identical `rule_key` — exactly
1 succeeded, the other correctly rejected with "already exists" (the existing
`ON CONFLICT (rule_key) DO NOTHING` + `rowCount` check already handled this correctly; confirmed,
not modified).

## 19. Live E2E Verification

Executed against production data via direct function calls, using a clearly-tagged, disposable
QA rule key (`_qa_phasec3_test_rule`), created, exercised, then fully deleted. **24 of 24 checks
passed**:

- Permission denial for both create and delete (non-admin/ceo role).
- Validation: invalid `rule_key` format rejected, missing `label` rejected.
- Create succeeds with a valid payload; duplicate `rule_key` correctly rejected.
- Rule appears in `getAutomationRules` and `getAutomationRule` with the exact submitted values.
- Update persists correctly (severity/cooldown changed and re-verified).
- **Concurrency**: 2 simultaneous creates with the same key — exactly 1 wins.
- **Built-in protection**: both `stock_low` (original 8) and `procurement_rfq_reminder` (the 6
  newly-protected procurement rules) correctly rejected for deletion, and both confirmed
  completely untouched afterward — the direct proof of the §17 bug fix.
- Audit log correctly recorded `CREATE`, `UPDATE`, and `DELETE` entries for the QA rule.
- Delete succeeds for the genuine custom rule; deleting it again cleanly fails ("not found").
- Regression: `automationDashboard` and `getAutomationRules` both still work normally afterward,
  and the total rule count returned to the exact baseline of 14.

## 20. Regression Verification

`node --check` clean on every touched backend/desktop/REST file. `npx tsc --noEmit` clean across
the entire mobile project. No shared function (`getAutomationRules`, `getAutomationRule`,
`updateAutomationRule`, `toggleAutomationRule`, `automationDashboard`) was modified — only
`BUILT_IN_RULES` (additive) and net-new UI/route/hook code. Confirmed live that the automation
dashboard and full rule list behave identically before and after. Sales Orders (Phase C1) and
CEO Overview (Phase C2) were not touched by this phase.

## 21. QA Cleanup

Both QA rule keys (`_qa_phasec3_test_rule`, `_qa_phasec3_race_rule`) fully deleted and verified
zero residue in `automation_rules`. Audit log rows for the QA rule were deliberately left in
place — audit history is immutable and never deleted anywhere in this app, matching established
practice, not a cleanup gap. No production automation rule, config, or notification was altered.
Temporary test script (`_qa_phaseC3_e2e_test.js`) deleted after the run.

## 22. Outstanding Items

None requiring further action. 3 items confirmed not applicable (search/filter/sort/pagination
on a 14-row admin config list, governance integration, notification routing) are documented in
the Gap Register as deliberate, not deferred.

## 23. Business Decisions

**None required.** This was the explicit reason this item was selected over others in the
register (e.g. PR-33, which does require one) — a clean, well-specified backend contract with an
unambiguous audience, needing only implementation.

## 24. Production Readiness

**Automation Custom Rules is now fully CRUD-complete on both platforms.** Every backend
capability in this feature area now has a working UI path; the one incidental correctness bug
found during re-verification (§17) is fixed and live-verified; permissions match the backend
exactly; no governance/notification gaps exist. Per the Final Stop Rule: **not starting Phase
C4.** No commit made, no push.
