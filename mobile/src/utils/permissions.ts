import { UserRole } from '../types/auth';

// What each role can do on mobile — READ is always granted to the role's own data.
// WRITE permissions must be explicitly listed.

export type Permission =
  | 'harvest.write'
  | 'logtransport.write'
  | 'sawmill.write'
  | 'poles.write'
  | 'poles.purchase'
  | 'poles.delivery'
  | 'poles.qc'
  | 'vat.write'
  | 'material.request'
  | 'material.review'
  | 'labour.write'
  | 'labour.review'
  | 'machine.log'
  | 'machine.register'
  | 'machine.cats'
  | 'workshop.manage'
  | 'workshop.approve'
  | 'compartment.create'
  | 'compartment.manage'
  | 'stock.catalog'
  | 'stock.inventory'
  | 'stock.movements'
  | 'stock.approve'
  | 'timber.inventory'
  | 'sales.view'
  | 'sales.create'
  | 'sales.edit'
  | 'sales.pay'
  | 'transfer.view'
  | 'transfer.approve'
  | 'transfer.act'
  | 'dispatch.view'
  | 'dispatch.approve'
  | 'fuel.vehicle'
  | 'fuel.machine'
  | 'delivery.update'
  | 'ceo.approve'
  | 'monthly.approve'
  | 'reports.weekly_cost'
  | 'reports.weekly_perf'
  | 'reports.kpi'
  | 'reports.executive'
  | 'reports.bi'
  | 'reports.monthly'
  | 'reports.export'
  | 'reports.edit_expenses'
  | 'reports.edit_kpi'
  | 'reports.monthly_approve'
  | 'admin.secgov'
  | 'admin.audit'
  | 'admin.users'
  | 'admin.roles'
  | 'admin.trash'
  | 'admin.changes'
  | 'automation.view'
  | 'automation.run'
  | 'automation.edit_rules'
  | 'automation.escalation_resolve'
  | 'automation.escalation_ack'
  | 'reports.epm'
  | 'reports.sage'
  // HR Enterprise Phase 1 — Casuals (casual worker registry): read and write
  // share the exact same role gate in data.js (casualsList/Create/Update/
  // Delete all check the same [admin,ceo,operations,supervisor] set), so one
  // permission key covers both, unlike sales.view vs sales.create/edit.
  | 'casual.manage'
  // HR Enterprise Phase 2 — Attendance. Same role set as casual.manage
  // today (both reuse data.js's ATTENDANCE_ROLES = admin/ceo/operations/
  // supervisor), kept as a distinct key rather than reusing 'casual.manage'
  // since they gate genuinely separate backend page permissions ('casuals'
  // vs 'attendance') that could diverge independently in the future.
  | 'attendance.manage'
  // Payroll Enterprise Phase 2 — same role set again (admin/ceo/operations/
  // supervisor, matching data.js's PAYROLL_ROLES), distinct key for the same
  // independent-divergence reason as attendance.manage above. A supervisor
  // holding this can prepare/review workshop-scoped payroll but cannot
  // approve a stage — that's gated separately, server-side, by
  // procurement_approval_steps.assigned_role (operations/ceo only), not by
  // this page-level permission.
  | 'payroll.manage';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  // Stabilization Phase 4 (P-7) — 'fuel.vehicle' added to admin/ceo: both
  // hold the backend 'vehicles' permission (db/migrate.js, matching
  // vehicles.js's own VEHICLE_ROLES) that fuelLogsList/Create actually gate
  // on, but this key was only ever granted to 'logistics' here.
  admin:                  ['ceo.approve', 'monthly.approve', 'material.review', 'labour.review', 'delivery.update', 'machine.register', 'machine.cats', 'workshop.manage', 'workshop.approve', 'compartment.create', 'compartment.manage', 'stock.catalog', 'stock.movements', 'stock.approve', 'timber.inventory', 'transfer.view', 'transfer.approve', 'transfer.act', 'dispatch.view', 'dispatch.approve', 'fuel.vehicle', 'sales.view', 'sales.create', 'sales.edit', 'sales.pay', 'reports.weekly_cost', 'reports.weekly_perf', 'reports.kpi', 'reports.executive', 'reports.bi', 'reports.monthly', 'reports.export', 'reports.edit_expenses', 'reports.edit_kpi', 'reports.monthly_approve', 'reports.epm', 'reports.sage', 'admin.secgov', 'admin.audit', 'admin.users', 'admin.roles', 'admin.trash', 'admin.changes', 'automation.view', 'automation.run', 'automation.edit_rules', 'automation.escalation_resolve', 'automation.escalation_ack', 'casual.manage', 'attendance.manage', 'payroll.manage'],
  ceo:                    ['ceo.approve', 'monthly.approve', 'machine.register', 'machine.cats', 'workshop.manage', 'workshop.approve', 'compartment.create', 'compartment.manage', 'stock.catalog', 'stock.inventory', 'stock.movements', 'stock.approve', 'timber.inventory', 'transfer.view', 'transfer.approve', 'transfer.act', 'dispatch.view', 'dispatch.approve', 'fuel.vehicle', 'sales.view', 'sales.create', 'sales.edit', 'sales.pay', 'delivery.update', 'reports.weekly_cost', 'reports.weekly_perf', 'reports.kpi', 'reports.executive', 'reports.bi', 'reports.monthly', 'reports.export', 'reports.edit_expenses', 'reports.edit_kpi', 'reports.monthly_approve', 'reports.epm', 'reports.sage', 'admin.secgov', 'admin.audit', 'admin.users', 'admin.roles', 'admin.trash', 'admin.changes', 'automation.view', 'automation.run', 'automation.edit_rules', 'automation.escalation_resolve', 'automation.escalation_ack', 'casual.manage', 'attendance.manage', 'payroll.manage'],
  // Stabilization Phase 4 (P-5) — 'dispatch.view'/'dispatch.approve' added:
  // operations holds the backend 'dispatch' permission (db/migrate.js) and
  // desktop's dispatchReview already allows it, but mobile had no Dispatch
  // tab or permission for this role at all (see OperationsNavigator.tsx).
  operations:             ['material.review', 'labour.review', 'machine.cats', 'workshop.manage', 'workshop.approve', 'compartment.create', 'compartment.manage', 'stock.catalog', 'stock.inventory', 'stock.movements', 'stock.approve', 'timber.inventory', 'transfer.view', 'transfer.approve', 'transfer.act', 'dispatch.view', 'dispatch.approve', 'sales.view', 'sales.create', 'sales.edit', 'sales.pay', 'reports.weekly_cost', 'reports.weekly_perf', 'reports.executive', 'reports.bi', 'reports.export', 'reports.epm', 'admin.secgov', 'admin.audit', 'admin.users', 'admin.trash', 'admin.changes', 'automation.view', 'automation.run', 'automation.escalation_resolve', 'automation.escalation_ack', 'casual.manage', 'attendance.manage', 'payroll.manage'],
  sales:                  ['delivery.update', 'sales.view', 'sales.create', 'sales.edit', 'sales.pay', 'admin.changes'],
  'sales-staff':          ['delivery.update', 'admin.changes'],
  // Stock & Inventory Phase 4 (audit finding M-15/M-16) — 'transfer.view'/
  // 'transfer.act' added: showroom-staff holds the backend 'stock-transfers'
  // permission (role_definitions) that mobile-api's stockTransfers.js and
  // desktop's own canAct list were both just corrected to match, but this
  // client-side map still granted neither. Note: no navigator currently
  // routes this role to the Stock Transfers screen at all (unlike storekeeper/
  // supervisor/logistics/operations/ceo, who each have a dedicated Navigator
  // entry) — granting the permission alone doesn't yet surface a menu entry;
  // that navigation gap is documented, not fixed, in this phase's completion
  // report (out of proportion to fix under this specific finding's scope).
  'showroom-staff':       ['delivery.update', 'transfer.view', 'transfer.act', 'admin.changes'],
  finance:                ['reports.weekly_cost', 'reports.monthly', 'reports.export', 'reports.edit_expenses', 'reports.sage', 'admin.changes'],
  logistics:              ['delivery.update', 'fuel.vehicle', 'machine.register', 'machine.cats', 'workshop.manage', 'workshop.approve', 'stock.catalog', 'stock.inventory', 'stock.movements', 'stock.approve', 'timber.inventory', 'transfer.view', 'transfer.approve', 'transfer.act', 'dispatch.view', 'dispatch.approve', 'admin.changes'],
  // Stabilization Phase 4 — 'stock.catalog' (P-2), 'transfer.view'/
  // 'transfer.act' (P-3), and 'fuel.vehicle' (P-7) added: logistics-officer
  // holds the backend 'stock-items', 'stock-transfers', and 'vehicles'
  // permissions (db/migrate.js) and both desktop and the mobile-api routes
  // already allow it, but this client-side map never granted the matching
  // mobile permissions, so the corresponding screens/actions stayed hidden.
  'logistics-officer':    ['delivery.update', 'stock.catalog', 'transfer.view', 'transfer.act', 'fuel.vehicle', 'admin.changes'],
  // Stabilization Phase 4 (P-4) — 'workshop.approve' added: supervisor can
  // already approve/reject Material Requests for their own workshop on
  // desktop (renderWorkshopOverview's canApprove list), and mobile's
  // Workshop Overview is the only mobile path to that action — without this
  // key it was the sole entry point mobile blocked supervisor from.
  supervisor:             ['material.request', 'labour.write', 'compartment.create', 'stock.movements', 'stock.approve', 'timber.inventory', 'transfer.view', 'transfer.act', 'workshop.approve', 'reports.bi', 'reports.export', 'admin.changes', 'casual.manage', 'attendance.manage', 'payroll.manage'],
  storekeeper:            ['material.review', 'stock.catalog', 'stock.inventory', 'stock.movements', 'transfer.view', 'transfer.act', 'reports.bi', 'reports.export', 'admin.changes'],
  'storekeeper-assistant':['material.request', 'stock.movements', 'reports.bi', 'admin.changes'],
  // Mechanician Phase 1 (Priority 1/4) — 'machine.log'/'fuel.machine' removed:
  // this role had never held the matching backend permissions at the time.
  // Mechanician Phase 2 (Priority 1) — 'machine.log'/'fuel.machine' restored:
  // this role now genuinely holds 'machine-logs'/'machine-fuel'
  // (MECHANICIAN_PHASE2_OPERATIONAL_AUDIT.md), so the Add buttons they gate
  // now lead to submissions that actually succeed.
  mechanician:            ['material.request', 'machine.log', 'fuel.machine', 'admin.changes'],
  'harvesting-leader':    ['harvest.write', 'logtransport.write', 'material.request', 'labour.write', 'stock.movements', 'reports.bi', 'admin.changes'],
  'sawmill-leader':       ['sawmill.write', 'material.request', 'labour.write', 'stock.movements', 'reports.bi', 'timber.inventory', 'admin.changes'],
  'poles-leader':         ['poles.write', 'poles.purchase', 'poles.delivery', 'poles.qc', 'material.request', 'labour.write', 'stock.movements', 'reports.bi', 'admin.changes'],
  // Stock & Inventory Phase 4 (audit finding M-15/M-16) — same fix as
  // showroom-staff above: vat-leader holds backend 'stock-transfers' but
  // this map granted neither 'transfer.view' nor 'transfer.act'. Same
  // navigation-gap caveat applies (documented, not fixed, this phase).
  'vat-leader':           ['vat.write', 'material.request', 'labour.write', 'stock.movements', 'transfer.view', 'transfer.act', 'reports.bi', 'admin.changes'],
  'harvesting-supervisor': ['harvest.write', 'logtransport.write', 'reports.bi', 'admin.changes'],
  'sawmill-supervisor':    ['sawmill.write', 'reports.bi', 'timber.inventory', 'admin.changes'],
  'poles-supervisor':      ['poles.write', 'poles.delivery', 'admin.changes'],
  // Stock & Inventory Phase 4 (audit finding M-15/M-16) — same fix as
  // vat-leader/showroom-staff above.
  'vat-supervisor':        ['vat.write', 'transfer.view', 'transfer.act', 'admin.changes'],
  'procurement-officer':   ['admin.changes'],
  'procurement-manager':   ['admin.changes'],
  'department-manager':    ['admin.changes'],
};

export function hasPermission(role: UserRole, perm: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(perm) ?? false;
}

export function getPermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

// Which nav groups this role sees on the bottom tab bar
export type NavGroup =
  | 'ceo-overview'
  | 'harvest'
  | 'sawmill'
  | 'poles'
  | 'logistics'
  | 'sales'
  | 'operations'
  | 'workshop'
  | 'machines'
  | 'my-requests';

export const ROLE_NAV_GROUPS: Record<UserRole, NavGroup[]> = {
  admin:                  ['ceo-overview', 'operations', 'my-requests'],
  ceo:                    ['ceo-overview', 'my-requests'],
  operations:             ['operations', 'my-requests'],
  sales:                  ['sales', 'my-requests'],
  'sales-staff':          ['sales', 'my-requests'],
  'showroom-staff':       ['sales', 'my-requests'],
  finance:                ['my-requests'],
  logistics:              ['logistics', 'my-requests'],
  'logistics-officer':    ['logistics', 'my-requests'],
  supervisor:             ['workshop', 'machines', 'my-requests'],
  storekeeper:            ['workshop', 'my-requests'],
  'storekeeper-assistant':['workshop', 'my-requests'],
  mechanician:            ['machines', 'my-requests'],
  'harvesting-leader':     ['harvest', 'my-requests'],
  'sawmill-leader':        ['sawmill', 'my-requests'],
  'poles-leader':          ['poles', 'my-requests'],
  'vat-leader':            ['my-requests'],
  'harvesting-supervisor': ['harvest'],
  'sawmill-supervisor':    ['sawmill'],
  'poles-supervisor':      ['poles'],
  'vat-supervisor':        [],
  'procurement-officer':   ['my-requests'],
  'procurement-manager':   ['my-requests'],
  'department-manager':    ['my-requests'],
};
