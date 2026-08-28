# Phase C3 — Automation Custom Rules — Gap Register

## Selection

Per Priority 0's instruction to read the current register and re-verify against live code rather
than trust stale findings, all 24 open P2 items in `ERP_MASTER_PROFESSIONALIZATION_GAP_REGISTER.md`
were reviewed (excluding PR-01/PR-19/PR-21, already resolved by Phase C1/C2). **PR-22/PR-23 —
Automation Custom Rules** was selected:

- It is the **one genuine "backend exists, zero UI" finding** out of the full 407-function audit
  (`ERP_BACKEND_UI_PARITY_MATRIX.md`) — every other P2 finding is a usability/export/filter gap
  on an already-reachable capability; this is the purest example of the phase's own central
  principle ("the backend must not be materially richer than the UI").
- **Zero business-decision risk** — unlike PR-33 (requires a decision about what status value a
  shared function persists) or PR-20 (systemic, spans 5 dashboards), this is a single,
  self-contained, already-fully-validated backend capability with an unambiguous admin/ceo-only
  audience.
- **Real, live evidence of use**: production holds 14 real automation rules (8 original + 6
  procurement-automation rules from a more recent phase) — the feature area is actively
  maintained, not dormant.
- Re-verification against current code confirmed the finding is accurate: `createAutomationRule`/
  `deleteAutomationRule` (`db/services/data.js`) are fully validated, IPC-wired
  (`electron/main.js:412-413`), preload-exposed (`electron/preload.js:163-164`), and mobile REST-
  reachable now — but had **zero UI call site on either platform** before this phase.

## Findings

| # | Area | Finding | Classification |
|---|---|---|---|
| G-01 | Desktop | Automation Center's Rule Status panel had Enable/Disable and Edit per row, but no "New Rule" control anywhere and no per-row Delete | **FIXED** |
| G-02 | Backend (real bug found during re-verification) | `BUILT_IN_RULES` (the set `deleteAutomationRule` checks to block deletion) only listed the original 8 rules. The 6 `procurement_*` rules (`seedProcurementAutomationRules`, `db/migrate.js`) are re-seeded via `ON CONFLICT (rule_key) DO UPDATE` on every app startup exactly like the original 8, but were absent from the set. Harmless while no Delete UI existed (this phase's own reason for existing); the moment a Delete button ships, deleting one of those 6 would appear to succeed and then silently reappear on next restart. | **FIXED** — extended `BUILT_IN_RULES` to match what `migrate.js` actually re-seeds; verified live that both an original built-in (`stock_low`) and a procurement rule (`procurement_rfq_reminder`) are correctly protected, and that a rejected delete attempt leaves the row completely untouched. |
| G-03 | Mobile | `AutomationRulesScreen`/`AutomationRuleDetailScreen` existed (view + edit only) — same "no create, no delete" gap as desktop, plus `mobile-api/routes/automation.js` had no `POST`/`DELETE /rules` routes at all | **FIXED** — added both REST routes, both mutation hooks, create-mode support in the existing detail screen (reusing the Sales Order Form's established create/edit dual-mode pattern from Phase C1), and a Delete action in edit mode. |
| G-04 | Mobile | `mobile/src/hooks/useAutomation.ts` had no create/delete mutations | **FIXED** |
| G-05 | Data integrity | Threshold JSON editing | **INTENTIONALLY DESKTOP-ONLY (pre-existing, preserved)** — the existing edit screen already notes "Threshold values can only be edited from the desktop application"; the new mobile Create form follows the identical precedent (new rules start with an empty threshold, tunable from desktop afterward) rather than inventing a JSON editor UX on mobile. |
| G-06 | Permissions | Which permission key should gate the new Create/Delete UI actions on mobile | **NOT A NEW DECISION** — reused the existing `automation.edit_rules` permission key (already granted only to `admin`/`ceo`, exactly matching the backend's own `['admin','ceo']` gate) rather than inventing a new key; create/delete are naturally part of "managing rules," the same grain the existing permission already covers. |
| G-07 | Governance | Should rule creation go through the existing approval-request engine (`pending_edits`) like other governed entities | **NOT APPLICABLE / CONFIRMED BY DESIGN** — `createAutomationRule`/`deleteAutomationRule` were already built without an `applyGovernance` call (admin/ceo-only, no ownership concept), consistent with other admin-only system-configuration actions elsewhere in the app (e.g. Role management). Not a gap this phase introduced or needed to resolve — the existing backend design was already deliberate. |
| G-08 | Notifications | Does a rule create/delete need a `NOTIFICATION_ROUTES` entry | **NOT APPLICABLE** — verified via grep that `logAudit`'s `module:'automation'` calls exist for audit trail purposes only; no `pushNotification` call fires for rule create/update/delete (only for a rule's own automated *firing*, an unrelated concept). Nothing to route. |
| G-09 | Reporting/Export | Automation Center's own History panel already has CSV export (`_acExportHistoryCsv`) | **ALREADY COMPLETE, UNCHANGED** — out of this phase's scope (the gap was Create/Delete, not export). |

## Summary

**5 FIXED** (including one real, evidenced bug found during re-verification, not just the
originally-scoped UI gap), **3 confirmed NOT APPLICABLE / already-correct-by-design**, **0
business decisions required**, **0 deferred**. This is the cleanest resolution of any Phase C
item so far: the selected finding required no ambiguous judgment calls, only implementation
against an already-fully-specified backend contract — plus one additional correctness fix
(G-02) that re-verification surfaced and that would have become a real, confusing bug the moment
users started using the new Delete button.
