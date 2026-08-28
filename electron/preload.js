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
  dailyList:         (_userId, workshopId, filters) => ipcRenderer.invoke('daily:list',    { workshopId, filters }),
  dailyCreate:       (_userId, payload)       => ipcRenderer.invoke('daily:create',        { payload }),
  dailyHarvestData:  (_userId, workshopId)    => ipcRenderer.invoke('daily:harvest-data',  { workshopId }),
  dailyUpdate:       (_userId, logId, payload)=> ipcRenderer.invoke('daily:update',        { logId, payload }),
  dailyDelete:       (_userId, logId, reason) => ipcRenderer.invoke('daily:delete',        { logId, reason }),
  sawmillDashboard:  (_userId, workshopId) => ipcRenderer.invoke('sawmill:dashboard',       { workshopId }),

  productionStaffList: (_userId) => ipcRenderer.invoke('production:staff-list'),

  // Poles / VAT
  polesPurchaseList:         (_userId, workshopId)                         => ipcRenderer.invoke('poles:purchase-list',    { workshopId }),
  polesPurchaseCreate:       (_userId, payload)                            => ipcRenderer.invoke('poles:purchase-create',  { payload }),
  polesPurchaseApprove:      (_userId, requestId, approve, rejectionReason)=> ipcRenderer.invoke('poles:purchase-approve', { requestId, approve, rejectionReason }),
  polesDeliveryCreate:       (_userId, payload)                            => ipcRenderer.invoke('poles:delivery-create',  { payload }),
  polesDeliveryQualityCheck: (_userId, deliveryId, payload)                => ipcRenderer.invoke('poles:delivery-qc',      { deliveryId, payload }),
  // Pole Production Phase 1
  poleProductionBatchesList:      (_userId, workshopId)          => ipcRenderer.invoke('poles:production-list',           { workshopId }),
  poleProductionBatchCreate:      (_userId, payload)              => ipcRenderer.invoke('poles:production-create',         { payload }),
  poleProductionBatchDelete:      (_userId, batchId, reason)      => ipcRenderer.invoke('poles:production-delete',         { batchId, reason }),
  poleProductionInspect:          (_userId, outputId, payload)    => ipcRenderer.invoke('poles:production-inspect',        { outputId, payload }),
  poleProductionReconciliation:   (_userId, workshopId)           => ipcRenderer.invoke('poles:production-reconciliation', { workshopId }),
  // Pole Production Phase 2 — Purchased Finished Poles
  procurementGoodsReceiptPendingPoleQC: (_userId, workshopId)              => ipcRenderer.invoke('poles:purchased-pending-qc', { workshopId }),
  procurementGoodsReceiptInspect:       (_userId, receiptItemId, payload) => ipcRenderer.invoke('poles:purchased-inspect',    { receiptItemId, payload }),
  polesSourceReport:                    (_userId, workshopId)              => ipcRenderer.invoke('poles:source-report',       { workshopId }),
  valueAddedProductionAvailableInputs: (_userId, workshopId)                => ipcRenderer.invoke('vat:available-inputs', { workshopId }),

  // Sales
  salesList:                 (_userId, opts)                => ipcRenderer.invoke('sales:list',                  opts || {}),
  salesGet:                  (_userId, orderId)              => ipcRenderer.invoke('sales:get',                   { orderId }),
  salesExportExcel:          (_userId, opts)                => ipcRenderer.invoke('sales:exportExcel',            opts || {}),
  salesCreate:               (_userId, payload)             => ipcRenderer.invoke('sales:create',                 { payload }),
  salesUpdate:               (_userId, orderId, payload)    => ipcRenderer.invoke('sales:update',                 { orderId, payload }),
  salesDelete:               (_userId, orderId, reason)     => ipcRenderer.invoke('sales:delete',                 { orderId, reason }),
  salesUpdateStatus:         (_userId, orderId, status)     => ipcRenderer.invoke('sales:updateStatus',           { orderId, status }),
  salesUpdatePayment:        (_userId, orderId, paymentStatus) => ipcRenderer.invoke('sales:update-payment',      { orderId, paymentStatus }),
  salesProductsForDropdown:  (_userId)                      => ipcRenderer.invoke('sales:products-for-dropdown'),
  salesCloseShort:           (_userId, soId)                => ipcRenderer.invoke('sales:closeShort',             { soId }),
  salesDashboard:            (_userId, workshopId)          => ipcRenderer.invoke('sales:dashboard',              { workshopId }),
  salesReport:               (_userId, filters)             => ipcRenderer.invoke('sales:report',                 { filters }),

  // Customers
  customersForDropdown: (_userId)                   => ipcRenderer.invoke('customers:for-dropdown'),
  customersList:        (_userId)                   => ipcRenderer.invoke('customers:list'),
  customersCreate:      (_userId, payload)          => ipcRenderer.invoke('customers:create', { payload }),
  customersUpdate:      (_userId, customerId, payload) => ipcRenderer.invoke('customers:update', { customerId, payload }),
  customersToggle:      (_userId, customerId, reason)  => ipcRenderer.invoke('customers:toggle', { customerId, reason }),
  customersOrders:      (_userId, customerId)          => ipcRenderer.invoke('customers:orders', { customerId }),

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
  inventoryDashboard: (_userId, workshopId) => ipcRenderer.invoke('inventory:dashboard', { workshopId }),
  inventoryIntelligence: (_userId, workshopId) => ipcRenderer.invoke('inventory:intelligence', { workshopId }),

  // Logistics
  logisticsList:      (_userId)          => ipcRenderer.invoke('logistics:list'),
  logisticsCreate:    (_userId, payload) => ipcRenderer.invoke('logistics:create',    { payload }),
  logisticsUpdate:    (_userId, itemId, payload) => ipcRenderer.invoke('logistics:update', { itemId, payload }),
  logisticsDelete:    (_userId, itemId)  => ipcRenderer.invoke('logistics:delete',    { itemId }),
  logisticsDashboard: (_userId)          => ipcRenderer.invoke('logistics:dashboard'),
  logisticsExportExcel: (_userId, listType, filters) => ipcRenderer.invoke('logistics:export-excel', { listType, filters }),
  logisticsRecordHistory: (_userId, module, recordId) => ipcRenderer.invoke('logistics:record-history', { module, recordId }),

  // Audit + Notifications
  auditList:               (_userId, filters)         => ipcRenderer.invoke('audit:list',                { filters }),
  auditExportExcel:        (_userId, filters)         => ipcRenderer.invoke('audit:exportExcel',          { filters }),
  notificationsList:       (_userId, filters = {})    => ipcRenderer.invoke('notifications:list',        { filters }),
  notificationsPoll:       ()                         => ipcRenderer.invoke('notifications:poll'),
  notificationsMarkRead:   (_userId, notificationId)  => ipcRenderer.invoke('notifications:markRead',    { notificationId }),
  notificationsMarkAllRead:(_userId)                  => ipcRenderer.invoke('notifications:markAllRead'),

  // Global Search
  globalSearch: (_userId, filters = {}) => ipcRenderer.invoke('search:query', { filters }),
  secGovDashboard:         (_userId)                  => ipcRenderer.invoke('secgov:dashboard'),
  // Phase 6F — Executive Analytics
  execDashboard:           (_userId)                  => ipcRenderer.invoke('exec:dashboard'),
  execExportExcel:         (_userId)                  => ipcRenderer.invoke('exec:exportExcel'),
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
  workshopsForDropdown: (_userId)                    => ipcRenderer.invoke('warehouses:for-dropdown'),

  // Stock catalog
  stockItemsList:         (_userId, workshopId)       => ipcRenderer.invoke('stock-items:list',         { workshopId }),
  stockItemsCreate:       (_userId, payload)          => ipcRenderer.invoke('stock-items:create',       { payload }),
  stockItemsUpdate:       (_userId, itemId, payload)  => ipcRenderer.invoke('stock-items:update',       { itemId, payload }),
  // ERP Remaining Departments Completion Program — same reason-dropping bug
  // as deliveriesDelete: `reason` was never forwarded through this bridge,
  // the IPC handler, or the desktop caller, so every stock-item deletion
  // recorded a blank reason in the deletion-request/audit trail.
  stockItemsDelete:       (_userId, itemId, reason)  => ipcRenderer.invoke('stock-items:delete',       { itemId, reason }),
  stockItemsForDropdown:  (_userId)                   => ipcRenderer.invoke('stock-items:for-dropdown'),
  stockCategoriesList:    (_userId)                   => ipcRenderer.invoke('stock-categories:list'),
  stockCategoriesCreate:  (_userId, name)             => ipcRenderer.invoke('stock-categories:create',  { name }),
  stockCategoriesDelete:  (_userId, categoryId)       => ipcRenderer.invoke('stock-categories:delete',  { categoryId }),

  // Stock movements & transfers
  stockMovementsList:       (_userId, workshopId)                    => ipcRenderer.invoke('stock-movements:list',             { workshopId }),
  stockMovementsCreate:     (_userId, payload)                       => ipcRenderer.invoke('stock-movements:create',           { payload }),
  stockAdjustmentRequestCreate: (_userId, payload)                   => ipcRenderer.invoke('stock-movements:adjustment-request', { payload }),
  stockMovementsDelete:     (_userId, movementId, reason)            => ipcRenderer.invoke('stock-movements:delete',           { movementId, reason }),
  stockTransferApprove:     (_userId, movementId, action, rejectionReason) => ipcRenderer.invoke('stock-movements:transfer-approve', { movementId, action, rejectionReason }),
  inventoryLossReports:     (_userId, filters)                       => ipcRenderer.invoke('inventory:loss-reports',           { filters }),
  stockTransfersList:       (_userId, workshopId)                    => ipcRenderer.invoke('stock-transfers:list',             { workshopId }),
  stockTransfersCreate:     (_userId, payload)                       => ipcRenderer.invoke('stock-transfers:create',           { payload }),
  stockTransfersApprove:    (_userId, transferId, action, reason)    => ipcRenderer.invoke('stock-transfers:approve',          { transferId, action, reason }),
  stockTransfersDispatch:   (_userId, transferId, payload)           => ipcRenderer.invoke('stock-transfers:dispatch',         { transferId, payload }),
  stockTransfersDispatchHistory: (_userId, transferId)               => ipcRenderer.invoke('stock-transfers:dispatch-history', { transferId }),
  stockTransfersReceive:    (_userId, transferId, qty, notes)        => ipcRenderer.invoke('stock-transfers:receive',          { transferId, qty, notes }),
  stockTransfersReportDiscrepancy: (_userId, transferId, notes, lossReason) => ipcRenderer.invoke('stock-transfers:report-discrepancy', { transferId, notes, lossReason }),

  // Material requests
  materialRequestsList:    (_userId, workshopId) => ipcRenderer.invoke('material-requests:list',    { workshopId }),
  materialRequestsCreate:  (_userId, payload)    => ipcRenderer.invoke('material-requests:create',  { payload }),
  materialRequestsApprove: (_userId, requestId, action, approvedQty, reviewNotes, sourceWarehouseId, destinationWorkshopId) =>
    ipcRenderer.invoke('material-requests:approve', { requestId, action, approvedQty, reviewNotes, sourceWarehouseId, destinationWorkshopId }),
  mechanicianDashboard: (_userId) => ipcRenderer.invoke('mechanician:dashboard'),
  workshopOverview: (_userId) => ipcRenderer.invoke('workshop:overview'),

  // Vehicles
  transportCompaniesDropdown: (_userId)                      => ipcRenderer.invoke('transport-companies:dropdown'),
  fleetDashboard:             (_userId)                      => ipcRenderer.invoke('fleet:dashboard'),
  fleetIntelligence:          (_userId)                      => ipcRenderer.invoke('fleet:intelligence'),
  vehiclesForTransport:       (_userId)                      => ipcRenderer.invoke('vehicles:for-transport'),
  vehiclesList:               (_userId)                      => ipcRenderer.invoke('vehicles:list'),
  vehiclesCreate:             (_userId, payload)             => ipcRenderer.invoke('vehicles:create', { payload }),
  vehiclesUpdate:             (_userId, vehicleId, payload)  => ipcRenderer.invoke('vehicles:update', { vehicleId, payload }),
  vehiclesDelete:             (_userId, vehicleId, reason)   => ipcRenderer.invoke('vehicles:delete', { vehicleId, reason }),

  // Fuel logs
  fuelLogsList:   (_userId, vehicleId) => ipcRenderer.invoke('fuel-logs:list',   { vehicleId }),
  fuelLogsCreate: (_userId, payload)   => ipcRenderer.invoke('fuel-logs:create', { payload }),
  fuelLogsDelete: (_userId, logId, reason) => ipcRenderer.invoke('fuel-logs:delete', { logId, reason }),

  // Vehicle maintenance
  maintenanceList:   (_userId, vehicleId)          => ipcRenderer.invoke('maintenance:list',   { vehicleId }),
  maintenanceCreate: (_userId, payload)             => ipcRenderer.invoke('maintenance:create', { payload }),
  maintenanceUpdate: (_userId, recordId, payload)   => ipcRenderer.invoke('maintenance:update', { recordId, payload }),
  maintenanceDelete: (_userId, recordId, reason)    => ipcRenderer.invoke('maintenance:delete', { recordId, reason }),

  // Deliveries
  deliveriesList:       (_userId)                  => ipcRenderer.invoke('deliveries:list'),
  deliveriesCreate:     (_userId, payload)          => ipcRenderer.invoke('deliveries:create',       { payload }),
  deliveriesUpdate:     (_userId, orderId, payload) => ipcRenderer.invoke('deliveries:update',       { orderId, payload }),
  // ERP Remaining Departments Completion Program — `reason` was silently
  // dropped end-to-end (this bridge, the IPC handler, and the desktop caller
  // all omitted it), so every desktop delivery-order deletion recorded a
  // blank deletion_reason despite the backend fully supporting one (mobile
  // was already correctly wired). Mirrors salesDelete's own signature.
  deliveriesDelete:     (_userId, orderId, reason)  => ipcRenderer.invoke('deliveries:delete',       { orderId, reason }),
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
  harvestDashboard: (_userId, workshopId)   => ipcRenderer.invoke('harvest:dashboard', { workshopId }),

  // Enterprise Timber Lifecycle Integration Program — Phase 1
  harvestWasteCategories:      () => ipcRenderer.invoke('harvest-waste:categories'),
  harvestWasteCategoryCreate:  (_userId, name) => ipcRenderer.invoke('harvest-waste:category-create', { name }),
  harvestWasteList:            (_userId, workshopId) => ipcRenderer.invoke('harvest-waste:list', { workshopId }),
  harvestWasteCreate:          (_userId, payload) => ipcRenderer.invoke('harvest-waste:create', { payload }),
  resolutionsList:             (_userId, sourceType) => ipcRenderer.invoke('resolutions:list', { sourceType }),
  resolutionCreate:            (_userId, payload) => ipcRenderer.invoke('resolutions:create', { payload }),
  productionOffcutsList:       (_userId, workshopId, status) => ipcRenderer.invoke('production-offcuts:list', { workshopId, status }),
  productionOffcutCreate:      (_userId, payload) => ipcRenderer.invoke('production-offcuts:create', { payload }),
  productionOffcutDecide:      (_userId, offcutId, recoverable) => ipcRenderer.invoke('production-offcuts:decide', { offcutId, recoverable }),
  productionOffcutRecordRecovery: (_userId, offcutId, payload) => ipcRenderer.invoke('production-offcuts:recovery', { offcutId, payload }),
  qualityInspectionCreate:     (_userId, offcutId, payload) => ipcRenderer.invoke('production-offcuts:inspect', { offcutId, payload }),
  productionReconciliation:    (_userId, workshopId) => ipcRenderer.invoke('production-offcuts:reconciliation', { workshopId }),

  // Timber Lifecycle Phase 2
  rejectionHoldsList:      (_userId, status, sourceType) => ipcRenderer.invoke('rejection-holds:list', { status, sourceType }),
  rejectionResolveRework:  (_userId, holdId) => ipcRenderer.invoke('rejection-holds:rework', { holdId }),
  rejectionResolveDowngrade: (_userId, holdId, payload) => ipcRenderer.invoke('rejection-holds:downgrade', { holdId, payload }),
  rejectionResolveReturn: (_userId, holdId, payload) => ipcRenderer.invoke('rejection-holds:return', { holdId, payload }),
  qualityReport: (_userId, workshopId) => ipcRenderer.invoke('rejection-holds:quality-report', { workshopId }),

  // Timber Lifecycle Phase 3
  showroomDamageList:   (_userId, status) => ipcRenderer.invoke('showroom-damage:list', { status }),
  showroomDamageCreate: (_userId, payload) => ipcRenderer.invoke('showroom-damage:create', { payload }),
  showroomInventoryList: (_userId) => ipcRenderer.invoke('showroom:inventory'),
  attachmentsList:      (_userId, entityType, entityId) => ipcRenderer.invoke('attachments:list', { entityType, entityId }),
  attachmentsUpload:    (_userId, entityType, entityId, filePath) => ipcRenderer.invoke('attachments:upload', { entityType, entityId, filePath }),
  attachmentsDownload:  (_userId, attachmentId, defaultFilename) => ipcRenderer.invoke('attachments:download', { attachmentId, defaultFilename }),
  attachmentsDelete:    (_userId, attachmentId) => ipcRenderer.invoke('attachments:delete', { attachmentId }),
  // Harvesting Phase 2 (Workstream 1) — Harvest Planning
  harvestPlanList:   (_userId, workshopId)         => ipcRenderer.invoke('harvest:plan-list',   { workshopId }),
  harvestPlanCreate: (_userId, payload)            => ipcRenderer.invoke('harvest:plan-create', { payload }),
  harvestPlanUpdate: (_userId, planId, payload)    => ipcRenderer.invoke('harvest:plan-update', { planId, payload }),
  harvestPlanDelete: (_userId, planId, reason)     => ipcRenderer.invoke('harvest:plan-delete', { planId, reason }),
  // Harvesting Phase 3 (Workstreams 1-3)
  harvestOperations:  (_userId)                  => ipcRenderer.invoke('harvest:operations'),
  harvestPerformance: (_userId, workshopId)      => ipcRenderer.invoke('harvest:performance', { workshopId }),
  harvestDelayList:   (_userId, workshopId)      => ipcRenderer.invoke('harvest:delay-list', { workshopId }),
  harvestDelayCreate: (_userId, payload)         => ipcRenderer.invoke('harvest:delay-create', { payload }),
  // Harvesting Phase 4 (Workstreams 2-3)
  harvestDecisionSupport: (_userId, workshopId) => ipcRenderer.invoke('harvest:decision-support', { workshopId }),
  harvestExecutiveExtras: (_userId, workshopId) => ipcRenderer.invoke('harvest:executive-extras', { workshopId }),

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
  machineMaintListAll: (_userId, workshopId)        => ipcRenderer.invoke('machine-maint:list-all', { workshopId }),
  machineMaintList:   (_userId, machineId)         => ipcRenderer.invoke('machine-maint:list',   { machineId }),
  machineMaintCreate: (_userId, payload)            => ipcRenderer.invoke('machine-maint:create', { payload }),
  machineMaintUpdate: (_userId, schedId, payload)   => ipcRenderer.invoke('machine-maint:update', { schedId, payload }),
  machineMaintDelete: (_userId, schedId)            => ipcRenderer.invoke('machine-maint:delete', { schedId }),

  // Maintenance Jobs (Mechanician Phase 3)
  maintenanceJobsList:       (_userId, filters)              => ipcRenderer.invoke('maintenance-jobs:list', { filters }),
  maintenanceJobDetail:      (_userId, jobId)                => ipcRenderer.invoke('maintenance-jobs:detail', { jobId }),
  maintenanceJobCreate:      (_userId, payload)               => ipcRenderer.invoke('maintenance-jobs:create', { payload }),
  maintenanceJobAssign:      (_userId, jobId, technicianId)  => ipcRenderer.invoke('maintenance-jobs:assign', { jobId, technicianId }),
  maintenanceJobTransition:  (_userId, jobId, action, payload) => ipcRenderer.invoke('maintenance-jobs:transition', { jobId, action, payload }),
  maintenanceJobLabourAdd:   (_userId, jobId, payload)        => ipcRenderer.invoke('maintenance-jobs:labour-add', { jobId, payload }),
  maintenanceImpactAdd:      (_userId, payload)               => ipcRenderer.invoke('maintenance-jobs:impact-add', { payload }),
  maintenanceOfficerDashboard: (_userId)                      => ipcRenderer.invoke('maintenance-jobs:officer-dashboard'),
  maintenanceReports:        (_userId, filters)               => ipcRenderer.invoke('maintenance-jobs:reports', { filters }),
  maintenanceAssetSummary:   (_userId, machineId)             => ipcRenderer.invoke('maintenance-jobs:asset-summary', { machineId }),
  maintenanceWaitingParts:   (_userId)                        => ipcRenderer.invoke('maintenance-jobs:waiting-parts'),

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

  // Nyanza Value-Added Production
  valueAddedProductionList:   (_userId, workshopId) => ipcRenderer.invoke('value-added-production:list',   { workshopId }),
  valueAddedProductionCreate: (_userId, payload)    => ipcRenderer.invoke('value-added-production:create', { payload }),
  valueAddedProductionUpdate: (_userId, id, payload)=> ipcRenderer.invoke('value-added-production:update', { id, payload }),
  valueAddedProductionDelete: (_userId, id, reason) => ipcRenderer.invoke('value-added-production:delete', { id, reason }),
  valueAddedProductionInspect: (_userId, outputId, payload) => ipcRenderer.invoke('value-added-production:inspect', { outputId, payload }),
  valueAddedProductionReconciliation: (_userId, workshopId) => ipcRenderer.invoke('value-added-production:reconciliation', { workshopId }),
  valueAddedProductionReport: (_userId, workshopId) => ipcRenderer.invoke('value-added-production:report', { workshopId }),

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

  // HR Enterprise Phase 2 — Attendance
  attendanceRoster:    (_userId, workshopId, date)         => ipcRenderer.invoke('attendance:roster',    { workshopId, date }),
  attendanceMark:      (_userId, payload)                  => ipcRenderer.invoke('attendance:mark',      { payload }),
  attendanceList:      (_userId, filters)                  => ipcRenderer.invoke('attendance:list',      { filters }),
  attendanceUpdate:    (_userId, attendanceId, payload)    => ipcRenderer.invoke('attendance:update',    { attendanceId, payload }),
  attendanceDelete:    (_userId, attendanceId, reason)     => ipcRenderer.invoke('attendance:delete',    { attendanceId, reason }),
  attendanceDashboard: (_userId, workshopId)               => ipcRenderer.invoke('attendance:dashboard', { workshopId }),
  attendanceReport:    (_userId, filters)                  => ipcRenderer.invoke('attendance:report',    { filters }),

  // Payroll Enterprise Phase 2
  payrollRateSet:                (_userId, payload)              => ipcRenderer.invoke('payroll:rateSet', { payload }),
  payrollRatesList:               (_userId, workshopId)            => ipcRenderer.invoke('payroll:ratesList', { workshopId }),
  payrollRateHistory:             (_userId, personType, personId)  => ipcRenderer.invoke('payroll:rateHistory', { personType, personId }),
  payrollPeriodCreate:            (_userId, payload)                => ipcRenderer.invoke('payroll:periodCreate', { payload }),
  payrollPeriodList:              (_userId, filters)                => ipcRenderer.invoke('payroll:periodList', { filters }),
  payrollPeriodDetail:            (_userId, periodId)               => ipcRenderer.invoke('payroll:periodDetail', { periodId }),
  payrollPeriodUpdate:            (_userId, periodId, payload)      => ipcRenderer.invoke('payroll:periodUpdate', { periodId, payload }),
  payrollPeriodDelete:            (_userId, periodId, reason)       => ipcRenderer.invoke('payroll:periodDelete', { periodId, reason }),
  payrollPeriodCalculate:         (_userId, periodId)               => ipcRenderer.invoke('payroll:periodCalculate', { periodId }),
  payrollPeriodSubmit:            (_userId, periodId)               => ipcRenderer.invoke('payroll:periodSubmit', { periodId }),
  payrollPeriodMarkExported:      (_userId, periodId)               => ipcRenderer.invoke('payroll:periodMarkExported', { periodId }),
  payrollPeriodClose:             (_userId, periodId)               => ipcRenderer.invoke('payroll:periodClose', { periodId }),
  payrollLineList:                (_userId, periodId, options)      => ipcRenderer.invoke('payroll:lineList', { periodId, options }),
  payrollLineDetail:              (_userId, lineId)                 => ipcRenderer.invoke('payroll:lineDetail', { lineId }),
  payrollLineRecalculate:         (_userId, lineId)                 => ipcRenderer.invoke('payroll:lineRecalculate', { lineId }),
  payrollLineUpdateSourceQty:     (_userId, lineId, sourceQty, reason) => ipcRenderer.invoke('payroll:lineUpdateSourceQty', { lineId, sourceQty, reason }),
  payrollAdjustmentCreate:        (_userId, lineId, payload)        => ipcRenderer.invoke('payroll:adjustmentCreate', { lineId, payload }),
  payrollAdjustmentList:          (_userId, lineId)                 => ipcRenderer.invoke('payroll:adjustmentList', { lineId }),
  payrollAdjustmentApprove:       (_userId, adjustmentId, notes)    => ipcRenderer.invoke('payroll:adjustmentApprove', { adjustmentId, notes }),
  payrollAdjustmentReject:        (_userId, adjustmentId, notes)    => ipcRenderer.invoke('payroll:adjustmentReject', { adjustmentId, notes }),
  payrollSummaryReport:           (_userId, periodId)               => ipcRenderer.invoke('payroll:summaryReport', { periodId }),
  payrollAttendanceReconciliation:(_userId, periodId)               => ipcRenderer.invoke('payroll:attendanceReconciliation', { periodId }),
  payrollCasualCostSummary:       (_userId, periodId)               => ipcRenderer.invoke('payroll:casualCostSummary', { periodId }),
  payrollAdjustmentsReport:       (_userId, periodId)               => ipcRenderer.invoke('payroll:adjustmentsReport', { periodId }),
  payrollWorkshopSummary:         (_userId, periodId)               => ipcRenderer.invoke('payroll:workshopSummary', { periodId }),
  payrollExportExcel:             (_userId, reportType, params)     => ipcRenderer.invoke('payroll:exportExcel', { reportType, params }),

  financeDashboard:               (_userId, filters)                => ipcRenderer.invoke('finance:dashboard', { filters }),
  financeCustomerOutstanding:     (_userId, filters)                => ipcRenderer.invoke('finance:customerOutstanding', { filters }),
  financeSupplierOutstanding:     (_userId, filters)                => ipcRenderer.invoke('finance:supplierOutstanding', { filters }),
  financeOperationsSearch:        (_userId, filters)                => ipcRenderer.invoke('finance:operationsSearch', { filters }),
  financeOperationsExportExcel:   (_userId, filters)                => ipcRenderer.invoke('finance:operationsExportExcel', { filters }),
  financeApprovalQueue:           (_userId, filters)                => ipcRenderer.invoke('finance:approvalQueue', { filters }),
  financeWorkshopCostSummary:     (_userId, filters)                => ipcRenderer.invoke('finance:workshopCostSummary', { filters }),
  financeDepartmentCostSummary:   (_userId, filters)                => ipcRenderer.invoke('finance:departmentCostSummary', { filters }),
  financeApprovalReport:          (_userId, filters)                => ipcRenderer.invoke('finance:approvalReport', { filters }),
  financeExceptionReport:         (_userId)                         => ipcRenderer.invoke('finance:exceptionReport', {}),
  financeAuditReport:             (_userId, filters)                => ipcRenderer.invoke('finance:auditReport', { filters }),
  financeTransactionTrace:        (_userId, sourceType, sourceId)   => ipcRenderer.invoke('finance:transactionTrace', { sourceType, sourceId }),
  financeConfigView:              (_userId)                         => ipcRenderer.invoke('finance:configView', {}),
  financeSageExportPreview:       (_userId, filters)                => ipcRenderer.invoke('finance:sageExportPreview', { filters }),
  financeSageExportRun:           (_userId, filters)                => ipcRenderer.invoke('finance:sageExportRun', { filters }),
  financeSageExportHistory:       (_userId, filters)                => ipcRenderer.invoke('finance:sageExportHistory', { filters }),

  financeInventoryOverview:       (_userId, filters)                 => ipcRenderer.invoke('finance:inventoryOverview', { filters }),
  financeStockMovements:          (_userId, filters)                 => ipcRenderer.invoke('finance:stockMovements', { filters }),
  financeStockCountCreate:        (_userId, payload)                 => ipcRenderer.invoke('finance:stockCountCreate', { payload }),
  financeStockCountList:          (_userId, filters)                 => ipcRenderer.invoke('finance:stockCountList', { filters }),
  financeStockCountDetail:        (_userId, sessionId)                => ipcRenderer.invoke('finance:stockCountDetail', { sessionId }),
  financeStockCountEnterCount:    (_userId, sessionId, lineId, physicalQty, notes) => ipcRenderer.invoke('finance:stockCountEnterCount', { sessionId, lineId, physicalQty, notes }),
  financeStockCountSubmitReview:  (_userId, sessionId)                => ipcRenderer.invoke('finance:stockCountSubmitReview', { sessionId }),
  financeStockCountSubmitAdjustments: (_userId, sessionId, reason)    => ipcRenderer.invoke('finance:stockCountSubmitAdjustments', { sessionId, reason }),
  financeStockCountCancel:        (_userId, sessionId, reason)        => ipcRenderer.invoke('finance:stockCountCancel', { sessionId, reason }),
  financeStockVarianceReport:     (_userId, filters)                  => ipcRenderer.invoke('finance:stockVarianceReport', { filters }),
  financeInventoryAdjustmentReport: (_userId, filters)                => ipcRenderer.invoke('finance:inventoryAdjustmentReport', { filters }),
  financeExceptionCaseOpen:       (_userId, payload)                  => ipcRenderer.invoke('finance:exceptionCaseOpen', { payload }),
  financeExceptionCaseList:       (_userId, filters)                  => ipcRenderer.invoke('finance:exceptionCaseList', { filters }),
  financeExceptionCaseDetail:     (_userId, caseId)                   => ipcRenderer.invoke('finance:exceptionCaseDetail', { caseId }),
  financeExceptionCaseComment:    (_userId, caseId, comment)          => ipcRenderer.invoke('finance:exceptionCaseComment', { caseId, comment }),
  financeExceptionCaseResolve:    (_userId, caseId, resolutionNotes)  => ipcRenderer.invoke('finance:exceptionCaseResolve', { caseId, resolutionNotes }),
  financeExceptionCaseClose:      (_userId, caseId)                   => ipcRenderer.invoke('finance:exceptionCaseClose', { caseId }),
  financeProductionControl:       (_userId, workshopId)                => ipcRenderer.invoke('finance:productionControl', { workshopId }),
  financeMaintenanceControl:      (_userId)                            => ipcRenderer.invoke('finance:maintenanceControl', {}),
  financeCustomerProfile:         (_userId, customerId)                => ipcRenderer.invoke('finance:customerProfile', { customerId }),
  financeSupplierProfile:         (_userId, supplierId)                => ipcRenderer.invoke('finance:supplierProfile', { supplierId }),

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

  // Procurement Management
  procurementConfigGet:    (_userId) => ipcRenderer.invoke('procurement-config:get'),
  procurementConfigUpdate: (_userId, ceoThreshold) => ipcRenderer.invoke('procurement-config:update', { ceoThreshold }),

  procurementSuppliersList:          (_userId, filters)          => ipcRenderer.invoke('procurement-suppliers:list', { filters }),
  procurementSupplierCreate:         (_userId, payload)          => ipcRenderer.invoke('procurement-suppliers:create', { payload }),
  procurementSupplierUpdate:         (_userId, supplierId, payload) => ipcRenderer.invoke('procurement-suppliers:update', { supplierId, payload }),
  procurementSupplierBlacklist:      (_userId, supplierId, blacklisted, reason) => ipcRenderer.invoke('procurement-suppliers:blacklist', { supplierId, blacklisted, reason }),
  procurementSupplierSetStatus:      (_userId, supplierId, status, reason) => ipcRenderer.invoke('procurement-suppliers:set-status', { supplierId, status, reason }),
  procurementSupplierDelete:         (_userId, supplierId)       => ipcRenderer.invoke('procurement-suppliers:delete', { supplierId }),
  procurementSupplierContactsList:   (_userId, supplierId)       => ipcRenderer.invoke('procurement-suppliers:contacts-list', { supplierId }),
  procurementSupplierContactCreate: (_userId, supplierId, payload) => ipcRenderer.invoke('procurement-suppliers:contacts-create', { supplierId, payload }),
  procurementSupplierContactUpdate: (_userId, contactId, payload)  => ipcRenderer.invoke('procurement-suppliers:contacts-update', { contactId, payload }),
  procurementSupplierContactDelete: (_userId, contactId)           => ipcRenderer.invoke('procurement-suppliers:contacts-delete', { contactId }),
  procurementSupplierContractsList:  (_userId, supplierId)       => ipcRenderer.invoke('procurement-suppliers:contracts-list', { supplierId }),
  procurementSupplierContractCreate:(_userId, supplierId, payload) => ipcRenderer.invoke('procurement-suppliers:contracts-create', { supplierId, payload }),
  procurementSupplierContractUpdate:(_userId, contractId, payload) => ipcRenderer.invoke('procurement-suppliers:contracts-update', { contractId, payload }),
  procurementSupplierPerformance:    (_userId, supplierId)       => ipcRenderer.invoke('procurement-suppliers:performance', { supplierId }),

  procurementRequisitionsList:   (_userId, filters)            => ipcRenderer.invoke('procurement-requisitions:list', { filters }),
  procurementRequisitionCreate:  (_userId, payload)             => ipcRenderer.invoke('procurement-requisitions:create', { payload }),
  procurementRequisitionUpdate:  (_userId, requisitionId, payload) => ipcRenderer.invoke('procurement-requisitions:update', { requisitionId, payload }),
  procurementRequisitionSubmit:  (_userId, requisitionId)       => ipcRenderer.invoke('procurement-requisitions:submit', { requisitionId }),
  procurementRequisitionCancel:  (_userId, requisitionId, reason) => ipcRenderer.invoke('procurement-requisitions:cancel', { requisitionId, reason }),
  procurementRequisitionDetail:  (_userId, requisitionId)       => ipcRenderer.invoke('procurement-requisitions:detail', { requisitionId }),
  procurementApprovalAction:     (_userId, entityType, entityId, decision, notes) =>
    ipcRenderer.invoke('procurement-requisitions:approve', { entityType, entityId, decision, notes }),

  procurementRfqCreate:      (_userId, requisitionId, payload) => ipcRenderer.invoke('procurement-rfq:create', { requisitionId, payload }),
  procurementRfqSend:        (_userId, rfqId, supplierIds)     => ipcRenderer.invoke('procurement-rfq:send', { rfqId, supplierIds }),
  procurementRfqList:        (_userId)                          => ipcRenderer.invoke('procurement-rfq:list'),
  procurementRfqDetail:      (_userId, rfqId)                   => ipcRenderer.invoke('procurement-rfq:detail', { rfqId }),
  procurementQuotationSubmit:(_userId, rfqId, supplierId, payload) => ipcRenderer.invoke('procurement-rfq:quote-submit', { rfqId, supplierId, payload }),
  procurementQuotationsCompare: (_userId, rfqId)                => ipcRenderer.invoke('procurement-rfq:compare', { rfqId }),
  procurementQuotationSelect:   (_userId, quotationId)          => ipcRenderer.invoke('procurement-rfq:select-quote', { quotationId }),

  procurementPoGenerate: (_userId, requisitionId, quotationId) => ipcRenderer.invoke('procurement-po:generate', { requisitionId, quotationId }),
  procurementPoList:     (_userId, filters)                    => ipcRenderer.invoke('procurement-po:list', { filters }),
  procurementPoDetail:   (_userId, poId)                       => ipcRenderer.invoke('procurement-po:detail', { poId }),
  procurementPoUpdate:   (_userId, poId, payload)              => ipcRenderer.invoke('procurement-po:update', { poId, payload }),
  procurementPoPdfHtml:  (_userId, poId)                       => ipcRenderer.invoke('procurement-po:pdf-html', { poId }),
  procurementPoCloseWithShortage: (_userId, poId, reason, supplierExplanation) => ipcRenderer.invoke('procurement-po:close-shortage', { poId, reason, supplierExplanation }),
  procurementPoApprove: (_userId, poId, decision, notes) => ipcRenderer.invoke('procurement-po:approve', { poId, decision, notes }),
  procurementPoPrint:    (html, filename)                      => ipcRenderer.invoke('procurement-po:print', { html, filename }),

  procurementGoodsReceiptCreate: (_userId, poId, payload) => ipcRenderer.invoke('procurement-goods-receipt:create', { poId, payload }),
  procurementGoodsReceiptList:   (_userId)                => ipcRenderer.invoke('procurement-goods-receipt:list'),
  procurementGoodsReceiptDetail: (_userId, receiptId)     => ipcRenderer.invoke('procurement-goods-receipt:detail', { receiptId }),

  procurementInvoiceCreate:  (_userId, poId, payload)          => ipcRenderer.invoke('procurement-invoices:create', { poId, payload }),
  procurementInvoiceMatch:   (_userId, invoiceId)              => ipcRenderer.invoke('procurement-invoices:match', { invoiceId }),
  procurementInvoiceApprove: (_userId, invoiceId, decision, notes) => ipcRenderer.invoke('procurement-invoices:approve', { invoiceId, decision, notes }),
  procurementInvoiceList:    (_userId, filters)                => ipcRenderer.invoke('procurement-invoices:list', { filters }),
  procurementPaymentCreate:  (_userId, invoiceId, payload)     => ipcRenderer.invoke('procurement-payments:create', { invoiceId, payload }),
  procurementPaymentApprove: (_userId, paymentId, decision, notes) => ipcRenderer.invoke('procurement-payments:approve', { paymentId, decision, notes }),
  procurementPaymentList:    (_userId)                          => ipcRenderer.invoke('procurement-payments:list'),

  procurementDashboard:          (_userId) => ipcRenderer.invoke('procurement-dashboard:get'),
  procurementExportExcel:        (_userId, listType, filters) => ipcRenderer.invoke('procurement:export-excel', { listType, filters }),
  procurementReportSpendAnalysis:(_userId) => ipcRenderer.invoke('procurement-reports:spend-analysis'),
  procurementReportSupplierPerf: (_userId) => ipcRenderer.invoke('procurement-reports:supplier-perf'),
  procurementReportDeliveryPerf: (_userId) => ipcRenderer.invoke('procurement-reports:delivery-perf'),
  procurementReportBudgetUtil:   (_userId) => ipcRenderer.invoke('procurement-reports:budget-util'),
  procurementRequisitionRevisionReports: (_userId) => ipcRenderer.invoke('procurement-reports:revisions'),
  procurementPoShortageReports: (_userId) => ipcRenderer.invoke('procurement-reports:po-shortages'),
  procurementAnalytics:          (_userId) => ipcRenderer.invoke('procurement-analytics:get'),
  procurementExecutiveDashboard: (_userId) => ipcRenderer.invoke('procurement-executive-dashboard:get'),
  procurementSpendBudgetAnalytics: (_userId) => ipcRenderer.invoke('procurement-spend-budget-analytics:get'),
  procurementForecastingDashboard: (_userId) => ipcRenderer.invoke('procurement-forecasting-dashboard:get'),
  procurementExecutiveReport: (_userId, reportType, filters) => ipcRenderer.invoke('procurement-executive-report:get', { reportType, filters }),
  procurementAutomationDashboard: (_userId) => ipcRenderer.invoke('procurement-automation-dashboard:get'),
  procurementTasksList:    (_userId, filters) => ipcRenderer.invoke('procurement-tasks:list', filters),
  procurementTaskComplete: (_userId, taskId)  => ipcRenderer.invoke('procurement-tasks:complete', taskId),
  procurementPerformanceScorecard:   (_userId) => ipcRenderer.invoke('procurement-performance-scorecard:get'),
  procurementPerformanceBuyers:      (_userId) => ipcRenderer.invoke('procurement-performance-buyers:get'),
  procurementPerformanceDepartments: (_userId) => ipcRenderer.invoke('procurement-performance-departments:get'),
  procurementPerformanceWorkshops:   (_userId) => ipcRenderer.invoke('procurement-performance-workshops:get'),
  procurementPerformanceExecutive:   (_userId) => ipcRenderer.invoke('procurement-performance-executive:get'),
  procurementPerformanceBenchmark:   (_userId, filters) => ipcRenderer.invoke('procurement-performance-benchmark:get', filters),
  procurementPerformanceRisk:        (_userId) => ipcRenderer.invoke('procurement-performance-risk:get'),

  // Supplier Intelligence — Phase 3C
  supplierIntelligenceDashboard: (_userId, filters) => ipcRenderer.invoke('supplier-intel:dashboard', { filters }),
  supplierIntelligenceProfile:   (_userId, supplierId) => ipcRenderer.invoke('supplier-intel:profile', { supplierId }),
  supplierIntelligenceCompare:   (_userId, supplierIds) => ipcRenderer.invoke('supplier-intel:compare', { supplierIds }),
  supplierIntelligenceReport:    (_userId, reportType, filters) => ipcRenderer.invoke('supplier-intel:report', { reportType, filters }),

  // Supplier Relationship Management (SRM) — Phase 4
  srmContractsRegister:   (_userId, filters) => ipcRenderer.invoke('srm-contracts:register', { filters }),
  srmContractApprove:     (_userId, contractId, reason) => ipcRenderer.invoke('srm-contracts:approve', { contractId, reason }),
  srmContractRenew:       (_userId, contractId, payload) => ipcRenderer.invoke('srm-contracts:renew', { contractId, payload }),

  srmComplianceList:      (_userId, supplierId) => ipcRenderer.invoke('srm-compliance:list', { supplierId }),
  srmComplianceUpsert:    (_userId, supplierId, payload) => ipcRenderer.invoke('srm-compliance:upsert', { supplierId, payload }),
  srmComplianceRegister:  (_userId, filters) => ipcRenderer.invoke('srm-compliance:register', { filters }),

  srmCommunicationsList:     (_userId, supplierId) => ipcRenderer.invoke('srm-communications:list', { supplierId }),
  srmCommunicationCreate:    (_userId, supplierId, payload) => ipcRenderer.invoke('srm-communications:create', { supplierId, payload }),
  srmCommunicationUpdate:    (_userId, communicationId, payload) => ipcRenderer.invoke('srm-communications:update', { communicationId, payload }),
  srmCommunicationsRegister: (_userId, filters) => ipcRenderer.invoke('srm-communications:register', { filters }),

  srmImprovementPlansList:     (_userId, supplierId) => ipcRenderer.invoke('srm-improvement-plans:list', { supplierId }),
  srmImprovementPlanCreate:    (_userId, supplierId, payload) => ipcRenderer.invoke('srm-improvement-plans:create', { supplierId, payload }),
  srmImprovementPlanUpdate:    (_userId, planId, payload) => ipcRenderer.invoke('srm-improvement-plans:update', { planId, payload }),
  srmImprovementPlansRegister: (_userId, filters) => ipcRenderer.invoke('srm-improvement-plans:register', { filters }),

  srmDashboard: (_userId) => ipcRenderer.invoke('srm-dashboard:get'),
  srmReport:    (_userId, reportType, filters) => ipcRenderer.invoke('srm-reports:get', { reportType, filters }),

  srmDocumentsPickFile:  () => ipcRenderer.invoke('srm-documents:pick-file'),
  srmDocumentsUpload:    (_userId, payload) => ipcRenderer.invoke('srm-documents:upload', payload),
  srmDocumentsList:      (_userId, supplierId) => ipcRenderer.invoke('srm-documents:list', { supplierId }),
  srmDocumentsRegister:  (_userId, filters) => ipcRenderer.invoke('srm-documents:register', { filters }),
  srmDocumentsDeactivate:(_userId, documentId, reason) => ipcRenderer.invoke('srm-documents:deactivate', { documentId, reason }),
  srmDocumentsDownload:  (_userId, documentId, defaultFilename) => ipcRenderer.invoke('srm-documents:download', { documentId, defaultFilename }),
});
