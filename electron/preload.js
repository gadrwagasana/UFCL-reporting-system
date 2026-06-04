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

  salesList: (userId) => ipcRenderer.invoke('sales:list', { userId }),
  salesCreate: (userId, payload) => ipcRenderer.invoke('sales:create', { userId, payload }),
  salesUpdateStatus: (userId, orderId, status) => ipcRenderer.invoke('sales:updateStatus', { userId, orderId, status }),

  productsList: (userId, filter) => ipcRenderer.invoke('products:list', { userId, filter }),
  productsCreate: (userId, payload) => ipcRenderer.invoke('products:create', { userId, payload }),
  productsToggle: (userId, productId, reason) =>
    ipcRenderer.invoke('products:toggle', { userId, productId, reason }),

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
  kpiBudgetsList: (userId, month) => ipcRenderer.invoke('kpi:budgets:list', { userId, month }),
  kpiBudgetSave: (userId, payload) => ipcRenderer.invoke('kpi:budgets:save', { userId, payload }),
  monthlyDashboard: (userId, month) => ipcRenderer.invoke('monthly:dashboard', { userId, month }),
  inventoryList: (userId) => ipcRenderer.invoke('inventory:list', { userId })
});

