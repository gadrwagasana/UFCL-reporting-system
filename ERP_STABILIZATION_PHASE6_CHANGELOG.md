# ERP Stabilization Program — Phase 6 — Changelog

## Added

- **Accessibility, desktop** (`renderer/app.js`) — `aria-label` added to Machine Registry's row actions (View, Edit, Maintenance schedules, Archive) and Machine Fuel Logs' row actions (View, Delete).
- **Accessibility, mobile shared component** (`mobile/src/components/AppHeader.tsx`) — the icon-only back button and every header action button now carry `accessibilityRole="button"` and `accessibilityLabel`. Actions get an explicit `label` prop (new, optional) or fall back to a humanized version of their icon name — improves every existing call site app-wide without requiring changes to each one.
- **Accessibility, mobile screens/components** — `MaintenanceWaitingForPartsScreen.tsx` (card `accessibilityLabel`), `MRApproveModal.tsx` (input `accessibilityLabel`s, button `accessibilityRole`/`accessibilityState`), `MaterialRequestDetailScreen.tsx` (Approve/Reject button `accessibilityRole`/`accessibilityState`).
- **Recently Viewed — second reference implementation**: `MachineDetailScreen.tsx` (push on view) + `MachinesListScreen.tsx` (widget), mirroring the Phase 3 Stock Transfers reference pair exactly.

## Verified, not changed

- Notification/confirmation patterns across all 8 Stabilization Phase 5 workflows — reviewed, already consistent with established helpers, no fixes needed.
- Desktop/Mobile terminology parity across the same 8 workflows — reviewed, consistent; two intentional desktop-only differences (delivery status, PO edit) reconfirmed and documented rather than treated as gaps.

## Documented, not fixed (out of this phase's gap-filling scope)

- `JobCard` (`MaintenanceJobsListScreen.tsx`) and likely most other list-card components app-wide share the same missing-accessibility pattern `WaitingCard` had before this phase's fix — a full accessibility pass, not this phase's scope.
- App-wide rollout of Saved Filters/Recently Viewed, toast replacement, confirmation-dialog consolidation, a full responsive-design pass, arrow-key navigation, and Quick Actions on more dashboards — all previously logged by Phase 3, still open.
- Table/Form/Dashboard Standardization workstreams — no drift found in the screens actually reviewed this phase; a literal exhaustive app-wide review was not performed.
