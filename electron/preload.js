'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Security note: every function below accepts the renderer-supplied userId as
// the first parameter (_userId) for backward compatibility with existing renderer
// code, but it is intentionally NOT forwarded in the IPC payload.
// The main process resolves the authenticated identity exclusively from its
// server-side session map (_sessions in main.js) — the renderer cannot influence it.

window.addEventListener('DOMContentLoaded', () => {
  try {
    const appRoot = document.getElementById('app');
    const loginView = document.getElementById('loginView');
    const lvStyle = loginView ? window.getComputedStyle(loginView) : null;
    const lvRect = loginView ? loginView.getBoundingClientRect() : null;
    const payload = {
      href: location.href,
      hasAppRoot: !!appRoot,
      appChildCount: appRoot ? appRoot.childElementCount : null,
      appInnerLen: appRoot ? appRoot.innerHTML.length : null,
      hasLoginView: !!loginView,
      loginDisplay: lvStyle ? lvStyle.display : null,
      loginVisibility: lvStyle ? lvStyle.visibility : null,
      loginRect: lvRect
        ? { x: lvRect.x, y: lvRect.y, w: lvRect.width, h: lvRect.height }
        : null,
      scriptTags: Array.from(document.querySelectorAll('script'))
        .map((s) => s.getAttribute('src') || '[inline]')
        .slice(0, 10),
      linkTags: Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .map((l) => l.getAttribute('href'))
        .slice(0, 10)
    };
    console.log('[UFCL] preload DOMContentLoaded ' + JSON.stringify(payload));
  } catch (e) {
    console.error('[UFCL] preload DOMContentLoaded error', e);
  }
});

contextBridge.exposeInMainWorld('UFCL', {
  // ── Public (no session required) ──────────────────────────────────────────
  login:          (username, password) => ipcRenderer.invoke('auth:login', { username, password }),
  logout:         ()                   => ipcRenderer.invoke('auth:logout'),
  getAppVersion:  ()                   => ipcRenderer.invoke('app:getVersion'),

  // Auto-update bridge (no auth)
  onUpdateAvailable:   (cb) => ipcRenderer.on('update:available',  (_e, d) => cb(d)),
  onUpdateProgress:    (cb) => ipcRenderer.on('update:progress',   (_e, d) => cb(d)),
  onUpdateDownloaded:  (cb) => ipcRenderer.on('update:downloaded', (_e, d) => cb(d)),
  onUpdateError:       (cb) => ipcRenderer.on('update:error',      (_e, d) => cb(d)),
  startUpdateDownload: ()   => ipcRenderer.invoke('update:download'),
  installUpdate:       ()   => ipcRenderer.invoke('update:install'),

  // ── Authenticated handlers — userId from session, NOT from args ───────────

  getBootstrap: (_userId) => ipcRenderer.invoke('app:getBootstrap'),

  // Daily logs
  dailyList:         (_userId, workshopId)    => ipcRenderer.invoke('daily:list',         { workshopId }),
  dailyCreate:       (_userId, payload)       => ipcRenderer.invoke('daily:create',        { payload }),
  dailyHarvestData:  (_userId, workshopId)    => ipcRenderer.invoke('daily:harvest-data',  { workshopId }),
  dailyUpdate:       (_userId, logId, payload)=> ipcRenderer.invoke('daily:update',        { logId, payload }),
  dailyDelete:       (_userId, logId, reason) => ipcRenderer.invoke('daily:delete',        { logId, reason }),

  productionStaffList: (_userId) => ipcRenderer.invoke('production:staff-list'),

  // Poles / VAT
  polesPurchaseList:         (_userId, workshopId)                         => ipcRenderer.invoke('poles:purchase-list',    { workshopId }),
  polesPurchaseCreate:       (_userId, payload)                            => ipcRenderer.invoke('poles:purchase-create',  { payload }),
  polesPurchaseApprove:      (_userId, requestId, approve, rejectionReason)=> ipcRenderer.invoke('poles:purchase-approve', { requestId, approve, rejectionReason }),
  polesDeliveryCreate:       (_userId, payload)                            => ipcRenderer.invoke('poles:delivery-create',  { payload }),
  polesDeliveryQualityCheck: (_userId, deliveryId, payload)                => ipcRenderer.invoke('poles:delivery-qc',      { deliveryId, payload }),
  vatInboundList:            (_userId)                                     => ipcRenderer.invoke('vat:inbound-list'),

  // Sales
  salesList:                 (_userId, workshopId)          => ipcRenderer.invoke('sales:list',                  { workshopId }),
  salesCreate:               (_userId, payload)             => ipcRenderer.invoke('sales:create',                 { payload }),
  salesUpdate:               (_userId, orderId, payload)    => ipcRenderer.invoke('sales:update',                 { orderId, payload }),
  salesDelete:               (_userId, orderId, reason)     => ipcRenderer.invoke('sales:delete',                 { orderId, reason }),
  salesUpdateStatus:         (_userId, orderId, status)     => ipcRenderer.invoke('sales:updateStatus',           { orderId, status }),
  salesUpdatePayment:        (_userId, orderId, paymentStatus) => ipcRenderer.invoke('sales:update-payment',      { orderId, paymentStatus }),
  salesProductsForDropdown:  (_userId)                      => ipcRenderer.invoke('sales:products-for-dropdown'),
  salesCloseShort:           (_userId, soId)                => ipcRenderer.invoke('sales:closeShort',             { soId }),

  // Customers
  customersForDropdown: (_userId)                   => ipcRenderer.invoke('customers:for-dropdown'),
  customersList:        (_userId)                   => ipcRenderer.invoke('customers:list'),
  customersCreate:      (_userId, payload)          => ipcRenderer.invoke('customers:create', { payload }),
  customersUpdate:      (_userId, customerId, payload) => ipcRenderer.invoke('customers:update', { customerId, payload }),

  // Products
  productsList:           (_userId, filter)            => ipcRenderer.invoke('products:list',            { filter }),
  productsCreate:         (_userId, payload)           => ipcRenderer.invoke('products:create',          { payload }),
  productsToggle:         (_userId, productId, reason) => ipcRenderer.invoke('products:toggle',          { productId, reason }),
  productsUpdate:         (_userId, productId, payload)=> ipcRenderer.invoke('products:update',          { productId, payload }),
  productsActiveForForm:  (_userId, type)              => ipcRenderer.invoke('products:active-for-form', { type }),
  productsCatalog:        (_userId)                    => ipcRenderer.invoke('products:catalog'),

  // Reports / KPI / Dashboard
  weeklyCost:         (_userId)          => ipcRenderer.invoke('weekly:cost'),
  weeklyExpensesSave: (_userId, payload) => ipcRenderer.invoke('weekly:expenses:save', { payload }),
  weeklyPerf:         (_userId)          => ipcRenderer.invoke('weekly:perf'),
  monthlyDashboard:   (_userId, month)   => ipcRenderer.invoke('monthly:dashboard',    { month }),
  monthlyApprove:     (_userId, monthKey)=> ipcRenderer.invoke('monthly:approve',      { monthKey }),
  dashboardStats:     (_userId)          => ipcRenderer.invoke('dashboard:stats'),
  kpiBudgetsList:     (_userId, month)   => ipcRenderer.invoke('kpi:budgets:list',     { month }),
  kpiBudgetSave:      (_userId, payload) => ipcRenderer.invoke('kpi:budgets:save',     { payload }),
  inventoryList:      (_userId, workshopId) => ipcRenderer.invoke('inventory:list',   { workshopId }),

  // Logistics
  logisticsList:      (_userId)          => ipcRenderer.invoke('logistics:list'),
  logisticsCreate:    (_userId, payload) => ipcRenderer.invoke('logistics:create',    { payload }),
  logisticsUpdate:    (_userId, itemId, payload) => ipcRenderer.invoke('logistics:update', { itemId, payload }),
  logisticsDelete:    (_userId, itemId)  => ipcRenderer.invoke('logistics:delete',    { itemId }),
  logisticsDashboard: (_userId)          => ipcRenderer.invoke('logistics:dashboard'),

  // Audit + Notifications
  auditList:               (_userId, filters)         => ipcRenderer.invoke('audit:list',                { filters }),
  notificationsList:       (_userId, filters = {})    => ipcRenderer.invoke('notifications:list',        { filters }),
  notificationsPoll:       ()                         => ipcRenderer.invoke('notifications:poll'),
  notificationsMarkRead:   (_userId, notificationId)  => ipcRenderer.invoke('notifications:markRead',    { notificationId }),
  notificationsMarkAllRead:(_userId)                  => ipcRenderer.invoke('notifications:markAllRead'),
  secGovDashboard:         (_userId)                  => ipcRenderer.invoke('secgov:dashboard'),
  // Phase 6F — Executive Analytics
  execDashboard:           (_userId)                  => ipcRenderer.invoke('exec:dashboard'),
  execExport:              (_userId, payload)          => ipcRenderer.invoke('exec:export', payload),
  // Phase 7 — Business Intelligence
  biDashboard:             (_userId)                  => ipcRenderer.invoke('bi:dashboard'),
  biExport:                (_userId, payload)          => ipcRenderer.invoke('bi:export', payload),

  // Phase 8 — Intelligent Automation Engine
  automationRules:  (_userId)                        => ipcRenderer.invoke('automation:rules'),
  automationToggle: (_userId, ruleKey, enabled)       => ipcRenderer.invoke('automation:toggle', { ruleKey, enabled }),
  automationLog:    (_userId, filters)               => ipcRenderer.invoke('automation:log', filters),
  automationRun:    (_userId)                        => ipcRenderer.invoke('automation:run'),
  // Phase 8 Part 3 — Rule Engine management
  automationRule:   (_userId, ruleKey)               => ipcRenderer.invoke('automation:rule',   { ruleKey }),
  automationUpdate: (_userId, ruleKey, updates)      => ipcRenderer.invoke('automation:update', { ruleKey, updates }),
  automationDelete: (_userId, ruleKey)               => ipcRenderer.invoke('automation:delete', { ruleKey }),
  automationCreate: (_userId, payload)               => ipcRenderer.invoke('automation:create', payload),
  // Phase 8 Part 4 — Escalation Engine
  escalationList:    (_userId, filters)              => ipcRenderer.invoke('escalation:list',    filters),
  escalationHistory: (_userId, escalationId)         => ipcRenderer.invoke('escalation:history', { escalationId }),
  escalationResolve: (_userId, escalationId, reason) => ipcRenderer.invoke('escalation:resolve', { escalationId, reason }),
  escalationAck:     (_userId, escalationId)         => ipcRenderer.invoke('escalation:ack',     { escalationId }),
  // Phase 8 Part 5/6 — Automation Dashboard + canonical aliases
  automationDashboard: (_userId)                        => ipcRenderer.invoke('automation:dashboard'),
  automationHistory:   (_userId, filters)               => ipcRenderer.invoke('automation:history',    filters),
  automationUpdateRule:(_userId, ruleKey, updates)      => ipcRenderer.invoke('automation:updateRule', { ruleKey, updates }),

  // Change requests
  changesList:   (_userId)                              => ipcRenderer.invoke('changes:list'),
  changesCreate: (_userId, payload)                     => ipcRenderer.invoke('changes:create', { payload }),
  changesReview: (_userId, changeId, status, response)  => ipcRenderer.invoke('changes:review', { changeId, status, response }),

  // User management
  usersList:          (_userId)                             => ipcRenderer.invoke('users:list'),
  usersCreate:        (_userId, payload)                    => ipcRenderer.invoke('users:create',        { payload }),
  usersUpdate:        (_userId, targetUserId, payload)      => ipcRenderer.invoke('users:update',        { targetUserId, payload }),
  usersResetPassword: (_userId, targetUserId, newPassword)  => ipcRenderer.invoke('users:resetPassword', { targetUserId, newPassword }),
  usersDelete:        (_userId, targetUserId)               => ipcRenderer.invoke('users:delete',        { targetUserId }),
  rolesList:          (_userId)                             => ipcRenderer.invoke('roles:list'),
  rolesUpdate:        (_userId, role, payload)              => ipcRenderer.invoke('roles:update',        { role, payload }),

  // Warehouses
  warehousesList:   (_userId, workshopId)            => ipcRenderer.invoke('warehouses:list',   { workshopId }),
  warehousesCreate: (_userId, payload)               => ipcRenderer.invoke('warehouses:create', { payload }),
  warehousesUpdate: (_userId, warehouseId, payload)  => ipcRenderer.invoke('warehouses:update', { warehouseId, payload }),
  warehousesDelete: (_userId, warehouseId)           => ipcRenderer.invoke('warehouses:delete', { warehouseId }),

  // Stock catalog
  stockItemsList:         (_userId, workshopId)       => ipcRenderer.invoke('stock-items:list',         { workshopId }),
  stockItemsCreate:       (_userId, payload)          => ipcRenderer.invoke('stock-items:create',       { payload }),
  stockItemsUpdate:       (_userId, itemId, payload)  => ipcRenderer.invoke('stock-items:update',       { itemId, payload }),
  stockItemsDelete:       (_userId, itemId)           => ipcRenderer.invoke('stock-items:delete',       { itemId }),
  stockCategoriesList:    (_userId)                   => ipcRenderer.invoke('stock-categories:list'),
  stockCategoriesCreate:  (_userId, name)             => ipcRenderer.invoke('stock-categories:create',  { name }),
  stockCategoriesDelete:  (_userId, categoryId)       => ipcRenderer.invoke('stock-categories:delete',  { categoryId }),

  // Stock movements & transfers
  stockMovementsList:       (_userId, workshopId)                    => ipcRenderer.invoke('stock-movements:list',             { workshopId }),
  stockMovementsCreate:     (_userId, payload)                       => ipcRenderer.invoke('stock-movements:create',           { payload }),
  stockMovementsDelete:     (_userId, movementId, reason)            => ipcRenderer.invoke('stock-movements:delete',           { movementId, reason }),
  stockTransferApprove:     (_userId, movementId, action, rejectionReason) => ipcRenderer.invoke('stock-movements:transfer-approve', { movementId, action, rejectionReason }),
  stockTransfersList:       (_userId, workshopId)                    => ipcRenderer.invoke('stock-transfers:list',             { workshopId }),
  stockTransfersCreate:     (_userId, payload)                       => ipcRenderer.invoke('stock-transfers:create',           { payload }),
  stockTransfersApprove:    (_userId, transferId, action, reason)    => ipcRenderer.invoke('stock-transfers:approve',          { transferId, action, reason }),
  stockTransfersDispatch:   (_userId, transferId, payload)           => ipcRenderer.invoke('stock-transfers:dispatch',         { transferId, payload }),
  stockTransfersDispatchHistory: (_userId, transferId)               => ipcRenderer.invoke('stock-transfers:dispatch-history', { transferId }),
  stockTransfersReceive:    (_userId, transferId, qty, notes)        => ipcRenderer.invoke('stock-transfers:receive',          { transferId, qty, notes }),

  // Material requests
  materialRequestsList:    (_userId, workshopId) => ipcRenderer.invoke('material-requests:list',    { workshopId }),
  materialRequestsCreate:  (_userId, payload)    => ipcRenderer.invoke('material-requests:create',  { payload }),
  materialRequestsApprove: (_userId, requestId, action, approvedQty, reviewNotes, sourceWarehouseId) =>
    ipcRenderer.invoke('material-requests:approve', { requestId, action, approvedQty, reviewNotes, sourceWarehouseId }),
  workshopOverview: (_userId) => ipcRenderer.invoke('workshop:overview'),

  // Vehicles
  transportCompaniesDropdown: (_userId)                      => ipcRenderer.invoke('transport-companies:dropdown'),
  vehiclesForTransport:       (_userId)                      => ipcRenderer.invoke('vehicles:for-transport'),
  vehiclesList:               (_userId)                      => ipcRenderer.invoke('vehicles:list'),
  vehiclesCreate:             (_userId, payload)             => ipcRenderer.invoke('vehicles:create', { payload }),
  vehiclesUpdate:             (_userId, vehicleId, payload)  => ipcRenderer.invoke('vehicles:update', { vehicleId, payload }),
  vehiclesDelete:             (_userId, vehicleId)           => ipcRenderer.invoke('vehicles:delete', { vehicleId }),

  // Fuel logs
  fuelLogsList:   (_userId, vehicleId) => ipcRenderer.invoke('fuel-logs:list',   { vehicleId }),
  fuelLogsCreate: (_userId, payload)   => ipcRenderer.invoke('fuel-logs:create', { payload }),
  fuelLogsDelete: (_userId, logId)     => ipcRenderer.invoke('fuel-logs:delete', { logId }),

  // Vehicle maintenance
  maintenanceList:   (_userId, vehicleId)          => ipcRenderer.invoke('maintenance:list',   { vehicleId }),
  maintenanceCreate: (_userId, payload)             => ipcRenderer.invoke('maintenance:create', { payload }),
  maintenanceUpdate: (_userId, recordId, payload)   => ipcRenderer.invoke('maintenance:update', { recordId, payload }),
  maintenanceDelete: (_userId, recordId, reason)    => ipcRenderer.invoke('maintenance:delete', { recordId, reason }),

  // Deliveries
  deliveriesList:       (_userId)                  => ipcRenderer.invoke('deliveries:list'),
  deliveriesCreate:     (_userId, payload)          => ipcRenderer.invoke('deliveries:create',       { payload }),
  deliveriesUpdate:     (_userId, orderId, payload) => ipcRenderer.invoke('deliveries:update',       { orderId, payload }),
  deliveriesDelete:     (_userId, orderId)          => ipcRenderer.invoke('deliveries:delete',       { orderId }),
  deliveriesUpdateStatus: (_userId, orderId, status)=> ipcRenderer.invoke('deliveries:updateStatus', { orderId, status }),
  deliveriesRecordPOD:  (_userId, orderId, payload) => ipcRenderer.invoke('deliveries:recordPOD',    { orderId, payload }),

  // Dispatch
  dispatchList:   (_userId)                              => ipcRenderer.invoke('dispatch:list'),
  dispatchCreate: (_userId, payload)                     => ipcRenderer.invoke('dispatch:create', { payload }),
  dispatchReview: (_userId, requestId, status, notes)    => ipcRenderer.invoke('dispatch:review', { requestId, status, notes }),
  dispatchDelete: (_userId, requestId)                   => ipcRenderer.invoke('dispatch:delete', { requestId }),

  // Harvest
  harvestList:   (_userId, workshopId)      => ipcRenderer.invoke('harvest:list',   { workshopId }),
  harvestCreate: (_userId, payload)         => ipcRenderer.invoke('harvest:create', { payload }),
  harvestUpdate: (_userId, logId, payload)  => ipcRenderer.invoke('harvest:update', { logId, payload }),
  harvestDelete: (_userId, logId, reason)   => ipcRenderer.invoke('harvest:delete', { logId, reason }),

  // Timber inventory
  timberInventoryList: (_userId) => ipcRenderer.invoke('timber-inventory:list'),

  // Third-party transport
  transportCompaniesList:   (_userId)                         => ipcRenderer.invoke('transport:companies:list'),
  transportCompaniesCreate: (_userId, payload)                => ipcRenderer.invoke('transport:companies:create', { payload }),
  transportCompaniesUpdate: (_userId, companyId, payload)     => ipcRenderer.invoke('transport:companies:update', { companyId, payload }),
  transportCompaniesDelete: (_userId, companyId)              => ipcRenderer.invoke('transport:companies:delete', { companyId }),
  transportJobsList:        (_userId)                         => ipcRenderer.invoke('transport:jobs:list'),
  transportJobsCreate:      (_userId, payload)                => ipcRenderer.invoke('transport:jobs:create',      { payload }),
  transportJobsUpdate:      (_userId, jobId, payload)         => ipcRenderer.invoke('transport:jobs:update',      { jobId, payload }),
  transportJobsDelete:      (_userId, jobId)                  => ipcRenderer.invoke('transport:jobs:delete',      { jobId }),
  transportJobsUpdateStatus:(_userId, jobId, status)          => ipcRenderer.invoke('transport:jobs:updateStatus',{ jobId, status }),

  // Pending edit approvals
  pendingEditsList:   (_userId)                                   => ipcRenderer.invoke('pending-edits:list'),
  pendingEditsCreate: (_userId, payload)                          => ipcRenderer.invoke('pending-edits:create', { payload }),
  pendingEditsReview: (_userId, pendingId, status, reviewNotes)   => ipcRenderer.invoke('pending-edits:review', { pendingId, status, reviewNotes }),

  // Unified approval engine (Step 3)
  approvalsProcess:   (_userId, requestType, requestId, decision, notes) =>
    ipcRenderer.invoke('approvals:process',   { requestType, requestId, decision, notes }),
  approvalsDashboard: (_userId) => ipcRenderer.invoke('approvals:dashboard'),

  // Machine Management
  machineCategoriesList:   (_userId)                              => ipcRenderer.invoke('machines:categories:list'),
  machineCategoriesCreate: (_userId, payload)                     => ipcRenderer.invoke('machines:categories:create', { payload }),
  machineCategoriesUpdate: (_userId, categoryId, payload)         => ipcRenderer.invoke('machines:categories:update', { categoryId, payload }),
  machineCategoriesDelete: (_userId, categoryId)                  => ipcRenderer.invoke('machines:categories:delete', { categoryId }),
  machinesList:            (_userId)                              => ipcRenderer.invoke('machines:list'),
  machinesCreate:          (_userId, payload)                     => ipcRenderer.invoke('machines:create',            { payload }),
  machinesUpdate:          (_userId, machineId, payload)          => ipcRenderer.invoke('machines:update',            { machineId, payload }),
  machinesDelete:          (_userId, machineId)                   => ipcRenderer.invoke('machines:delete',            { machineId }),
  machinesForDropdown:     (_userId)                              => ipcRenderer.invoke('machines:for-dropdown'),

  // Machine Log Item Categories
  machineLogCatsList:   (_userId)          => ipcRenderer.invoke('machine-log-cats:list'),
  machineLogCatsCreate: (_userId, payload) => ipcRenderer.invoke('machine-log-cats:create', { payload }),
  machineLogCatsDelete: (_userId, id)      => ipcRenderer.invoke('machine-log-cats:delete', { id }),

  // Machine Daily Logs
  machineLogsList:        (_userId, machineId, month, workshopId) => ipcRenderer.invoke('machine-logs:list',       { machineId, month, workshopId }),
  machineLogsCreate:      (_userId, payload)                       => ipcRenderer.invoke('machine-logs:create',     { payload }),
  machineLogsUpdate:      (_userId, logId, payload)                => ipcRenderer.invoke('machine-logs:update',     { logId, payload }),
  machineLogsDelete:      (_userId, logId, reason)                 => ipcRenderer.invoke('machine-logs:delete',     { logId, reason }),
  machineFuelIssuedLookup:(_userId, machineId, logDate)            => ipcRenderer.invoke('machine-logs:fuel-issued',{ machineId, logDate }),

  // Machine KPI
  machineKpiDefinitionsList:   (_userId)                    => ipcRenderer.invoke('machine-kpi:definitions:list'),
  machineKpiDefinitionsCreate: (_userId, payload)           => ipcRenderer.invoke('machine-kpi:definitions:create', { payload }),
  machineKpiDefinitionsUpdate: (_userId, kpiId, payload)    => ipcRenderer.invoke('machine-kpi:definitions:update', { kpiId, payload }),
  machineKpiDefinitionsDelete: (_userId, kpiId)             => ipcRenderer.invoke('machine-kpi:definitions:delete', { kpiId }),
  machineKpiTargetsList:       (_userId, machineId, month)  => ipcRenderer.invoke('machine-kpi:targets:list',       { machineId, month }),
  machineKpiTargetsSave:       (_userId, payload)           => ipcRenderer.invoke('machine-kpi:targets:save',       { payload }),
  machineKpiPerformance:       (_userId, month)             => ipcRenderer.invoke('machine-kpi:performance',        { month }),

  // Machine Maintenance Schedules
  machineMaintList:   (_userId, machineId)         => ipcRenderer.invoke('machine-maint:list',   { machineId }),
  machineMaintCreate: (_userId, payload)            => ipcRenderer.invoke('machine-maint:create', { payload }),
  machineMaintUpdate: (_userId, schedId, payload)   => ipcRenderer.invoke('machine-maint:update', { schedId, payload }),
  machineMaintDelete: (_userId, schedId)            => ipcRenderer.invoke('machine-maint:delete', { schedId }),

  // Compartments
  compartmentsList:        (_userId)                       => ipcRenderer.invoke('compartments:list'),
  compartmentsCreate:      (_userId, payload)              => ipcRenderer.invoke('compartments:create',      { payload }),
  compartmentsUpdate:      (_userId, comptId, payload)     => ipcRenderer.invoke('compartments:update',      { comptId, payload }),
  compartmentsDelete:      (_userId, comptId, reason)      => ipcRenderer.invoke('compartments:delete',      { comptId, reason }),
  compartmentsForDropdown: (_userId)                       => ipcRenderer.invoke('compartments:for-dropdown'),

  // Log Transport
  logTransportList:   (_userId, workshopId)     => ipcRenderer.invoke('log-transport:list',   { workshopId }),
  logTransportCreate: (_userId, payload)         => ipcRenderer.invoke('log-transport:create', { payload }),
  logTransportUpdate: (_userId, id, payload)     => ipcRenderer.invoke('log-transport:update', { id, payload }),
  logTransportDelete: (_userId, id, reason)      => ipcRenderer.invoke('log-transport:delete', { id, reason }),

  // Value-Added Timber
  valueAddedTimberList:   (_userId, workshopId) => ipcRenderer.invoke('value-added-timber:list',   { workshopId }),
  valueAddedTimberCreate: (_userId, payload)    => ipcRenderer.invoke('value-added-timber:create', { payload }),
  valueAddedTimberUpdate: (_userId, id, payload)=> ipcRenderer.invoke('value-added-timber:update', { id, payload }),
  valueAddedTimberDelete: (_userId, id, reason) => ipcRenderer.invoke('value-added-timber:delete', { id, reason }),

  // Machine Fuel Logs
  machineFuelDropdown:    (_userId)              => ipcRenderer.invoke('machine-fuel:dropdown'),
  machineFuelSummary:     (_userId, month)       => ipcRenderer.invoke('machine-fuel:summary', { month }),
  machineFuelLogsList:    (_userId)              => ipcRenderer.invoke('machine-fuel:list'),
  machineFuelLogsCreate:  (_userId, payload)     => ipcRenderer.invoke('machine-fuel:create',  { payload }),
  machineFuelLogsUpdate:  (_userId, id, payload) => ipcRenderer.invoke('machine-fuel:update',  { id, payload }),
  machineFuelLogsDelete:  (_userId, id, reason)  => ipcRenderer.invoke('machine-fuel:delete',  { id, reason }),

  // Casual Labour Requests
  casualLabourRequestsList:   (_userId, workshopId)          => ipcRenderer.invoke('casual-requests:list',   { workshopId }),
  casualLabourRequestsCreate: (_userId, payload)             => ipcRenderer.invoke('casual-requests:create', { payload }),
  casualLabourRequestsSubmit: (_userId, payload)             => ipcRenderer.invoke('casual-requests:submit', { payload }),
  casualLabourRequestsReview: (_userId, requestId, status)   => ipcRenderer.invoke('casual-requests:review', { requestId, status }),
  casualLabourRequestsDelete: (_userId, id)                  => ipcRenderer.invoke('casual-requests:delete', { id }),

  // Casuals
  casualsList:   (_userId, workshopId)         => ipcRenderer.invoke('casuals:list',   { workshopId }),
  casualsCreate: (_userId, payload)            => ipcRenderer.invoke('casuals:create', { payload }),
  casualsUpdate: (_userId, casualId, payload)  => ipcRenderer.invoke('casuals:update', { casualId, payload }),
  casualsDelete: (_userId, casualId)           => ipcRenderer.invoke('casuals:delete', { casualId }),

  ceoOverview: (_userId) => ipcRenderer.invoke('ceo:overview'),

  // Deletion request workflow
  deletionRequestCreate:  (_userId, tableName, recordId, entityType, entityRef, reason) =>
    ipcRenderer.invoke('deletion-requests:create', { tableName, recordId, entityType, entityRef, reason }),
  deletionRequestsList:   (_userId)                => ipcRenderer.invoke('deletion-requests:list'),
  deletionRequestApprove: (_userId, requestId, notes) => ipcRenderer.invoke('deletion-requests:approve', { requestId, notes }),
  deletionRequestReject:  (_userId, requestId, notes) => ipcRenderer.invoke('deletion-requests:reject',  { requestId, notes }),

  // Trash (soft-deleted records)
  trashList:    (_userId)                          => ipcRenderer.invoke('trash:list'),
  trashRestore: (_userId, tableName, recordId)     => ipcRenderer.invoke('trash:restore', { tableName, recordId }),
  trashPurge:   (_userId, tableName, recordId)     => ipcRenderer.invoke('trash:purge',   { tableName, recordId }),

  // Phase 9 — Enterprise Performance Management
  performanceDashboard:   (_userId)               => ipcRenderer.invoke('performance:dashboard'),
  performanceKPIs:        (_userId)               => ipcRenderer.invoke('performance:kpis'),
  departmentScorecards:   (_userId)               => ipcRenderer.invoke('performance:departments'),
  executiveScorecard:     (_userId)               => ipcRenderer.invoke('performance:executive'),
  performanceTrends:      (_userId)               => ipcRenderer.invoke('performance:trends'),
  performanceActionPlans: (_userId)               => ipcRenderer.invoke('performance:plans'),
  performanceExport:      (_userId, csv, filename) => ipcRenderer.invoke('performance:export', { csv, filename }),
});
