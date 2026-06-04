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

ipcMain.handle('sales:list', async (_evt, { userId }) => data.salesList(userId));
ipcMain.handle('sales:create', async (_evt, { userId, payload }) => data.salesCreate(userId, payload));
ipcMain.handle('sales:updateStatus', async (_evt, { userId, orderId, status }) => data.salesUpdateStatus(userId, orderId, status));

ipcMain.handle('products:list', async (_evt, { userId, filter }) => data.productsList(userId, filter));
ipcMain.handle('products:create', async (_evt, { userId, payload }) => data.productsCreate(userId, payload));
ipcMain.handle('products:toggle', async (_evt, { userId, productId, reason }) =>
  data.productsToggle(userId, productId, reason)
);

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

