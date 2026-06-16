const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');

const { migrate } = require('../db/migrate');
const auth = require('../db/services/auth');
const data = require('../db/services/data');

let mainWindow;

// Some Windows setups show a blank window even when DOM is loaded (GPU/compositor issues).
// Disabling hardware acceleration makes rendering reliable for local desktop prototypes.
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');

// Fix Windows "Unable to create cache (Access is denied)" by forcing
// Chromium to use Electron's userData folder (writable for current user).
try {
  // Use LocalAppData (non-roaming). Roaming AppData is sometimes redirected/locked.
  const localBase = process.env.LOCALAPPDATA || app.getPath('localAppData');
  const userDataDir = path.join(localBase, 'UFCL-ReportingApp');
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.mkdirSync(path.join(userDataDir, 'Cache'), { recursive: true });
  fs.mkdirSync(path.join(userDataDir, 'MediaCache'), { recursive: true });
  app.setPath('userData', userDataDir);
  app.commandLine.appendSwitch('user-data-dir', userDataDir);
  app.commandLine.appendSwitch('disk-cache-dir', path.join(userDataDir, 'Cache'));
  app.commandLine.appendSwitch('media-cache-dir', path.join(userDataDir, 'MediaCache'));
  app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
  app.commandLine.appendSwitch('disable-http-cache');
} catch {
  // If this fails, Electron will fall back to defaults.
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 780,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#0D2E18',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    // Ignore benign DevTools protocol errors (e.g. Autofill domain missing in this Chromium build).
    if (typeof sourceId === 'string' && sourceId.startsWith('devtools://')) {
      if (message && message.includes('Autofill')) return;
    }
    const lvl = ['log', 'warn', 'error'][Math.min(Math.max(level - 1, 0), 2)] || 'log';
    console[lvl](`[renderer:${lvl}] ${message} (${sourceId}:${line})`);
  });
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    dialog.showErrorBox('UI failed to load', `Code: ${code}\n${desc}\n${url}`);
  });
  // Open DevTools only in development to avoid DevTools protocol noise on regular runs.
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

app.whenReady().then(async () => {
  // Force Electron session cache path as well (more reliable than command line flags on some Windows setups).
  try {
    const userDataDir = app.getPath('userData');
    await session.defaultSession.setCachePath(path.join(userDataDir, 'Cache'));
  } catch {
    // ignore
  }
  try {
    await migrate();
  } catch (e) {
    dialog.showErrorBox(
      'Database migration failed',
      `${e?.message || e}\n\nCheck your .env Postgres settings and network access.`
    );
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('auth:login', async (_evt, { username, password }) => {
  return auth.login(username, password);
});

ipcMain.handle('auth:logout', async () => ({ ok: true }));

ipcMain.handle('app:getBootstrap', async (_evt, { userId }) => {
  return data.getBootstrap(userId);
});

ipcMain.handle('daily:list', async (_evt, { userId }) => data.dailyList(userId));
ipcMain.handle('daily:create', async (_evt, { userId, payload }) => data.dailyCreate(userId, payload));
ipcMain.handle('daily:harvest-data', async (_evt, { userId }) => data.dailyHarvestData(userId));

ipcMain.handle('sales:list', async (_evt, { userId }) => data.salesList(userId));
ipcMain.handle('sales:create', async (_evt, { userId, payload }) => data.salesCreate(userId, payload));
ipcMain.handle('sales:updateStatus', async (_evt, { userId, orderId, status }) => data.salesUpdateStatus(userId, orderId, status));
ipcMain.handle('sales:products-for-dropdown', async (_evt, { userId }) => data.salesProductsForDropdown(userId));
ipcMain.handle('sales:update-payment', async (_evt, { userId, orderId, paymentStatus }) => data.salesUpdatePayment(userId, orderId, paymentStatus));

// Customers
ipcMain.handle('customers:for-dropdown', async (_evt, { userId }) => data.customersForDropdown(userId));
ipcMain.handle('customers:list',   async (_evt, { userId }) => data.customersList(userId));
ipcMain.handle('customers:create', async (_evt, { userId, payload }) => data.customersCreate(userId, payload));
ipcMain.handle('customers:update', async (_evt, { userId, customerId, payload }) => data.customersUpdate(userId, customerId, payload));

ipcMain.handle('products:list', async (_evt, { userId, filter }) => data.productsList(userId, filter));
ipcMain.handle('products:create', async (_evt, { userId, payload }) => data.productsCreate(userId, payload));
ipcMain.handle('products:toggle', async (_evt, { userId, productId, reason }) =>
  data.productsToggle(userId, productId, reason)
);
ipcMain.handle('products:update', async (_evt, { userId, productId, payload }) => data.productsUpdate(userId, productId, payload));
ipcMain.handle('products:active-for-form', async (_evt, { userId, type }) => data.productsActiveForForm(userId, type));
ipcMain.handle('machines:for-dropdown', async (_evt, { userId }) => data.machinesForDropdown(userId));

ipcMain.handle('weekly:cost', async (_evt, { userId }) => data.weeklyCostReport(userId));
ipcMain.handle('weekly:expenses:save', async (_evt, { userId, payload }) => data.weeklyExpensesSave(userId, payload));

ipcMain.handle('logistics:list', async (_evt, { userId }) => data.logisticsList(userId));
ipcMain.handle('logistics:create', async (_evt, { userId, payload }) => data.logisticsCreate(userId, payload));

ipcMain.handle('audit:list', async (_evt, { userId, roleFilter }) => data.auditList(userId, roleFilter));
ipcMain.handle('notifications:list', async (_evt, { userId }) => data.notificationsList(userId));
ipcMain.handle('notifications:markRead', async (_evt, { userId, notificationId }) =>
  data.notificationsMarkRead(userId, notificationId)
);
ipcMain.handle('notifications:markAllRead', async (_evt, { userId }) => data.notificationsMarkAllRead(userId));

ipcMain.handle('changes:list', async (_evt, { userId }) => data.changesList(userId));
ipcMain.handle('changes:create', async (_evt, { userId, payload }) => data.changesCreate(userId, payload));
ipcMain.handle('changes:review', async (_evt, { userId, changeId, status, response }) =>
  data.changesReview(userId, changeId, status, response)
);

ipcMain.handle('monthly:approve', async (_evt, { userId, monthKey }) => data.monthlyApprove(userId, monthKey));

// Users admin IPC
ipcMain.handle('users:list', async (_evt, { userId }) => data.usersList(userId));
ipcMain.handle('users:create', async (_evt, { userId, payload }) => data.usersCreate(userId, payload));
ipcMain.handle('users:update', async (_evt, { userId, targetUserId, payload }) =>
  data.usersUpdate(userId, targetUserId, payload)
);
ipcMain.handle('users:resetPassword', async (_evt, { userId, targetUserId, newPassword }) =>
  data.usersResetPassword(userId, targetUserId, newPassword)
);
ipcMain.handle('roles:list', async (_evt, { userId }) => data.rolesList(userId));
ipcMain.handle('roles:update', async (_evt, { userId, role, payload }) => data.rolesUpdate(userId, role, payload));

ipcMain.handle('dashboard:stats', async (_evt, { userId }) => data.getDashboardStats(userId));
ipcMain.handle('weekly:perf', async (_evt, { userId }) => data.weeklyPerformanceReport(userId));
ipcMain.handle('products:catalog', async (_evt, { userId }) => data.productCatalogList(userId));
ipcMain.handle('kpi:budgets:list', async (_evt, { userId, month }) => data.kpiBudgetsList(userId, month));
ipcMain.handle('kpi:budgets:save', async (_evt, { userId, payload }) => data.kpiBudgetSave(userId, payload));
ipcMain.handle('monthly:dashboard', async (_evt, { userId, month }) => data.monthlyDashboard(userId, month));
ipcMain.handle('inventory:list', async (_evt, { userId, workshopId }) => data.inventoryList(userId, workshopId));

// Warehouses
ipcMain.handle('warehouses:list', async (_evt, { userId, workshopId }) => data.warehousesList(userId, workshopId));
ipcMain.handle('warehouses:create', async (_evt, { userId, payload }) => data.warehousesCreate(userId, payload));
ipcMain.handle('warehouses:update', async (_evt, { userId, warehouseId, payload }) => data.warehousesUpdate(userId, warehouseId, payload));

// Stock catalog
ipcMain.handle('stock-items:list', async (_evt, { userId, workshopId }) => data.stockItemsList(userId, workshopId));
ipcMain.handle('stock-items:create', async (_evt, { userId, payload }) => data.stockItemsCreate(userId, payload));
ipcMain.handle('stock-items:update', async (_evt, { userId, itemId, payload }) => data.stockItemsUpdate(userId, itemId, payload));
ipcMain.handle('stock-categories:list', async (_evt, { userId }) => data.stockCategoriesList(userId));
ipcMain.handle('stock-categories:create', async (_evt, { userId, name }) => data.stockCategoriesCreate(userId, name));
ipcMain.handle('stock-categories:delete', async (_evt, { userId, categoryId }) => data.stockCategoriesDelete(userId, categoryId));

// Stock movements
ipcMain.handle('stock-movements:list', async (_evt, { userId, workshopId }) => data.stockMovementsList(userId, workshopId));
ipcMain.handle('stock-movements:create', async (_evt, { userId, payload }) => data.stockMovementsCreate(userId, payload));
ipcMain.handle('stock-movements:transfer-approve', async (_evt, { userId, movementId, action, rejectionReason }) => data.stockTransferApprove(userId, movementId, action, rejectionReason));
ipcMain.handle('material-requests:list', async (_evt, { userId, workshopId }) => data.materialRequestsList(userId, workshopId));
ipcMain.handle('material-requests:create', async (_evt, { userId, payload }) => data.materialRequestsCreate(userId, payload));
ipcMain.handle('material-requests:approve', async (_evt, { userId, requestId, action, approvedQty, reviewNotes, sourceWarehouseId }) => data.materialRequestsApprove(userId, requestId, action, approvedQty, reviewNotes, sourceWarehouseId));
ipcMain.handle('workshop:overview', async (_evt, { userId }) => data.workshopOverview(userId));

// Vehicles
ipcMain.handle('transport-companies:dropdown', async (_evt, { userId }) => data.transportCompaniesForDropdown(userId));
ipcMain.handle('vehicles:for-transport', async (_evt, { userId }) => data.vehiclesForTransport(userId));
ipcMain.handle('vehicles:list', async (_evt, { userId }) => data.vehiclesList(userId));
ipcMain.handle('vehicles:create', async (_evt, { userId, payload }) => data.vehiclesCreate(userId, payload));
ipcMain.handle('vehicles:update', async (_evt, { userId, vehicleId, payload }) => data.vehiclesUpdate(userId, vehicleId, payload));
ipcMain.handle('fuel-logs:list', async (_evt, { userId, vehicleId }) => data.fuelLogsList(userId, vehicleId));
ipcMain.handle('fuel-logs:create', async (_evt, { userId, payload }) => data.fuelLogsCreate(userId, payload));
ipcMain.handle('maintenance:list', async (_evt, { userId, vehicleId }) => data.maintenanceList(userId, vehicleId));
ipcMain.handle('maintenance:create', async (_evt, { userId, payload }) => data.maintenanceCreate(userId, payload));
ipcMain.handle('maintenance:update', async (_evt, { userId, recordId, payload }) => data.maintenanceUpdate(userId, recordId, payload));

// Deliveries
ipcMain.handle('deliveries:list', async (_evt, { userId }) => data.deliveryOrdersList(userId));
ipcMain.handle('deliveries:create', async (_evt, { userId, payload }) => data.deliveryOrdersCreate(userId, payload));
ipcMain.handle('deliveries:updateStatus', async (_evt, { userId, orderId, status }) => data.deliveryOrdersUpdateStatus(userId, orderId, status));

// Dispatch
ipcMain.handle('dispatch:list', async (_evt, { userId }) => data.dispatchList(userId));
ipcMain.handle('dispatch:create', async (_evt, { userId, payload }) => data.dispatchCreate(userId, payload));
ipcMain.handle('dispatch:review', async (_evt, { userId, requestId, status, notes }) => data.dispatchReview(userId, requestId, status, notes));

// Harvest
ipcMain.handle('harvest:list', async (_evt, { userId }) => data.harvestList(userId));
ipcMain.handle('harvest:create', async (_evt, { userId, payload }) => data.harvestCreate(userId, payload));

// Timber inventory
ipcMain.handle('timber-inventory:list', async (_evt, { userId }) => data.timberInventoryList(userId));

// Pending edit approvals (supervisor workflow)
ipcMain.handle('pending-edits:list',   async (_evt, { userId }) => data.pendingEditsList(userId));
ipcMain.handle('pending-edits:create', async (_evt, { userId, payload }) => data.pendingEditsCreate(userId, payload));
ipcMain.handle('pending-edits:review', async (_evt, { userId, pendingId, status, reviewNotes }) =>
  data.pendingEditsReview(userId, pendingId, status, reviewNotes));

// Edit / Delete
ipcMain.handle('daily:update', async (_evt, { userId, logId, payload }) => data.dailyUpdate(userId, logId, payload));
ipcMain.handle('daily:delete', async (_evt, { userId, logId, reason }) => data.dailyDelete(userId, logId, reason));
ipcMain.handle('sales:update', async (_evt, { userId, orderId, payload }) => data.salesUpdate(userId, orderId, payload));
ipcMain.handle('sales:delete', async (_evt, { userId, orderId, reason }) => data.salesDelete(userId, orderId, reason));
ipcMain.handle('logistics:update', async (_evt, { userId, itemId, payload }) => data.logisticsUpdate(userId, itemId, payload));
ipcMain.handle('logistics:delete', async (_evt, { userId, itemId }) => data.logisticsDelete(userId, itemId));
ipcMain.handle('harvest:update', async (_evt, { userId, logId, payload }) => data.harvestUpdate(userId, logId, payload));
ipcMain.handle('harvest:delete', async (_evt, { userId, logId, reason }) => data.harvestDelete(userId, logId, reason));
ipcMain.handle('deliveries:update', async (_evt, { userId, orderId, payload }) => data.deliveryOrdersUpdate(userId, orderId, payload));
ipcMain.handle('deliveries:delete', async (_evt, { userId, orderId }) => data.deliveryOrdersDelete(userId, orderId));
ipcMain.handle('dispatch:delete', async (_evt, { userId, requestId }) => data.dispatchDelete(userId, requestId));
ipcMain.handle('transport:jobs:update', async (_evt, { userId, jobId, payload }) => data.transportJobsUpdate(userId, jobId, payload));
ipcMain.handle('transport:jobs:delete', async (_evt, { userId, jobId }) => data.transportJobsDelete(userId, jobId));
ipcMain.handle('fuel-logs:delete', async (_evt, { userId, logId }) => data.fuelLogsDelete(userId, logId));
ipcMain.handle('maintenance:delete', async (_evt, { userId, recordId, reason }) => data.maintenanceDelete(userId, recordId, reason));
ipcMain.handle('stock-movements:delete', async (_evt, { userId, movementId, reason }) => data.stockMovementsDelete(userId, movementId, reason));
ipcMain.handle('warehouses:delete', async (_evt, { userId, warehouseId }) => data.warehousesDelete(userId, warehouseId));
ipcMain.handle('stock-items:delete', async (_evt, { userId, itemId }) => data.stockItemsDelete(userId, itemId));
ipcMain.handle('vehicles:delete', async (_evt, { userId, vehicleId }) => data.vehiclesDelete(userId, vehicleId));
ipcMain.handle('transport:companies:delete', async (_evt, { userId, companyId }) => data.transportCompaniesDelete(userId, companyId));

// Third-party transport
ipcMain.handle('transport:companies:list', async (_evt, { userId }) => data.transportCompaniesList(userId));
ipcMain.handle('transport:companies:create', async (_evt, { userId, payload }) => data.transportCompaniesCreate(userId, payload));
ipcMain.handle('transport:companies:update', async (_evt, { userId, companyId, payload }) => data.transportCompaniesUpdate(userId, companyId, payload));
ipcMain.handle('transport:jobs:list', async (_evt, { userId }) => data.transportJobsList(userId));
ipcMain.handle('transport:jobs:create', async (_evt, { userId, payload }) => data.transportJobsCreate(userId, payload));
ipcMain.handle('transport:jobs:updateStatus', async (_evt, { userId, jobId, status }) => data.transportJobsUpdateStatus(userId, jobId, status));

// Machine Management
ipcMain.handle('machines:categories:list',   async (_evt, { userId }) => data.machineCategoriesList(userId));
ipcMain.handle('machines:categories:create', async (_evt, { userId, payload }) => data.machineCategoriesCreate(userId, payload));
ipcMain.handle('machines:categories:update', async (_evt, { userId, categoryId, payload }) => data.machineCategoriesUpdate(userId, categoryId, payload));
ipcMain.handle('machines:categories:delete', async (_evt, { userId, categoryId }) => data.machineCategoriesDelete(userId, categoryId));
ipcMain.handle('machines:list',   async (_evt, { userId }) => data.machinesList(userId));
ipcMain.handle('machines:create', async (_evt, { userId, payload }) => data.machinesCreate(userId, payload));
ipcMain.handle('machines:update', async (_evt, { userId, machineId, payload }) => data.machinesUpdate(userId, machineId, payload));
ipcMain.handle('machines:delete', async (_evt, { userId, machineId }) => data.machinesDelete(userId, machineId));

// Machine Log Item Categories
ipcMain.handle('machine-log-cats:list',   async (_evt, { userId }) => data.machineLogCategoriesList(userId));
ipcMain.handle('machine-log-cats:create', async (_evt, { userId, payload }) => data.machineLogCategoriesCreate(userId, payload));
ipcMain.handle('machine-log-cats:delete', async (_evt, { userId, id }) => data.machineLogCategoriesDelete(userId, id));

// Machine Daily Logs
ipcMain.handle('machine-logs:list',   async (_evt, { userId, machineId, month }) => data.machineLogsList(userId, machineId, month));
ipcMain.handle('machine-logs:create', async (_evt, { userId, payload }) => data.machineLogsCreate(userId, payload));
ipcMain.handle('machine-logs:update', async (_evt, { userId, logId, payload }) => data.machineLogsUpdate(userId, logId, payload));
ipcMain.handle('machine-logs:delete', async (_evt, { userId, logId, reason }) => data.machineLogsDelete(userId, logId, reason));
ipcMain.handle('machine-logs:fuel-issued', async (_evt, { userId, machineId, logDate }) => data.machineFuelIssuedLookup(userId, machineId, logDate));

// Machine KPI
ipcMain.handle('machine-kpi:definitions:list',   async (_evt, { userId }) => data.machineKpiDefinitionsList(userId));
ipcMain.handle('machine-kpi:definitions:create', async (_evt, { userId, payload }) => data.machineKpiDefinitionsCreate(userId, payload));
ipcMain.handle('machine-kpi:definitions:update', async (_evt, { userId, kpiId, payload }) => data.machineKpiDefinitionsUpdate(userId, kpiId, payload));
ipcMain.handle('machine-kpi:definitions:delete', async (_evt, { userId, kpiId }) => data.machineKpiDefinitionsDelete(userId, kpiId));
ipcMain.handle('machine-kpi:targets:list', async (_evt, { userId, machineId, month }) => data.machineKpiTargetsList(userId, machineId, month));
ipcMain.handle('machine-kpi:targets:save', async (_evt, { userId, payload }) => data.machineKpiTargetsSave(userId, payload));
ipcMain.handle('machine-kpi:performance',  async (_evt, { userId, month }) => data.machineKpiPerformance(userId, month));

// Machine Maintenance Schedules
ipcMain.handle('machine-maint:list',   async (_evt, { userId, machineId }) => data.machineMaintScheduleList(userId, machineId));
ipcMain.handle('machine-maint:create', async (_evt, { userId, payload }) => data.machineMaintScheduleCreate(userId, payload));
ipcMain.handle('machine-maint:update', async (_evt, { userId, schedId, payload }) => data.machineMaintScheduleUpdate(userId, schedId, payload));
ipcMain.handle('machine-maint:delete', async (_evt, { userId, schedId }) => data.machineMaintScheduleDelete(userId, schedId));

// Compartments
ipcMain.handle('compartments:list',   async (_evt, { userId }) => data.compartmentsList(userId));
ipcMain.handle('compartments:create', async (_evt, { userId, payload }) => data.compartmentsCreate(userId, payload));
ipcMain.handle('compartments:update', async (_evt, { userId, comptId, payload }) => data.compartmentsUpdate(userId, comptId, payload));
ipcMain.handle('compartments:delete', async (_evt, { userId, comptId, reason }) => data.compartmentsDelete(userId, comptId, reason));
ipcMain.handle('compartments:for-dropdown', async (_evt, { userId }) => data.compartmentsForDropdown(userId));

// Log Transport
ipcMain.handle('log-transport:list',   async (_evt, { userId }) => data.logTransportList(userId));
ipcMain.handle('log-transport:create', async (_evt, { userId, payload }) => data.logTransportCreate(userId, payload));
ipcMain.handle('log-transport:update', async (_evt, { userId, id, payload }) => data.logTransportUpdate(userId, id, payload));
ipcMain.handle('log-transport:delete', async (_evt, { userId, id, reason }) => data.logTransportDelete(userId, id, reason));

// Value-Added Timber
ipcMain.handle('value-added-timber:list',   async (_evt, { userId }) => data.valueAddedTimberList(userId));
ipcMain.handle('value-added-timber:create', async (_evt, { userId, payload }) => data.valueAddedTimberCreate(userId, payload));
ipcMain.handle('value-added-timber:update', async (_evt, { userId, id, payload }) => data.valueAddedTimberUpdate(userId, id, payload));
ipcMain.handle('value-added-timber:delete', async (_evt, { userId, id, reason }) => data.valueAddedTimberDelete(userId, id, reason));

// Logistics Dashboard
ipcMain.handle('logistics:dashboard', async (_evt, { userId }) => data.logisticsDashboard(userId));

// Machine Fuel Logs
ipcMain.handle('machine-fuel:dropdown', async (_evt, { userId }) => data.machineFuelDropdown(userId));
ipcMain.handle('machine-fuel:summary', async (_evt, { userId, month }) => data.machineFuelSummary(userId, month));
ipcMain.handle('machine-fuel:list',   async (_evt, { userId }) => data.machineFuelLogsList(userId));
ipcMain.handle('machine-fuel:create', async (_evt, { userId, payload }) => data.machineFuelLogsCreate(userId, payload));
ipcMain.handle('machine-fuel:update', async (_evt, { userId, id, payload }) => data.machineFuelLogsUpdate(userId, id, payload));
ipcMain.handle('machine-fuel:delete', async (_evt, { userId, id, reason }) => data.machineFuelLogsDelete(userId, id, reason));

// Casual Labour Requests
ipcMain.handle('casual-requests:list',   async (_evt, { userId }) => data.casualLabourRequestsList(userId));
ipcMain.handle('casual-requests:create', async (_evt, { userId, payload }) => data.casualLabourRequestsCreate(userId, payload));
ipcMain.handle('casual-requests:submit', async (_evt, { userId, payload }) => data.casualLabourRequestsSubmit(userId, payload));
ipcMain.handle('casual-requests:review', async (_evt, { userId, requestId, status }) => data.casualLabourRequestsReview(userId, requestId, status));
ipcMain.handle('casual-requests:delete', async (_evt, { userId, id }) => data.casualLabourRequestsDelete(userId, id));

// Casuals
ipcMain.handle('casuals:list',   async (_evt, { userId }) => data.casualsList(userId));
ipcMain.handle('casuals:create', async (_evt, { userId, payload }) => data.casualsCreate(userId, payload));
ipcMain.handle('casuals:update', async (_evt, { userId, casualId, payload }) => data.casualsUpdate(userId, casualId, payload));
ipcMain.handle('casuals:delete', async (_evt, { userId, casualId }) => data.casualsDelete(userId, casualId));

ipcMain.handle('ceo:overview', async (_evt, { userId }) => data.getCeoOverview(userId));

// Deletion Requests (supervisor → manager approval workflow)
ipcMain.handle('deletion-requests:create',  async (_evt, { userId, tableName, recordId, entityType, entityRef, reason }) =>
  data.deletionRequestCreate(userId, { tableName, recordId, entityType, entityRef, reason }));
ipcMain.handle('deletion-requests:list',    async (_evt, { userId }) => data.deletionRequestsList(userId));
ipcMain.handle('deletion-requests:approve', async (_evt, { userId, requestId, notes }) => data.deletionRequestApprove(userId, requestId, notes));
ipcMain.handle('deletion-requests:reject',  async (_evt, { userId, requestId, notes }) => data.deletionRequestReject(userId, requestId, notes));

// Trash (soft-deleted records)
ipcMain.handle('trash:list',    async (_evt, { userId }) => data.trashList(userId));
ipcMain.handle('trash:restore', async (_evt, { userId, tableName, recordId }) => data.trashRestore(userId, tableName, recordId));
ipcMain.handle('trash:purge',   async (_evt, { userId, tableName, recordId }) => data.trashPurge(userId, tableName, recordId));

