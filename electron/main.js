'use strict';

const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, ipcMain, dialog, session, Menu, powerMonitor } = require('electron');
const { migrate } = require('../db/migrate');

const LOCAL_VERSION = require('../package.json').version;

// Safety net: pg-pool can emit a secondary ECONNABORTED when it calls
// client.end() on a socket that died during machine sleep.  That error
// bypasses pg's own error chain and surfaces as an uncaught exception.
// We swallow known stale-connection codes here so the app stays alive.
const _STALE_CODES = new Set(['ECONNABORTED', 'ECONNRESET', 'EPIPE', 'ETIMEDOUT']);
process.on('uncaughtException', (err, origin) => {
  if (_STALE_CODES.has(err.code)) {
    console.warn('[main] suppressed stale-connection error (machine sleep):', err.code);
    return;
  }
  // Re-throw real errors so Electron's default handler shows the crash dialog.
  throw err;
});

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

const { closePool, pool } = require('../db/pool');
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

  // When the machine wakes from sleep, idle pg connections are dead but the
  // pool doesn't know yet.  Proactively run a SELECT 1 so the pool detects and
  // replaces stale clients before the first real query hits them.
  powerMonitor.on('resume', async () => {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      console.log('[power] db connection verified after system resume');
    } catch (e) {
      console.warn('[power] db reconnect probe after resume failed:', e.message);
    }
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
secureHandle('daily:list',         (userId, { workshopId, filters }) => data.dailyList(userId, workshopId, filters));
secureHandle('daily:create',       (userId, { payload })    => data.dailyCreate(userId, payload));
secureHandle('daily:harvest-data', (userId, { workshopId }) => data.dailyHarvestData(userId, workshopId));
secureHandle('daily:update',       (userId, { logId, payload }) => data.dailyUpdate(userId, logId, payload));
secureHandle('daily:delete',       (userId, { logId, reason }) => data.dailyDelete(userId, logId, reason));
secureHandle('sawmill:dashboard',  (userId, { workshopId }) => data.sawmillManagerDashboard(userId, workshopId));

secureHandle('production:staff-list', (userId) => data.productionStaffList(userId));

// Poles
secureHandle('poles:purchase-list',    (userId, { workshopId }) => data.polesPurchaseList(userId, workshopId));
secureHandle('poles:purchase-create',  (userId, { payload })    => data.polesPurchaseCreate(userId, payload));
secureHandle('poles:purchase-approve', (userId, { requestId, approve, rejectionReason }) =>
  data.polesPurchaseApprove(userId, requestId, approve, rejectionReason));
secureHandle('poles:delivery-create',  (userId, { payload })           => data.polesDeliveryCreate(userId, payload));
secureHandle('poles:delivery-qc',      (userId, { deliveryId, payload }) => data.polesDeliveryQualityCheck(userId, deliveryId, payload));

// Pole Production Phase 1
secureHandle('poles:production-list',           (userId, { workshopId })          => data.poleProductionBatchesList(userId, workshopId));
secureHandle('poles:production-create',         (userId, { payload })             => data.poleProductionBatchCreate(userId, payload));
secureHandle('poles:production-delete',         (userId, { batchId, reason })     => data.poleProductionBatchDelete(userId, batchId, reason));
secureHandle('poles:production-inspect',        (userId, { outputId, payload })   => data.poleProductionInspect(userId, outputId, payload));
secureHandle('poles:production-reconciliation', (userId, { workshopId })          => data.poleProductionReconciliation(userId, workshopId));

// Pole Production Phase 2 — Purchased Finished Poles
secureHandle('poles:purchased-pending-qc', (userId, { workshopId })              => data.procurementGoodsReceiptPendingPoleQC(userId, workshopId));
secureHandle('poles:purchased-inspect',    (userId, { receiptItemId, payload })  => data.procurementGoodsReceiptInspect(userId, receiptItemId, payload));
secureHandle('poles:source-report',        (userId, { workshopId })              => data.polesSourceReport(userId, workshopId));

secureHandle('vat:available-inputs', (userId, { workshopId }) => data.valueAddedProductionAvailableInputs(userId, workshopId));

// Sales
secureHandle('sales:list',                 (userId, opts) => data.salesList(userId, opts));
secureHandle('sales:get',                  (userId, { orderId }) => data.salesGet(userId, orderId));
// Same base64 round-trip as payroll:exportExcel (electron/main.js:751) — avoids
// relying on binary structured-clone across the context-isolation boundary.
secureHandle('sales:exportExcel',          async (userId, opts) => {
  const res = await data.salesOrdersExportExcel(userId, opts);
  if (!res.ok) return res;
  return { ok: true, filename: res.filename, rowCount: res.rowCount, base64: Buffer.from(res.buffer).toString('base64') };
});
secureHandle('sales:create',               (userId, { payload })    => data.salesCreate(userId, payload));
secureHandle('sales:update',               (userId, { orderId, payload }) => data.salesUpdate(userId, orderId, payload));
secureHandle('sales:delete',               (userId, { orderId, reason }) => data.salesDelete(userId, orderId, reason));
secureHandle('sales:updateStatus',         (userId, { orderId, status })  => data.salesUpdateStatus(userId, orderId, status));
secureHandle('sales:update-payment',       (userId, { orderId, paymentStatus }) => data.salesUpdatePayment(userId, orderId, paymentStatus));
secureHandle('sales:products-for-dropdown',(userId) => data.salesProductsForDropdown(userId));
secureHandle('sales:closeShort',           (userId, { soId }) => data.salesCloseShort(userId, soId));
secureHandle('sales:dashboard',            (userId, { workshopId }) => data.salesDashboard(userId, workshopId));
secureHandle('sales:report',               (userId, { filters }) => data.salesReport(userId, filters));

// Customers
secureHandle('customers:for-dropdown', (userId) => data.customersForDropdown(userId));
secureHandle('customers:list',         (userId) => data.customersList(userId));
secureHandle('customers:create',       (userId, { payload }) => data.customersCreate(userId, payload));
secureHandle('customers:update',       (userId, { customerId, payload }) => data.customersUpdate(userId, customerId, payload));
secureHandle('customers:toggle',       (userId, { customerId, reason }) => data.customersToggle(userId, customerId, reason));
secureHandle('customers:orders',       (userId, { customerId }) => data.customersOrders(userId, customerId));

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
secureHandle('inventory:dashboard', (userId, { workshopId }) => data.inventoryDashboard(userId, workshopId));
secureHandle('inventory:intelligence', (userId, { workshopId }) => data.inventoryIntelligence(userId, workshopId));

// Logistics
secureHandle('logistics:list',      (userId) => data.logisticsList(userId));
secureHandle('logistics:create',    (userId, { payload }) => data.logisticsCreate(userId, payload));
secureHandle('logistics:update',    (userId, { itemId, payload }) => data.logisticsUpdate(userId, itemId, payload));
secureHandle('logistics:delete',    (userId, { itemId }) => data.logisticsDelete(userId, itemId));
secureHandle('logistics:dashboard', (userId) => data.logisticsDashboard(userId));
// Phase C9 — base64-encode the generated .xlsx buffer for the IPC round-trip,
// same pattern as every other Excel export channel (finance/payroll/audit/
// executive/procurement).
secureHandle('logistics:export-excel', async (userId, { listType, filters }) => {
  const res = await data.logisticsExportExcel(userId, listType, filters || {});
  if (!res.ok) return res;
  return { ok: true, filename: res.filename, rowCount: res.rowCount, base64: Buffer.from(res.buffer).toString('base64') };
});
// Phase 2 — generic per-record audit history, reused by every Logistics detail overlay.
secureHandle('logistics:record-history', (userId, { module, recordId }) => data.logisticsRecordHistory(userId, module, recordId));

// Audit + Notifications
secureHandle('audit:list',                (userId, { filters }) => data.auditList(userId, filters));
// Phase C6 (NF-01 remediation) — base64-encode the generated .xlsx buffer
// for the IPC round-trip, same pattern as finance:operationsExportExcel/
// payroll:exportExcel/sales:exportExcel. auditExportExcel reuses auditList's
// exact same Workshop Isolation predicate (_auditBuildQuery in data.js), so
// this cannot export a wider slice than the list itself would ever show.
secureHandle('audit:exportExcel', async (userId, { filters }) => {
  const res = await data.auditExportExcel(userId, filters);
  if (!res.ok) return res;
  return { ok: true, filename: res.filename, rowCount: res.rowCount, base64: Buffer.from(res.buffer).toString('base64') };
});
secureHandle('notifications:list',        (userId, { filters } = {}) => data.notificationsList(userId, filters || {}));
secureHandle('notifications:poll',        (userId) => data.notificationsPoll(userId));
secureHandle('notifications:markRead',    (userId, { notificationId }) => data.notificationsMarkRead(userId, notificationId));
secureHandle('notifications:markAllRead', (userId) => data.notificationsMarkAllRead(userId));

// Global Search — cross-module search, access enforced inside data.globalSearch
secureHandle('search:query', (userId, { filters } = {}) => data.globalSearch(userId, filters || {}));

// Security & Governance Dashboard
secureHandle('secgov:dashboard', (userId) => data.secGovDashboard(userId));

// Executive Analytics & Reporting — Phase 6F
secureHandle('exec:dashboard', (userId) => data.executiveDashboard(userId));
// Phase C7 — base64-encode the generated .xlsx buffer for the IPC round-trip,
// same pattern as every other Excel export channel (finance/payroll/audit).
secureHandle('exec:exportExcel', async (userId) => {
  const res = await data.executiveDashboardExportExcel(userId);
  if (!res.ok) return res;
  return { ok: true, filename: res.filename, base64: Buffer.from(res.buffer).toString('base64') };
});
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
// Unrestricted reference lookup (Phase 2B) — matches mobile's GET /api/meta/warehouses.
secureHandle('warehouses:for-dropdown', (userId) => data.workshopsForDropdown(userId));

// Stock catalog
secureHandle('stock-items:list',         (userId, { workshopId }) => data.stockItemsList(userId, workshopId));
secureHandle('stock-items:create',       (userId, { payload }) => data.stockItemsCreate(userId, payload));
secureHandle('stock-items:update',       (userId, { itemId, payload }) => data.stockItemsUpdate(userId, itemId, payload));
secureHandle('stock-items:delete',       (userId, { itemId, reason }) => data.stockItemsDelete(userId, itemId, reason));
// Unrestricted reference lookup (Phase 2B) — matches mobile's GET /api/meta/stock-items.
secureHandle('stock-items:for-dropdown', (userId) => data.stockItemsForDropdown(userId));
secureHandle('stock-categories:list',    (userId) => data.stockCategoriesList(userId));
secureHandle('stock-categories:create',  (userId, { name }) => data.stockCategoriesCreate(userId, name));
secureHandle('stock-categories:delete',  (userId, { categoryId }) => data.stockCategoriesDelete(userId, categoryId));

// Stock movements
secureHandle('stock-movements:list',             (userId, { workshopId }) => data.stockMovementsList(userId, workshopId));
secureHandle('stock-movements:create',           (userId, { payload }) => data.stockMovementsCreate(userId, payload));
secureHandle('stock-movements:adjustment-request', (userId, { payload }) => data.stockAdjustmentRequestCreate(userId, payload));
secureHandle('stock-movements:delete',           (userId, { movementId, reason }) => data.stockMovementsDelete(userId, movementId, reason));
secureHandle('stock-movements:transfer-approve', (userId, { movementId, action, rejectionReason }) =>
  data.stockTransferApprove(userId, movementId, action, rejectionReason));
secureHandle('inventory:loss-reports',           (userId, { filters }) => data.inventoryLossReports(userId, filters));

// Stock transfers
secureHandle('stock-transfers:list',             (userId, { workshopId }) => data.stockTransfersList(userId, workshopId));
secureHandle('stock-transfers:create',           (userId, { payload }) => data.stockTransfersCreate(userId, payload));
secureHandle('stock-transfers:approve',          (userId, { transferId, action, reason }) => data.stockTransfersApproveReject(userId, transferId, action, reason));
secureHandle('stock-transfers:dispatch',         (userId, { transferId, payload }) => data.stockTransfersDispatch(userId, transferId, payload));
secureHandle('stock-transfers:dispatch-history', (userId, { transferId }) => data.stockTransfersDispatchHistory(userId, transferId));
secureHandle('stock-transfers:receive',          (userId, { transferId, qty, notes }) => data.stockTransfersReceive(userId, transferId, qty, notes));
secureHandle('stock-transfers:report-discrepancy', (userId, { transferId, notes, lossReason }) => data.stockTransfersReportDiscrepancy(userId, transferId, notes, lossReason));

// Material requests
secureHandle('material-requests:list',    (userId, { workshopId }) => data.materialRequestsList(userId, workshopId));
secureHandle('material-requests:create',  (userId, { payload }) => data.materialRequestsCreate(userId, payload));
secureHandle('material-requests:approve', (userId, { requestId, action, approvedQty, reviewNotes, sourceWarehouseId, destinationWorkshopId }) =>
  data.materialRequestsApprove(userId, requestId, action, approvedQty, reviewNotes, sourceWarehouseId, destinationWorkshopId));
secureHandle('mechanician:dashboard',     (userId) => data.mechanicianDashboard(userId));

secureHandle('workshop:overview', (userId) => data.workshopOverview(userId));

// Vehicles
secureHandle('transport-companies:dropdown',  (userId) => data.transportCompaniesForDropdown(userId));
secureHandle('fleet:dashboard',               (userId) => data.fleetDashboard(userId));
secureHandle('fleet:intelligence',            (userId) => data.fleetIntelligence(userId));
secureHandle('vehicles:for-transport',        (userId) => data.vehiclesForTransport(userId));
secureHandle('vehicles:list',                 (userId) => data.vehiclesList(userId));
secureHandle('vehicles:create',               (userId, { payload }) => data.vehiclesCreate(userId, payload));
secureHandle('vehicles:update',               (userId, { vehicleId, payload }) => data.vehiclesUpdate(userId, vehicleId, payload));
secureHandle('vehicles:delete',               (userId, { vehicleId, reason }) => data.vehiclesDelete(userId, vehicleId, reason));

// Fuel logs
secureHandle('fuel-logs:list',   (userId, { vehicleId }) => data.fuelLogsList(userId, vehicleId));
secureHandle('fuel-logs:create', (userId, { payload }) => data.fuelLogsCreate(userId, payload));
secureHandle('fuel-logs:delete', (userId, { logId, reason }) => data.fuelLogsDelete(userId, logId, reason));

// Vehicle maintenance
secureHandle('maintenance:list',   (userId, { vehicleId }) => data.maintenanceList(userId, vehicleId));
secureHandle('maintenance:create', (userId, { payload }) => data.maintenanceCreate(userId, payload));
secureHandle('maintenance:update', (userId, { recordId, payload }) => data.maintenanceUpdate(userId, recordId, payload));
secureHandle('maintenance:delete', (userId, { recordId, reason }) => data.maintenanceDelete(userId, recordId, reason));

// Deliveries
secureHandle('deliveries:list',      (userId) => data.deliveryOrdersList(userId));
secureHandle('deliveries:create',    (userId, { payload }) => data.deliveryOrdersCreate(userId, payload));
secureHandle('deliveries:update',    (userId, { orderId, payload }) => data.deliveryOrdersUpdate(userId, orderId, payload));
secureHandle('deliveries:delete',    (userId, { orderId, reason }) => data.deliveryOrdersDelete(userId, orderId, reason));
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
// Harvesting Phase 1 (Workstream 2)
secureHandle('harvest:dashboard', (userId, { workshopId }) => data.harvestDashboard(userId, workshopId));
// Harvesting Phase 2 (Workstream 1) — Harvest Planning
secureHandle('harvest:plan-list',   (userId, { workshopId }) => data.harvestPlanList(userId, workshopId));
secureHandle('harvest:plan-create', (userId, { payload }) => data.harvestPlanCreate(userId, payload));
secureHandle('harvest:plan-update', (userId, { planId, payload }) => data.harvestPlanUpdate(userId, planId, payload));
secureHandle('harvest:plan-delete', (userId, { planId, reason }) => data.harvestPlanDelete(userId, planId, reason));
// Harvesting Phase 3 (Workstreams 1-3) — Active Operations, Performance, Delays
secureHandle('harvest:operations',   (userId) => data.harvestCompartmentStatus(userId));
secureHandle('harvest:performance',  (userId, { workshopId }) => data.harvestPerformance(userId, workshopId));
secureHandle('harvest:delay-list',   (userId, { workshopId }) => data.harvestDelayList(userId, workshopId));
secureHandle('harvest:delay-create', (userId, { payload }) => data.harvestDelayCreate(userId, payload));
// Harvesting Phase 4 (Workstreams 2-3) — Decision Support, Executive Extras
secureHandle('harvest:decision-support',  (userId, { workshopId }) => data.harvestDecisionSupport(userId, workshopId));
secureHandle('harvest:executive-extras',  (userId, { workshopId }) => data.harvestExecutiveExtras(userId, workshopId));

// Enterprise Timber Lifecycle Integration Program — Phase 1
secureHandle('harvest-waste:categories',       (userId) => data.harvestWasteCategoriesList(userId));
secureHandle('harvest-waste:category-create',  (userId, { name }) => data.harvestWasteCategoryCreate(userId, name));
secureHandle('harvest-waste:list',             (userId, { workshopId }) => data.harvestWasteList(userId, workshopId));
secureHandle('harvest-waste:create',           (userId, { payload }) => data.harvestWasteCreate(userId, payload));
secureHandle('resolutions:list',               (userId, { sourceType }) => data.resolutionsList(userId, sourceType));
secureHandle('resolutions:create',             (userId, { payload }) => data.resolutionCreate(userId, payload));
secureHandle('production-offcuts:list',        (userId, { workshopId, status }) => data.productionOffcutsList(userId, workshopId, status));
secureHandle('production-offcuts:create',      (userId, { payload }) => data.productionOffcutCreate(userId, payload));
secureHandle('production-offcuts:decide',      (userId, { offcutId, recoverable }) => data.productionOffcutDecide(userId, offcutId, recoverable));
secureHandle('production-offcuts:recovery',    (userId, { offcutId, payload }) => data.productionOffcutRecordRecovery(userId, offcutId, payload));
secureHandle('production-offcuts:inspect',     (userId, { offcutId, payload }) => data.qualityInspectionCreate(userId, offcutId, payload));
secureHandle('production-offcuts:reconciliation', (userId, { workshopId }) => data.productionReconciliation(userId, workshopId));

// Timber Lifecycle Phase 2
secureHandle('rejection-holds:list',      (userId, { status, sourceType }) => data.rejectionHoldsList(userId, status, sourceType));
secureHandle('rejection-holds:rework',    (userId, { holdId }) => data.rejectionResolveRework(userId, holdId));
secureHandle('rejection-holds:downgrade', (userId, { holdId, payload }) => data.rejectionResolveDowngrade(userId, holdId, payload));
secureHandle('rejection-holds:return',    (userId, { holdId, payload }) => data.rejectionResolveReturnToInventory(userId, holdId, payload));
secureHandle('rejection-holds:quality-report', (userId, { workshopId }) => data.qualityReport(userId, workshopId));

// Timber Lifecycle Phase 3
secureHandle('showroom-damage:list',   (userId, { status }) => data.showroomDamageReportsList(userId, status));
secureHandle('showroom-damage:create', (userId, { payload }) => data.showroomDamageReportCreate(userId, payload));
secureHandle('showroom:inventory',     (userId) => data.showroomInventoryList(userId));

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
secureHandle('machine-maint:list-all', (userId, { workshopId }) => data.machineMaintScheduleListAll(userId, workshopId));
secureHandle('machine-maint:list',   (userId, { machineId }) => data.machineMaintScheduleList(userId, machineId));
secureHandle('machine-maint:create', (userId, { payload }) => data.machineMaintScheduleCreate(userId, payload));
secureHandle('machine-maint:update', (userId, { schedId, payload }) => data.machineMaintScheduleUpdate(userId, schedId, payload));
secureHandle('machine-maint:delete', (userId, { schedId }) => data.machineMaintScheduleDelete(userId, schedId));

// Maintenance Jobs (Mechanician Phase 3)
secureHandle('maintenance-jobs:list',         (userId, { filters }) => data.maintenanceJobsList(userId, filters));
secureHandle('maintenance-jobs:detail',       (userId, { jobId }) => data.maintenanceJobDetail(userId, jobId));
secureHandle('maintenance-jobs:create',       (userId, { payload }) => data.maintenanceJobCreate(userId, payload));
secureHandle('maintenance-jobs:assign',       (userId, { jobId, technicianId }) => data.maintenanceJobAssign(userId, jobId, technicianId));
secureHandle('maintenance-jobs:transition',   (userId, { jobId, action, payload }) => data.maintenanceJobTransition(userId, jobId, action, payload));
secureHandle('maintenance-jobs:labour-add',   (userId, { jobId, payload }) => data.maintenanceJobLabourAdd(userId, jobId, payload));
secureHandle('maintenance-jobs:impact-add',   (userId, { payload }) => data.maintenanceProductionImpactCreate(userId, payload));
secureHandle('maintenance-jobs:officer-dashboard', (userId) => data.maintenanceOfficerDashboard(userId));
secureHandle('maintenance-jobs:reports',      (userId, { filters }) => data.maintenanceReports(userId, filters));
secureHandle('maintenance-jobs:asset-summary', (userId, { machineId }) => data.maintenanceAssetSummary(userId, machineId));
secureHandle('maintenance-jobs:waiting-parts', (userId) => data.maintenanceWaitingForPartsList(userId));

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

// Nyanza Value-Added Production
secureHandle('value-added-production:list',    (userId, { workshopId }) => data.valueAddedProductionBatchList(userId, workshopId));
secureHandle('value-added-production:create',  (userId, { payload }) => data.valueAddedProductionBatchCreate(userId, payload));
secureHandle('value-added-production:update',  (userId, { id, payload }) => data.valueAddedProductionBatchUpdate(userId, id, payload));
secureHandle('value-added-production:delete',  (userId, { id, reason }) => data.valueAddedProductionBatchDelete(userId, id, reason));
secureHandle('value-added-production:inspect', (userId, { outputId, payload }) => data.valueAddedProductionInspect(userId, outputId, payload));
secureHandle('value-added-production:reconciliation', (userId, { workshopId }) => data.valueAddedProductionReconciliation(userId, workshopId));
secureHandle('value-added-production:report',  (userId, { workshopId }) => data.valueAddedProductionReport(userId, workshopId));

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

// HR Enterprise Phase 2 — Attendance
secureHandle('attendance:roster',    (userId, { workshopId, date }) => data.attendanceRoster(userId, workshopId, date));
secureHandle('attendance:mark',      (userId, { payload }) => data.attendanceMark(userId, payload));
secureHandle('attendance:list',      (userId, { filters }) => data.attendanceList(userId, filters));
secureHandle('attendance:update',    (userId, { attendanceId, payload }) => data.attendanceUpdate(userId, attendanceId, payload));
secureHandle('attendance:delete',    (userId, { attendanceId, reason }) => data.attendanceDelete(userId, attendanceId, reason));
secureHandle('attendance:dashboard', (userId, { workshopId }) => data.attendanceDashboard(userId, workshopId));
secureHandle('attendance:report',    (userId, { filters }) => data.attendanceReport(userId, filters));

// Payroll Enterprise Phase 2
secureHandle('payroll:rateSet',              (userId, { payload }) => data.payrollRateSet(userId, payload));
secureHandle('payroll:ratesList',            (userId, { workshopId }) => data.payrollRatesList(userId, workshopId));
secureHandle('payroll:rateHistory',          (userId, { personType, personId }) => data.payrollRateHistory(userId, personType, personId));
secureHandle('payroll:periodCreate',         (userId, { payload }) => data.payrollPeriodCreate(userId, payload));
secureHandle('payroll:periodList',           (userId, { filters }) => data.payrollPeriodList(userId, filters));
secureHandle('payroll:periodDetail',         (userId, { periodId }) => data.payrollPeriodDetail(userId, periodId));
secureHandle('payroll:periodUpdate',         (userId, { periodId, payload }) => data.payrollPeriodUpdate(userId, periodId, payload));
secureHandle('payroll:periodDelete',         (userId, { periodId, reason }) => data.payrollPeriodDelete(userId, periodId, reason));
secureHandle('payroll:periodCalculate',      (userId, { periodId }) => data.payrollPeriodCalculate(userId, periodId));
secureHandle('payroll:periodSubmit',         (userId, { periodId }) => data.payrollPeriodSubmit(userId, periodId));
secureHandle('payroll:periodMarkExported',   (userId, { periodId }) => data.payrollPeriodMarkExported(userId, periodId));
secureHandle('payroll:periodClose',          (userId, { periodId }) => data.payrollPeriodClose(userId, periodId));
secureHandle('payroll:lineList',             (userId, { periodId, options }) => data.payrollLineList(userId, periodId, options));
secureHandle('payroll:lineDetail',           (userId, { lineId }) => data.payrollLineDetail(userId, lineId));
secureHandle('payroll:lineRecalculate',      (userId, { lineId }) => data.payrollLineRecalculate(userId, lineId));
secureHandle('payroll:lineUpdateSourceQty',  (userId, { lineId, sourceQty, reason }) => data.payrollLineUpdateSourceQty(userId, lineId, sourceQty, reason));
secureHandle('payroll:adjustmentCreate',     (userId, { lineId, payload }) => data.payrollAdjustmentCreate(userId, lineId, payload));
secureHandle('payroll:adjustmentList',       (userId, { lineId }) => data.payrollAdjustmentList(userId, lineId));
secureHandle('payroll:adjustmentApprove',    (userId, { adjustmentId, notes }) => data.payrollAdjustmentApprove(userId, adjustmentId, notes));
secureHandle('payroll:adjustmentReject',     (userId, { adjustmentId, notes }) => data.payrollAdjustmentReject(userId, adjustmentId, notes));
secureHandle('payroll:summaryReport',        (userId, { periodId }) => data.payrollSummaryReport(userId, periodId));
secureHandle('payroll:attendanceReconciliation', (userId, { periodId }) => data.attendancePayrollReconciliation(userId, periodId));
secureHandle('payroll:casualCostSummary',    (userId, { periodId }) => data.casualLabourCostSummary(userId, periodId));
secureHandle('payroll:adjustmentsReport',    (userId, { periodId }) => data.payrollAdjustmentsReport(userId, periodId));
secureHandle('payroll:workshopSummary',      (userId, { periodId }) => data.payrollWorkshopSummary(userId, periodId));
// Payroll Enterprise Phase 3 — Excel export. Base64-encodes the generated
// .xlsx buffer for the IPC round-trip (avoids relying on Electron's binary
// structured-clone support across the context-isolation boundary); the
// renderer decodes it back into a Blob using the exact same
// Blob->ObjectURL->anchor-click download mechanism downloadCsv() already
// uses, so no new download code path is introduced.
secureHandle('payroll:exportExcel', async (userId, { reportType, params }) => {
  const res = await data.payrollExportExcel(userId, reportType, params);
  if (!res.ok) return res;
  return { ok: true, filename: res.filename, rowCount: res.rowCount, base64: Buffer.from(res.buffer).toString('base64') };
});

// Finance Enterprise Phase 2 — Finance Control Center
secureHandle('finance:dashboard',           (userId, { filters }) => data.financeDashboard(userId, filters));
secureHandle('finance:customerOutstanding', (userId, { filters }) => data.financeCustomerOutstanding(userId, filters));
secureHandle('finance:supplierOutstanding', (userId, { filters }) => data.financeSupplierOutstanding(userId, filters));
secureHandle('finance:operationsSearch',    (userId, { filters }) => data.financeOperationsSearch(userId, filters));
// Master Professionalization Phase C4 (PR-15) — base64-encode the generated
// .xlsx buffer for the IPC round-trip, same pattern as payroll:exportExcel/
// sales:exportExcel.
secureHandle('finance:operationsExportExcel', async (userId, { filters }) => {
  const res = await data.financeOperationsExportExcel(userId, filters);
  if (!res.ok) return res;
  return { ok: true, filename: res.filename, rowCount: res.rowCount, base64: Buffer.from(res.buffer).toString('base64') };
});
secureHandle('finance:approvalQueue',       (userId, { filters }) => data.financeApprovalQueue(userId, filters));
secureHandle('finance:workshopCostSummary', (userId, { filters }) => data.financeWorkshopCostSummary(userId, filters));
secureHandle('finance:departmentCostSummary', (userId, { filters }) => data.financeDepartmentCostSummary(userId, filters));
secureHandle('finance:approvalReport',      (userId, { filters }) => data.financeApprovalReport(userId, filters));
secureHandle('finance:exceptionReport',     (userId) => data.financeExceptionReport(userId));
secureHandle('finance:auditReport',         (userId, { filters }) => data.financeAuditReport(userId, filters));
secureHandle('finance:transactionTrace',    (userId, { sourceType, sourceId }) => data.financeTransactionTrace(userId, sourceType, sourceId));
secureHandle('finance:configView',          (userId) => data.financeConfigView(userId));
secureHandle('finance:sageExportPreview',   (userId, { filters }) => data.financeSageExportPreview(userId, filters));
secureHandle('finance:sageExportHistory',   (userId, { filters }) => data.financeSageExportHistory(userId, filters));
// Approve/reject itself is not re-implemented here — the Approval Center's UI
// calls the existing approvals:process handler above, exactly like Procurement.
secureHandle('finance:sageExportRun', async (userId, { filters }) => {
  const res = await data.financeSageExportRun(userId, filters);
  if (!res.ok) return res;
  return { ok: true, filename: res.filename, rowCount: res.rowCount, base64: Buffer.from(res.buffer).toString('base64') };
});

// Finance Enterprise — Complete Requirements Specification (Inventory
// Financial Control, Stock Count/Reconciliation, Financial Exception
// Center, department Finance Control combinators)
secureHandle('finance:inventoryOverview',       (userId, { filters }) => data.financeInventoryOverview(userId, filters));
secureHandle('finance:stockMovements',          (userId, { filters }) => data.financeStockMovements(userId, filters));
secureHandle('finance:stockCountCreate',        (userId, { payload }) => data.financeStockCountCreate(userId, payload));
secureHandle('finance:stockCountList',          (userId, { filters }) => data.financeStockCountList(userId, filters));
secureHandle('finance:stockCountDetail',        (userId, { sessionId }) => data.financeStockCountDetail(userId, sessionId));
secureHandle('finance:stockCountEnterCount',    (userId, { sessionId, lineId, physicalQty, notes }) => data.financeStockCountEnterCount(userId, sessionId, lineId, physicalQty, notes));
secureHandle('finance:stockCountSubmitReview',  (userId, { sessionId }) => data.financeStockCountSubmitForReview(userId, sessionId));
secureHandle('finance:stockCountSubmitAdjustments', (userId, { sessionId, reason }) => data.financeStockCountSubmitAdjustments(userId, sessionId, reason));
secureHandle('finance:stockCountCancel',        (userId, { sessionId, reason }) => data.financeStockCountCancel(userId, sessionId, reason));
secureHandle('finance:stockVarianceReport',     (userId, { filters }) => data.financeStockVarianceReport(userId, filters));
secureHandle('finance:inventoryAdjustmentReport', (userId, { filters }) => data.financeInventoryAdjustmentReport(userId, filters));
secureHandle('finance:exceptionCaseOpen',       (userId, { payload }) => data.financeExceptionCaseOpen(userId, payload));
secureHandle('finance:exceptionCaseList',       (userId, { filters }) => data.financeExceptionCaseList(userId, filters));
secureHandle('finance:exceptionCaseDetail',     (userId, { caseId }) => data.financeExceptionCaseDetail(userId, caseId));
secureHandle('finance:exceptionCaseComment',    (userId, { caseId, comment }) => data.financeExceptionCaseComment(userId, caseId, comment));
secureHandle('finance:exceptionCaseResolve',    (userId, { caseId, resolutionNotes }) => data.financeExceptionCaseResolve(userId, caseId, resolutionNotes));
secureHandle('finance:exceptionCaseClose',      (userId, { caseId }) => data.financeExceptionCaseClose(userId, caseId));
secureHandle('finance:productionControl',       (userId, { workshopId }) => data.financeProductionControl(userId, workshopId));
secureHandle('finance:maintenanceControl',      (userId) => data.financeMaintenanceControl(userId));
secureHandle('finance:customerProfile',         (userId, { customerId }) => data.financeCustomerFinancialProfile(userId, customerId));
secureHandle('finance:supplierProfile',         (userId, { supplierId }) => data.financeSupplierFinancialProfile(userId, supplierId));

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

// ── Procurement Management ───────────────────────────────────────────────────
// Requisition → RFQ/Quotation → Purchase Order → Goods Receipt → Invoice Match
// → Payment, driven by data.procurementApprovalAction's generic multi-stage
// chain (shared by requisitions/invoices/payments — see data.js for the
// dispatcher itself).

// Config (configurable CEO approval threshold)
secureHandle('procurement-config:get',    (userId) => data.procurementConfigGet(userId));
secureHandle('procurement-config:update', (userId, { ceoThreshold }) => data.procurementConfigUpdate(userId, ceoThreshold));

// Procurement Suppliers
secureHandle('procurement-suppliers:list',   (userId, { filters } = {}) => data.procurementSuppliersList(userId, filters || {}));
secureHandle('procurement-suppliers:create', (userId, { payload }) => data.procurementSupplierCreate(userId, payload));
secureHandle('procurement-suppliers:update', (userId, { supplierId, payload }) => data.procurementSupplierUpdate(userId, supplierId, payload));
secureHandle('procurement-suppliers:blacklist', (userId, { supplierId, blacklisted, reason }) =>
  data.procurementSupplierToggleBlacklist(userId, supplierId, blacklisted, reason));
// Phase 3B — generic lifecycle transition (activate/deactivate/restore/
// archive all go through this one channel with the target status string,
// rather than one IPC channel per action).
secureHandle('procurement-suppliers:set-status', (userId, { supplierId, status, reason }) =>
  data.procurementSupplierSetStatus(userId, supplierId, status, reason));
secureHandle('procurement-suppliers:delete', (userId, { supplierId }) => data.procurementSupplierDelete(userId, supplierId));
secureHandle('procurement-suppliers:contacts-list',   (userId, { supplierId }) => data.procurementSupplierContactsList(userId, supplierId));
secureHandle('procurement-suppliers:contacts-create', (userId, { supplierId, payload }) => data.procurementSupplierContactCreate(userId, supplierId, payload));
secureHandle('procurement-suppliers:contacts-update', (userId, { contactId, payload }) => data.procurementSupplierContactUpdate(userId, contactId, payload));
secureHandle('procurement-suppliers:contacts-delete', (userId, { contactId }) => data.procurementSupplierContactDelete(userId, contactId));
secureHandle('procurement-suppliers:contracts-list',   (userId, { supplierId }) => data.procurementSupplierContractsList(userId, supplierId));
secureHandle('procurement-suppliers:contracts-create', (userId, { supplierId, payload }) => data.procurementSupplierContractCreate(userId, supplierId, payload));
secureHandle('procurement-suppliers:contracts-update', (userId, { contractId, payload }) => data.procurementSupplierContractUpdate(userId, contractId, payload));
secureHandle('procurement-suppliers:performance', (userId, { supplierId }) => data.procurementSupplierPerformance(userId, supplierId));

// Procurement Requisitions + approval chain
secureHandle('procurement-requisitions:list',   (userId, { filters } = {}) => data.procurementRequisitionsList(userId, filters || {}));
secureHandle('procurement-requisitions:create', (userId, { payload }) => data.procurementRequisitionCreate(userId, payload));
secureHandle('procurement-requisitions:update', (userId, { requisitionId, payload }) => data.procurementRequisitionUpdate(userId, requisitionId, payload));
secureHandle('procurement-requisitions:submit', (userId, { requisitionId }) => data.procurementRequisitionSubmit(userId, requisitionId));
secureHandle('procurement-requisitions:cancel', (userId, { requisitionId, reason }) => data.procurementRequisitionCancel(userId, requisitionId, reason));
secureHandle('procurement-requisitions:detail', (userId, { requisitionId }) => data.procurementRequisitionDetail(userId, requisitionId));
secureHandle('procurement-requisitions:approve', (userId, { entityType, entityId, decision, notes }) =>
  data.procurementApprovalAction(userId, entityType, entityId, decision, notes));

// Procurement RFQ / Quotations
secureHandle('procurement-rfq:create',       (userId, { requisitionId, payload }) => data.procurementRfqCreate(userId, requisitionId, payload));
secureHandle('procurement-rfq:send',         (userId, { rfqId, supplierIds }) => data.procurementRfqSendToSuppliers(userId, rfqId, supplierIds));
secureHandle('procurement-rfq:list',         (userId) => data.procurementRfqList(userId));
secureHandle('procurement-rfq:detail',       (userId, { rfqId }) => data.procurementRfqDetail(userId, rfqId));
secureHandle('procurement-rfq:quote-submit', (userId, { rfqId, supplierId, payload }) => data.procurementQuotationSubmit(userId, rfqId, supplierId, payload));
secureHandle('procurement-rfq:compare',      (userId, { rfqId }) => data.procurementQuotationsCompare(userId, rfqId));
secureHandle('procurement-rfq:select-quote', (userId, { quotationId }) => data.procurementQuotationSelect(userId, quotationId));

// Procurement Purchase Orders
secureHandle('procurement-po:generate', (userId, { requisitionId, quotationId }) => data.procurementPoGenerate(userId, requisitionId, quotationId));
secureHandle('procurement-po:list',     (userId, { filters } = {}) => data.procurementPoList(userId, filters || {}));
secureHandle('procurement-po:detail',   (userId, { poId }) => data.procurementPoDetail(userId, poId));
secureHandle('procurement-po:update',   (userId, { poId, payload }) => data.procurementPoUpdate(userId, poId, payload));
secureHandle('procurement-po:pdf-html', (userId, { poId }) => data.procurementPoPdfHtml(userId, poId));
secureHandle('procurement-po:close-shortage', (userId, { poId, reason, supplierExplanation }) => data.procurementPoCloseWithShortage(userId, poId, reason, supplierExplanation));
secureHandle('procurement-po:approve', (userId, { poId, decision, notes }) => data.procurementApprovalAction(userId, 'po', poId, decision, notes));

// Procurement Goods Receipt
secureHandle('procurement-goods-receipt:create', (userId, { poId, payload }) => data.procurementGoodsReceiptCreate(userId, poId, payload));
secureHandle('procurement-goods-receipt:list',   (userId) => data.procurementGoodsReceiptList(userId));
secureHandle('procurement-goods-receipt:detail', (userId, { receiptId }) => data.procurementGoodsReceiptDetail(userId, receiptId));

// Procurement Invoices + Payments
secureHandle('procurement-invoices:create', (userId, { poId, payload }) => data.procurementInvoiceCreate(userId, poId, payload));
secureHandle('procurement-invoices:match',   (userId, { invoiceId }) => data.procurementInvoiceMatch(userId, invoiceId));
secureHandle('procurement-invoices:approve', (userId, { invoiceId, decision, notes }) => data.procurementInvoiceApprove(userId, invoiceId, decision, notes));
secureHandle('procurement-invoices:list',    (userId, { filters } = {}) => data.procurementInvoiceList(userId, filters || {}));
secureHandle('procurement-payments:create',  (userId, { invoiceId, payload }) => data.procurementPaymentCreate(userId, invoiceId, payload));
secureHandle('procurement-payments:approve', (userId, { paymentId, decision, notes }) => data.procurementPaymentApprove(userId, paymentId, decision, notes));
secureHandle('procurement-payments:list',    (userId) => data.procurementPaymentList(userId));

// Phase C8 — one dispatcher channel for all 6 exportable Procurement lists
// (resolves master register PR-03/04/05/06 + 2 more found this phase),
// same base64-encode-for-IPC pattern as every other Excel export channel.
secureHandle('procurement:export-excel', async (userId, { listType, filters }) => {
  const res = await data.procurementExportExcel(userId, listType, filters || {});
  if (!res.ok) return res;
  return { ok: true, filename: res.filename, rowCount: res.rowCount, base64: Buffer.from(res.buffer).toString('base64') };
});

// Procurement Dashboard / Reports / Analytics
secureHandle('procurement-dashboard:get',           (userId) => data.procurementDashboard(userId));
secureHandle('procurement-reports:spend-analysis',  (userId) => data.procurementReportSpendAnalysis(userId));
secureHandle('procurement-reports:supplier-perf',   (userId) => data.procurementReportSupplierPerformance(userId));
secureHandle('procurement-reports:delivery-perf',   (userId) => data.procurementReportDeliveryPerformance(userId));
secureHandle('procurement-reports:budget-util',     (userId) => data.procurementReportBudgetUtilization(userId));
secureHandle('procurement-reports:revisions',       (userId) => data.procurementRequisitionRevisionReports(userId));
secureHandle('procurement-reports:po-shortages',    (userId) => data.procurementPoShortageReports(userId));
secureHandle('procurement-analytics:get',           (userId) => data.procurementAnalytics(userId));
// Phase 5A — Executive Procurement Dashboard (Procurement Analytics & Forecasting)
secureHandle('procurement-executive-dashboard:get', (userId) => data.procurementExecutiveDashboard(userId));
// Phase 5B — Spend & Budget Analytics
secureHandle('procurement-spend-budget-analytics:get', (userId) => data.procurementSpendBudgetAnalytics(userId));
// Phase 5C + 5D — Procurement Forecasting & Executive Reporting
secureHandle('procurement-forecasting-dashboard:get', (userId) => data.procurementForecastingDashboard(userId));
secureHandle('procurement-executive-report:get', (userId, { reportType, filters }) => data.procurementExecutiveReport(userId, reportType, filters || {}));
// Phase 6 — Procurement Automation Engine. Escalations reuse the existing
// generic escalation:list/resolve/ack IPC channels below (data.js's
// getEscalations/resolveEscalation now recognize procurement entity types
// and roles — no separate procurement-scoped channel needed on desktop).
secureHandle('procurement-automation-dashboard:get', (userId) => data.procurementAutomationDashboard(userId));
secureHandle('procurement-tasks:list',     (userId, filters) => data.procurementTasksList(userId, filters || {}));
secureHandle('procurement-tasks:complete', (userId, taskId) => data.procurementTaskComplete(userId, taskId));
// Phase 7 — Procurement Performance Management
secureHandle('procurement-performance-scorecard:get', (userId) => data.procurementPerformanceScorecard(userId));
secureHandle('procurement-performance-buyers:get',    (userId) => data.procurementBuyerPerformance(userId));
secureHandle('procurement-performance-departments:get', (userId) => data.procurementDepartmentPerformance(userId));
secureHandle('procurement-performance-workshops:get',   (userId) => data.procurementWorkshopPerformance(userId));
secureHandle('procurement-performance-executive:get',   (userId) => data.procurementExecutivePerformanceDashboard(userId));
secureHandle('procurement-performance-benchmark:get',   (userId, filters) => data.procurementBenchmark(userId, filters || {}));
secureHandle('procurement-performance-risk:get',        (userId) => data.procurementRiskMonitor(userId));

// Supplier Intelligence — Phase 3C. All four handlers are thin wrappers;
// every calculation lives in data.js's Supplier Intelligence Engine.
secureHandle('supplier-intel:dashboard',  (userId, { filters } = {}) => data.supplierIntelligenceDashboard(userId, filters || {}));
secureHandle('supplier-intel:profile',    (userId, { supplierId }) => data.procurementSupplierIntelligenceProfile(userId, supplierId));
secureHandle('supplier-intel:compare',    (userId, { supplierIds }) => data.procurementSupplierComparison(userId, supplierIds));
secureHandle('supplier-intel:report',     (userId, { reportType, filters }) => data.procurementSupplierIntelligenceReports(userId, reportType, filters || {}));

// ── Supplier Relationship Management (SRM) — Phase 4 ─────────────────────────
// Contracts/compliance/communications/improvement-plans/dashboard/reports are
// thin wrappers over data.js, same as everything else. Documents are the one
// exception: file bytes live on mobile-api's filesystem (the only storage
// both Electron and Mobile can reach — see SUPPLIER_RELATIONSHIP_PHASE4_
// COMPLETION_REPORT.md "Architecture Decisions"), so Electron proxies those
// calls over HTTP instead of talking to Postgres directly. It authenticates
// to mobile-api with a short-lived service JWT minted from the same
// JWT_SECRET mobile-api itself verifies against — no new secret, no new
// login flow, and this is the only place Electron ever calls mobile-api.

const jwt = require('jsonwebtoken');

function _srmApiBase() {
  return `http://${process.env.PGHOST}:${process.env.MOBILE_API_PORT}`;
}
function _srmServiceToken(userId) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set in .env');
  return jwt.sign({ userId }, secret, { expiresIn: '5m' });
}
// mobile-api wraps every response in { ok, version, data } / { ok, error:{code,message} }
// (see mobile-api/middleware/respond.js) — flatten back to this app's native
// { ok, ...fields } / { ok, error: 'string' } shape so callers on the
// renderer side don't need to special-case these three handlers.
function _unwrapSrmEnvelope(envelope) {
  if (envelope && envelope.ok) return { ok: true, ...(envelope.data || {}) };
  return { ok: false, error: envelope?.error?.message || 'Request failed' };
}

// Contracts
secureHandle('srm-contracts:register', (userId, { filters } = {}) => data.procurementContractsRegister(userId, filters || {}));
secureHandle('srm-contracts:approve',  (userId, { contractId, reason }) => data.procurementSupplierContractApprove(userId, contractId, reason));
secureHandle('srm-contracts:renew',    (userId, { contractId, payload }) => data.procurementSupplierContractRenew(userId, contractId, payload));

// Compliance
secureHandle('srm-compliance:list',     (userId, { supplierId }) => data.supplierComplianceList(userId, supplierId));
secureHandle('srm-compliance:upsert',   (userId, { supplierId, payload }) => data.supplierComplianceUpsert(userId, supplierId, payload));
secureHandle('srm-compliance:register', (userId, { filters } = {}) => data.supplierComplianceRegister(userId, filters || {}));

// Communications
secureHandle('srm-communications:list',     (userId, { supplierId }) => data.supplierCommunicationsList(userId, supplierId));
secureHandle('srm-communications:create',   (userId, { supplierId, payload }) => data.supplierCommunicationCreate(userId, supplierId, payload));
secureHandle('srm-communications:update',   (userId, { communicationId, payload }) => data.supplierCommunicationUpdate(userId, communicationId, payload));
secureHandle('srm-communications:register', (userId, { filters } = {}) => data.supplierCommunicationsRegister(userId, filters || {}));

// Improvement plans
secureHandle('srm-improvement-plans:list',     (userId, { supplierId }) => data.supplierImprovementPlansList(userId, supplierId));
secureHandle('srm-improvement-plans:create',   (userId, { supplierId, payload }) => data.supplierImprovementPlanCreate(userId, supplierId, payload));
secureHandle('srm-improvement-plans:update',   (userId, { planId, payload }) => data.supplierImprovementPlanUpdate(userId, planId, payload));
secureHandle('srm-improvement-plans:register', (userId, { filters } = {}) => data.supplierImprovementPlansRegister(userId, filters || {}));

// Executive dashboard + reports
secureHandle('srm-dashboard:get', (userId) => data.srmExecutiveDashboard(userId));
secureHandle('srm-reports:get',   (userId, { reportType, filters }) => data.srmReport(userId, reportType, filters || {}));

// Document Center — proxied to mobile-api over HTTP (see comment above).
secureHandle('srm-documents:list', async (userId, { supplierId }) => {
  const res = await fetch(`${_srmApiBase()}/api/srm/documents/${supplierId}`, {
    headers: { Authorization: `Bearer ${_srmServiceToken(userId)}` },
  });
  return _unwrapSrmEnvelope(await res.json());
});
secureHandle('srm-documents:register', async (userId, { filters } = {}) => {
  const qs = new URLSearchParams(filters || {}).toString();
  const res = await fetch(`${_srmApiBase()}/api/srm/documents${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${_srmServiceToken(userId)}` },
  });
  return _unwrapSrmEnvelope(await res.json());
});
secureHandle('srm-documents:deactivate', async (userId, { documentId, reason }) => {
  const res = await fetch(`${_srmApiBase()}/api/srm/documents/${documentId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${_srmServiceToken(userId)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason }),
  });
  return _unwrapSrmEnvelope(await res.json());
});

// Lets the renderer open a native file picker before showing the upload
// form (so it can display the chosen filename), without exposing `dialog`
// to the renderer directly.
ipcMain.handle('srm-documents:pick-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Select Document',
    properties: ['openFile'],
  });
  if (canceled || !filePaths?.length) return { ok: false, error: 'Selection cancelled' };
  return { ok: true, filePath: filePaths[0], fileName: path.basename(filePaths[0]) };
});

// Upload: renderer has already picked a file via srm-documents:pick-file and
// collected metadata in its form; we read the file here and stream it to
// mobile-api as multipart form data.
secureHandle('srm-documents:upload', async (userId, { supplierId, filePath, documentType, contractId, complianceId, expiryDate, notes }) => {
  const buf = fs.readFileSync(filePath);
  const form = new FormData();
  form.append('file', new Blob([buf]), path.basename(filePath));
  if (documentType) form.append('document_type', documentType);
  if (contractId != null) form.append('contract_id', String(contractId));
  if (complianceId != null) form.append('compliance_id', String(complianceId));
  if (expiryDate) form.append('expiry_date', expiryDate);
  if (notes) form.append('notes', notes);
  const res = await fetch(`${_srmApiBase()}/api/srm/documents/${supplierId}/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${_srmServiceToken(userId)}` },
    body: form,
  });
  return _unwrapSrmEnvelope(await res.json());
});

// Download: fetch the file from mobile-api, save via a native save dialog.
secureHandle('srm-documents:download', async (userId, { documentId, defaultFilename }) => {
  const res = await fetch(`${_srmApiBase()}/api/srm/documents/file/${documentId}`, {
    headers: { Authorization: `Bearer ${_srmServiceToken(userId)}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { ok: false, error: body?.error?.message || `Download failed (${res.status})` };
  }
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Save Document',
    defaultPath: defaultFilename || 'document',
  });
  if (canceled || !filePath) return { ok: false, error: 'Save cancelled' };
  const arrBuf = await res.arrayBuffer();
  fs.writeFileSync(filePath, Buffer.from(arrBuf));
  return { ok: true, filePath };
});

// ── Timber Lifecycle Phase 1 — generalized attachments ───────────────────────
// Same HTTP-proxy pattern as srm-documents:* above (file bytes live on
// mobile-api's filesystem, not reachable directly from Electron's own
// process) — reuses _srmApiBase/_srmServiceToken/_unwrapSrmEnvelope as-is,
// and reuses the existing srm-documents:pick-file dialog handler (it's
// already generic, no supplier-specific logic in it).
secureHandle('attachments:list', async (userId, { entityType, entityId }) => {
  const res = await fetch(`${_srmApiBase()}/api/attachments/${entityType}/${entityId}`, {
    headers: { Authorization: `Bearer ${_srmServiceToken(userId)}` },
  });
  return _unwrapSrmEnvelope(await res.json());
});
secureHandle('attachments:upload', async (userId, { entityType, entityId, filePath }) => {
  const buf = fs.readFileSync(filePath);
  const form = new FormData();
  form.append('file', new Blob([buf]), path.basename(filePath));
  const res = await fetch(`${_srmApiBase()}/api/attachments/${entityType}/${entityId}/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${_srmServiceToken(userId)}` },
    body: form,
  });
  return _unwrapSrmEnvelope(await res.json());
});
secureHandle('attachments:download', async (userId, { attachmentId, defaultFilename }) => {
  const res = await fetch(`${_srmApiBase()}/api/attachments/file/${attachmentId}`, {
    headers: { Authorization: `Bearer ${_srmServiceToken(userId)}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { ok: false, error: body?.error?.message || `Download failed (${res.status})` };
  }
  const { canceled, filePath } = await dialog.showSaveDialog({ title: 'Save Attachment', defaultPath: defaultFilename || 'attachment' });
  if (canceled || !filePath) return { ok: false, error: 'Save cancelled' };
  const arrBuf = await res.arrayBuffer();
  fs.writeFileSync(filePath, Buffer.from(arrBuf));
  return { ok: true, filePath };
});
secureHandle('attachments:delete', async (userId, { attachmentId }) => {
  const res = await fetch(`${_srmApiBase()}/api/attachments/${attachmentId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${_srmServiceToken(userId)}` },
  });
  return _unwrapSrmEnvelope(await res.json());
});

// Purchase Order PDF — Electron's own Chromium engine renders the HTML built
// by procurementPoPdfHtml into a real PDF via a hidden BrowserWindow. First
// real PDF output in this codebase; no PDF library dependency needed.
ipcMain.handle('procurement-po:print', async (_e, { html, filename }) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Save Purchase Order',
    defaultPath: filename || 'purchase_order.pdf',
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
  });
  if (canceled || !filePath) return { ok: false, error: 'Save cancelled' };

  const printWin = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  try {
    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const pdfBuffer = await printWin.webContents.printToPDF({ printBackground: true, pageSize: 'A4' });
    fs.writeFileSync(filePath, pdfBuffer);
    return { ok: true, filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    printWin.destroy();
  }
});

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
