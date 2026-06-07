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

ipcMain.handle('products:list', async (_evt, { userId, filter }) => data.productsList(userId, filter));
ipcMain.handle('products:create', async (_evt, { userId, payload }) => data.productsCreate(userId, payload));
ipcMain.handle('products:toggle', async (_evt, { userId, productId, reason }) =>
  data.productsToggle(userId, productId, reason)
);
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
ipcMain.handle('inventory:list', async (_evt, { userId }) => data.inventoryList(userId));

// Warehouses
ipcMain.handle('warehouses:list', async (_evt, { userId }) => data.warehousesList(userId));
ipcMain.handle('warehouses:create', async (_evt, { userId, payload }) => data.warehousesCreate(userId, payload));
ipcMain.handle('warehouses:update', async (_evt, { userId, warehouseId, payload }) => data.warehousesUpdate(userId, warehouseId, payload));

// Stock catalog
ipcMain.handle('stock-items:list', async (_evt, { userId }) => data.stockItemsList(userId));
ipcMain.handle('stock-items:create', async (_evt, { userId, payload }) => data.stockItemsCreate(userId, payload));
ipcMain.handle('stock-items:update', async (_evt, { userId, itemId, payload }) => data.stockItemsUpdate(userId, itemId, payload));

// Stock movements
ipcMain.handle('stock-movements:list', async (_evt, { userId }) => data.stockMovementsList(userId));
ipcMain.handle('stock-movements:create', async (_evt, { userId, payload }) => data.stockMovementsCreate(userId, payload));

// Vehicles
ipcMain.handle('vehicles:list', async (_evt, { userId }) => data.vehiclesList(userId));
ipcMain.handle('vehicles:create', async (_evt, { userId, payload }) => data.vehiclesCreate(userId, payload));
ipcMain.handle('vehicles:update', async (_evt, { userId, vehicleId, payload }) => data.vehiclesUpdate(userId, vehicleId, payload));
ipcMain.handle('fuel-logs:list', async (_evt, { userId, vehicleId }) => data.fuelLogsList(userId, vehicleId));
ipcMain.handle('fuel-logs:create', async (_evt, { userId, payload }) => data.fuelLogsCreate(userId, payload));
ipcMain.handle('maintenance:list', async (_evt, { userId, vehicleId }) => data.maintenanceList(userId, vehicleId));
ipcMain.handle('maintenance:create', async (_evt, { userId, payload }) => data.maintenanceCreate(userId, payload));

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
ipcMain.handle('daily:delete', async (_evt, { userId, logId }) => data.dailyDelete(userId, logId));
ipcMain.handle('sales:update', async (_evt, { userId, orderId, payload }) => data.salesUpdate(userId, orderId, payload));
ipcMain.handle('sales:delete', async (_evt, { userId, orderId }) => data.salesDelete(userId, orderId));
ipcMain.handle('logistics:update', async (_evt, { userId, itemId, payload }) => data.logisticsUpdate(userId, itemId, payload));
ipcMain.handle('logistics:delete', async (_evt, { userId, itemId }) => data.logisticsDelete(userId, itemId));
ipcMain.handle('harvest:update', async (_evt, { userId, logId, payload }) => data.harvestUpdate(userId, logId, payload));
ipcMain.handle('harvest:delete', async (_evt, { userId, logId }) => data.harvestDelete(userId, logId));
ipcMain.handle('deliveries:update', async (_evt, { userId, orderId, payload }) => data.deliveryOrdersUpdate(userId, orderId, payload));
ipcMain.handle('deliveries:delete', async (_evt, { userId, orderId }) => data.deliveryOrdersDelete(userId, orderId));
ipcMain.handle('dispatch:delete', async (_evt, { userId, requestId }) => data.dispatchDelete(userId, requestId));
ipcMain.handle('transport:jobs:update', async (_evt, { userId, jobId, payload }) => data.transportJobsUpdate(userId, jobId, payload));
ipcMain.handle('transport:jobs:delete', async (_evt, { userId, jobId }) => data.transportJobsDelete(userId, jobId));
ipcMain.handle('fuel-logs:delete', async (_evt, { userId, logId }) => data.fuelLogsDelete(userId, logId));
ipcMain.handle('maintenance:delete', async (_evt, { userId, recordId }) => data.maintenanceDelete(userId, recordId));
ipcMain.handle('stock-movements:delete', async (_evt, { userId, movementId }) => data.stockMovementsDelete(userId, movementId));
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
ipcMain.handle('machines:list',   async (_evt, { userId }) => data.machinesList(userId));
ipcMain.handle('machines:create', async (_evt, { userId, payload }) => data.machinesCreate(userId, payload));
ipcMain.handle('machines:update', async (_evt, { userId, machineId, payload }) => data.machinesUpdate(userId, machineId, payload));

// Machine Daily Logs
ipcMain.handle('machine-logs:list',   async (_evt, { userId, machineId, month }) => data.machineLogsList(userId, machineId, month));
ipcMain.handle('machine-logs:create', async (_evt, { userId, payload }) => data.machineLogsCreate(userId, payload));
ipcMain.handle('machine-logs:update', async (_evt, { userId, logId, payload }) => data.machineLogsUpdate(userId, logId, payload));
ipcMain.handle('machine-logs:delete', async (_evt, { userId, logId }) => data.machineLogsDelete(userId, logId));

// Machine KPI
ipcMain.handle('machine-kpi:definitions:list',   async (_evt, { userId }) => data.machineKpiDefinitionsList(userId));
ipcMain.handle('machine-kpi:definitions:create', async (_evt, { userId, payload }) => data.machineKpiDefinitionsCreate(userId, payload));
ipcMain.handle('machine-kpi:targets:list', async (_evt, { userId, machineId, month }) => data.machineKpiTargetsList(userId, machineId, month));
ipcMain.handle('machine-kpi:targets:save', async (_evt, { userId, payload }) => data.machineKpiTargetsSave(userId, payload));
ipcMain.handle('machine-kpi:performance',  async (_evt, { userId, month }) => data.machineKpiPerformance(userId, month));

// Machine Maintenance Schedules
ipcMain.handle('machine-maint:list',   async (_evt, { userId, machineId }) => data.machineMaintScheduleList(userId, machineId));
ipcMain.handle('machine-maint:create', async (_evt, { userId, payload }) => data.machineMaintScheduleCreate(userId, payload));
ipcMain.handle('machine-maint:update', async (_evt, { userId, schedId, payload }) => data.machineMaintScheduleUpdate(userId, schedId, payload));

