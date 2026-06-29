'use strict';

const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, ipcMain, dialog, session, Menu } = require('electron');
const { migrate } = require('../db/migrate');

const LOCAL_VERSION = require('../package.json').version;

let autoUpdater = null;

function setupAutoUpdater() {
  ({ autoUpdater } = require('electron-updater'));
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update:available', {
        current: LOCAL_VERSION,
        latest: info.version,
        date: info.releaseDate || '',
        notes: Array.isArray(info.releaseNotes)
          ? info.releaseNotes.map(n => (typeof n === 'string' ? n : n.note || '')).filter(Boolean)
          : info.releaseNotes ? [String(info.releaseNotes)] : []
      });
    }
  });

  autoUpdater.on('download-progress', (progress) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update:progress', {
        percent: Math.round(progress.percent),
        transferred: progress.transferred,
        total: progress.total,
        bytesPerSecond: progress.bytesPerSecond
      });
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update:downloaded', { version: info.version });
    }
  });

  autoUpdater.on('error', (err) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update:error', { message: err?.message || String(err) });
    }
  });
}

const { closePool } = require('../db/pool');
const auth = require('../db/services/auth');
const data = require('../db/services/data');

let mainWindow;
let _jobQueueTimer = null;
let _isQuitting = false;

// ── Server-side session store ─────────────────────────────────────────────────
// Maps webContents.id → authenticated userId (string).
// The renderer is NEVER trusted for identity. userId is always resolved here.
const _sessions = new Map();

function getSessionUserId(evt) {
  return _sessions.get(evt.sender.id) ?? null;
}

// Wraps every authenticated IPC handler with a mandatory session check.
// fn receives (userId, rendererArgs) — userId always comes from the session map,
// never from the renderer payload.
function secureHandle(channel, fn) {
  ipcMain.handle(channel, async (evt, args = {}) => {
    const userId = getSessionUserId(evt);
    if (userId == null) return { ok: false, error: 'Unauthorized session' };
    try {
      return await fn(userId, args);
    } catch (e) {
      console.error(`[ipc:${channel}]`, e.message);
      return { ok: false, error: 'Internal error' };
    }
  });
}

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

  // ── DevTools lockdown (production only) ─────────────────────────────────────
  // In development, DevTools auto-opens as before.
  // In production, all keyboard shortcuts and the application menu are removed
  // so no user can open a console and execute arbitrary IPC calls.
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    Menu.setApplicationMenu(null);
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (
        input.key === 'F12' ||
        (input.control && input.shift && ['i', 'I', 'j', 'J', 'c', 'C'].includes(input.key))
      ) {
        event.preventDefault();
      }
    });
  }

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  mainWindow.webContents.on('console-message', (event) => {
    const { level, message, lineNumber, sourceId } = event;
    if (typeof sourceId === 'string' && sourceId.startsWith('devtools://')) {
      if (message && message.includes('Autofill')) return;
    }
    const lvl = ['log', 'warn', 'error'][Math.min(Math.max(level - 1, 0), 2)] || 'log';
    console[lvl](`[renderer:${lvl}] ${message} (${sourceId}:${lineNumber})`);
  });
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    dialog.showErrorBox('UI failed to load', `Code: ${code}\n${desc}\n${url}`);
  });
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

  // Check for updates 4 seconds after startup (only in packaged app)
  if (app.isPackaged) {
    setupAutoUpdater();
    setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 4000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Graceful shutdown — runs before every quit() and before quitAndInstall().
// Stops all background timers, waits for the pool to drain, then exits cleanly
// so the installer can replace the .exe without a "please close manually" prompt.
app.on('before-quit', async (e) => {
  e.preventDefault(); // block all app.quit() paths; only app.exit() bypasses this
  if (_isQuitting) return;
  _isQuitting = true;

  // 1. Stop intervals — no new ticks will fire after this point
  if (_jobQueueTimer) { clearInterval(_jobQueueTimer); _jobQueueTimer = null; }
  data.stopJobProcessor();
  data.stopScheduler();

  // 2. Drain the pg pool — waits for any in-flight queries then closes all
  //    server-side connections (8 s hard cap to avoid blocking the installer)
  try {
    await Promise.race([closePool(), new Promise(r => setTimeout(r, 8_000))]);
  } catch { /* pool already closed or never opened */ }

  // 3. Exit without re-triggering before-quit
  app.exit(0);
});

// ── Public handlers (no session required) ────────────────────────────────────

ipcMain.handle('app:getVersion', () => ({ version: LOCAL_VERSION }));

ipcMain.handle('update:download', async () => {
  try { await autoUpdater.downloadUpdate(); return { ok: true }; }
  catch (e) { return { ok: false, error: e?.message || String(e) }; }
});

ipcMain.handle('update:install', () => {
  autoUpdater.quitAndInstall(false, true);
});

// ── Authentication (manages session lifecycle) ────────────────────────────────

ipcMain.handle('auth:login', async (evt, { username, password }) => {
  const result = await auth.login(username, password);
  if (result?.ok && result?.user?.id != null) {
    // Bind this webContents to the authenticated userId — server-side only.
    _sessions.set(evt.sender.id, result.user.id);
    // Clean up when the window closes so there is no stale session.
    evt.sender.once('destroyed', () => _sessions.delete(evt.sender.id));
  }
  return result;
});

ipcMain.handle('auth:logout', async (evt) => {
  _sessions.delete(evt.sender.id);
  return { ok: true };
});

// ── All authenticated handlers ────────────────────────────────────────────────
// userId is ALWAYS resolved from the session map by secureHandle.
// The renderer payload must NOT include userId — it is ignored even if present.

secureHandle('app:getBootstrap', (userId) => data.getBootstrap(userId));

// Daily logs
secureHandle('daily:list',         (userId, { workshopId }) => data.dailyList(userId, workshopId));
secureHandle('daily:create',       (userId, { payload })    => data.dailyCreate(userId, payload));
secureHandle('daily:harvest-data', (userId, { workshopId }) => data.dailyHarvestData(userId, workshopId));
secureHandle('daily:update',       (userId, { logId, payload }) => data.dailyUpdate(userId, logId, payload));
secureHandle('daily:delete',       (userId, { logId, reason }) => data.dailyDelete(userId, logId, reason));

secureHandle('production:staff-list', (userId) => data.productionStaffList(userId));

// Poles
secureHandle('poles:purchase-list',    (userId, { workshopId }) => data.polesPurchaseList(userId, workshopId));
secureHandle('poles:purchase-create',  (userId, { payload })    => data.polesPurchaseCreate(userId, payload));
secureHandle('poles:purchase-approve', (userId, { requestId, approve, rejectionReason }) =>
  data.polesPurchaseApprove(userId, requestId, approve, rejectionReason));
secureHandle('poles:delivery-create',  (userId, { payload })           => data.polesDeliveryCreate(userId, payload));
secureHandle('poles:delivery-qc',      (userId, { deliveryId, payload }) => data.polesDeliveryQualityCheck(userId, deliveryId, payload));

secureHandle('vat:inbound-list', (userId) => data.vatInboundList(userId));

// Sales
secureHandle('sales:list',                 (userId, { workshopId }) => data.salesList(userId, workshopId));
secureHandle('sales:create',               (userId, { payload })    => data.salesCreate(userId, payload));
secureHandle('sales:update',               (userId, { orderId, payload }) => data.salesUpdate(userId, orderId, payload));
secureHandle('sales:delete',               (userId, { orderId, reason }) => data.salesDelete(userId, orderId, reason));
secureHandle('sales:updateStatus',         (userId, { orderId, status })  => data.salesUpdateStatus(userId, orderId, status));
secureHandle('sales:update-payment',       (userId, { orderId, paymentStatus }) => data.salesUpdatePayment(userId, orderId, paymentStatus));
secureHandle('sales:products-for-dropdown',(userId) => data.salesProductsForDropdown(userId));
secureHandle('sales:closeShort',           (userId, { soId }) => data.salesCloseShort(userId, soId));

// Customers
secureHandle('customers:for-dropdown', (userId) => data.customersForDropdown(userId));
secureHandle('customers:list',         (userId) => data.customersList(userId));
secureHandle('customers:create',       (userId, { payload }) => data.customersCreate(userId, payload));
secureHandle('customers:update',       (userId, { customerId, payload }) => data.customersUpdate(userId, customerId, payload));

// Products
secureHandle('products:list',            (userId, { filter }) => data.productsList(userId, filter));
secureHandle('products:create',          (userId, { payload }) => data.productsCreate(userId, payload));
secureHandle('products:toggle',          (userId, { productId, reason }) => data.productsToggle(userId, productId, reason));
secureHandle('products:update',          (userId, { productId, payload }) => data.productsUpdate(userId, productId, payload));
secureHandle('products:active-for-form', (userId, { type }) => data.productsActiveForForm(userId, type));
secureHandle('products:catalog',         (userId) => data.productCatalogList(userId));
secureHandle('machines:for-dropdown',    (userId) => data.machinesForDropdown(userId));

// Reports / KPI
secureHandle('weekly:cost',         (userId) => data.weeklyCostReport(userId));
secureHandle('weekly:expenses:save',(userId, { payload }) => data.weeklyExpensesSave(userId, payload));
secureHandle('weekly:perf',         (userId) => data.weeklyPerformanceReport(userId));
secureHandle('monthly:dashboard',   (userId, { month }) => data.monthlyDashboard(userId, month));
secureHandle('monthly:approve',     (userId, { monthKey }) => data.monthlyApprove(userId, monthKey));
secureHandle('dashboard:stats',     (userId) => data.getDashboardStats(userId));
secureHandle('kpi:budgets:list',    (userId, { month }) => data.kpiBudgetsList(userId, month));
secureHandle('kpi:budgets:save',    (userId, { payload }) => data.kpiBudgetSave(userId, payload));
secureHandle('inventory:list',      (userId, { workshopId }) => data.inventoryList(userId, workshopId));

// Logistics
secureHandle('logistics:list',      (userId) => data.logisticsList(userId));
secureHandle('logistics:create',    (userId, { payload }) => data.logisticsCreate(userId, payload));
secureHandle('logistics:update',    (userId, { itemId, payload }) => data.logisticsUpdate(userId, itemId, payload));
secureHandle('logistics:delete',    (userId, { itemId }) => data.logisticsDelete(userId, itemId));
secureHandle('logistics:dashboard', (userId) => data.logisticsDashboard(userId));

// Audit + Notifications
secureHandle('audit:list',                (userId, { filters }) => data.auditList(userId, filters));
secureHandle('notifications:list',        (userId, { filters } = {}) => data.notificationsList(userId, filters || {}));
secureHandle('notifications:poll',        (userId) => data.notificationsPoll(userId));
secureHandle('notifications:markRead',    (userId, { notificationId }) => data.notificationsMarkRead(userId, notificationId));
secureHandle('notifications:markAllRead', (userId) => data.notificationsMarkAllRead(userId));

// Security & Governance Dashboard
secureHandle('secgov:dashboard', (userId) => data.secGovDashboard(userId));

// Executive Analytics & Reporting — Phase 6F
secureHandle('exec:dashboard', (userId) => data.executiveDashboard(userId));
ipcMain.handle('exec:export', async (_e, { csv, filename }) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export Executive Report',
    defaultPath: filename || 'ufcl_executive_report.csv',
    filters: [{ name: 'CSV Files', extensions: ['csv'] }],
  });
  if (canceled || !filePath) return { ok: false };
  try {
    fs.writeFileSync(filePath, '﻿' + csv, 'utf8'); // BOM for Excel UTF-8
    return { ok: true, filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// Phase 7 — Business Intelligence
secureHandle('bi:dashboard', (userId) => data.businessIntelligenceDashboard(userId));

// Phase 8 — Intelligent Automation Engine
secureHandle('automation:rules',  (userId)                    => data.getAutomationRules(userId));
secureHandle('automation:toggle', (userId, { ruleKey, enabled }) => data.toggleAutomationRule(userId, ruleKey, enabled));
secureHandle('automation:log',    (userId, filters)           => data.getAutomationLog(userId, filters));
secureHandle('automation:run',    (userId)                    => data.triggerAutomationNow(userId));
// Phase 8 Part 3 — Rule Engine management
secureHandle('automation:rule',   (userId, { ruleKey })       => data.getAutomationRule(userId, ruleKey));
secureHandle('automation:update', (userId, { ruleKey, updates }) => data.updateAutomationRule(userId, ruleKey, updates));
secureHandle('automation:delete', (userId, { ruleKey })       => data.deleteAutomationRule(userId, ruleKey));
secureHandle('automation:create', (userId, payload)           => data.createAutomationRule(userId, payload));
// Phase 8 Part 4 — Escalation Engine
secureHandle('escalation:list',    (userId, filters)             => data.getEscalations(userId, filters));
secureHandle('escalation:history', (userId, { escalationId })   => data.getEscalationHistory(userId, escalationId));
secureHandle('escalation:resolve', (userId, { escalationId, reason }) => data.resolveEscalation(userId, escalationId, reason));
secureHandle('escalation:ack',     (userId, { escalationId })   => data.acknowledgeEscalation(userId, escalationId));
// Phase 8 Part 5/6 — Automation Dashboard + canonical IPC aliases
secureHandle('automation:dashboard',  (userId)                        => data.automationDashboard(userId));
secureHandle('automation:history',    (userId, filters)               => data.getAutomationLog(userId, filters));
secureHandle('automation:updateRule', (userId, { ruleKey, updates })  => data.updateAutomationRule(userId, ruleKey, updates));

// Phase 9 — Enterprise Performance Management
secureHandle('performance:dashboard',   (userId) => data.performanceDashboard(userId));
secureHandle('performance:kpis',        (userId) => data.performanceKPIs(userId));
secureHandle('performance:departments', (userId) => data.departmentScorecards(userId));
secureHandle('performance:executive',   (userId) => data.executiveScorecard(userId));
secureHandle('performance:trends',      (userId) => data.performanceTrends(userId));
secureHandle('performance:plans',       (userId) => data.performanceActionPlans(userId));
ipcMain.handle('performance:export', async (_e, { csv, filename }) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export EPM Report',
    defaultPath: filename || 'ufcl_epm_report.csv',
    filters: [{ name: 'CSV Files', extensions: ['csv'] }],
  });
  if (canceled || !filePath) return { ok: false };
  try {
    fs.writeFileSync(filePath, '﻿' + csv, 'utf8');
    return { ok: true, filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('bi:export', async (_e, { csv, filename }) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export BI Report',
    defaultPath: filename || 'ufcl_bi_report.csv',
    filters: [{ name: 'CSV Files', extensions: ['csv'] }],
  });
  if (canceled || !filePath) return { ok: false };
  try {
    fs.writeFileSync(filePath, '﻿' + csv, 'utf8');
    return { ok: true, filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// Change requests
secureHandle('changes:list',   (userId) => data.changesList(userId));
secureHandle('changes:create', (userId, { payload }) => data.changesCreate(userId, payload));
secureHandle('changes:review', (userId, { changeId, status, response }) => data.changesReview(userId, changeId, status, response));

// User management
secureHandle('users:list',          (userId) => data.usersList(userId));
secureHandle('users:create',        (userId, { payload }) => data.usersCreate(userId, payload));
secureHandle('users:update',        (userId, { targetUserId, payload }) => data.usersUpdate(userId, targetUserId, payload));
secureHandle('users:resetPassword', (userId, { targetUserId, newPassword }) => data.usersResetPassword(userId, targetUserId, newPassword));
secureHandle('users:delete',        (userId, { targetUserId }) => data.usersDelete(userId, targetUserId));
secureHandle('roles:list',          (userId) => data.rolesList(userId));
secureHandle('roles:update',        (userId, { role, payload }) => data.rolesUpdate(userId, role, payload));

// Warehouses
secureHandle('warehouses:list',   (userId, { workshopId }) => data.warehousesList(userId, workshopId));
secureHandle('warehouses:create', (userId, { payload }) => data.warehousesCreate(userId, payload));
secureHandle('warehouses:update', (userId, { warehouseId, payload }) => data.warehousesUpdate(userId, warehouseId, payload));
secureHandle('warehouses:delete', (userId, { warehouseId }) => data.warehousesDelete(userId, warehouseId));

// Stock catalog
secureHandle('stock-items:list',         (userId, { workshopId }) => data.stockItemsList(userId, workshopId));
secureHandle('stock-items:create',       (userId, { payload }) => data.stockItemsCreate(userId, payload));
secureHandle('stock-items:update',       (userId, { itemId, payload }) => data.stockItemsUpdate(userId, itemId, payload));
secureHandle('stock-items:delete',       (userId, { itemId }) => data.stockItemsDelete(userId, itemId));
secureHandle('stock-categories:list',    (userId) => data.stockCategoriesList(userId));
secureHandle('stock-categories:create',  (userId, { name }) => data.stockCategoriesCreate(userId, name));
secureHandle('stock-categories:delete',  (userId, { categoryId }) => data.stockCategoriesDelete(userId, categoryId));

// Stock movements
secureHandle('stock-movements:list',             (userId, { workshopId }) => data.stockMovementsList(userId, workshopId));
secureHandle('stock-movements:create',           (userId, { payload }) => data.stockMovementsCreate(userId, payload));
secureHandle('stock-movements:delete',           (userId, { movementId, reason }) => data.stockMovementsDelete(userId, movementId, reason));
secureHandle('stock-movements:transfer-approve', (userId, { movementId, action, rejectionReason }) =>
  data.stockTransferApprove(userId, movementId, action, rejectionReason));

// Stock transfers
secureHandle('stock-transfers:list',             (userId, { workshopId }) => data.stockTransfersList(userId, workshopId));
secureHandle('stock-transfers:create',           (userId, { payload }) => data.stockTransfersCreate(userId, payload));
secureHandle('stock-transfers:approve',          (userId, { transferId, action, reason }) => data.stockTransfersApproveReject(userId, transferId, action, reason));
secureHandle('stock-transfers:dispatch',         (userId, { transferId, payload }) => data.stockTransfersDispatch(userId, transferId, payload));
secureHandle('stock-transfers:dispatch-history', (userId, { transferId }) => data.stockTransfersDispatchHistory(userId, transferId));
secureHandle('stock-transfers:receive',          (userId, { transferId, qty, notes }) => data.stockTransfersReceive(userId, transferId, qty, notes));

// Material requests
secureHandle('material-requests:list',    (userId, { workshopId }) => data.materialRequestsList(userId, workshopId));
secureHandle('material-requests:create',  (userId, { payload }) => data.materialRequestsCreate(userId, payload));
secureHandle('material-requests:approve', (userId, { requestId, action, approvedQty, reviewNotes, sourceWarehouseId }) =>
  data.materialRequestsApprove(userId, requestId, action, approvedQty, reviewNotes, sourceWarehouseId));

secureHandle('workshop:overview', (userId) => data.workshopOverview(userId));

// Vehicles
secureHandle('transport-companies:dropdown',  (userId) => data.transportCompaniesForDropdown(userId));
secureHandle('vehicles:for-transport',        (userId) => data.vehiclesForTransport(userId));
secureHandle('vehicles:list',                 (userId) => data.vehiclesList(userId));
secureHandle('vehicles:create',               (userId, { payload }) => data.vehiclesCreate(userId, payload));
secureHandle('vehicles:update',               (userId, { vehicleId, payload }) => data.vehiclesUpdate(userId, vehicleId, payload));
secureHandle('vehicles:delete',               (userId, { vehicleId }) => data.vehiclesDelete(userId, vehicleId));

// Fuel logs
secureHandle('fuel-logs:list',   (userId, { vehicleId }) => data.fuelLogsList(userId, vehicleId));
secureHandle('fuel-logs:create', (userId, { payload }) => data.fuelLogsCreate(userId, payload));
secureHandle('fuel-logs:delete', (userId, { logId }) => data.fuelLogsDelete(userId, logId));

// Vehicle maintenance
secureHandle('maintenance:list',   (userId, { vehicleId }) => data.maintenanceList(userId, vehicleId));
secureHandle('maintenance:create', (userId, { payload }) => data.maintenanceCreate(userId, payload));
secureHandle('maintenance:update', (userId, { recordId, payload }) => data.maintenanceUpdate(userId, recordId, payload));
secureHandle('maintenance:delete', (userId, { recordId, reason }) => data.maintenanceDelete(userId, recordId, reason));

// Deliveries
secureHandle('deliveries:list',      (userId) => data.deliveryOrdersList(userId));
secureHandle('deliveries:create',    (userId, { payload }) => data.deliveryOrdersCreate(userId, payload));
secureHandle('deliveries:update',    (userId, { orderId, payload }) => data.deliveryOrdersUpdate(userId, orderId, payload));
secureHandle('deliveries:delete',    (userId, { orderId }) => data.deliveryOrdersDelete(userId, orderId));
secureHandle('deliveries:updateStatus', (userId, { orderId, status }) => data.deliveryOrdersUpdateStatus(userId, orderId, status));
secureHandle('deliveries:recordPOD', (userId, { orderId, payload }) => data.deliveryOrdersRecordPOD(userId, orderId, payload));

// Dispatch
secureHandle('dispatch:list',   (userId) => data.dispatchList(userId));
secureHandle('dispatch:create', (userId, { payload }) => data.dispatchCreate(userId, payload));
secureHandle('dispatch:review', (userId, { requestId, status, notes }) => data.dispatchReview(userId, requestId, status, notes));
secureHandle('dispatch:delete', (userId, { requestId }) => data.dispatchDelete(userId, requestId));

// Harvest
secureHandle('harvest:list',   (userId, { workshopId }) => data.harvestList(userId, workshopId));
secureHandle('harvest:create', (userId, { payload }) => data.harvestCreate(userId, payload));
secureHandle('harvest:update', (userId, { logId, payload }) => data.harvestUpdate(userId, logId, payload));
secureHandle('harvest:delete', (userId, { logId, reason }) => data.harvestDelete(userId, logId, reason));

// Timber inventory
secureHandle('timber-inventory:list', (userId) => data.timberInventoryList(userId));

// Pending edit approvals
secureHandle('pending-edits:list',   (userId) => data.pendingEditsList(userId));
secureHandle('pending-edits:create', (userId, { payload }) => data.pendingEditsCreate(userId, payload));
secureHandle('pending-edits:review', (userId, { pendingId, status, reviewNotes }) =>
  data.pendingEditsReview(userId, pendingId, status, reviewNotes));

// Third-party transport
secureHandle('transport:companies:list',         (userId) => data.transportCompaniesList(userId));
secureHandle('transport:companies:create',       (userId, { payload }) => data.transportCompaniesCreate(userId, payload));
secureHandle('transport:companies:update',       (userId, { companyId, payload }) => data.transportCompaniesUpdate(userId, companyId, payload));
secureHandle('transport:companies:delete',       (userId, { companyId }) => data.transportCompaniesDelete(userId, companyId));
secureHandle('transport:jobs:list',              (userId) => data.transportJobsList(userId));
secureHandle('transport:jobs:create',            (userId, { payload }) => data.transportJobsCreate(userId, payload));
secureHandle('transport:jobs:update',            (userId, { jobId, payload }) => data.transportJobsUpdate(userId, jobId, payload));
secureHandle('transport:jobs:delete',            (userId, { jobId }) => data.transportJobsDelete(userId, jobId));
secureHandle('transport:jobs:updateStatus',      (userId, { jobId, status }) => data.transportJobsUpdateStatus(userId, jobId, status));

// Machine management
secureHandle('machines:categories:list',   (userId) => data.machineCategoriesList(userId));
secureHandle('machines:categories:create', (userId, { payload }) => data.machineCategoriesCreate(userId, payload));
secureHandle('machines:categories:update', (userId, { categoryId, payload }) => data.machineCategoriesUpdate(userId, categoryId, payload));
secureHandle('machines:categories:delete', (userId, { categoryId }) => data.machineCategoriesDelete(userId, categoryId));
secureHandle('machines:list',              (userId) => data.machinesList(userId));
secureHandle('machines:create',            (userId, { payload }) => data.machinesCreate(userId, payload));
secureHandle('machines:update',            (userId, { machineId, payload }) => data.machinesUpdate(userId, machineId, payload));
secureHandle('machines:delete',            (userId, { machineId }) => data.machinesDelete(userId, machineId));

// Machine log item categories
secureHandle('machine-log-cats:list',   (userId) => data.machineLogCategoriesList(userId));
secureHandle('machine-log-cats:create', (userId, { payload }) => data.machineLogCategoriesCreate(userId, payload));
secureHandle('machine-log-cats:delete', (userId, { id }) => data.machineLogCategoriesDelete(userId, id));

// Machine daily logs
secureHandle('machine-logs:list',        (userId, { machineId, month, workshopId }) => data.machineLogsList(userId, machineId, month, workshopId));
secureHandle('machine-logs:create',      (userId, { payload }) => data.machineLogsCreate(userId, payload));
secureHandle('machine-logs:update',      (userId, { logId, payload }) => data.machineLogsUpdate(userId, logId, payload));
secureHandle('machine-logs:delete',      (userId, { logId, reason }) => data.machineLogsDelete(userId, logId, reason));
secureHandle('machine-logs:fuel-issued', (userId, { machineId, logDate }) => data.machineFuelIssuedLookup(userId, machineId, logDate));

// Machine KPI
secureHandle('machine-kpi:definitions:list',   (userId) => data.machineKpiDefinitionsList(userId));
secureHandle('machine-kpi:definitions:create', (userId, { payload }) => data.machineKpiDefinitionsCreate(userId, payload));
secureHandle('machine-kpi:definitions:update', (userId, { kpiId, payload }) => data.machineKpiDefinitionsUpdate(userId, kpiId, payload));
secureHandle('machine-kpi:definitions:delete', (userId, { kpiId }) => data.machineKpiDefinitionsDelete(userId, kpiId));
secureHandle('machine-kpi:targets:list',       (userId, { machineId, month }) => data.machineKpiTargetsList(userId, machineId, month));
secureHandle('machine-kpi:targets:save',       (userId, { payload }) => data.machineKpiTargetsSave(userId, payload));
secureHandle('machine-kpi:performance',        (userId, { month }) => data.machineKpiPerformance(userId, month));

// Machine maintenance schedules
secureHandle('machine-maint:list',   (userId, { machineId }) => data.machineMaintScheduleList(userId, machineId));
secureHandle('machine-maint:create', (userId, { payload }) => data.machineMaintScheduleCreate(userId, payload));
secureHandle('machine-maint:update', (userId, { schedId, payload }) => data.machineMaintScheduleUpdate(userId, schedId, payload));
secureHandle('machine-maint:delete', (userId, { schedId }) => data.machineMaintScheduleDelete(userId, schedId));

// Compartments
secureHandle('compartments:list',         (userId) => data.compartmentsList(userId));
secureHandle('compartments:create',       (userId, { payload }) => data.compartmentsCreate(userId, payload));
secureHandle('compartments:update',       (userId, { comptId, payload }) => data.compartmentsUpdate(userId, comptId, payload));
secureHandle('compartments:delete',       (userId, { comptId, reason }) => data.compartmentsDelete(userId, comptId, reason));
secureHandle('compartments:for-dropdown', (userId) => data.compartmentsForDropdown(userId));

// Log transport
secureHandle('log-transport:list',   (userId, { workshopId }) => data.logTransportList(userId, workshopId));
secureHandle('log-transport:create', (userId, { payload }) => data.logTransportCreate(userId, payload));
secureHandle('log-transport:update', (userId, { id, payload }) => data.logTransportUpdate(userId, id, payload));
secureHandle('log-transport:delete', (userId, { id, reason }) => data.logTransportDelete(userId, id, reason));

// Value-added timber
secureHandle('value-added-timber:list',   (userId, { workshopId }) => data.valueAddedTimberList(userId, workshopId));
secureHandle('value-added-timber:create', (userId, { payload }) => data.valueAddedTimberCreate(userId, payload));
secureHandle('value-added-timber:update', (userId, { id, payload }) => data.valueAddedTimberUpdate(userId, id, payload));
secureHandle('value-added-timber:delete', (userId, { id, reason }) => data.valueAddedTimberDelete(userId, id, reason));

// Machine fuel logs
secureHandle('machine-fuel:dropdown', (userId) => data.machineFuelDropdown(userId));
secureHandle('machine-fuel:summary',  (userId, { month }) => data.machineFuelSummary(userId, month));
secureHandle('machine-fuel:list',     (userId) => data.machineFuelLogsList(userId));
secureHandle('machine-fuel:create',   (userId, { payload }) => data.machineFuelLogsCreate(userId, payload));
secureHandle('machine-fuel:update',   (userId, { id, payload }) => data.machineFuelLogsUpdate(userId, id, payload));
secureHandle('machine-fuel:delete',   (userId, { id, reason }) => data.machineFuelLogsDelete(userId, id, reason));

// Casual labour
secureHandle('casual-requests:list',   (userId, { workshopId }) => data.casualLabourRequestsList(userId, workshopId));
secureHandle('casual-requests:create', (userId, { payload }) => data.casualLabourRequestsCreate(userId, payload));
secureHandle('casual-requests:submit', (userId, { payload }) => data.casualLabourRequestsSubmit(userId, payload));
secureHandle('casual-requests:review', (userId, { requestId, status }) => data.casualLabourRequestsReview(userId, requestId, status));
secureHandle('casual-requests:delete', (userId, { id }) => data.casualLabourRequestsDelete(userId, id));

secureHandle('casuals:list',   (userId, { workshopId }) => data.casualsList(userId, workshopId));
secureHandle('casuals:create', (userId, { payload }) => data.casualsCreate(userId, payload));
secureHandle('casuals:update', (userId, { casualId, payload }) => data.casualsUpdate(userId, casualId, payload));
secureHandle('casuals:delete', (userId, { casualId }) => data.casualsDelete(userId, casualId));

// CEO overview
secureHandle('ceo:overview', (userId) => data.getCeoOverview(userId));

// Deletion request workflow
secureHandle('deletion-requests:create',  (userId, { tableName, recordId, entityType, entityRef, reason }) =>
  data.deletionRequestCreate(userId, { tableName, recordId, entityType, entityRef, reason }));
secureHandle('deletion-requests:list',    (userId) => data.deletionRequestsList(userId));
secureHandle('deletion-requests:approve', (userId, { requestId, notes }) => data.deletionRequestApprove(userId, requestId, notes));
secureHandle('deletion-requests:reject',  (userId, { requestId, notes }) => data.deletionRequestReject(userId, requestId, notes));

// Step 3 — Unified approval engine
// Single entry point that replaces the separate approve/reject handlers above.
// requestType: 'edit' | 'delete' ; decision: 'Approved' | 'Rejected'
secureHandle('approvals:process',
  (userId, { requestType, requestId, decision, notes }) =>
    data.processApprovalDecision(userId, requestType, requestId, decision, notes));
secureHandle('approvals:dashboard', (userId) => data.getApprovalDashboard(userId));

// Trash (soft-deleted records)
secureHandle('trash:list',    (userId) => data.trashList(userId));
secureHandle('trash:restore', (userId, { tableName, recordId }) => data.trashRestore(userId, tableName, recordId));
secureHandle('trash:purge',   (userId, { tableName, recordId }) => data.trashPurge(userId, tableName, recordId));

// ── Step 4: Persistent Job Queue Runner ──────────────────────────────────────
// Replaces the Step 3 in-memory escalation timer.
// recoverWorkflowState() runs once on startup to:
//   • reset any jobs stuck in 'processing' (crashed mid-run)
//   • re-schedule missing escalation jobs for all pending requests
// processWorkflowJobs() then runs every 2 minutes to drain the queue.
// All escalation, notification-retry, and audit-replay jobs are in the DB
// and survive app restarts — no critical logic lives in memory.
app.whenReady().then(async () => {
  // Recover any jobs stranded in 'processing' from a previous crash
  try {
    await data.recoverWorkflowState();
  } catch (e) {
    console.error('[startup] recoverWorkflowState failed:', e.message);
  }

  // High-frequency job-queue drain — every 2 minutes
  // Handles notification retries, audit replays, and escalation jobs
  // with low latency independent of the 15-minute scheduler.
  _jobQueueTimer = setInterval(() => data.processWorkflowJobs(), 2 * 60 * 1_000);

  // Phase 8 Part 2 — Internal Scheduler (15-minute interval)
  // Runs: BI scan · security scan · workflow scan ·
  //       approval SLA scan · notification cleanup · workflow job retry
  // Singleton-guarded: safe to call here and from any future hot-reload path.
  data.startScheduler();
});
