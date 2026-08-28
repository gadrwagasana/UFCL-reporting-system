// Central list of all API endpoint paths.
// Base URL is injected by the Axios client.
export const EP = {
  // Auth
  AUTH_LOGIN:              '/api/auth/login',
  AUTH_ME:                 '/api/auth/me',

  // Dashboard — general stats (multi-role) + logistics warehouse view
  DASHBOARD_STATS:         '/api/dashboard/stats',
  DASHBOARD_MECHANICIAN:   '/api/dashboard/mechanician',
  LOGISTICS_DASHBOARD:     '/api/logistics/dashboard',
  // Phase 2 — generic per-record audit history, mobile equivalent of the
  // desktop detail overlay's history section.
  LOGISTICS_HISTORY:       (module: string, recordId: number | string) => `/api/logistics/history/${module}/${recordId}`,

  // CEO
  CEO_OVERVIEW:            '/api/ceo/overview',
  CEO_POLES_REQUESTS:      '/api/ceo/poles-requests',
  // Single endpoint handles both approve and reject via {approve: boolean, rejectionReason?}
  CEO_POLES_APPROVE:       (id: number) => `/api/ceo/poles-requests/${id}/approve`,
  CEO_MONTHLY:             '/api/ceo/monthly',
  CEO_MONTHLY_APPROVE:     (monthKey: string) => `/api/ceo/monthly/${monthKey}/approve`,

  // Harvest
  HARVEST_LIST:            '/api/harvest',
  HARVEST_CREATE:          '/api/harvest',
  // Harvesting Phase 1 (Workstream 1)
  HARVEST_UPDATE:          (id: number) => `/api/harvest/${id}`,
  HARVEST_DELETE:          (id: number) => `/api/harvest/${id}`,
  // Harvesting Phase 1 (Workstream 2)
  HARVEST_DASHBOARD:       '/api/harvest/dashboard',
  // Harvesting Phase 2 (Workstream 1) — Harvest Planning
  HARVEST_PLAN_LIST:       '/api/harvest/plans',
  HARVEST_PLAN_CREATE:     '/api/harvest/plans',
  HARVEST_PLAN_UPDATE:     (id: number) => `/api/harvest/plans/${id}`,
  HARVEST_PLAN_DELETE:     (id: number) => `/api/harvest/plans/${id}`,
  // Harvesting Phase 3 (Workstreams 1-3)
  HARVEST_OPERATIONS:      '/api/harvest/operations',
  HARVEST_PERFORMANCE:     '/api/harvest/performance',
  HARVEST_DELAY_LIST:      '/api/harvest/delays',
  HARVEST_DELAY_CREATE:    '/api/harvest/delays',
  // Harvesting Phase 4 (Workstreams 2-3)
  HARVEST_DECISION_SUPPORT: '/api/harvest/decision-support',
  HARVEST_EXECUTIVE_EXTRAS: '/api/harvest/executive-extras',

  // Enterprise Timber Lifecycle Integration Program — Phase 1
  HARVEST_WASTE_CATEGORIES: '/api/harvest-waste/categories',
  HARVEST_WASTE_LIST:       '/api/harvest-waste',
  HARVEST_WASTE_CREATE:     '/api/harvest-waste',
  RESOLUTIONS_LIST:         '/api/resolutions',
  RESOLUTIONS_CREATE:       '/api/resolutions',
  PRODUCTION_OFFCUTS_LIST:   '/api/production-offcuts',
  PRODUCTION_OFFCUTS_CREATE: '/api/production-offcuts',
  PRODUCTION_OFFCUTS_DECIDE: (id: number) => `/api/production-offcuts/${id}/decide`,
  PRODUCTION_OFFCUTS_RECOVERY: (id: number) => `/api/production-offcuts/${id}/recovery`,
  PRODUCTION_OFFCUTS_INSPECT:  (id: number) => `/api/production-offcuts/${id}/inspect`,
  PRODUCTION_RECONCILIATION: '/api/production-offcuts/reconciliation',
  ATTACHMENTS_LIST:   (entityType: string, entityId: number) => `/api/attachments/${entityType}/${entityId}`,
  ATTACHMENTS_UPLOAD: (entityType: string, entityId: number) => `/api/attachments/${entityType}/${entityId}/upload`,
  ATTACHMENTS_DELETE: (id: number) => `/api/attachments/${id}`,

  // Enterprise Timber Lifecycle Integration Program — Phase 2
  REJECTION_HOLDS_LIST:      '/api/rejection-holds',
  REJECTION_HOLDS_REWORK:    (id: number) => `/api/rejection-holds/${id}/rework`,
  REJECTION_HOLDS_DOWNGRADE: (id: number) => `/api/rejection-holds/${id}/downgrade`,
  REJECTION_HOLDS_RETURN:    (id: number) => `/api/rejection-holds/${id}/return`,
  QUALITY_REPORT:            '/api/rejection-holds/quality-report',

  // Log Transport
  LOG_TRANSPORT_LIST:      '/api/log-transport',
  LOG_TRANSPORT_CREATE:    '/api/log-transport',
  // Remediation Phase 2 — logTransportUpdate had no REST route/mobile UI
  LOG_TRANSPORT_UPDATE:    (id: number) => `/api/log-transport/${id}`,
  // ERP Final Enterprise Completion Gate — logTransportDelete had no REST route/mobile UI
  LOG_TRANSPORT_DELETE:    (id: number) => `/api/log-transport/${id}`,

  // Sawmill
  SAWMILL_LIST:            '/api/sawmill',
  SAWMILL_CREATE:          '/api/sawmill',
  // Sawmill Phase 1 (Workstream 3)
  SAWMILL_UPDATE:          (id: number) => `/api/sawmill/${id}`,
  SAWMILL_DELETE:          (id: number) => `/api/sawmill/${id}`,
  SAWMILL_DASHBOARD:       '/api/sawmill/dashboard',

  // Nyanza Value-Added Production
  VAT_AVAILABLE_INPUTS:    '/api/vat/available-inputs',
  VAT_LIST:                '/api/vat',
  VAT_CREATE:              '/api/vat',
  VAT_UPDATE:              (id: number) => `/api/vat/${id}`,
  VAT_DELETE:              (id: number) => `/api/vat/${id}`,
  VAT_INSPECT:             (outputId: number) => `/api/vat/outputs/${outputId}/inspect`,
  VAT_RECONCILIATION:      '/api/vat/reconciliation',
  VAT_REPORT:              '/api/vat/report',
  SHOWROOM_INVENTORY:      '/api/showroom-damage/inventory',
  SHOWROOM_DAMAGE_LIST:    '/api/showroom-damage',
  SHOWROOM_DAMAGE_CREATE:  '/api/showroom-damage',

  // Poles — purchase requests
  POLES_PURCHASE_LIST:     '/api/poles/purchase-requests',
  POLES_PURCHASE_CREATE:   '/api/poles/purchase-requests',
  // Poles — deliveries
  POLES_DELIVERY_LIST:     '/api/poles/deliveries',
  POLES_DELIVERY_CREATE:   '/api/poles/deliveries',
  POLES_DELIVERY_QC:       (id: number) => `/api/poles/deliveries/${id}/quality-check`,
  // Poles — production batches (Pole Production Phase 1)
  POLES_PRODUCTION_LIST:      '/api/poles/production',
  POLES_PRODUCTION_CREATE:    '/api/poles/production',
  POLES_PRODUCTION_DELETE:    (id: number) => `/api/poles/production/${id}`,
  POLES_PRODUCTION_INSPECT:   (outputId: number) => `/api/poles/production/outputs/${outputId}/inspect`,
  POLES_PRODUCTION_RECONCILIATION: '/api/poles/production/reconciliation',
  // Poles — purchased finished poles (Pole Production Phase 2)
  POLES_PURCHASED_PENDING_QC: '/api/poles/purchased/pending-qc',
  POLES_PURCHASED_INSPECT:    (id: number) => `/api/poles/purchased/${id}/inspect`,
  POLES_SOURCE_REPORT:        '/api/poles/source-report',

  // Material requests
  // /approve handles both approve and reject — pass {action:'approve'|'reject', ...} in body
  MATERIAL_LIST:           '/api/material-requests',
  MATERIAL_CREATE:         '/api/material-requests',
  MATERIAL_APPROVE:        (id: number) => `/api/material-requests/${id}/approve`,

  // Maintenance Jobs (Mechanician Phase 3)
  MAINTENANCE_JOBS_LIST:      '/api/maintenance-jobs',
  MAINTENANCE_JOBS_CREATE:    '/api/maintenance-jobs',
  MAINTENANCE_JOB_DETAIL:     (id: number) => `/api/maintenance-jobs/${id}`,
  MAINTENANCE_JOB_ASSIGN:     (id: number) => `/api/maintenance-jobs/${id}/assign`,
  MAINTENANCE_JOB_TRANSITION: (id: number) => `/api/maintenance-jobs/${id}/transition`,
  MAINTENANCE_JOB_LABOUR:     (id: number) => `/api/maintenance-jobs/${id}/labour`,
  MAINTENANCE_PRODUCTION_IMPACT: '/api/maintenance-jobs/production-impact',
  MAINTENANCE_WAITING_FOR_PARTS: '/api/maintenance-jobs/waiting-for-parts',
  MAINTENANCE_ASSET_SUMMARY:  (machineId: number) => `/api/maintenance-jobs/asset-summary/${machineId}`,

  // Casual labour
  // /review handles approve and reject — pass {status:'approved'|'rejected'} in body
  LABOUR_LIST:             '/api/casual-labour',
  LABOUR_CREATE:           '/api/casual-labour',
  LABOUR_REVIEW:           (id: number) => `/api/casual-labour/${id}/review`,
  // Remediation Phase 2 — casualLabourRequestsDelete had no REST route/mobile UI
  LABOUR_DELETE:           (id: number) => `/api/casual-labour/${id}`,

  // Deliveries
  DELIVERY_LIST:           '/api/deliveries',
  DELIVERY_CREATE:         '/api/deliveries',
  DELIVERY_UPDATE:         (id: number) => `/api/deliveries/${id}`,
  DELIVERY_DELETE:         (id: number) => `/api/deliveries/${id}`,
  DELIVERY_POD:            (id: number) => `/api/deliveries/${id}/pod`,
  DELIVERY_STATUS:         (id: number) => `/api/deliveries/${id}/status`,

  // Machine logs
  MACHINE_LOG_LIST:        '/api/machine-logs',
  MACHINE_LOG_CREATE:      '/api/machine-logs',
  // Remediation Phase 3 — machineLogsUpdate/Delete had desktop wiring, no mobile REST route
  MACHINE_LOG_UPDATE:      (id: number) => `/api/machine-logs/${id}`,
  MACHINE_LOG_DELETE:      (id: number) => `/api/machine-logs/${id}`,
  MACHINE_FUEL_ISSUED:     '/api/machine-logs/fuel-issued',

  // Machine fuel
  MACHINE_FUEL_LIST:       '/api/fuel/machine',
  MACHINE_FUEL_CREATE:     '/api/fuel/machine',
  // Stabilization Phase 5 (F-21)
  MACHINE_FUEL_UPDATE:     (id: number) => `/api/fuel/machine/${id}`,
  // Remediation Phase 2 — machineFuelLogsDelete had no REST route/mobile UI
  MACHINE_FUEL_DELETE:     (id: number) => `/api/fuel/machine/${id}`,

  // Vehicle fuel (logistics/admin only)
  VEHICLE_FUEL_LIST:       '/api/fuel/vehicle',
  VEHICLE_FUEL_CREATE:     '/api/fuel/vehicle',

  // My requests
  MY_REQUESTS:             '/api/my-requests',

  // Notifications
  NOTIFICATIONS_LIST:      '/api/notifications',
  NOTIFICATIONS_POLL:      '/api/notifications/poll',
  NOTIFICATIONS_MARK_READ: (id: number) => `/api/notifications/${id}/read`,
  NOTIFICATIONS_MARK_ALL:  '/api/notifications/read-all',

  // ERP Enterprise Completion Phase 4 — Pending Edit / Deletion Request
  // governance review (approve/reject side).
  GOVERNANCE_PENDING_EDITS_LIST:     '/api/governance/pending-edits',
  GOVERNANCE_PENDING_EDITS_REVIEW:   (id: number) => `/api/governance/pending-edits/${id}/review`,
  GOVERNANCE_DELETION_REQUESTS_LIST: '/api/governance/deletion-requests',
  GOVERNANCE_DELETION_REQUESTS_APPROVE: (id: number) => `/api/governance/deletion-requests/${id}/approve`,
  GOVERNANCE_DELETION_REQUESTS_REJECT:  (id: number) => `/api/governance/deletion-requests/${id}/reject`,

  // Products
  PRODUCTS_LIST:          (filter?: string) => `/api/products${filter ? `?filter=${filter}` : ''}`,
  PRODUCTS_CREATE:        '/api/products',
  PRODUCTS_UPDATE:        (id: number) => `/api/products/${id}`,
  PRODUCTS_TOGGLE:        (id: number) => `/api/products/${id}/toggle`,
  PRODUCTS_ACTIVE:        (type: string) => `/api/products/active?type=${type}`,
  PRODUCTS_SALES_DROPDOWN:'/api/products/sales-dropdown',

  // Vehicles
  VEHICLES_LIST:                '/api/vehicles',
  FLEET_DASHBOARD:              '/api/vehicles/dashboard',
  FLEET_INTELLIGENCE:           '/api/vehicles/intelligence',
  VEHICLES_DETAIL:              (id: number) => `/api/vehicles/${id}`,
  VEHICLES_CREATE:              '/api/vehicles',
  VEHICLES_UPDATE:              (id: number) => `/api/vehicles/${id}`,
  VEHICLES_DELETE:              (id: number) => `/api/vehicles/${id}`,
  VEHICLES_FUEL_LOG_CREATE:     (id: number) => `/api/vehicles/${id}/fuel-logs`,
  VEHICLES_FUEL_LOG_DELETE:     (logId: number) => `/api/vehicles/fuel-logs/${logId}`,
  VEHICLES_MAINTENANCE_CREATE:  (id: number) => `/api/vehicles/${id}/maintenance`,
  // Stabilization Phase 5 (F-16)
  VEHICLES_MAINTENANCE_UPDATE:  (recordId: number) => `/api/vehicles/maintenance/${recordId}`,
  VEHICLES_MAINTENANCE_DELETE:  (recordId: number) => `/api/vehicles/maintenance/${recordId}`,
  VEHICLES_TRANSPORT_DROPDOWN:  '/api/vehicles/transport-dropdown',

  // Machines (registry)
  MACHINES_LIST:                   '/api/machines',
  MACHINES_DETAIL:                 (id: number) => `/api/machines/${id}`,
  MACHINES_CREATE:                 '/api/machines',
  MACHINES_UPDATE:                 (id: number) => `/api/machines/${id}`,
  // Stabilization Phase 5 (F-19)
  MACHINES_DELETE:                 (id: number) => `/api/machines/${id}`,
  MACHINES_CATEGORIES:             '/api/machines/categories',
  MACHINES_CATEGORY_UPDATE:        (catId: number) => `/api/machines/categories/${catId}`,
  MACHINES_CATEGORY_DELETE:        (catId: number) => `/api/machines/categories/${catId}`,
  MACHINES_MAINT_SCHEDULE_CREATE:  (id: number) => `/api/machines/${id}/maint-schedules`,
  // ERP Final Enterprise Completion Gate — Update/Delete had no REST route/mobile UI
  MACHINES_MAINT_SCHEDULE_UPDATE:  (schedId: number) => `/api/machines/maint-schedules/${schedId}`,
  MACHINES_MAINT_SCHEDULE_DELETE:  (schedId: number) => `/api/machines/maint-schedules/${schedId}`,
  // Mechanician Phase 2 (Priority 3) — cross-machine Maintenance Schedule list.
  MACHINES_MAINT_SCHEDULES_ALL:    '/api/machines/maintenance-schedules',
  // Phase 1 Workshop parity fix
  MACHINE_KPI_PERFORMANCE:         (month?: string) => `/api/machines/kpi-performance${month ? `?month=${month}` : ''}`,

  // Stock Transfers
  STOCK_TRANSFERS_LIST:     '/api/stock-transfers',
  STOCK_TRANSFERS_CREATE:   '/api/stock-transfers',
  STOCK_TRANSFERS_APPROVE:  (id: number) => `/api/stock-transfers/${id}/approve`,
  STOCK_TRANSFERS_DISPATCH: (id: number) => `/api/stock-transfers/${id}/dispatch`,
  STOCK_TRANSFERS_RECEIVE:  (id: number) => `/api/stock-transfers/${id}/receive`,
  STOCK_TRANSFERS_REPORT_DISCREPANCY: (id: number) => `/api/stock-transfers/${id}/report-discrepancy`,
  STOCK_TRANSFERS_HISTORY:  (id: number) => `/api/stock-transfers/${id}/history`,

  // Dispatch
  DISPATCH_LIST:   '/api/dispatch',
  DISPATCH_CREATE: '/api/dispatch',
  DISPATCH_REVIEW: (id: number) => `/api/dispatch/${id}`,
  DISPATCH_DELETE: (id: number) => `/api/dispatch/${id}`,

  // Transport Carriers & Jobs (Phase 1 Logistics fix — no mobile route existed)
  TRANSPORT_COMPANIES_LIST:   '/api/transport/companies',
  TRANSPORT_COMPANIES_CREATE: '/api/transport/companies',
  TRANSPORT_COMPANIES_UPDATE: (id: number) => `/api/transport/companies/${id}`,
  TRANSPORT_COMPANIES_DELETE: (id: number) => `/api/transport/companies/${id}`,
  TRANSPORT_JOBS_LIST:   '/api/transport/jobs',
  TRANSPORT_JOBS_CREATE: '/api/transport/jobs',
  TRANSPORT_JOBS_UPDATE: (id: number) => `/api/transport/jobs/${id}`,
  TRANSPORT_JOBS_STATUS: (id: number) => `/api/transport/jobs/${id}/status`,
  TRANSPORT_JOBS_DELETE: (id: number) => `/api/transport/jobs/${id}`,

  // Sales Orders
  SALES_LIST:         '/api/sales',
  // Master Professionalization Phase C1 — no single-record detail endpoint
  // existed at all; every screen re-derived a row from the list.
  SALES_DETAIL:       (id: number) => `/api/sales/${id}`,
  SALES_CREATE:       '/api/sales',
  SALES_UPDATE:       (id: number) => `/api/sales/${id}`,
  SALES_DELETE:       (id: number) => `/api/sales/${id}`,
  SALES_PAY:          (id: number) => `/api/sales/${id}/pay`,
  SALES_STATUS:       (id: number) => `/api/sales/${id}/status`,
  SALES_CLOSE_SHORT:  (id: number) => `/api/sales/${id}/close-short`,
  SALES_DELIVER:      (id: number) => `/api/sales/${id}/deliver`,
  // ERP Final Enterprise Completion Gate — confirmed no Sales Dashboard/Reporting existed on either platform
  SALES_DASHBOARD:    '/api/sales/dashboard',
  SALES_REPORT:       '/api/sales/report',

  // Timber Inventory
  TIMBER_INVENTORY: '/api/timber-inventory',

  // Stock Management
  STOCK_ITEMS:                   '/api/stock',
  STOCK_ITEMS_CREATE:            '/api/stock',
  STOCK_ITEMS_UPDATE:            (id: number) => `/api/stock/${id}`,
  STOCK_ITEMS_DELETE:            (id: number) => `/api/stock/${id}`,
  STOCK_CATEGORIES:              '/api/stock/categories',
  STOCK_CATEGORIES_CREATE:       '/api/stock/categories',
  STOCK_CATEGORIES_DELETE:       (id: number) => `/api/stock/categories/${id}`,
  STOCK_INVENTORY:               '/api/stock/inventory',
  STOCK_INVENTORY_DASHBOARD:     '/api/stock/inventory/dashboard',
  STOCK_INVENTORY_INTELLIGENCE:  '/api/stock/inventory/intelligence',
  STOCK_MOVEMENTS:               '/api/stock/movements',
  STOCK_MOVEMENTS_CREATE:        '/api/stock/movements',
  STOCK_MOVEMENTS_DELETE:        (id: number) => `/api/stock/movements/${id}`,
  STOCK_ADJUSTMENT_REQUEST_CREATE: '/api/stock/movements/adjustment-request',

  // Compartments
  COMPARTMENTS_LIST:   '/api/compartments',
  COMPARTMENTS_CREATE: '/api/compartments',
  COMPARTMENTS_UPDATE: (id: number) => `/api/compartments/${id}`,
  COMPARTMENTS_DELETE: (id: number) => `/api/compartments/${id}`,

  // Workshops
  WORKSHOPS_OVERVIEW:          '/api/workshops/overview',
  WORKSHOPS_LIST:              '/api/workshops',
  WORKSHOPS_CREATE:            '/api/workshops',
  WORKSHOPS_UPDATE:            (id: number) => `/api/workshops/${id}`,
  WORKSHOPS_DELETE:            (id: number) => `/api/workshops/${id}`,
  WORKSHOPS_TRANSFER_APPROVE:  (movementId: number) => `/api/workshops/transfers/${movementId}/approve`,

  // Customers
  CUSTOMERS_LIST:     '/api/customers',
  CUSTOMERS_CREATE:   '/api/customers',
  CUSTOMERS_UPDATE:   (id: number) => `/api/customers/${id}`,
  CUSTOMERS_TOGGLE:   (id: number) => `/api/customers/${id}/toggle`,
  CUSTOMERS_DROPDOWN: '/api/customers/dropdown',
  // ERP Final Enterprise Completion Gate — Customer History
  CUSTOMERS_ORDERS:   (id: number) => `/api/customers/${id}/orders`,

  // Casuals (casual worker registry) — HR Enterprise Phase 1
  CASUALS_LIST:   '/api/casuals',
  CASUALS_CREATE: '/api/casuals',
  CASUALS_UPDATE: (id: number) => `/api/casuals/${id}`,
  CASUALS_DELETE: (id: number) => `/api/casuals/${id}`,

  // Attendance — HR Enterprise Phase 2
  ATTENDANCE_ROSTER:    '/api/attendance/roster',
  ATTENDANCE_MARK:      '/api/attendance/mark',
  ATTENDANCE_LIST:      '/api/attendance',
  ATTENDANCE_DASHBOARD: '/api/attendance/dashboard',
  ATTENDANCE_REPORT:    '/api/attendance/report',
  ATTENDANCE_UPDATE:    (id: number) => `/api/attendance/${id}`,
  ATTENDANCE_DELETE:    (id: number) => `/api/attendance/${id}`,

  // Payroll — Payroll Enterprise Phase 2/3 (mobile: review/approve/inspect
  // + search/filter/sort/export only — see PayrollStack comment in
  // navigation/types.ts for what stays desktop-only)
  PAYROLL_PERIODS_LIST:    '/api/payroll/periods',
  PAYROLL_PERIOD_DETAIL:   (id: number) => `/api/payroll/periods/${id}`,
  PAYROLL_PERIOD_APPROVE:  (id: number) => `/api/payroll/periods/${id}/approve`,
  PAYROLL_LINE_DETAIL:     (id: number) => `/api/payroll/lines/${id}`,
  PAYROLL_LINE_ADJUSTMENTS: (id: number) => `/api/payroll/lines/${id}/adjustments`,
  // Phase 3 — binary .xlsx response, downloaded via downloadFile() (same
  // "write, then share" mechanism SageScreen.tsx/useSrm.ts already use),
  // not the standard JSON-envelope get()/post() helpers.
  PAYROLL_EXPORT_EXCEL:    (reportType: string) => `/api/payroll/export/${reportType}`,

  // Finance Control Center — Finance Enterprise (mobile: Dashboard, Approval
  // Center, Stock Count review (a natural fit for on-the-floor physical
  // counting), Stock Variance, and the Exception Center. Operations
  // Center/Reports/Configuration/Sage Export/Production-Maintenance-
  // Customer-Supplier drill-downs remain desktop-only — dense, filterable
  // tables and file-export workflows, disclosed in the Gap Register, not
  // silently missing).
  FINANCE_DASHBOARD:        '/api/finance-center/dashboard',
  FINANCE_APPROVALS:        '/api/finance-center/approvals',
  FINANCE_APPROVAL_DECIDE:  (entityType: string, entityId: number) => `/api/finance-center/approvals/${entityType}/${entityId}/decide`,
  FINANCE_INVENTORY_OVERVIEW: '/api/finance-center/inventory-overview',
  FINANCE_STOCK_VARIANCE:     '/api/finance-center/stock-variance',
  FINANCE_STOCK_COUNTS_LIST:  '/api/finance-center/stock-counts',
  FINANCE_STOCK_COUNT_DETAIL: (id: number) => `/api/finance-center/stock-counts/${id}`,
  FINANCE_STOCK_COUNT_ENTER:  (id: number, lineId: number) => `/api/finance-center/stock-counts/${id}/lines/${lineId}`,
  FINANCE_STOCK_COUNT_SUBMIT_REVIEW: (id: number) => `/api/finance-center/stock-counts/${id}/submit-review`,
  FINANCE_EXCEPTIONS_LIST:    '/api/finance-center/exceptions',
  FINANCE_EXCEPTION_DETAIL:   (id: number) => `/api/finance-center/exceptions/${id}`,
  FINANCE_EXCEPTION_COMMENT:  (id: number) => `/api/finance-center/exceptions/${id}/comments`,
  FINANCE_EXCEPTION_RESOLVE:  (id: number) => `/api/finance-center/exceptions/${id}/resolve`,

  // Reports
  REPORTS_WEEKLY_COST:     '/api/reports/weekly-cost',
  REPORTS_WEEKLY_EXPENSES: '/api/reports/weekly-expenses',
  REPORTS_WEEKLY_PERF:     '/api/reports/weekly-perf',
  REPORTS_KPI:             '/api/reports/kpi',
  REPORTS_EXECUTIVE:       '/api/reports/executive',
  REPORTS_BI:              '/api/reports/bi',
  REPORTS_MONTHLY:         '/api/reports/monthly',
  REPORTS_MONTHLY_APPROVE: '/api/reports/monthly/approve',

  // Meta / lookup endpoints
  META_MACHINES:           '/api/meta/machines',
  META_MACHINE_FUEL_TARGETS: '/api/meta/machine-fuel-targets',
  META_MACHINE_LOG_CATEGORIES: '/api/meta/machine-log-categories',
  META_VEHICLES:           '/api/meta/vehicles',
  META_COMPARTMENTS:       '/api/meta/compartments',
  META_STOCK_ITEMS:        '/api/meta/stock-items',
  META_WAREHOUSES:         '/api/meta/warehouses',
  META_POLES_REQUESTS:     '/api/meta/poles-purchase-requests',

  // Admin — Security, Audit, Users, Roles, Trash, Changes
  ADMIN_SECGOV:        '/api/admin/secgov',
  ADMIN_AUDIT:         '/api/admin/audit',
  ADMIN_USERS:         '/api/admin/users',
  ADMIN_USER:          (id: number) => `/api/admin/users/${id}`,
  ADMIN_USER_RESET_PW: (id: number) => `/api/admin/users/${id}/reset-password`,
  ADMIN_ROLES:         '/api/admin/roles',
  ADMIN_ROLE:          (role: string) => `/api/admin/roles/${role}`,
  ADMIN_TRASH:         '/api/admin/trash',
  ADMIN_TRASH_RESTORE: '/api/admin/trash/restore',
  ADMIN_TRASH_PURGE:   '/api/admin/trash/purge',
  ADMIN_CHANGES:       '/api/admin/changes',
  ADMIN_CHANGE:        (id: number) => `/api/admin/changes/${id}`,

  // Automation Center
  AUTOMATION_DASHBOARD:         '/api/automation/dashboard',
  AUTOMATION_RUN:               '/api/automation/run',
  AUTOMATION_RULES:             '/api/automation/rules',
  AUTOMATION_RULE:              (key: string) => `/api/automation/rules/${key}`,
  AUTOMATION_ESCALATIONS:       '/api/automation/escalations',
  AUTOMATION_ESCALATION_RESOLVE:(id: number) => `/api/automation/escalations/${id}/resolve`,
  AUTOMATION_ESCALATION_ACK:    (id: number) => `/api/automation/escalations/${id}/ack`,

  // EPM
  EPM_DASHBOARD:    '/api/epm/dashboard',
  EPM_DEPARTMENTS:  '/api/epm/departments',
  EPM_TRENDS:       '/api/epm/trends',

  // Global Search
  SEARCH: '/api/search',

  // Procurement Management
  PROCUREMENT_SUPPLIERS:                '/api/procurement/suppliers',
  PROCUREMENT_SUPPLIER:                 (id: number) => `/api/procurement/suppliers/${id}`,
  PROCUREMENT_SUPPLIER_BLACKLIST:       (id: number) => `/api/procurement/suppliers/${id}/blacklist`,
  PROCUREMENT_SUPPLIER_STATUS:          (id: number) => `/api/procurement/suppliers/${id}/status`,
  PROCUREMENT_SUPPLIER_CONTACTS:        (id: number) => `/api/procurement/suppliers/${id}/contacts`,
  PROCUREMENT_SUPPLIER_CONTACT:         (id: number) => `/api/procurement/suppliers/contacts/${id}`,
  PROCUREMENT_SUPPLIER_CONTRACTS:       (id: number) => `/api/procurement/suppliers/${id}/contracts`,
  PROCUREMENT_SUPPLIER_CONTRACT:        (id: number) => `/api/procurement/suppliers/contracts/${id}`,
  PROCUREMENT_SUPPLIER_PERFORMANCE:     (id: number) => `/api/procurement/suppliers/${id}/performance`,

  PROCUREMENT_REQUISITIONS:         '/api/procurement/requisitions',
  PROCUREMENT_REQUISITION:          (id: number) => `/api/procurement/requisitions/${id}`,
  PROCUREMENT_REQUISITION_SUBMIT:   (id: number) => `/api/procurement/requisitions/${id}/submit`,
  PROCUREMENT_REQUISITION_CANCEL:   (id: number) => `/api/procurement/requisitions/${id}/cancel`,
  PROCUREMENT_REQUISITION_APPROVE:  (id: number) => `/api/procurement/requisitions/${id}/approve`,
  PROCUREMENT_DASHBOARD:            '/api/procurement/requisitions/meta/dashboard',
  PROCUREMENT_REPORT_SPEND:         '/api/procurement/requisitions/meta/reports/spend-analysis',
  PROCUREMENT_REPORT_SUPPLIER_PERF: '/api/procurement/requisitions/meta/reports/supplier-performance',
  PROCUREMENT_REPORT_DELIVERY_PERF: '/api/procurement/requisitions/meta/reports/delivery-performance',
  PROCUREMENT_REPORT_BUDGET:        '/api/procurement/requisitions/meta/reports/budget-utilization',
  PROCUREMENT_REPORT_REVISIONS:     '/api/procurement/requisitions/meta/reports/revisions',
  PROCUREMENT_ANALYTICS:            '/api/procurement/requisitions/meta/analytics',
  PROCUREMENT_EXECUTIVE_DASHBOARD:  '/api/procurement/requisitions/meta/executive-dashboard',
  PROCUREMENT_SPEND_BUDGET_ANALYTICS: '/api/procurement/requisitions/meta/spend-budget-analytics',
  PROCUREMENT_FORECASTING_DASHBOARD: '/api/procurement/requisitions/meta/forecasting-dashboard',
  PROCUREMENT_EXECUTIVE_REPORT: (reportType: string) => `/api/procurement/requisitions/meta/executive-reports/${reportType}`,
  PROCUREMENT_CONFIG:               '/api/procurement/requisitions/meta/config',

  // Phase 6 — Procurement Automation Engine
  PROCUREMENT_AUTOMATION_DASHBOARD: '/api/procurement/requisitions/meta/automation/dashboard',
  PROCUREMENT_TASKS:                '/api/procurement/requisitions/meta/automation/tasks',
  PROCUREMENT_TASK_COMPLETE:        (taskId: number) => `/api/procurement/requisitions/meta/automation/tasks/${taskId}/complete`,
  PROCUREMENT_ESCALATIONS:          '/api/procurement/requisitions/meta/automation/escalations',
  PROCUREMENT_ESCALATION_RESOLVE:   (escalationId: number) => `/api/procurement/requisitions/meta/automation/escalations/${escalationId}/resolve`,

  // Phase 7 — Procurement Performance Management
  PROCUREMENT_PERF_SCORECARD:   '/api/procurement/requisitions/meta/performance/scorecard',
  PROCUREMENT_PERF_BUYERS:      '/api/procurement/requisitions/meta/performance/buyers',
  PROCUREMENT_PERF_DEPARTMENTS: '/api/procurement/requisitions/meta/performance/departments',
  PROCUREMENT_PERF_WORKSHOPS:   '/api/procurement/requisitions/meta/performance/workshops',
  PROCUREMENT_PERF_EXECUTIVE:   '/api/procurement/requisitions/meta/performance/executive-dashboard',
  PROCUREMENT_PERF_BENCHMARK:   '/api/procurement/requisitions/meta/performance/benchmark',
  PROCUREMENT_PERF_RISK:        '/api/procurement/requisitions/meta/performance/risk',

  // Supplier Intelligence — Phase 3C
  SUPPLIER_INTEL_DASHBOARD: '/api/procurement/requisitions/meta/intelligence/dashboard',
  SUPPLIER_INTEL_PROFILE:   (supplierId: number) => `/api/procurement/requisitions/meta/intelligence/profile/${supplierId}`,
  SUPPLIER_INTEL_COMPARE:   '/api/procurement/requisitions/meta/intelligence/compare',
  SUPPLIER_INTEL_REPORT:    (reportType: string) => `/api/procurement/requisitions/meta/intelligence/reports/${reportType}`,

  PROCUREMENT_RFQS:            '/api/procurement/rfq',
  PROCUREMENT_RFQ_CREATE:      (requisitionId: number) => `/api/procurement/rfq/from-requisition/${requisitionId}`,
  PROCUREMENT_RFQ:             (id: number) => `/api/procurement/rfq/${id}`,
  PROCUREMENT_RFQ_SEND:        (id: number) => `/api/procurement/rfq/${id}/send`,
  PROCUREMENT_RFQ_QUOTATIONS:  (id: number) => `/api/procurement/rfq/${id}/quotations`,
  PROCUREMENT_RFQ_COMPARE:     (id: number) => `/api/procurement/rfq/${id}/compare`,
  PROCUREMENT_QUOTATION_SELECT:(id: number) => `/api/procurement/rfq/quotations/${id}/select`,

  PROCUREMENT_POS:          '/api/procurement/orders',
  PROCUREMENT_PO_GENERATE:  '/api/procurement/orders/generate',
  PROCUREMENT_PO:           (id: number) => `/api/procurement/orders/${id}`,
  PROCUREMENT_PO_PDF_HTML:  (id: number) => `/api/procurement/orders/${id}/pdf-html`,
  PROCUREMENT_PO_RECEIPTS:  (id: number) => `/api/procurement/orders/${id}/receipts`,
  PROCUREMENT_RECEIPTS:     '/api/procurement/orders/receipts',
  PROCUREMENT_RECEIPT:      (id: number) => `/api/procurement/orders/receipts/${id}`,
  // Procurement Exception Management Phase 3 — Close with Shortage.
  PROCUREMENT_PO_CLOSE_SHORTAGE: (id: number) => `/api/procurement/orders/${id}/close-shortage`,
  PROCUREMENT_PO_APPROVE:        (id: number) => `/api/procurement/orders/${id}/approve`,
  PROCUREMENT_REPORT_PO_SHORTAGES: '/api/procurement/orders/meta/reports/po-shortages',

  PROCUREMENT_INVOICES:          '/api/procurement/invoices',
  PROCUREMENT_INVOICE_CREATE:    (poId: number) => `/api/procurement/invoices/from-po/${poId}`,
  PROCUREMENT_INVOICE_MATCH:     (id: number) => `/api/procurement/invoices/${id}/match`,
  PROCUREMENT_INVOICE_APPROVE:   (id: number) => `/api/procurement/invoices/${id}/approve`,
  PROCUREMENT_PAYMENTS:          '/api/procurement/invoices/payments',
  PROCUREMENT_PAYMENT_CREATE:    (invoiceId: number) => `/api/procurement/invoices/${invoiceId}/payments`,
  PROCUREMENT_PAYMENT_APPROVE:   (id: number) => `/api/procurement/invoices/payments/${id}/approve`,

  // Supplier Relationship Management (SRM) — Phase 4
  SRM_CONTRACTS_REGISTER: '/api/srm/contracts',
  SRM_CONTRACT_APPROVE:   (id: number) => `/api/srm/contracts/${id}/approve`,
  SRM_CONTRACT_RENEW:     (id: number) => `/api/srm/contracts/${id}/renew`,

  SRM_COMPLIANCE_REGISTER: '/api/srm/compliance',
  SRM_COMPLIANCE_LIST:     (supplierId: number) => `/api/srm/compliance/${supplierId}`,
  SRM_COMPLIANCE_UPSERT:   (supplierId: number) => `/api/srm/compliance/${supplierId}`,

  SRM_COMMUNICATIONS_REGISTER: '/api/srm/communications',
  SRM_COMMUNICATIONS_LIST:     (supplierId: number) => `/api/srm/communications/${supplierId}`,
  SRM_COMMUNICATION_CREATE:    (supplierId: number) => `/api/srm/communications/${supplierId}`,
  SRM_COMMUNICATION_UPDATE:    (id: number) => `/api/srm/communications/entry/${id}`,

  SRM_IMPROVEMENT_PLANS_REGISTER: '/api/srm/improvement-plans',
  SRM_IMPROVEMENT_PLANS_LIST:     (supplierId: number) => `/api/srm/improvement-plans/${supplierId}`,
  SRM_IMPROVEMENT_PLAN_CREATE:    (supplierId: number) => `/api/srm/improvement-plans/${supplierId}`,
  SRM_IMPROVEMENT_PLAN_UPDATE:    (id: number) => `/api/srm/improvement-plans/entry/${id}`,

  SRM_DASHBOARD: '/api/srm/dashboard',
  SRM_REPORT:    (reportType: string) => `/api/srm/reports/${reportType}`,

  SRM_DOCUMENTS_REGISTER: '/api/srm/documents',
  SRM_DOCUMENTS_LIST:     (supplierId: number) => `/api/srm/documents/${supplierId}`,
  SRM_DOCUMENT_UPLOAD:    (supplierId: number) => `/api/srm/documents/${supplierId}/upload`,
  SRM_DOCUMENT_FILE:      (documentId: number) => `/api/srm/documents/file/${documentId}`,
  SRM_DOCUMENT_DELETE:    (documentId: number) => `/api/srm/documents/${documentId}`,
} as const;
