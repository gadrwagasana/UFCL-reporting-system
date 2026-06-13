const { contextBridge, ipcRenderer } = require('electron');

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
      linkTags: Array.from(document.querySelectorAll('link[rel=\"stylesheet\"]'))
        .map((l) => l.getAttribute('href'))
        .slice(0, 10)
    };
    console.log('[UFCL] preload DOMContentLoaded ' + JSON.stringify(payload));
  } catch (e) {
    console.error('[UFCL] preload DOMContentLoaded error', e);
  }
});

contextBridge.exposeInMainWorld('UFCL', {
  login: (username, password) => ipcRenderer.invoke('auth:login', { username, password }),
  logout: () => ipcRenderer.invoke('auth:logout'),

  getBootstrap: (userId) => ipcRenderer.invoke('app:getBootstrap', { userId }),

  dailyList: (userId) => ipcRenderer.invoke('daily:list', { userId }),
  dailyCreate: (userId, payload) => ipcRenderer.invoke('daily:create', { userId, payload }),
  dailyHarvestData: (userId) => ipcRenderer.invoke('daily:harvest-data', { userId }),

  salesList: (userId) => ipcRenderer.invoke('sales:list', { userId }),
  salesCreate: (userId, payload) => ipcRenderer.invoke('sales:create', { userId, payload }),
  salesUpdateStatus: (userId, orderId, status) => ipcRenderer.invoke('sales:updateStatus', { userId, orderId, status }),

  productsList: (userId, filter) => ipcRenderer.invoke('products:list', { userId, filter }),
  productsCreate: (userId, payload) => ipcRenderer.invoke('products:create', { userId, payload }),
  productsToggle: (userId, productId, reason) =>
    ipcRenderer.invoke('products:toggle', { userId, productId, reason }),
  productsUpdate: (userId, productId, payload) => ipcRenderer.invoke('products:update', { userId, productId, payload }),

  weeklyCost: (userId) => ipcRenderer.invoke('weekly:cost', { userId }),
  weeklyExpensesSave: (userId, payload) => ipcRenderer.invoke('weekly:expenses:save', { userId, payload }),

  logisticsList: (userId) => ipcRenderer.invoke('logistics:list', { userId }),
  logisticsCreate: (userId, payload) => ipcRenderer.invoke('logistics:create', { userId, payload }),

  auditList: (userId, roleFilter) => ipcRenderer.invoke('audit:list', { userId, roleFilter }),
  notificationsList: (userId) => ipcRenderer.invoke('notifications:list', { userId }),
  notificationsMarkRead: (userId, notificationId) =>
    ipcRenderer.invoke('notifications:markRead', { userId, notificationId }),
  notificationsMarkAllRead: (userId) => ipcRenderer.invoke('notifications:markAllRead', { userId }),

  changesList: (userId) => ipcRenderer.invoke('changes:list', { userId }),
  changesCreate: (userId, payload) => ipcRenderer.invoke('changes:create', { userId, payload }),
  changesReview: (userId, changeId, status, response) =>
    ipcRenderer.invoke('changes:review', { userId, changeId, status, response }),

  monthlyApprove: (userId, monthKey) => ipcRenderer.invoke('monthly:approve', { userId, monthKey }),
  usersList: (userId) => ipcRenderer.invoke('users:list', { userId }),
  usersCreate: (userId, payload) => ipcRenderer.invoke('users:create', { userId, payload }),
  usersUpdate: (userId, targetUserId, payload) => ipcRenderer.invoke('users:update', { userId, targetUserId, payload }),
  usersResetPassword: (userId, targetUserId, newPassword) => ipcRenderer.invoke('users:resetPassword', { userId, targetUserId, newPassword }),
  rolesList: (userId) => ipcRenderer.invoke('roles:list', { userId }),
  rolesUpdate: (userId, role, payload) => ipcRenderer.invoke('roles:update', { userId, role, payload }),

  dashboardStats: (userId) => ipcRenderer.invoke('dashboard:stats', { userId }),
  weeklyPerf: (userId) => ipcRenderer.invoke('weekly:perf', { userId }),
  productsCatalog: (userId) => ipcRenderer.invoke('products:catalog', { userId }),
  productsActiveForForm: (userId, type) => ipcRenderer.invoke('products:active-for-form', { userId, type }),
  machinesForDropdown: (userId) => ipcRenderer.invoke('machines:for-dropdown', { userId }),
  kpiBudgetsList: (userId, month) => ipcRenderer.invoke('kpi:budgets:list', { userId, month }),
  kpiBudgetSave: (userId, payload) => ipcRenderer.invoke('kpi:budgets:save', { userId, payload }),
  monthlyDashboard: (userId, month) => ipcRenderer.invoke('monthly:dashboard', { userId, month }),
  inventoryList: (userId, workshopId) => ipcRenderer.invoke('inventory:list', { userId, workshopId }),

  warehousesList: (userId, workshopId) => ipcRenderer.invoke('warehouses:list', { userId, workshopId }),
  warehousesCreate: (userId, payload) => ipcRenderer.invoke('warehouses:create', { userId, payload }),
  warehousesUpdate: (userId, warehouseId, payload) => ipcRenderer.invoke('warehouses:update', { userId, warehouseId, payload }),

  stockItemsList: (userId, workshopId) => ipcRenderer.invoke('stock-items:list', { userId, workshopId }),
  stockItemsCreate: (userId, payload) => ipcRenderer.invoke('stock-items:create', { userId, payload }),
  stockItemsUpdate: (userId, itemId, payload) => ipcRenderer.invoke('stock-items:update', { userId, itemId, payload }),

  stockMovementsList: (userId, workshopId) => ipcRenderer.invoke('stock-movements:list', { userId, workshopId }),
  stockMovementsCreate: (userId, payload) => ipcRenderer.invoke('stock-movements:create', { userId, payload }),
  stockTransferApprove: (userId, movementId, action, rejectionReason) => ipcRenderer.invoke('stock-movements:transfer-approve', { userId, movementId, action, rejectionReason }),
  materialRequestsList: (userId, workshopId) => ipcRenderer.invoke('material-requests:list', { userId, workshopId }),
  materialRequestsCreate: (userId, payload) => ipcRenderer.invoke('material-requests:create', { userId, payload }),
  materialRequestsApprove: (userId, requestId, action, approvedQty, reviewNotes, sourceWarehouseId) => ipcRenderer.invoke('material-requests:approve', { userId, requestId, action, approvedQty, reviewNotes, sourceWarehouseId }),
  workshopOverview: (userId) => ipcRenderer.invoke('workshop:overview', { userId }),

  transportCompaniesDropdown: (userId) => ipcRenderer.invoke('transport-companies:dropdown', { userId }),
  vehiclesList: (userId) => ipcRenderer.invoke('vehicles:list', { userId }),
  vehiclesCreate: (userId, payload) => ipcRenderer.invoke('vehicles:create', { userId, payload }),
  vehiclesUpdate: (userId, vehicleId, payload) => ipcRenderer.invoke('vehicles:update', { userId, vehicleId, payload }),
  fuelLogsList: (userId, vehicleId) => ipcRenderer.invoke('fuel-logs:list', { userId, vehicleId }),
  fuelLogsCreate: (userId, payload) => ipcRenderer.invoke('fuel-logs:create', { userId, payload }),
  maintenanceList: (userId, vehicleId) => ipcRenderer.invoke('maintenance:list', { userId, vehicleId }),
  maintenanceCreate: (userId, payload) => ipcRenderer.invoke('maintenance:create', { userId, payload }),
  maintenanceUpdate: (userId, recordId, payload) => ipcRenderer.invoke('maintenance:update', { userId, recordId, payload }),

  deliveriesList: (userId) => ipcRenderer.invoke('deliveries:list', { userId }),
  deliveriesCreate: (userId, payload) => ipcRenderer.invoke('deliveries:create', { userId, payload }),
  deliveriesUpdateStatus: (userId, orderId, status) => ipcRenderer.invoke('deliveries:updateStatus', { userId, orderId, status }),

  dispatchList: (userId) => ipcRenderer.invoke('dispatch:list', { userId }),
  dispatchCreate: (userId, payload) => ipcRenderer.invoke('dispatch:create', { userId, payload }),
  dispatchReview: (userId, requestId, status, notes) => ipcRenderer.invoke('dispatch:review', { userId, requestId, status, notes }),

  harvestList: (userId) => ipcRenderer.invoke('harvest:list', { userId }),
  harvestCreate: (userId, payload) => ipcRenderer.invoke('harvest:create', { userId, payload }),

  timberInventoryList: (userId) => ipcRenderer.invoke('timber-inventory:list', { userId }),

  transportCompaniesList: (userId) => ipcRenderer.invoke('transport:companies:list', { userId }),
  transportCompaniesCreate: (userId, payload) => ipcRenderer.invoke('transport:companies:create', { userId, payload }),
  transportCompaniesUpdate: (userId, companyId, payload) => ipcRenderer.invoke('transport:companies:update', { userId, companyId, payload }),
  transportJobsList: (userId) => ipcRenderer.invoke('transport:jobs:list', { userId }),
  transportJobsCreate: (userId, payload) => ipcRenderer.invoke('transport:jobs:create', { userId, payload }),
  transportJobsUpdateStatus: (userId, jobId, status) => ipcRenderer.invoke('transport:jobs:updateStatus', { userId, jobId, status }),

  pendingEditsList:   (userId) => ipcRenderer.invoke('pending-edits:list', { userId }),
  pendingEditsCreate: (userId, payload) => ipcRenderer.invoke('pending-edits:create', { userId, payload }),
  pendingEditsReview: (userId, pendingId, status, reviewNotes) =>
    ipcRenderer.invoke('pending-edits:review', { userId, pendingId, status, reviewNotes }),

  dailyUpdate: (userId, logId, payload) => ipcRenderer.invoke('daily:update', { userId, logId, payload }),
  dailyDelete: (userId, logId, reason) => ipcRenderer.invoke('daily:delete', { userId, logId, reason }),
  salesUpdate: (userId, orderId, payload) => ipcRenderer.invoke('sales:update', { userId, orderId, payload }),
  salesDelete: (userId, orderId, reason) => ipcRenderer.invoke('sales:delete', { userId, orderId, reason }),
  logisticsUpdate: (userId, itemId, payload) => ipcRenderer.invoke('logistics:update', { userId, itemId, payload }),
  logisticsDelete: (userId, itemId) => ipcRenderer.invoke('logistics:delete', { userId, itemId }),
  harvestUpdate: (userId, logId, payload) => ipcRenderer.invoke('harvest:update', { userId, logId, payload }),
  harvestDelete: (userId, logId, reason) => ipcRenderer.invoke('harvest:delete', { userId, logId, reason }),
  deliveriesUpdate: (userId, orderId, payload) => ipcRenderer.invoke('deliveries:update', { userId, orderId, payload }),
  deliveriesDelete: (userId, orderId) => ipcRenderer.invoke('deliveries:delete', { userId, orderId }),
  dispatchDelete: (userId, requestId) => ipcRenderer.invoke('dispatch:delete', { userId, requestId }),
  transportJobsUpdate: (userId, jobId, payload) => ipcRenderer.invoke('transport:jobs:update', { userId, jobId, payload }),
  transportJobsDelete: (userId, jobId) => ipcRenderer.invoke('transport:jobs:delete', { userId, jobId }),
  fuelLogsDelete: (userId, logId) => ipcRenderer.invoke('fuel-logs:delete', { userId, logId }),
  maintenanceDelete: (userId, recordId, reason) => ipcRenderer.invoke('maintenance:delete', { userId, recordId, reason }),
  stockMovementsDelete: (userId, movementId, reason) => ipcRenderer.invoke('stock-movements:delete', { userId, movementId, reason }),
  warehousesDelete: (userId, warehouseId) => ipcRenderer.invoke('warehouses:delete', { userId, warehouseId }),
  stockItemsDelete: (userId, itemId) => ipcRenderer.invoke('stock-items:delete', { userId, itemId }),
  vehiclesDelete: (userId, vehicleId) => ipcRenderer.invoke('vehicles:delete', { userId, vehicleId }),
  transportCompaniesDelete: (userId, companyId) => ipcRenderer.invoke('transport:companies:delete', { userId, companyId }),

  // Machine Management
  machineCategoriesList:   (userId) => ipcRenderer.invoke('machines:categories:list', { userId }),
  machineCategoriesCreate: (userId, payload) => ipcRenderer.invoke('machines:categories:create', { userId, payload }),
  machineCategoriesUpdate: (userId, categoryId, payload) => ipcRenderer.invoke('machines:categories:update', { userId, categoryId, payload }),
  machineCategoriesDelete: (userId, categoryId) => ipcRenderer.invoke('machines:categories:delete', { userId, categoryId }),
  machinesList:   (userId) => ipcRenderer.invoke('machines:list', { userId }),
  machinesCreate: (userId, payload) => ipcRenderer.invoke('machines:create', { userId, payload }),
  machinesUpdate: (userId, machineId, payload) => ipcRenderer.invoke('machines:update', { userId, machineId, payload }),
  machinesDelete: (userId, machineId) => ipcRenderer.invoke('machines:delete', { userId, machineId }),

  // Machine Log Item Categories
  machineLogCatsList:   (userId) => ipcRenderer.invoke('machine-log-cats:list', { userId }),
  machineLogCatsCreate: (userId, payload) => ipcRenderer.invoke('machine-log-cats:create', { userId, payload }),
  machineLogCatsDelete: (userId, id) => ipcRenderer.invoke('machine-log-cats:delete', { userId, id }),

  // Machine Daily Logs
  machineLogsList:   (userId, machineId, month) => ipcRenderer.invoke('machine-logs:list', { userId, machineId, month }),
  machineLogsCreate: (userId, payload) => ipcRenderer.invoke('machine-logs:create', { userId, payload }),
  machineLogsUpdate: (userId, logId, payload) => ipcRenderer.invoke('machine-logs:update', { userId, logId, payload }),
  machineLogsDelete: (userId, logId, reason) => ipcRenderer.invoke('machine-logs:delete', { userId, logId, reason }),

  // Machine KPI
  machineKpiDefinitionsList:   (userId) => ipcRenderer.invoke('machine-kpi:definitions:list', { userId }),
  machineKpiDefinitionsCreate: (userId, payload) => ipcRenderer.invoke('machine-kpi:definitions:create', { userId, payload }),
  machineKpiDefinitionsUpdate: (userId, kpiId, payload) => ipcRenderer.invoke('machine-kpi:definitions:update', { userId, kpiId, payload }),
  machineKpiDefinitionsDelete: (userId, kpiId) => ipcRenderer.invoke('machine-kpi:definitions:delete', { userId, kpiId }),
  machineKpiTargetsList: (userId, machineId, month) => ipcRenderer.invoke('machine-kpi:targets:list', { userId, machineId, month }),
  machineKpiTargetsSave: (userId, payload) => ipcRenderer.invoke('machine-kpi:targets:save', { userId, payload }),
  machineKpiPerformance: (userId, month) => ipcRenderer.invoke('machine-kpi:performance', { userId, month }),

  // Machine Maintenance Schedules
  machineMaintList:   (userId, machineId) => ipcRenderer.invoke('machine-maint:list', { userId, machineId }),
  machineMaintCreate: (userId, payload) => ipcRenderer.invoke('machine-maint:create', { userId, payload }),
  machineMaintUpdate: (userId, schedId, payload) => ipcRenderer.invoke('machine-maint:update', { userId, schedId, payload }),
  machineMaintDelete: (userId, schedId) => ipcRenderer.invoke('machine-maint:delete', { userId, schedId }),

  // Compartments
  compartmentsList:        (userId) => ipcRenderer.invoke('compartments:list', { userId }),
  compartmentsCreate:      (userId, payload) => ipcRenderer.invoke('compartments:create', { userId, payload }),
  compartmentsUpdate:      (userId, comptId, payload) => ipcRenderer.invoke('compartments:update', { userId, comptId, payload }),
  compartmentsDelete:      (userId, comptId, reason) => ipcRenderer.invoke('compartments:delete', { userId, comptId, reason }),
  compartmentsForDropdown: (userId) => ipcRenderer.invoke('compartments:for-dropdown', { userId }),

  // Log Transport
  logTransportList:   (userId) => ipcRenderer.invoke('log-transport:list', { userId }),
  logTransportCreate: (userId, payload) => ipcRenderer.invoke('log-transport:create', { userId, payload }),
  logTransportUpdate: (userId, id, payload) => ipcRenderer.invoke('log-transport:update', { userId, id, payload }),
  logTransportDelete: (userId, id, reason) => ipcRenderer.invoke('log-transport:delete', { userId, id, reason }),

  // Value-Added Timber
  valueAddedTimberList:   (userId) => ipcRenderer.invoke('value-added-timber:list', { userId }),
  valueAddedTimberCreate: (userId, payload) => ipcRenderer.invoke('value-added-timber:create', { userId, payload }),
  valueAddedTimberUpdate: (userId, id, payload) => ipcRenderer.invoke('value-added-timber:update', { userId, id, payload }),
  valueAddedTimberDelete: (userId, id, reason) => ipcRenderer.invoke('value-added-timber:delete', { userId, id, reason }),

  // Logistics Dashboard
  logisticsDashboard: (userId) => ipcRenderer.invoke('logistics:dashboard', { userId }),

  // Machine Fuel Logs
  machineFuelLogsList:   (userId) => ipcRenderer.invoke('machine-fuel:list', { userId }),
  machineFuelLogsCreate: (userId, payload) => ipcRenderer.invoke('machine-fuel:create', { userId, payload }),
  machineFuelLogsUpdate: (userId, id, payload) => ipcRenderer.invoke('machine-fuel:update', { userId, id, payload }),
  machineFuelLogsDelete: (userId, id, reason) => ipcRenderer.invoke('machine-fuel:delete', { userId, id, reason }),

  // Casual Labour Requests
  casualLabourRequestsList:   (userId) => ipcRenderer.invoke('casual-requests:list', { userId }),
  casualLabourRequestsCreate: (userId, payload) => ipcRenderer.invoke('casual-requests:create', { userId, payload }),
  casualLabourRequestsReview: (userId, requestId, status) => ipcRenderer.invoke('casual-requests:review', { userId, requestId, status }),
  casualLabourRequestsDelete: (userId, id) => ipcRenderer.invoke('casual-requests:delete', { userId, id }),

  // Casuals
  casualsList:   (userId) => ipcRenderer.invoke('casuals:list', { userId }),
  casualsCreate: (userId, payload) => ipcRenderer.invoke('casuals:create', { userId, payload }),
  casualsUpdate: (userId, casualId, payload) => ipcRenderer.invoke('casuals:update', { userId, casualId, payload }),
  casualsDelete: (userId, casualId) => ipcRenderer.invoke('casuals:delete', { userId, casualId }),

  ceoOverview: (userId) => ipcRenderer.invoke('ceo:overview', { userId }),

  // Deletion Requests
  deletionRequestCreate:  (userId, tableName, recordId, entityType, entityRef, reason) =>
    ipcRenderer.invoke('deletion-requests:create', { userId, tableName, recordId, entityType, entityRef, reason }),
  deletionRequestsList:   (userId) => ipcRenderer.invoke('deletion-requests:list', { userId }),
  deletionRequestApprove: (userId, requestId, notes) => ipcRenderer.invoke('deletion-requests:approve', { userId, requestId, notes }),
  deletionRequestReject:  (userId, requestId, notes) => ipcRenderer.invoke('deletion-requests:reject', { userId, requestId, notes }),

  // Trash
  trashList:    (userId) => ipcRenderer.invoke('trash:list', { userId }),
  trashRestore: (userId, tableName, recordId) => ipcRenderer.invoke('trash:restore', { userId, tableName, recordId }),
  trashPurge:   (userId, tableName, recordId) => ipcRenderer.invoke('trash:purge', { userId, tableName, recordId })
});

