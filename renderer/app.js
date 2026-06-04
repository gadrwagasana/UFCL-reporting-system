/* global UFCL */

const STORAGE = {
  user: null,
  approved: { monthly: false },
  unread: 0
};

const NAV = [
  { id: 'dashboard', icon: 'ti-layout-dashboard', label: 'Dashboard', sec: 'Overview' },
  { id: 'daily', icon: 'ti-clipboard-list', label: 'Daily production log', sec: 'Production' },
  { id: 'sales', icon: 'ti-shopping-cart', label: 'Sales orders', sec: 'Commercial' },
  { id: 'products', icon: 'ti-package', label: 'Product catalog', sec: 'Commercial' },
  { id: 'logistics', icon: 'ti-truck', label: 'Logistics & spare parts', sec: 'Operations' },
  { id: 'weekly-cost', icon: 'ti-cash', label: 'Weekly cost report', sec: 'Reports' },
  { id: 'weekly-perf', icon: 'ti-chart-bar', label: 'Weekly performance', sec: 'Reports' },
  { id: 'monthly', icon: 'ti-report-analytics', label: 'Monthly dashboard', sec: 'Reports' },
  { id: 'inventory', icon: 'ti-stack', label: 'Inventory', sec: 'Operations' },
  { id: 'sage', icon: 'ti-refresh', label: 'Sage reconciliation', sec: 'Finance' },
  { id: 'kpi', icon: 'ti-target', label: 'KPI scorecard', sec: 'Executive' },
  { id: 'changes', icon: 'ti-git-pull-request', label: 'Change requests', sec: 'Governance' },
  { id: 'notifications', icon: 'ti-bell', label: 'Notifications', sec: 'Governance' },
  { id: 'audit', icon: 'ti-shield-check', label: 'Audit trail', sec: 'Governance' },
  { id: 'export', icon: 'ti-file-export', label: 'Exports', sec: 'Tools' },
  { id: 'users', icon: 'ti-users', label: 'Users', sec: 'System' }
];

function $(id) {
  return document.getElementById(id);
}

function downloadCsv(content, filename) {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function show(el, on) {
  el.style.display = on ? '' : 'none';
}

function setActivePage(id) {
  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
  const el = $(`page-${id}`);
  if (el) el.classList.add('active');

  document.querySelectorAll('.ni').forEach((n) => n.classList.remove('active'));
  const ni = $(`ni-${id}`);
  if (ni) ni.classList.add('active');
}

function soStatusBadge(status) {
  const map = { Pending: 'ba', Confirmed: 'bb', Dispatched: 'bp', Delivered: 'bg', Cancelled: 'br' };
  return `<span class="badge ${map[status] || 'ba'}">${status || 'Pending'}</span>`;
}

function roleLabel(role) {
  const map = {
    admin: 'System Admin',
    ceo: 'CEO',
    operations: 'Operations Manager',
    sales: 'Sales Manager',
    finance: 'Finance Manager',
    logistics: 'Logistics Manager',
    supervisor: 'Supervisor',
    storekeeper: 'Storekeeper'
  };
  return map[role] || role;
}

function roleOptionHtml(role) {
  return `<option value="${role}">${roleLabel(role)}</option>`;
}

function pageTitle(pageId) {
  const item = NAV.find((x) => x.id === pageId);
  return item?.label || pageId;
}

function renderPermissionCheckboxes(selected = []) {
  const pageIds = ['dashboard', 'daily', 'sales', 'products', 'logistics', 'weekly-cost', 'weekly-perf', 'monthly', 'inventory', 'sage', 'kpi', 'changes', 'audit', 'notifications', 'export', 'users'];
  return pageIds
    .map(
      (id) => `
      <label class="fg" style="display:block;margin-bottom:.45rem">
        <input type="checkbox" class="perm-checkbox" value="${id}" ${selected.includes(id) ? 'checked' : ''}>
        ${pageTitle(id)}
      </label>`
    )
    .join('');
}

function shortName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'UF';
  const a = parts[0][0] || 'U';
  const b = parts[1]?.[0] || (parts[0][1] || 'F');
  return (a + b).toUpperCase();
}

function updateBadge() {
  const b = $('nbadge');
  if (!b) return;
  b.style.display = STORAGE.unread > 0 ? 'block' : 'none';
}

function sectionsFromNav(list) {
  const secs = [];
  for (const n of list) if (!secs.includes(n.sec)) secs.push(n.sec);
  return secs;
}

function buildSidebar(allowedPages) {
  const allowed = new Set(Array.isArray(allowedPages) ? allowedPages : []);
  const secs = sectionsFromNav(NAV);
  let html = '';
  for (const s of secs) {
    const items = NAV.filter((x) => x.sec === s);
    const visible = items.filter((it) => allowed.has(it.id));
    if (!visible.length) continue;
    html += `<div class="nsec">${s}</div>`;
    for (const n of visible) {
      html += `<div class="ni" id="ni-${n.id}" role="button">
        <i class="ti ${n.icon}"></i><span>${n.label}</span>
      </div>`;
    }
  }
  $('sidebar').innerHTML = html;
  NAV.forEach((n) => {
    const el = $(`ni-${n.id}`);
    if (el) el.onclick = () => showPage(n.id);
  });
}

function openOverlay(title, subtitle, bodyHtml, onSave) {
  const o = $('overlay');
  o.innerHTML = `
    <div class="ow">
      <div class="owh">
        <h3><i class="ti ti-edit"></i>${title}</h3>
        <button type="button" class="bs1" id="ovClose"><i class="ti ti-x"></i>Close</button>
      </div>
      <div class="owc">
        ${subtitle ? `<div class="psub" style="margin-bottom:.75rem">${subtitle}</div>` : ''}
        <div class="lerr" id="ovErr"></div>
        ${bodyHtml}
      </div>
    </div>`;
  o.style.display = 'flex';
  $('ovClose').onclick = closeOverlay;
  const cancelBtn = $('ovCancel');
  if (cancelBtn) cancelBtn.onclick = closeOverlay;
  const saveBtn = $('ovSave');
  if (saveBtn) saveBtn.onclick = async () => {
    const errEl = $('ovErr');
    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
    await onSave?.();
  };
}

function closeOverlay() {
  const o = $('overlay');
  o.style.display = 'none';
  o.innerHTML = '';
}

function showOverlayError(msg) {
  const el = $('ovErr');
  if (!el) return;
  el.textContent = msg;
  el.style.cssText = '';
  el.style.display = 'block';
}

function showOverlaySuccess(msg) {
  const el = $('ovErr');
  if (!el) return;
  el.textContent = msg;
  el.style.background = 'var(--g-light)';
  el.style.color = 'var(--g-dark)';
  el.style.borderColor = 'rgba(30,95,54,.25)';
  el.style.display = 'block';
  setTimeout(closeOverlay, 1800);
}

async function bootstrap() {
  console.log('[renderer] bootstrap: calling getBootstrap');
  const res = await UFCL.getBootstrap(STORAGE.user.id);
  console.log('[renderer] bootstrap: getBootstrap returned', res);
  if (!res.ok) throw new Error(res.error || 'Bootstrap failed');
  STORAGE.approved = res.approved || { monthly: false };
  STORAGE.unread = res.unreadNotifications || 0;
  updateBadge();

  $('uname2').textContent = res.user.name;
  $('urole').textContent = roleLabel(res.user.role);
  $('uav').textContent = shortName(res.user.name);
  const pages = Array.isArray(res.userPages) && res.userPages.length ? res.userPages : (res.rolePages?.[res.user.role] || []);
  buildSidebar(pages);

  // default route per user-specific permissions or role permissions
  const first = pages[0] || 'dashboard';
  console.log('[renderer] bootstrap: showing first page', first);
  await showPage(first);
}

async function showPage(id) {
  setActivePage(id);
  switch (id) {
    case 'dashboard':
      return renderDashboard();
    case 'daily':
      return renderDaily();
    case 'sales':
      return renderSales();
    case 'products':
      return renderProducts();
    case 'logistics':
      return renderLogistics();
    case 'weekly-cost':
      return renderWeeklyCost();
    case 'weekly-perf':
      return renderWeeklyPerf();
    case 'kpi':
      return renderKpi();
    case 'export':
      return renderExport();
    case 'notifications':
      return renderNotifications();
    case 'audit':
      return renderAudit();
    case 'changes':
      return renderChanges();
    case 'monthly':
      return renderMonthly();
    case 'inventory':
      return renderInventory();
    case 'sage':
      return renderSage();
    case 'users':
      return renderUsers();
    default:
      return renderStub(id);
  }
}

function renderStub(id) {
  const n = NAV.find((x) => x.id === id);
  $(`page-${id}`).innerHTML = `
    <div class="ptitle">${n?.label || id}</div>
    <div class="psub">This screen is wired to the database in this real app. Remaining sections will be filled next.</div>
    <div class="card"><h3><i class="ti ti-info-circle"></i>Status</h3>
      <p style="color:var(--t3);font-size:13px">Page scaffolded. If you want this completed next, tell me which page is most important.</p>
    </div>
  `;
}

async function renderDashboard() {
  $('page-dashboard').innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;padding:2rem;color:var(--t3);font-size:13px">
      <i class="ti ti-loader-2" style="font-size:18px;animation:spin 1s linear infinite"></i> Loading dashboard…
    </div>`;

  const res = await UFCL.dashboardStats(STORAGE.user.id);
  if (!res.ok) {
    $('page-dashboard').innerHTML = `<div class="ptitle">Dashboard</div><p style="color:var(--red)">${res.error || 'Failed to load dashboard data.'}</p>`;
    return;
  }

  const { production, sales, expenses, alerts, recentActivity, stock = {} } = res;
  const user = STORAGE.user;

  /* ── helpers ── */
  function trendBadge(current, prev, goodDir = 'up') {
    if (!prev) return '';
    const pct = prev > 0 ? Math.round(((current - prev) / prev) * 100) : 0;
    if (pct === 0) return `<span class="db-trend-flat" style="font-size:11px">— unchanged</span>`;
    const up = pct > 0;
    const good = (up && goodDir === 'up') || (!up && goodDir === 'down');
    const cls = good ? 'db-trend-up' : 'db-trend-down';
    const icon = up ? 'ti-trending-up' : 'ti-trending-down';
    return `<span class="${cls}" style="font-size:11px;display:inline-flex;align-items:center;gap:2px">
      <i class="ti ${icon}" style="font-size:10px"></i>${Math.abs(pct)}% vs last month
    </span>`;
  }

  function prodBarChart(daily7) {
    if (!daily7.length) return `<p style="color:var(--t3);font-size:12px;padding:.75rem 0">No production logs in the last 7 days.</p>`;
    const maxVal = Math.max(...daily7.map((d) => Number(d.timber_units) + Number(d.poles_units)), 1);
    const n = daily7.length;
    const gap = 6;
    const bw = Math.max(16, Math.floor((320 - (n - 1) * gap) / n));
    const ch = 72;
    const totalW = n * bw + (n - 1) * gap;

    let bars = '';
    let lbls = '';
    daily7.forEach((d, i) => {
      const x = i * (bw + gap);
      const timber = Number(d.timber_units);
      const poles = Number(d.poles_units);
      const total = timber + poles;
      const tH = total > 0 ? Math.max(3, Math.round((total / maxVal) * ch)) : 3;
      const timberH = total > 0 ? Math.round((timber / total) * tH) : tH;
      const polesH = tH - timberH;
      const date = d.log_date ? new Date(d.log_date + 'T12:00:00') : null;
      const lbl = date ? date.toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 3) : '—';
      bars += `<rect x="${x}" y="${ch - tH}" width="${bw}" height="${polesH || 0}" fill="#1D4ED8" rx="3" opacity=".75"/>
               <rect x="${x}" y="${ch - timberH}" width="${bw}" height="${timberH}" fill="#2E8B57" rx="3"/>`;
      lbls += `<text x="${x + bw / 2}" y="${ch + 15}" text-anchor="middle" font-size="10" fill="#6B7280" font-family="DM Sans,sans-serif">${lbl}</text>`;
    });

    return `
      <div style="display:flex;gap:14px;margin-bottom:10px">
        <span style="font-size:11px;color:var(--t3);display:flex;align-items:center;gap:4px"><span style="width:9px;height:9px;background:#2E8B57;border-radius:2px;display:inline-block"></span>Timber</span>
        <span style="font-size:11px;color:var(--t3);display:flex;align-items:center;gap:4px"><span style="width:9px;height:9px;background:#1D4ED8;border-radius:2px;display:inline-block;opacity:.75"></span>Poles</span>
      </div>
      <svg viewBox="0 0 ${totalW} ${ch + 20}" width="100%" style="overflow:visible;display:block">
        ${bars}${lbls}
      </svg>`;
  }

  function expBarChart(cats) {
    const hasData = cats.some((c) => c.total > 0);
    if (!hasData) return `<p style="color:var(--t3);font-size:12px;padding:.75rem 0">No expenses recorded this month.</p>`;
    const maxVal = Math.max(...cats.map((c) => c.total), 1);
    return cats.map((c) => {
      const pct = Math.round((c.total / maxVal) * 100);
      return `<div style="margin-bottom:9px">
        <div style="display:flex;justify-content:space-between;margin-bottom:3px">
          <span style="font-size:11px;color:var(--t2);font-weight:500">${c.name}</span>
          <span style="font-size:11px;font-family:var(--fm);color:var(--t3)">RWF ${c.total.toLocaleString()}</span>
        </div>
        <div style="background:var(--surf);border-radius:3px;height:7px;overflow:hidden">
          <div style="background:var(--g-soft);height:100%;width:${pct}%;border-radius:3px"></div>
        </div>
      </div>`;
    }).join('');
  }

  const alertTotal = alerts.lowStock + alerts.pendingChanges + STORAGE.unread;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const firstName = user.name.split(' ')[0];

  $('page-dashboard').innerHTML = `
    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>

    <!-- Greeting row -->
    <div class="db-greeting">
      <div>
        <div class="ptitle" style="margin-bottom:2px">${greeting}, ${firstName}</div>
        <div class="psub" style="margin:0">${dateStr}</div>
      </div>
      <div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap">
        ${alertTotal > 0
          ? `<span class="db-pill db-pill-alert"><i class="ti ti-alert-triangle"></i>${alertTotal} alert${alertTotal > 1 ? 's' : ''}</span>`
          : `<span class="db-pill db-pill-ok"><i class="ti ti-circle-check"></i>All clear</span>`}
        <span class="db-pill db-pill-role">${roleLabel(user.role)}</span>
      </div>
    </div>

    <!-- Stock balance row -->
    <div class="db-grid-4" style="margin-bottom:.625rem">
      <div class="db-kpi" style="border-top:3px solid #2E8B57">
        <div class="db-kpi-lbl">Timber in stock</div>
        <div class="db-kpi-val" style="color:${stock.timberStock < 0 ? 'var(--red)' : 'inherit'}">${Number(stock.timberStock || 0).toLocaleString()}</div>
        <div style="font-size:11px;color:var(--t4);line-height:1.8;margin-top:2px">
          <div><i class="ti ti-arrow-up" style="font-size:9px;color:var(--g-soft)"></i> ${Number(stock.timberProduced || 0).toLocaleString()} produced</div>
          <div><i class="ti ti-arrow-down" style="font-size:9px;color:var(--amber)"></i> ${Number(stock.timberSold || 0).toLocaleString()} sold</div>
        </div>
      </div>
      <div class="db-kpi" style="border-top:3px solid #1D4ED8">
        <div class="db-kpi-lbl">Poles in stock</div>
        <div class="db-kpi-val" style="color:${stock.polesStock < 0 ? 'var(--red)' : 'inherit'}">${Number(stock.polesStock || 0).toLocaleString()}</div>
        <div style="font-size:11px;color:var(--t4);line-height:1.8;margin-top:2px">
          <div><i class="ti ti-arrow-up" style="font-size:9px;color:var(--g-soft)"></i> ${Number(stock.polesProduced || 0).toLocaleString()} produced</div>
          <div><i class="ti ti-arrow-down" style="font-size:9px;color:var(--amber)"></i> ${Number(stock.polesSold || 0).toLocaleString()} sold</div>
        </div>
      </div>
      <div class="db-kpi" style="border-top:3px solid #2E8B57">
        <div class="db-kpi-lbl">Timber this month</div>
        <div class="db-kpi-val">${Number(production.thisMonth.timber || 0).toLocaleString()}</div>
        <div class="db-kpi-sub">${trendBadge(production.thisMonth.timber, production.lastMonth.timber)}</div>
      </div>
      <div class="db-kpi" style="border-top:3px solid #1D4ED8">
        <div class="db-kpi-lbl">Poles this month</div>
        <div class="db-kpi-val">${Number(production.thisMonth.poles || 0).toLocaleString()}</div>
        <div class="db-kpi-sub">${trendBadge(production.thisMonth.poles, production.lastMonth.poles)}</div>
      </div>
    </div>

    <!-- Expenses + alerts row -->
    <div class="db-grid-4">
      <div class="db-kpi" style="border-top:3px solid #D97706">
        <div class="db-kpi-lbl">Expenses — ${res.month}</div>
        <div class="db-kpi-val" style="font-size:17px">RWF ${Number(expenses.thisMonth).toLocaleString()}</div>
        <div class="db-kpi-sub" style="color:var(--t4);font-size:11px"><i class="ti ti-cash" style="font-size:11px"></i>month to date</div>
      </div>
      <div class="db-kpi" style="border-top:3px solid ${alertTotal > 0 ? '#DC2626' : '#0F766E'}">
        <div class="db-kpi-lbl">Alerts</div>
        <div class="db-kpi-val" style="color:${alertTotal > 0 ? 'var(--red)' : 'var(--teal)'}">${alertTotal}</div>
        <div style="font-size:11px;line-height:1.7;margin-top:4px;display:flex;flex-direction:column;gap:3px">
          ${alerts.lowStock > 0 ? `<button id="db-go-inventory" style="all:unset;cursor:pointer;display:flex;align-items:center;gap:4px;color:var(--red);font-size:11px;text-align:left"><i class="ti ti-alert-triangle" style="font-size:10px;flex-shrink:0"></i>${alerts.lowStock} low stock item${alerts.lowStock > 1 ? 's' : ''}<i class="ti ti-chevron-right" style="font-size:9px;margin-left:auto"></i></button>` : ''}
          ${alerts.pendingChanges > 0 ? `<button id="db-go-changes" style="all:unset;cursor:pointer;display:flex;align-items:center;gap:4px;color:var(--amber);font-size:11px;text-align:left"><i class="ti ti-git-pull-request" style="font-size:10px;flex-shrink:0"></i>${alerts.pendingChanges} pending change${alerts.pendingChanges > 1 ? 's' : ''}<i class="ti ti-chevron-right" style="font-size:9px;margin-left:auto"></i></button>` : ''}
          ${STORAGE.unread > 0 ? `<button id="db-go-notif" style="all:unset;cursor:pointer;display:flex;align-items:center;gap:4px;color:var(--blue);font-size:11px;text-align:left"><i class="ti ti-bell" style="font-size:10px;flex-shrink:0"></i>${STORAGE.unread} unread notification${STORAGE.unread > 1 ? 's' : ''}<i class="ti ti-chevron-right" style="font-size:9px;margin-left:auto"></i></button>` : ''}
          ${alertTotal === 0 ? `<div style="color:var(--teal);display:flex;align-items:center;gap:4px"><i class="ti ti-circle-check" style="font-size:10px"></i>No issues found</div>` : ''}
        </div>
      </div>
      <div class="db-kpi" style="border-top:3px solid var(--border2)">
        <div class="db-kpi-lbl">Sales this month</div>
        <div class="db-kpi-val">${Number(sales.thisMonth.orders || 0)}</div>
        <div class="db-kpi-sub" style="color:var(--t4);font-size:11px"><i class="ti ti-shopping-cart" style="font-size:11px"></i>${Number(sales.thisMonth.qty || 0).toLocaleString()} units dispatched</div>
      </div>
      <div class="db-kpi" style="border-top:3px solid var(--border2)">
        <div class="db-kpi-lbl">Revenue this month</div>
        <div class="db-kpi-val" style="font-size:17px">RWF ${Number(sales.thisMonth.revenue || 0).toLocaleString()}</div>
        <div class="db-kpi-sub" style="color:var(--t4);font-size:11px"><i class="ti ti-coin" style="font-size:11px"></i>month to date</div>
      </div>
    </div>

    <!-- Charts row -->
    <div class="db-grid-2">
      <div class="card" style="margin-bottom:0">
        <h3><i class="ti ti-chart-bar"></i>7-day production</h3>
        ${prodBarChart(production.daily7)}
      </div>
      <div class="card" style="margin-bottom:0">
        <h3><i class="ti ti-cash"></i>Monthly expenses by category</h3>
        ${expBarChart(expenses.byCategory)}
        ${expenses.thisMonth > 0 ? `<div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border);display:flex;justify-content:space-between">
          <span style="font-size:11px;color:var(--t3)">Total</span>
          <span style="font-size:12px;font-family:var(--fm);font-weight:600;color:var(--t1)">RWF ${Number(expenses.thisMonth).toLocaleString()}</span>
        </div>` : ''}
      </div>
    </div>

    <!-- Bottom row -->
    <div class="db-grid-2">
      <div class="card" style="margin-bottom:0">
        <h3><i class="ti ti-shopping-cart"></i>Recent sales orders</h3>
        ${sales.recent.length ? `
          <div class="tw">
            <table class="dt">
              <thead><tr><th>Order</th><th>Customer</th><th>Type</th><th>Qty</th><th>Unit (RWF)</th></tr></thead>
              <tbody>
                ${sales.recent.map((r) => `<tr>
                  <td style="font-family:var(--fm);font-size:12px">${r.order_number}</td>
                  <td style="font-size:12px">${r.customer_name}</td>
                  <td><span class="badge ${r.product_type === 'Timber' ? 'ba' : 'bb'}" style="font-size:10px">${r.product_type}</span></td>
                  <td style="font-size:12px">${r.quantity}</td>
                  <td style="font-size:12px;font-family:var(--fm)">${Number(r.unit_price).toLocaleString()}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
          <div style="margin-top:.75rem">
            <button class="bs1" style="font-size:12px" id="db-go-sales"><i class="ti ti-arrow-right" style="font-size:11px"></i>All orders</button>
          </div>` : `<p style="color:var(--t3);font-size:12px">No sales orders this month.</p>`}
      </div>
      <div class="card" style="margin-bottom:0">
        <h3><i class="ti ti-activity"></i>Recent activity</h3>
        ${recentActivity.length ? recentActivity.map((a) => `
          <div class="db-activity-row">
            <div class="db-activity-icon">
              <i class="ti ${a.icon || 'ti-check'}" style="font-size:12px;color:var(--g-soft)"></i>
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;color:var(--t1);line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${a.action}</div>
              <div style="font-size:11px;color:var(--t3);margin-top:1px;display:flex;align-items:center;gap:5px">
                ${a.user_name || 'System'}
                <span class="badge bp" style="font-size:10px;padding:1px 5px">${a.role}</span>
                <span style="font-family:var(--fm)">${a.time}</span>
              </div>
            </div>
          </div>`).join('')
          : `<p style="color:var(--t3);font-size:12px">No recent activity.</p>`}
        <div style="margin-top:.75rem">
          <button class="bs1" style="font-size:12px" id="db-go-audit"><i class="ti ti-arrow-right" style="font-size:11px"></i>Full audit trail</button>
        </div>
      </div>
    </div>
  `;

  const gs = $('db-go-sales');      if (gs) gs.onclick = () => showPage('sales');
  const ga = $('db-go-audit');      if (ga) ga.onclick = () => showPage('audit');
  const gi = $('db-go-inventory');  if (gi) gi.onclick = () => showPage('inventory');
  const gc = $('db-go-changes');    if (gc) gc.onclick = () => showPage('changes');
  const gn = $('db-go-notif');      if (gn) gn.onclick = () => showPage('notifications');
}

async function renderDaily() {
  const res = await UFCL.dailyList(STORAGE.user.id);
  if (!res.ok) return renderDenied('daily', res.error);
  const rows = res.rows || [];
  const stock = res.stock || {};

  const totalTimber = rows.reduce((s, r) => s + Number(r.timber_units || 0), 0);
  const totalPoles  = rows.reduce((s, r) => s + Number(r.poles_units  || 0), 0);

  $('page-daily').innerHTML = `
    <div class="ptitle">Daily production log</div>
    <div class="psub">Log daily output and downtime. Each entry adds to the available stock balance.</div>

    <div class="cards">
      <div class="mc" style="border-top:3px solid #2E8B57">
        <div class="mclbl">Timber in stock</div>
        <div class="mcval" style="color:${stock.timberStock < 0 ? 'var(--red)' : 'inherit'}">${Number(stock.timberStock || 0).toLocaleString()}</div>
        <div class="mcsub cg"><i class="ti ti-package"></i>after all sales</div>
      </div>
      <div class="mc" style="border-top:3px solid #1D4ED8">
        <div class="mclbl">Poles in stock</div>
        <div class="mcval" style="color:${stock.polesStock < 0 ? 'var(--red)' : 'inherit'}">${Number(stock.polesStock || 0).toLocaleString()}</div>
        <div class="mcsub cg"><i class="ti ti-package"></i>after all sales</div>
      </div>
      <div class="mc">
        <div class="mclbl">Timber (last 50 logs)</div>
        <div class="mcval">${totalTimber.toLocaleString()}</div>
        <div class="mcsub cg"><i class="ti ti-ruler-2"></i>units produced</div>
      </div>
      <div class="mc">
        <div class="mclbl">Poles (last 50 logs)</div>
        <div class="mcval">${totalPoles.toLocaleString()}</div>
        <div class="mcsub bp"><i class="ti ti-current-location"></i>units produced</div>
      </div>
    </div>

    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem">
        <h3 style="margin-bottom:0"><i class="ti ti-clipboard-list"></i>Production log</h3>
        <button class="appbtn" id="newDaily"><i class="ti ti-plus" style="font-size:12px;vertical-align:-1px"></i> Add entry</button>
      </div>
      <div class="tw">
        <table class="dt">
          <thead><tr><th>Date</th><th>Supervisor</th><th>Timber</th><th>T. waste</th><th>Poles</th><th>P. waste</th><th>Downtime</th><th>Remarks</th></tr></thead>
          <tbody>
            ${rows.length === 0
              ? '<tr><td colspan="8" style="text-align:center;color:var(--t3);padding:2rem">No production entries yet.</td></tr>'
              : rows.map((r) => `<tr>
                <td style="font-family:var(--fm)">${r.date}</td>
                <td>${r.supervisor || '—'}</td>
                <td style="font-weight:500;color:var(--g-dark)">${Number(r.timber_units || 0).toLocaleString()}</td>
                <td style="color:var(--amber)">${Number(r.timber_waste || 0).toLocaleString()}</td>
                <td style="font-weight:500;color:#1D4ED8">${Number(r.poles_units || 0).toLocaleString()}</td>
                <td style="color:var(--amber)">${Number(r.poles_waste || 0).toLocaleString()}</td>
                <td style="font-family:var(--fm);color:var(--t3)">${Number(r.downtime_hours || 0).toFixed(1)}h</td>
                <td style="color:var(--t3)">${r.remarks || '—'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  $('newDaily').onclick = () =>
    openOverlay(
      'Add production entry',
      `Current stock — Timber: <strong>${Number(stock.timberStock || 0).toLocaleString()}</strong> &nbsp;·&nbsp; Poles: <strong>${Number(stock.polesStock || 0).toLocaleString()}</strong>`,
      `
      <div class="frow">
        <div class="fg"><label>Date</label><input type="date" id="dl-date" value="${new Date().toISOString().split('T')[0]}"></div>
        <div class="fg"><label>Supervisor</label><input type="text" id="dl-sup" placeholder="${STORAGE.user.name}"></div>
      </div>
      <div class="frow">
        <div class="fg"><label>Timber units produced</label><input type="number" id="dl-tu" placeholder="0" min="0"></div>
        <div class="fg"><label>Timber waste (pieces)</label><input type="number" id="dl-tw" placeholder="0" min="0"></div>
      </div>
      <div class="frow">
        <div class="fg"><label>Poles units produced</label><input type="number" id="dl-pu" placeholder="0" min="0"></div>
        <div class="fg"><label>Poles waste (pieces)</label><input type="number" id="dl-pw" placeholder="0" min="0"></div>
      </div>
      <div class="frow">
        <div class="fg"><label>Downtime (hrs)</label><input type="number" id="dl-dt" placeholder="0" step="0.5" min="0"></div>
        <div class="fg"><label>Downtime reason</label><input type="text" id="dl-dr" placeholder="e.g. Blade replacement"></div>
      </div>
      <div class="frow full"><div class="fg"><label>Remarks</label><textarea id="dl-rem" rows="2" placeholder="Any notes for this shift"></textarea></div></div>
      <div class="brow"><button class="bp1" id="ovSave"><i class="ti ti-device-floppy" style="font-size:13px;vertical-align:-1px"></i> Save entry</button><button class="bs1" id="ovCancel">Cancel</button></div>
      `,
      async () => {
        const payload = {
          date:           $('dl-date').value,
          supervisor:     $('dl-sup').value,
          timber_units:   $('dl-tu').value,
          timber_waste:   $('dl-tw').value,
          poles_units:    $('dl-pu').value,
          poles_waste:    $('dl-pw').value,
          downtime_hours: $('dl-dt').value,
          downtime_reason: $('dl-dr').value,
          remarks:        $('dl-rem').value
        };
        const r = await UFCL.dailyCreate(STORAGE.user.id, payload);
        if (!r.ok) return showOverlayError(r.error || 'Failed to save entry.');
        closeOverlay();
        await renderDaily();
      }
    );
}

async function renderSales() {
  const res = await UFCL.salesList(STORAGE.user.id);
  if (!res.ok) return renderDenied('sales', res.error);
  const rows = res.rows || [];
  const stock = res.stock || {};

  const timberLow = stock.timberStock < 10;
  const polesLow  = stock.polesStock  < 10;

  $('page-sales').innerHTML = `
    <div class="ptitle">Sales orders</div>
    <div class="psub">Dispatch timber and poles to customers. Current stock is shown below — quantities are deducted on each order.</div>

    <div class="cards">
      <div class="mc" style="border-top:3px solid #2E8B57">
        <div class="mclbl">Timber in stock</div>
        <div class="mcval" style="color:${stock.timberStock < 0 ? 'var(--red)' : timberLow ? 'var(--amber)' : 'inherit'}">${Number(stock.timberStock || 0).toLocaleString()}</div>
        <div class="mcsub ${timberLow ? 'cr' : 'cg'}"><i class="ti ti-package"></i>${Number(stock.timberProduced || 0).toLocaleString()} produced · ${Number(stock.timberSold || 0).toLocaleString()} sold</div>
      </div>
      <div class="mc" style="border-top:3px solid #1D4ED8">
        <div class="mclbl">Poles in stock</div>
        <div class="mcval" style="color:${stock.polesStock < 0 ? 'var(--red)' : polesLow ? 'var(--amber)' : 'inherit'}">${Number(stock.polesStock || 0).toLocaleString()}</div>
        <div class="mcsub ${polesLow ? 'cr' : 'cg'}"><i class="ti ti-package"></i>${Number(stock.polesProduced || 0).toLocaleString()} produced · ${Number(stock.polesSold || 0).toLocaleString()} sold</div>
      </div>
      <div class="mc">
        <div class="mclbl">Total orders</div>
        <div class="mcval">${rows.length}</div>
        <div class="mcsub cg"><i class="ti ti-receipt"></i>last 50</div>
      </div>
    </div>

    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem">
        <h3 style="margin-bottom:0"><i class="ti ti-shopping-cart"></i>Orders</h3>
        <button class="appbtn" id="newSO"><i class="ti ti-plus" style="font-size:12px;vertical-align:-1px"></i> New order</button>
      </div>
      <div class="tw">
        <table class="dt">
          <thead><tr><th>Order #</th><th>Customer</th><th>Type</th><th>Size</th><th>Qty</th><th>Unit price (RWF)</th><th>Total (RWF)</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            ${rows.length === 0
              ? '<tr><td colspan="9" style="text-align:center;color:var(--t3);padding:2rem">No orders yet.</td></tr>'
              : rows.map((r) => `<tr>
                <td style="font-family:var(--fm);font-weight:500">${r.order_number}</td>
                <td>${r.customer_name}</td>
                <td><span class="badge ${r.product_type === 'Timber' ? 'ba' : 'bb'}">${r.product_type}</span></td>
                <td style="font-family:var(--fm)">${r.product_size}</td>
                <td style="font-weight:500">${Number(r.quantity).toLocaleString()}</td>
                <td style="font-family:var(--fm)">${Number(r.unit_price).toLocaleString()}</td>
                <td style="font-family:var(--fm);font-weight:500">${(Number(r.quantity) * Number(r.unit_price)).toLocaleString()}</td>
                <td><button class="so-status-btn" data-so="${r.id}" data-cur="${r.status || 'Pending'}" style="all:unset;cursor:pointer">${soStatusBadge(r.status || 'Pending')}</button></td>
                <td style="color:var(--t3)">${new Date(r.created_at).toLocaleDateString('en-GB')}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  $('newSO').onclick = () =>
    openOverlay(
      'New sales order',
      `Available stock — Timber: <strong>${Number(stock.timberStock || 0).toLocaleString()}</strong> units &nbsp;·&nbsp; Poles: <strong>${Number(stock.polesStock || 0).toLocaleString()}</strong> units`,
      `
      <div class="frow">
        <div class="fg"><label>Order number</label><input type="text" placeholder="SO-2026-XXX" id="so-num"></div>
        <div class="fg"><label>Customer name</label><input type="text" placeholder="Customer company" id="so-cust"></div>
      </div>
      <div class="frow">
        <div class="fg"><label>Product type</label>
          <select id="so-type"><option value="">— Select —</option><option value="Timber">Timber</option><option value="Poles">Wooden Poles</option></select>
        </div>
        <div class="fg"><label>Product size / spec</label><input type="text" id="so-size" placeholder="e.g. 120×250×4m"></div>
      </div>
      <div class="frow">
        <div class="fg"><label>Quantity</label><input type="number" placeholder="0" min="1" id="so-qty"></div>
        <div class="fg"><label>Unit price (RWF)</label><input type="number" placeholder="0" min="0" id="so-price"></div>
      </div>
      <div class="frow full"><div class="fg"><label>Notes</label><input type="text" id="so-notes" placeholder="Delivery instructions or special requirements (optional)"></div></div>
      <div class="frow full"><div class="fg"><label>Reason / description</label><input type="text" id="so-reason" placeholder="Required for audit trail"></div></div>
      <div class="brow"><button class="bp1" id="ovSave"><i class="ti ti-device-floppy" style="font-size:13px;vertical-align:-1px"></i> Save order</button><button class="bs1" id="ovCancel">Cancel</button></div>
      `,
      async () => {
        const payload = {
          order_number:  $('so-num').value.trim(),
          customer_name: $('so-cust').value.trim(),
          product_type:  $('so-type').value,
          product_size:  $('so-size').value.trim(),
          quantity:      $('so-qty').value,
          unit_price:    $('so-price').value,
          notes:         $('so-notes').value.trim(),
          reason:        $('so-reason').value.trim()
        };
        const r = await UFCL.salesCreate(STORAGE.user.id, payload);
        if (!r.ok) return showOverlayError(r.error || 'Failed to save order.');
        closeOverlay();
        await renderSales();
      }
    );

  const STATUSES = ['Pending', 'Confirmed', 'Dispatched', 'Delivered', 'Cancelled'];

  $('page-sales').querySelectorAll('.so-status-btn').forEach((btn) => {
    btn.onclick = () => {
      const orderId = Number(btn.dataset.so);
      const current = btn.dataset.cur || 'Pending';
      const order = rows.find((r) => Number(r.id) === orderId);
      if (!order) return;
      openOverlay(
        'Update order status',
        `<strong>${order.order_number}</strong> &nbsp;·&nbsp; ${order.customer_name}`,
        `
          <div class="frow full">
            <div class="fg"><label>Status</label>
              <select id="so-status-sel">
                ${STATUSES.map((s) => `<option value="${s}" ${s === current ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="brow">
            <button type="button" class="bp1" id="ovSave"><i class="ti ti-circle-check" style="font-size:13px;vertical-align:-1px"></i> Update</button>
            <button type="button" class="bs1" id="ovCancel">Cancel</button>
          </div>
        `,
        async () => {
          const newStatus = $('so-status-sel').value;
          const r = await UFCL.salesUpdateStatus(STORAGE.user.id, orderId, newStatus);
          if (!r.ok) return showOverlayError(r.error || 'Failed to update status.');
          closeOverlay();
          await renderSales();
        }
      );
    };
  });
}

async function renderProducts() {
  const currentFilter = $('prodFilter')?.dataset?.v || 'All';
  const res = await UFCL.productsList(STORAGE.user.id, currentFilter);
  if (!res.ok) return renderDenied('products', res.error);
  const rows = res.rows || [];
  const isAdmin = !!res.isAdmin;

  const activeCount = rows.filter((p) => p.active).length;
  const timberCount = rows.filter((p) => p.type === 'Timber').length;
  const polesCount = rows.filter((p) => p.type === 'Poles').length;
  const cols = isAdmin ? 8 : 7;

  $('page-products').innerHTML = `
    <div class="ptitle">Product catalog</div>
    <div class="psub">Product sizes available for production orders. All additions and status changes are logged to the audit trail.</div>

    <div class="cards">
      <div class="mc"><div class="mclbl">Total</div><div class="mcval">${rows.length}</div><div class="mcsub cg"><i class="ti ti-package"></i>products</div></div>
      <div class="mc"><div class="mclbl">Active</div><div class="mcval">${activeCount}</div><div class="mcsub cg"><i class="ti ti-circle-check"></i>in use</div></div>
      <div class="mc"><div class="mclbl">Timber sizes</div><div class="mcval">${timberCount}</div><div class="mcsub ca"><i class="ti ti-ruler-2"></i>sizes</div></div>
      <div class="mc"><div class="mclbl">Pole specs</div><div class="mcval">${polesCount}</div><div class="mcsub bp"><i class="ti ti-current-location"></i>specs</div></div>
    </div>

    <div class="card">
      <h3><i class="ti ti-plus"></i>Add product</h3>
      <div class="frow three">
        <div class="fg"><label>Type</label><select id="np-type"><option value="Timber">Timber</option><option value="Poles">Wooden Poles</option></select></div>
        <div class="fg"><label>Size / Spec</label><input type="text" id="np-size" placeholder="e.g. 50×100×3000 or 200mm dia×5m"></div>
        <div class="fg"><label>Customer ref</label><input type="text" id="np-ref" placeholder="e.g. SO-2026-120 (optional)"></div>
      </div>
      <div class="frow full"><div class="fg"><label>Reason for adding</label><textarea id="np-reason" rows="2" placeholder="Briefly explain the business need for this new size — required for audit…"></textarea></div></div>
      <div class="brow"><button class="bp1" id="np-save"><i class="ti ti-circle-check" style="font-size:13px;vertical-align:-1px"></i> Add product</button></div>
      <div class="lerr" id="np-err"></div>
    </div>

    <div class="fchips" id="prodFilter" data-v="${currentFilter}">
      <button class="fchip ${currentFilter === 'All' ? 'active' : ''}" data-f="All">All</button>
      <button class="fchip ${currentFilter === 'Timber' ? 'active' : ''}" data-f="Timber">Timber</button>
      <button class="fchip ${currentFilter === 'Poles' ? 'active' : ''}" data-f="Poles">Wooden Poles</button>
      <button class="fchip ${currentFilter === 'Active' ? 'active' : ''}" data-f="Active">Active only</button>
    </div>

    <div class="card">
      <h3><i class="ti ti-table"></i>Products</h3>
      <div class="tw">
        <table class="dt">
          <thead><tr><th>Type</th><th>Size / Spec</th><th>Status</th><th>Added by</th><th>Date</th><th>Reason</th><th>Ref</th>${isAdmin ? '<th></th>' : ''}</tr></thead>
          <tbody>
            ${rows.length === 0
              ? `<tr><td colspan="${cols}" style="text-align:center;color:var(--t3);padding:2rem">No products match this filter.</td></tr>`
              : rows.map((p) => `<tr>
                <td><span class="badge ${p.type === 'Timber' ? 'ba' : 'bb'}">${p.type}</span></td>
                <td style="font-family:var(--fm);font-weight:500">${p.size}</td>
                <td><span class="badge ${p.active ? 'bg' : 'br'}">${p.active ? 'Active' : 'Inactive'}</span></td>
                <td>${p.by || '—'}</td>
                <td style="font-family:var(--fm);color:var(--t3)">${p.date}</td>
                <td style="color:var(--t3);max-width:200px">${p.reason || '—'}</td>
                <td style="font-family:var(--fm);color:var(--t3)">${p.ref || '—'}</td>
                ${isAdmin ? `<td><button class="${p.active ? 'bdanger' : 'bs1'}" style="font-size:11px;padding:4px 10px" data-tog="${p.id}" data-active="${p.active}" data-size="${p.size}">${p.active ? 'Deactivate' : 'Reactivate'}</button></td>` : ''}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  const npErr = $('np-err');
  $('np-save').onclick = async () => {
    npErr.style.display = 'none';
    const payload = {
      type: $('np-type').value,
      size: $('np-size').value.trim(),
      ref: $('np-ref').value.trim(),
      reason: $('np-reason').value.trim()
    };
    if (!payload.size) { npErr.textContent = 'Size / Spec is required.'; npErr.style.display = 'block'; return; }
    if (!payload.reason) { npErr.textContent = 'A reason is required for the audit trail.'; npErr.style.display = 'block'; return; }
    const r = await UFCL.productsCreate(STORAGE.user.id, payload);
    if (!r.ok) { npErr.textContent = r.error || 'Failed to add product.'; npErr.style.display = 'block'; return; }
    await renderProducts();
  };

  $('page-products').querySelectorAll('#prodFilter .fchip').forEach((b) => {
    b.onclick = async () => {
      $('prodFilter').dataset.v = b.dataset.f;
      await renderProducts();
    };
  });

  $('page-products').querySelectorAll('[data-tog]').forEach((btn) => {
    btn.onclick = () => {
      const id = Number(btn.dataset.tog);
      const active = btn.dataset.active === 'true';
      const size = btn.dataset.size;
      openOverlay(
        active ? 'Deactivate product' : 'Reactivate product',
        active
          ? `<strong>${size}</strong> will be hidden from new production orders.`
          : `<strong>${size}</strong> will be available for new production orders again.`,
        `
          <div class="frow full"><div class="fg"><label>Reason</label><input type="text" id="tog-reason" placeholder="Required — recorded in the audit trail"></div></div>
          <div class="brow">
            <button type="button" class="${active ? 'bdanger' : 'bp1'}" id="ovSave">${active ? '<i class="ti ti-eye-off" style="font-size:13px;vertical-align:-1px"></i> Deactivate' : '<i class="ti ti-refresh" style="font-size:13px;vertical-align:-1px"></i> Reactivate'}</button>
            <button type="button" class="bs1" id="ovCancel">Cancel</button>
          </div>
        `,
        async () => {
          const reason = $('tog-reason').value.trim();
          if (!reason) return showOverlayError('A reason is required for the audit trail.');
          const r = await UFCL.productsToggle(STORAGE.user.id, id, reason);
          if (!r.ok) return showOverlayError(r.error || 'Failed to update product.');
          closeOverlay();
          await renderProducts();
        }
      );
    };
  });
}

async function renderWeeklyCost() {
  const res = await UFCL.weeklyCost(STORAGE.user.id);
  if (!res.ok) return renderDenied('weekly-cost', res.error);

  const { weekNumber, month, summary = [], expenses = [], totals = {} } = res;

  const ragBadge = (status) => {
    if (status === 'red') return '<span class="badge br">Over</span>';
    if (status === 'amber') return '<span class="badge ba">Near</span>';
    return '<span class="badge bg">OK</span>';
  };

  const varianceStyle = (v) => {
    const pct = Number(v || 0);
    if (pct > 5) return 'color:var(--red);font-weight:600';
    if (pct > 0) return 'color:var(--amber);font-weight:500';
    return 'color:var(--g-soft)';
  };

  const budgetPct = totals.budget ? Math.min(150, (Number(totals.month || 0) / Number(totals.budget)) * 100) : 0;
  const budgetBarColor = budgetPct > 105 ? 'var(--red)' : budgetPct > 90 ? 'var(--amber)' : 'var(--g-soft)';
  const expenseMap = Object.fromEntries(expenses.map((e) => [e.category_id, e]));

  $('page-weekly-cost').innerHTML = `
    <div class="ptitle">Weekly Cost Report</div>
    <div class="psub">${month} — Week ${weekNumber}. Enter and review expenses by category.</div>

    <div class="cards">
      <div class="mc"><div class="mclbl">This week</div><div class="mcval">RWF ${Number(totals.week || 0).toLocaleString()}</div><div class="mcsub bp"><i class="ti ti-cash"></i>week total</div></div>
      <div class="mc"><div class="mclbl">Month to date</div><div class="mcval">RWF ${Number(totals.month || 0).toLocaleString()}</div><div class="mcsub cg"><i class="ti ti-trending-up"></i>cumulative</div></div>
      <div class="mc"><div class="mclbl">Monthly budget</div><div class="mcval">RWF ${Number(totals.budget || 0).toLocaleString()}</div><div class="mcsub bp"><i class="ti ti-target"></i>target</div></div>
      <div class="mc"><div class="mclbl">Variance</div><div class="mcval" style="${varianceStyle(totals.variance)}">${Number(totals.variance || 0).toFixed(1)}%</div><div class="mcsub bp"><i class="ti ti-percentage"></i>vs budget</div></div>
    </div>

    <div class="card" style="padding-bottom:.875rem">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem">
        <span style="font-size:11px;font-weight:600;color:var(--t3);text-transform:uppercase;letter-spacing:.05em">Budget utilisation</span>
        <span style="font-size:12px;font-weight:600;color:${budgetBarColor}">${Math.min(budgetPct, 150).toFixed(1)}%</span>
      </div>
      <div style="background:var(--border);border-radius:4px;height:7px;overflow:hidden">
        <div style="background:${budgetBarColor};height:100%;width:${Math.min(100, budgetPct)}%;border-radius:4px;transition:.3s"></div>
      </div>
    </div>

    <div class="card">
      <h3><i class="ti ti-cash"></i>Expense categories — Week ${weekNumber}</h3>
      <div class="tw">
        <table class="dt">
          <thead><tr><th>Category</th><th>This week</th><th>Month to date</th><th>Budget</th><th>Variance</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${summary.length === 0
              ? '<tr><td colspan="7" style="text-align:center;color:var(--t3);padding:2rem">No expense categories configured.</td></tr>'
              : summary.map((cat) => `<tr>
                <td style="font-weight:500">${cat.name}</td>
                <td style="font-family:var(--fm)">${Number(cat.week_amount || 0).toLocaleString()}</td>
                <td style="font-family:var(--fm)">${Number(cat.month_amount || 0).toLocaleString()}</td>
                <td style="font-family:var(--fm);color:var(--t3)">${Number(cat.budget || 0).toLocaleString()}</td>
                <td style="${varianceStyle(cat.variance)}">${Number(cat.variance || 0).toFixed(1)}%</td>
                <td>${ragBadge(cat.status)}</td>
                <td><button type="button" class="bs1" style="font-size:11px;padding:4px 10px" data-exp="${cat.id}"><i class="ti ti-pencil" style="font-size:11px;vertical-align:-1px"></i> Edit</button></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  $('page-weekly-cost').querySelectorAll('[data-exp]').forEach((btn) => {
    btn.onclick = () => {
      const catId = Number(btn.dataset.exp);
      const cat = summary.find((c) => c.id === catId);
      if (!cat) return;
      const currentAmount = expenseMap[catId]?.amount || 0;
      openOverlay(
        'Edit weekly expense',
        `Record the amount spent on <strong>${cat.name}</strong> for Week ${weekNumber}, ${month}.`,
        `
          <div class="frow">
            <div class="fg"><label>Category</label><input type="text" disabled value="${cat.name}"></div>
            <div class="fg"><label>Period</label><input type="text" disabled value="Week ${weekNumber} — ${month}"></div>
          </div>
          <div class="frow">
            <div class="fg"><label>Amount (RWF)</label><input type="number" id="exp-amount" value="${currentAmount}" min="0" step="100" placeholder="0"></div>
            <div class="fg"><label>Note (optional)</label><input type="text" id="exp-reason" placeholder="Brief note"></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;background:var(--surf);border:1px solid var(--border);border-radius:var(--r-sm);padding:.75rem;margin-bottom:.75rem">
            <div><div style="font-size:11px;color:var(--t3);font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px">Month to date</div><div style="font-size:15px;font-weight:600;color:var(--t1)">RWF ${Number(cat.month_amount || 0).toLocaleString()}</div></div>
            <div><div style="font-size:11px;color:var(--t3);font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px">Monthly budget</div><div style="font-size:15px;font-weight:600;color:var(--t1)">RWF ${Number(cat.budget || 0).toLocaleString()}</div></div>
          </div>
          <div class="brow"><button type="button" class="bp1" id="ovSave"><i class="ti ti-device-floppy" style="font-size:13px;vertical-align:-1px"></i> Save</button><button type="button" class="bs1" id="ovCancel">Cancel</button></div>
        `,
        async () => {
          const amount = $('exp-amount').value.trim();
          if (!amount) return showOverlayError('Amount is required.');
          const r = await UFCL.weeklyExpensesSave(STORAGE.user.id, {
            categoryId: catId,
            amount: Number(amount),
            weekNumber,
            month,
            reason: $('exp-reason').value.trim() || null
          });
          if (!r.ok) return showOverlayError(r.error || 'Failed to save expense.');
          closeOverlay();
          await renderWeeklyCost();
        }
      );
    };
  });
}

async function renderWeeklyPerf() {
  const res = await UFCL.weeklyPerf(STORAGE.user.id);
  if (!res.ok) return renderDenied('weekly-perf', res.error);

  const { weekNumber, month, range, production = {}, dailyRows = [], categoryStatus = [] } = res;

  const ragBadge = (s) =>
    s === 'red'
      ? '<span style="color:var(--red)"><i class="ti ti-circle-filled"></i> OVER</span>'
      : s === 'amber'
      ? '<span style="color:var(--amber)"><i class="ti ti-circle-filled"></i> NEAR</span>'
      : '<span style="color:var(--green)"><i class="ti ti-circle-filled"></i> OK</span>';

  $('page-weekly-perf').innerHTML = `
    <div class="ptitle">Weekly Performance Report</div>
    <div class="psub">${month} — Week ${weekNumber} &nbsp;·&nbsp; ${range || ''}</div>
    <div class="cards">
      <div class="mc"><div class="mclbl">Timber produced</div><div class="mcval">${Number(production.timber || 0).toLocaleString()}</div><div class="mcsub cg"><i class="ti ti-package"></i>units</div></div>
      <div class="mc"><div class="mclbl">Poles produced</div><div class="mcval">${Number(production.poles || 0).toLocaleString()}</div><div class="mcsub cg"><i class="ti ti-package"></i>units</div></div>
      <div class="mc"><div class="mclbl">Downtime</div><div class="mcval">${Number(production.downtime_hours || 0).toFixed(1)}h</div><div class="mcsub ${Number(production.downtime_hours) > 4 ? 'cr' : 'ca'}"><i class="ti ti-clock"></i>this week</div></div>
      <div class="mc"><div class="mclbl">Cost / timber unit</div><div class="mcval">RWF ${Number(production.cost_per_timber || 0).toLocaleString()}</div><div class="mcsub bp"><i class="ti ti-cash"></i>per unit</div></div>
      <div class="mc"><div class="mclbl">Cost / pole unit</div><div class="mcval">RWF ${Number(production.cost_per_pole || 0).toLocaleString()}</div><div class="mcsub bp"><i class="ti ti-cash"></i>per unit</div></div>
      <div class="mc"><div class="mclbl">Budget flags</div><div class="mcval">${production.comment_count || 0}</div><div class="mcsub ${(production.comment_count || 0) > 0 ? 'cr' : 'cg'}"><i class="ti ti-alert-triangle"></i>categories</div></div>
    </div>
    <div class="card">
      <h3><i class="ti ti-clipboard-list"></i>Daily production breakdown</h3>
      <div class="tw">
        <table class="dt">
          <thead><tr><th>Date</th><th>Machine</th><th>Timber</th><th>T. waste</th><th>Poles</th><th>P. waste</th><th>Downtime</th><th>Supervisor</th></tr></thead>
          <tbody>
            ${dailyRows.length
              ? dailyRows.map((r) => `<tr>
                  <td style="font-family:var(--fm)">${r.date}</td>
                  <td>${r.machine || '—'}</td>
                  <td>${r.timber_units}</td>
                  <td style="color:var(--amber)">${r.timber_waste}</td>
                  <td>${r.poles_units}</td>
                  <td style="color:var(--amber)">${r.poles_waste}</td>
                  <td>${Number(r.downtime_hours || 0).toFixed(1)}h</td>
                  <td>${r.supervisor || '—'}</td>
                </tr>`).join('')
              : '<tr><td colspan="8" style="text-align:center;color:var(--t3);padding:1.5rem">No production entries this week</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
    <div class="card">
      <h3><i class="ti ti-chart-bar"></i>Cost category status</h3>
      <div class="tw">
        <table class="dt">
          <thead><tr><th>Category</th><th>Amount (RWF)</th><th>Budget (RWF)</th><th>Variance</th><th>Status</th><th>Entered by</th></tr></thead>
          <tbody>
            ${categoryStatus.length
              ? categoryStatus.map((c) => `<tr>
                  <td>${c.category}</td>
                  <td style="font-family:var(--fm)">${Number(c.amount || 0).toLocaleString()}</td>
                  <td style="font-family:var(--fm)">${Number(c.budget || 0).toLocaleString()}</td>
                  <td style="color:${c.variance > 5 ? 'var(--red)' : c.variance > 0 ? 'var(--amber)' : 'var(--green)'}">${Number(c.variance || 0).toFixed(1)}%</td>
                  <td>${ragBadge(c.status)}</td>
                  <td>${c.entered_by || '—'}</td>
                </tr>`).join('')
              : '<tr><td colspan="6" style="text-align:center;color:var(--t3);padding:1.5rem">No expenses recorded this week</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

async function renderKpi() {
  const now = new Date();
  const month = now.toISOString().slice(0, 7);
  const res = await UFCL.kpiBudgetsList(STORAGE.user.id, month);
  if (!res.ok) return renderDenied('kpi', res.error);

  const rows = res.rows || [];
  const isCeoAdmin = ['ceo', 'admin'].includes(STORAGE.user.role);
  const totalBudget = rows.reduce((s, r) => s + Number(r.budget_amount || 0), 0);

  $('page-kpi').innerHTML = `
    <div class="ptitle">KPI Scorecard</div>
    <div class="psub">Monthly budget targets for ${res.month}. ${isCeoAdmin ? 'Click <strong>Set budget</strong> on any row to update.' : 'Read-only — CEO / Admin can set budgets.'}</div>
    <div class="cards">
      <div class="mc"><div class="mclbl">Budget categories</div><div class="mcval">${rows.length}</div><div class="mcsub bp"><i class="ti ti-target"></i>categories</div></div>
      <div class="mc"><div class="mclbl">Total monthly budget</div><div class="mcval">RWF ${totalBudget.toLocaleString()}</div><div class="mcsub cg"><i class="ti ti-cash"></i>${res.month}</div></div>
    </div>
    <div class="card">
      <h3><i class="ti ti-target"></i>Budget targets — ${res.month}</h3>
      <div class="tw">
        <table class="dt">
          <thead><tr><th>Category</th><th>Budget (RWF)</th><th>Share</th>${isCeoAdmin ? '<th>Action</th>' : ''}</tr></thead>
          <tbody>
            ${rows.map((r) => {
              const share = totalBudget ? ((Number(r.budget_amount) / totalBudget) * 100).toFixed(1) : '0.0';
              return `<tr>
                <td>${r.name}</td>
                <td style="font-family:var(--fm)">${Number(r.budget_amount || 0).toLocaleString()}</td>
                <td>
                  <div style="display:flex;align-items:center;gap:8px">
                    <div style="background:var(--bg2);border-radius:4px;height:8px;width:80px;overflow:hidden">
                      <div style="background:var(--blue);height:100%;width:${share}%"></div>
                    </div>
                    ${share}%
                  </div>
                </td>
                ${isCeoAdmin ? `<td><button class="bs1" style="font-size:11px;padding:3px 9px" data-kpi="${r.id}" data-name="${r.name}" data-val="${r.budget_amount || 0}">Set budget</button></td>` : ''}
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  if (isCeoAdmin) {
    document.querySelectorAll('[data-kpi]').forEach((btn) => {
      btn.onclick = () => {
        const id = Number(btn.dataset.kpi);
        const name = btn.dataset.name;
        const val = Number(btn.dataset.val || 0);
        openOverlay(
          `Set budget — ${name}`,
          `Monthly budget for <strong>${name}</strong> in ${res.month}.`,
          `
          <div class="frow">
            <div class="fg"><label>Category</label><input type="text" disabled value="${name}"></div>
            <div class="fg"><label>Month</label><input type="text" disabled value="${res.month}"></div>
          </div>
          <div class="frow">
            <div class="fg"><label>Budget amount (RWF)</label><input type="number" id="kpi-amount" value="${val}" min="0" step="1000"></div>
          </div>
          <div class="brow"><button type="button" class="bp1" id="ovSave"><i class="ti ti-device-floppy"></i>Save</button><button type="button" class="bs1" id="ovCancel">Cancel</button></div>
          `,
          async () => {
            const amount = Number($('kpi-amount').value || 0);
            const r = await UFCL.kpiBudgetSave(STORAGE.user.id, { month: res.month, items: [{ id, budget_amount: amount }] });
            if (!r.ok) return alert(r.error || 'Save failed');
            closeOverlay();
            await renderKpi();
          }
        );
      };
    });
  }
}

async function renderExport() {
  $('page-export').innerHTML = `
    <div class="ptitle">Exports & Reports</div>
    <div class="psub">Download live data from Postgres as CSV for analysis or Sage import.</div>
    <div class="card">
      <h3><i class="ti ti-file-export"></i>Available exports</h3>
      <p style="color:var(--t3);margin-bottom:1rem;font-size:13px">All exports download as CSV files. Data reflects the current state of the database.</p>
      <div class="brow" style="flex-wrap:wrap;gap:.5rem">
        <button class="bp1" id="expProducts"><i class="ti ti-package"></i>Products</button>
        <button class="bp1" id="expSales"><i class="ti ti-shopping-cart"></i>Sales orders</button>
        <button class="bp1" id="expDaily"><i class="ti ti-clipboard-list"></i>Daily logs</button>
        <button class="bp1" id="expLogistics"><i class="ti ti-truck"></i>Logistics items</button>
        <button class="bp1" id="expAudit"><i class="ti ti-shield-check"></i>Audit trail</button>
      </div>
    </div>
  `;

  $('expProducts').onclick = async () => {
    const res = await UFCL.productsList(STORAGE.user.id, 'All');
    if (!res.ok) return alert(res.error || 'Failed');
    const csv = ['Type,Size,Active,Added by,Date,Reason,Ref'];
    for (const r of res.rows || [])
      csv.push(`${r.type},"${r.size}",${r.active},"${r.by || ''}","${r.date}","${(r.reason || '').replace(/"/g, '""')}","${r.ref || ''}"`);
    downloadCsv(csv.join('\n'), 'products.csv');
  };

  $('expSales').onclick = async () => {
    const res = await UFCL.salesList(STORAGE.user.id);
    if (!res.ok) return alert(res.error || 'Failed');
    const csv = ['Order number,Customer,Product type,Product size,Qty,Unit price (RWF),Created'];
    for (const r of res.rows || [])
      csv.push(`${r.order_number},"${r.customer_name}",${r.product_type},"${r.product_size}",${r.quantity},${Number(r.unit_price)},"${r.created_at}"`);
    downloadCsv(csv.join('\n'), 'sales-orders.csv');
  };

  $('expDaily').onclick = async () => {
    const res = await UFCL.dailyList(STORAGE.user.id);
    if (!res.ok) return alert(res.error || 'Failed');
    const csv = ['Date,Machine,Product size,Timber units,Timber waste,Poles units,Poles waste,Downtime hrs,Supervisor,Remarks'];
    for (const r of res.rows || [])
      csv.push(`"${r.date}","${r.machine || ''}","${r.product_size || ''}",${r.timber_units},${r.timber_waste},${r.poles_units},${r.poles_waste},${r.downtime_hours},"${r.supervisor || ''}","${(r.remarks || '').replace(/"/g, '""')}"`);
    downloadCsv(csv.join('\n'), 'daily-logs.csv');
  };

  $('expLogistics').onclick = async () => {
    const res = await UFCL.logisticsList(STORAGE.user.id);
    if (!res.ok) return alert(res.error || 'Failed');
    const csv = ['Category,Name,SKU,UoM,Unit cost (RWF),Stock,Min stock'];
    for (const r of res.rows || [])
      csv.push(`"${r.category}","${r.name}","${r.sku || ''}","${r.uom}",${Number(r.unit_cost)},${r.stock},${r.min_stock}`);
    downloadCsv(csv.join('\n'), 'logistics-items.csv');
  };

  $('expAudit').onclick = async () => {
    const res = await UFCL.auditList(STORAGE.user.id, 'All');
    if (!res.ok) return alert(res.error || 'Failed');
    const csv = ['Time,User,Role,Action'];
    for (const r of res.rows || [])
      csv.push(`"${r.time}","${r.user_name || ''}","${r.role}","${(r.action || '').replace(/"/g, '""')}"`);
    downloadCsv(csv.join('\n'), 'audit-trail.csv');
  };
}

async function renderLogistics() {
  const res = await UFCL.logisticsList(STORAGE.user.id);
  if (!res.ok) return renderDenied('logistics', res.error);
  const rows = res.rows || [];
  $('page-logistics').innerHTML = `
    <div class="ptitle">Logistics & spare parts</div>
    <div class="psub">Create logistics items (stored in Postgres).</div>
    <div class="appbar">
      <div><p>Add logistics item</p><span>Saved items are stored in Postgres.</span></div>
      <button class="appbtn" id="newLI"><i class="ti ti-plus" style="font-size:13px;vertical-align:-2px"></i> Add logistics item</button>
    </div>
    <div class="card">
      <h3><i class="ti ti-table"></i>Items</h3>
      <div class="tw">
        <table class="dt">
          <thead><tr><th>Category</th><th>Name</th><th>SKU</th><th>UoM</th><th>Unit cost</th><th>Stock</th><th>Min</th><th>Created</th></tr></thead>
          <tbody>
            ${rows
              .map(
                (r) => `<tr>
                  <td><span class="badge bt">${r.category}</span></td>
                  <td>${r.name}</td>
                  <td style="font-family:var(--fm);color:var(--t3)">${r.sku || '—'}</td>
                  <td>${r.uom}</td>
                  <td>${Number(r.unit_cost).toLocaleString()}</td>
                  <td>${r.stock}</td>
                  <td>${r.min_stock}</td>
                  <td style="color:var(--t3)">${new Date(r.created_at).toLocaleString()}</td>
                </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
  $('newLI').onclick = () =>
    openOverlay(
      'Add logistics item',
      'Reason/description is mandatory for audit.',
      `
      <div class="frow">
        <div class="fg"><label>Item category *</label><select id="li-cat"><option>Spare Part</option><option>Consumable</option><option>Lubricant</option><option>Tool</option><option>Safety Gear</option><option>Other</option></select></div>
        <div class="fg"><label>Item name *</label><input type="text" id="li-name" placeholder="e.g. Hydraulic oil 46" maxlength="100"></div>
      </div>
      <div class="frow">
        <div class="fg"><label>SKU (optional)</label><input type="text" id="li-sku" placeholder="e.g. HYD-46-20L"></div>
        <div class="fg"><label>Unit of measure *</label><select id="li-uom"><option>EA</option><option>L</option><option>KG</option><option>M</option><option>BX</option><option>SET</option></select></div>
      </div>
      <div class="frow">
        <div class="fg"><label>Unit cost (RWF) *</label><input type="number" id="li-cost" placeholder="0" min="0"></div>
        <div class="fg"><label>Current stock *</label><input type="number" id="li-stock" placeholder="0" min="0"></div>
      </div>
      <div class="frow">
        <div class="fg"><label>Min stock alert level *</label><input type="number" id="li-min" placeholder="0" min="0"></div>
        <div class="fg"><label>Reason / description *</label><input type="text" id="li-reason" placeholder="Mandatory audit reason"></div>
      </div>
      <div class="brow"><button class="bp1" id="ovSave"><i class="ti ti-device-floppy"></i>Save item</button><button class="bs1" id="ovCancel"><i class="ti ti-x"></i>Cancel</button></div>
      `,
      async () => {
        const payload = {
          category: $('li-cat').value,
          name: $('li-name').value,
          sku: $('li-sku').value,
          uom: $('li-uom').value,
          unit_cost: $('li-cost').value,
          stock: $('li-stock').value,
          min_stock: $('li-min').value,
          reason: $('li-reason').value
        };
        const r = await UFCL.logisticsCreate(STORAGE.user.id, payload);
        if (!r.ok) return alert(r.error || 'Save failed');
        closeOverlay();
        await renderLogistics();
      }
    );
}

async function renderNotifications() {
  const res = await UFCL.notificationsList(STORAGE.user.id);
  if (!res.ok) return renderDenied('notifications', res.error);
  STORAGE.unread = res.unread || 0;
  updateBadge();
  const rows = res.rows || [];
  $('page-notifications').innerHTML = `
    <div class="ptitle">Notifications</div>
    <div class="psub">System alerts and approvals.</div>
    <div class="npanel">
      <div class="nhead"><span>All notifications</span><button id="markAll">Mark all as read</button></div>
      ${rows
        .map((n) => {
          const dot = n.type === 'red' ? 'nd-red' : n.type === 'amber' ? 'nd-amber' : n.type === 'blue' ? 'nd-blue' : 'nd-green';
          return `<div class="nitem ${n.read ? '' : 'unread'}" id="nn-${n.id}">
            <div class="ndot ${dot}"></div>
            <div style="flex:1">
              <div class="ntxt"><strong>${n.title}</strong><div style="color:var(--t3);margin-top:2px">${n.body}</div></div>
              <div class="ntime">${n.time}</div>
            </div>
            ${n.read ? '' : `<button class="bs1" style="padding:3px 9px;font-size:11px" data-mr="${n.id}">Mark read</button>`}
          </div>`;
        })
        .join('')}
    </div>
  `;
  $('markAll').onclick = async () => {
    const r = await UFCL.notificationsMarkAllRead(STORAGE.user.id);
    if (r.ok) {
      STORAGE.unread = r.unread || 0;
      updateBadge();
      await renderNotifications();
    }
  };
  document.querySelectorAll('[data-mr]').forEach((b) => {
    b.onclick = async () => {
      const id = Number(b.dataset.mr);
      const r = await UFCL.notificationsMarkRead(STORAGE.user.id, id);
      if (r.ok) {
        STORAGE.unread = r.unread || 0;
        updateBadge();
        await renderNotifications();
      }
    };
  });
}

async function renderAudit() {
  const res = await UFCL.auditList(STORAGE.user.id, 'All');
  if (!res.ok) return renderDenied('audit', res.error);
  const rows = res.rows || [];
  $('page-audit').innerHTML = `
    <div class="ptitle">Audit trail</div>
    <div class="psub">Every important action is recorded.</div>
    <div class="card">
      <h3><i class="ti ti-shield-check"></i>Recent activity</h3>
      <div class="tw">
        <table class="dt">
          <thead><tr><th>Time</th><th>User</th><th>Role</th><th>Action</th></tr></thead>
          <tbody>
            ${rows
              .map(
                (r) => `<tr>
                <td style="font-family:var(--fm);color:var(--t3)">${r.time}</td>
                <td>${r.user_name || '—'}</td>
                <td><span class="badge bp">${r.role}</span></td>
                <td>${r.action}</td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

async function renderChanges() {
  const res = await UFCL.changesList(STORAGE.user.id);
  if (!res.ok) return renderDenied('changes', res.error);
  const rows = res.rows || [];
  $('page-changes').innerHTML = `
    <div class="ptitle">Change requests</div>
    <div class="psub">Submit and review change requests.</div>
    <div class="card">
      <h3><i class="ti ti-send"></i>Submit request</h3>
      <div class="frow">
        <div class="fg"><label>Record type</label><select id="cr-type"><option>Production Log</option><option>Sales Order</option><option>Inventory</option><option>Logistics</option></select></div>
        <div class="fg"><label>Record reference</label><input type="text" id="cr-ref" placeholder="e.g. Log 28 Nov 2024"></div>
      </div>
      <div class="frow full"><div class="fg"><label>Request details</label><textarea id="cr-text" placeholder="Describe what should be changed and why..."></textarea></div></div>
      <div class="brow"><button class="bp1" id="cr-submit"><i class="ti ti-send"></i>Submit request</button></div>
    </div>
    <div class="card">
      <h3><i class="ti ti-table"></i>Requests</h3>
      <div class="tw">
        <table class="dt">
          <thead><tr><th>ID</th><th>Type</th><th>Ref</th><th>By</th><th>Date</th><th>Status</th>${res.isMgr ? '<th>Manager</th>' : ''}</tr></thead>
          <tbody>
            ${rows
              .map((c) => {
                const badge = c.status === 'Approved' ? 'bg' : c.status === 'Rejected' ? 'br' : 'ba';
                return `<tr>
                  <td style="font-family:var(--fm)">${c.id}</td>
                  <td>${c.record_type}</td>
                  <td style="color:var(--t3)">${c.record_ref}</td>
                  <td>${c.by || '—'}</td>
                  <td style="font-family:var(--fm);color:var(--t3)">${c.created}</td>
                  <td><span class="badge ${badge}">${c.status}</span></td>
                  ${
                    res.isMgr
                      ? `<td>${
                          c.status === 'Pending'
                            ? `<button class="bp1" style="padding:3px 9px;font-size:11px;margin-right:4px" data-ap="${c.id}"><i class="ti ti-check" style="font-size:11px"></i>Approve</button>
                               <button class="bdanger" style="padding:3px 8px" data-rj="${c.id}"><i class="ti ti-x" style="font-size:11px"></i>Reject</button>`
                            : `<span style="font-size:11px;color:var(--t3)">${(c.response || '—').slice(0, 40)}${(c.response || '').length > 40 ? '…' : ''}</span>`
                        }</td>`
                      : ''
                  }
                </tr>`;
              })
              .join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
  $('cr-submit').onclick = async () => {
    const payload = { record_type: $('cr-type').value, record_ref: $('cr-ref').value, request_text: $('cr-text').value };
    const r = await UFCL.changesCreate(STORAGE.user.id, payload);
    if (!r.ok) return alert(r.error || 'Submit failed');
    await renderChanges();
  };
  document.querySelectorAll('[data-ap]').forEach((b) => {
    b.onclick = async () => {
      const id = Number(b.dataset.ap);
      const resp = prompt('Approval note (optional):') || '';
      const r = await UFCL.changesReview(STORAGE.user.id, id, 'Approved', resp);
      if (!r.ok) return alert(r.error || 'Failed');
      await renderChanges();
    };
  });
  document.querySelectorAll('[data-rj]').forEach((b) => {
    b.onclick = async () => {
      const id = Number(b.dataset.rj);
      const resp = prompt('Rejection reason:') || '';
      const r = await UFCL.changesReview(STORAGE.user.id, id, 'Rejected', resp);
      if (!r.ok) return alert(r.error || 'Failed');
      await renderChanges();
    };
  });
}

async function renderMonthly() {
  const month = new Date().toISOString().slice(0, 7);
  const res = await UFCL.monthlyDashboard(STORAGE.user.id, month);
  if (!res.ok) return renderDenied('monthly', res.error);

  const { production = {}, sales = {}, expenses = [], totalExpenses = 0, approval = {} } = res;
  const timberWastePct = Number(production.timber_units) > 0
    ? ((Number(production.timber_waste) / Number(production.timber_units)) * 100).toFixed(1)
    : '0.0';
  const polesWastePct = Number(production.poles_units) > 0
    ? ((Number(production.poles_waste) / Number(production.poles_units)) * 100).toFixed(1)
    : '0.0';

  $('page-monthly').innerHTML = `
    <div class="ptitle">Monthly Dashboard</div>
    <div class="psub">Production, sales and financial summary for ${res.month}.</div>
    ${
      STORAGE.user.role === 'ceo'
        ? approval.approved
          ? `<div class="appbar"><p><i class="ti ti-circle-check" style="font-size:14px;vertical-align:-2px;margin-right:4px"></i>Report approved by CEO</p><span>Signed off</span></div>`
          : `<div class="appbar"><p>Monthly report for ${res.month} — pending your approval</p><span>Awaiting CEO sign-off</span><button class="appbtn" id="apprBtn">Approve &amp; sign off</button></div>`
        : `<div class="appbar" style="background:var(--surf);border-color:var(--border)"><p style="color:var(--t3)">Approval status</p><span style="color:var(--t4)">${approval.approved ? 'Approved by CEO' : 'Pending CEO approval'}</span></div>`
    }
    <div class="cards">
      <div class="mc"><div class="mclbl">Timber produced</div><div class="mcval">${Number(production.timber_units || 0).toLocaleString()}</div><div class="mcsub cg"><i class="ti ti-package"></i>units</div></div>
      <div class="mc"><div class="mclbl">Poles produced</div><div class="mcval">${Number(production.poles_units || 0).toLocaleString()}</div><div class="mcsub cg"><i class="ti ti-package"></i>units</div></div>
      <div class="mc"><div class="mclbl">Timber waste rate</div><div class="mcval">${timberWastePct}%</div><div class="mcsub ${Number(timberWastePct) > 10 ? 'cr' : 'ca'}"><i class="ti ti-alert-triangle"></i>waste</div></div>
      <div class="mc"><div class="mclbl">Poles waste rate</div><div class="mcval">${polesWastePct}%</div><div class="mcsub ${Number(polesWastePct) > 10 ? 'cr' : 'ca'}"><i class="ti ti-alert-triangle"></i>waste</div></div>
      <div class="mc"><div class="mclbl">Downtime</div><div class="mcval">${Number(production.downtime_hours || 0).toFixed(1)}h</div><div class="mcsub ca"><i class="ti ti-clock"></i>total</div></div>
      <div class="mc"><div class="mclbl">Log days</div><div class="mcval">${Number(production.log_days || 0)}</div><div class="mcsub bp"><i class="ti ti-calendar"></i>days</div></div>
    </div>
    <div class="cards" style="margin-top:12px">
      <div class="mc"><div class="mclbl">Sales orders</div><div class="mcval">${Number(sales.order_count || 0)}</div><div class="mcsub bp"><i class="ti ti-shopping-cart"></i>orders</div></div>
      <div class="mc"><div class="mclbl">Units sold</div><div class="mcval">${Number(sales.total_qty || 0).toLocaleString()}</div><div class="mcsub cg"><i class="ti ti-package"></i>units</div></div>
      <div class="mc"><div class="mclbl">Revenue</div><div class="mcval">RWF ${Number(sales.total_revenue || 0).toLocaleString()}</div><div class="mcsub cg"><i class="ti ti-coin"></i>month</div></div>
      <div class="mc"><div class="mclbl">Total expenses</div><div class="mcval">RWF ${Number(totalExpenses).toLocaleString()}</div><div class="mcsub cr"><i class="ti ti-cash"></i>month</div></div>
    </div>
    <div class="card">
      <h3><i class="ti ti-cash"></i>Monthly expenses by category</h3>
      <div class="tw">
        <table class="dt">
          <thead><tr><th>Category</th><th>Total (RWF)</th><th>Share</th></tr></thead>
          <tbody>
            ${expenses.length
              ? expenses.map((e) => {
                  const share = totalExpenses ? ((e.total / totalExpenses) * 100).toFixed(1) : '0.0';
                  return `<tr>
                    <td>${e.category}</td>
                    <td style="font-family:var(--fm)">${Number(e.total).toLocaleString()}</td>
                    <td>
                      <div style="display:flex;align-items:center;gap:8px">
                        <div style="background:var(--bg2);border-radius:4px;height:8px;width:80px;overflow:hidden">
                          <div style="background:var(--blue);height:100%;width:${share}%"></div>
                        </div>
                        ${share}%
                      </div>
                    </td>
                  </tr>`;
                }).join('') + `<tr style="font-weight:600;border-top:2px solid var(--bdr)"><td>Total</td><td style="font-family:var(--fm)">RWF ${Number(totalExpenses).toLocaleString()}</td><td>100%</td></tr>`
              : '<tr><td colspan="3" style="text-align:center;color:var(--t3);padding:1.5rem">No expense data for this month</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;

  const b = $('apprBtn');
  if (b) {
    b.onclick = async () => {
      const r = await UFCL.monthlyApprove(STORAGE.user.id, res.month);
      if (!r.ok) return alert(r.error || 'Approve failed');
      STORAGE.approved.monthly = true;
      await renderMonthly();
    };
  }
}

async function renderUsers() {
    const [userRes, roleRes] = await Promise.all([UFCL.usersList(STORAGE.user.id), UFCL.rolesList(STORAGE.user.id)]);
    if (!userRes.ok) return renderDenied('users', userRes.error);
    const rows = userRes.rows || [];
    const roles = (roleRes.ok && roleRes.rows) || [];

    const activeCount = rows.filter((u) => u.active).length;
    const customCount = rows.filter((u) => (u.user_permissions || []).length || (u.user_responsibilities || []).length).length;

    $('page-users').innerHTML = `
      <div class="ptitle">Users & Roles</div>
      <div class="psub">Manage accounts, assign roles, and control individual access.</div>

      <div class="cards">
        <div class="mc"><div class="mclbl">Total accounts</div><div class="mcval">${rows.length}</div><div class="mcsub cg"><i class="ti ti-users"></i>accounts</div></div>
        <div class="mc"><div class="mclbl">Active</div><div class="mcval">${activeCount}</div><div class="mcsub cg"><i class="ti ti-circle-check"></i>users</div></div>
        <div class="mc"><div class="mclbl">Inactive</div><div class="mcval">${rows.length - activeCount}</div><div class="mcsub ${rows.length - activeCount > 0 ? 'cr' : 'cg'}"><i class="ti ti-circle-x"></i>users</div></div>
        <div class="mc"><div class="mclbl">Custom overrides</div><div class="mcval">${customCount}</div><div class="mcsub bp"><i class="ti ti-shield-check"></i>users</div></div>
      </div>

      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem">
          <h3 style="margin-bottom:0"><i class="ti ti-users"></i>Accounts</h3>
          <button class="appbtn" id="newUser"><i class="ti ti-plus" style="font-size:12px;vertical-align:-1px"></i> New user</button>
        </div>
        <div class="tw">
          <table class="dt">
            <thead><tr><th>Username</th><th>Name</th><th>Role</th><th>Department</th><th>Override</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              ${rows.map((u) => `<tr>
                <td style="font-family:var(--fm);font-weight:500">${u.username}</td>
                <td>${u.name}</td>
                <td><span class="badge bt">${roleLabel(u.role)}</span></td>
                <td>${u.department || '<span style="color:var(--t3)">—</span>'}</td>
                <td>${((u.user_permissions || []).length || (u.user_responsibilities || []).length) ? '<span class="badge bb">Custom</span>' : '<span style="color:var(--t3)">—</span>'}</td>
                <td><span class="badge ${u.active ? 'bg' : 'br'}">${u.active ? 'Active' : 'Inactive'}</span></td>
                <td style="color:var(--t3)">${u.created}</td>
                <td style="white-space:nowrap">
                  <button type="button" class="bs1" data-resp="${u.id}"><i class="ti ti-shield-lock" style="font-size:12px;vertical-align:-1px"></i> Permissions</button>
                  <button type="button" class="bs1" data-edit="${u.id}"><i class="ti ti-pencil" style="font-size:12px;vertical-align:-1px"></i> Edit</button>
                  <button type="button" class="bs1" data-reset="${u.id}"><i class="ti ti-key" style="font-size:12px;vertical-align:-1px"></i> Reset PW</button>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <h3><i class="ti ti-shield-check"></i>Role definitions</h3>
        <p style="color:var(--t3);margin-bottom:1rem">Default page access and responsibilities per role. Override per individual via the Permissions button.</p>
        <div class="tw">
          <table class="dt">
            <thead><tr><th>Role</th><th>Description</th><th>Pages</th><th>Default responsibilities</th><th></th></tr></thead>
            <tbody>
              ${roles.map((r) => `<tr>
                <td><span class="badge bt" style="font-family:var(--fm)">${roleLabel(r.role)}</span></td>
                <td style="color:var(--t2)">${r.description || '<span style="color:var(--t3)">—</span>'}</td>
                <td>${(r.permissions || []).length ? `<span class="badge bb">${(r.permissions || []).length} pages</span>` : '<span style="color:var(--t3)">—</span>'}</td>
                <td>${(r.responsibilities || []).length
                  ? `<ul style="margin:0;padding-left:1.1rem;color:var(--t2);font-size:12px">${(r.responsibilities || []).map((item) => `<li style="margin-bottom:2px">${item}</li>`).join('')}</ul>`
                  : '<span style="color:var(--t3)">—</span>'}</td>
                <td><button type="button" class="bs1" data-role="${r.role}">Edit</button></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    const roleOptions = ['admin', 'ceo', 'operations', 'sales', 'finance', 'logistics', 'supervisor', 'storekeeper']
      .map(roleOptionHtml)
      .join('');

    const departmentOptions = ['','Sales','Operations','Swan Timber','Finance','Logistics','Supervision','Administration','Store']
      .map((dept) => `<option value="${dept}">${dept || 'None'}</option>`)
      .join('');

    const nu = $('newUser');
    if (nu)
      nu.onclick = () =>
        openOverlay(
          'Create user',
          'Enter username, name, role and temporary password.',
          `
        <div class="frow">
          <div class="fg"><label>Username</label><input type="text" id="u-username" placeholder="username"></div>
          <div class="fg"><label>Name</label><input type="text" id="u-name" placeholder="Full name"></div>
        </div>
        <div class="frow">
          <div class="fg"><label>Role</label><select id="u-role">${roleOptions}</select></div>
          <div class="fg"><label>Department</label><select id="u-department">${departmentOptions}</select></div>
        </div>
        <div class="frow">
          <div class="fg"><label>Password</label><input type="password" id="u-pass" placeholder="temporary password"></div>
        </div>
        <div class="brow"><button type="button" class="bp1" id="ovSave">Create</button><button type="button" class="bs1" id="ovCancel">Cancel</button></div>
        `,
          async () => {
            const payload = {
              username: $('u-username').value,
              name: $('u-name').value,
              role: $('u-role').value,
              department: $('u-department').value || null,
              password: $('u-pass').value
            };
            const r = await UFCL.usersCreate(STORAGE.user.id, payload);
            if (!r.ok) return showOverlayError(r.error || 'Failed to create user.');
            closeOverlay();
            await renderUsers();
          }
        );

    $('page-users').querySelectorAll('[data-edit]').forEach((b) => {
      b.onclick = async () => {
        const id = Number(b.dataset.edit);
        const u = rows.find((x) => Number(x.id) === id);
        if (!u) return;
        openOverlay(
          'Edit user',
          `Edit ${u.username}`,
          `
          <div class="frow">
            <div class="fg"><label>Name</label><input type="text" id="eu-name" value="${u.name}"></div>
            <div class="fg"><label>Role</label><select id="eu-role">${roleOptions}</select></div>
            <div class="fg"><label>Department</label><select id="eu-department">${departmentOptions}</select></div>
          </div>
          <div class="frow"><div class="fg"><label>Status</label><select id="eu-active"><option value="true">Active</option><option value="false">Inactive</option></select></div></div>
          <div class="brow"><button type="button" class="bp1" id="ovSave">Save</button><button type="button" class="bs1" id="ovCancel">Cancel</button></div>
          `,
          async () => {
            const payload = {
              name: $('eu-name').value,
              role: $('eu-role').value,
              department: $('eu-department').value || null,
              active: $('eu-active').value === 'true'
            };
            const r = await UFCL.usersUpdate(STORAGE.user.id, id, payload);
            if (!r.ok) return showOverlayError(r.error || 'Failed to update user.');
            closeOverlay();
            await renderUsers();
          }
        );
        setTimeout(() => {
          const sel = $('eu-role');
          if (sel) sel.value = u.role;
          const dep = $('eu-department');
          if (dep) dep.value = u.department || '';
          const sa = $('eu-active');
          if (sa) sa.value = u.active ? 'true' : 'false';
        }, 10);
      };
    });

    $('page-users').querySelectorAll('[data-reset]').forEach((b) => {
      b.onclick = async () => {
        const id = Number(b.dataset.reset);
        openOverlay(
          'Reset password',
          'Set a temporary password for this user.',
          `
            <div class="frow"><div class="fg"><label>New password</label><input type="password" id="rp-pass" placeholder="temporary password"></div></div>
            <div class="brow"><button type="button" class="bp1" id="ovSave">Reset</button><button type="button" class="bs1" id="ovCancel">Cancel</button></div>
          `,
          async () => {
            const pw = $('rp-pass').value;
            const r = await UFCL.usersResetPassword(STORAGE.user.id, id, pw || undefined);
            if (!r.ok) return showOverlayError(r.error || 'Failed to reset password.');
            showOverlaySuccess('Password reset successfully.');
          }
        );
      };
    });

    $('page-users').querySelectorAll('[data-resp]').forEach((b) => {
      b.onclick = async () => {
        const id = Number(b.dataset.resp);
        const u = rows.find((x) => Number(x.id) === id);
        if (!u) return;
        const roleEntry = roles.find((x) => x.role === u.role);
        const roleResps = (roleEntry && roleEntry.responsibilities) || [];
        const roleRespHtml = roleResps.length
          ? `<div style="padding:.625rem .75rem;background:var(--surf);border:1px solid var(--border);border-radius:var(--r-sm)">${roleResps.map((item) => `<div style="display:flex;align-items:flex-start;gap:6px;padding:3px 0;font-size:12px;color:var(--t2)"><i class="ti ti-point-filled" style="font-size:8px;margin-top:4px;color:var(--t3);flex-shrink:0"></i>${item}</div>`).join('')}</div>`
          : `<span style="color:var(--t3);font-size:12px">No default responsibilities defined for this role.</span>`;
        const actingRoleOptions = roles
          .filter((x) => x.role !== u.role)
          .map((x) => `<option value="${x.role}">${roleLabel(x.role)}</option>`)
          .join('');
        openOverlay(
          'User permissions',
          `Manage page access and custom responsibilities for <strong>${u.username}</strong>. Custom settings override role defaults.`,
          `
            <div class="frow">
              <div class="fg"><label>User</label><input type="text" disabled value="${u.username}"></div>
              <div class="fg"><label>Assigned role</label><input type="text" disabled value="${roleLabel(u.role)}"></div>
            </div>
            <div class="frow full"><div class="fg"><label>Page permissions</label><div id="ur-permissions" style="max-height:260px;overflow:auto;padding:.75rem;border:1px solid var(--border);border-radius:var(--r-sm)">${renderPermissionCheckboxes(u.user_permissions || [])}</div></div></div>
            <div style="background:var(--g-light);border:1px solid rgba(30,95,54,.18);border-radius:var(--r-sm);padding:.625rem .875rem;margin-bottom:.75rem">
              <div style="font-size:11px;font-weight:600;color:var(--g-dark);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.45rem"><i class="ti ti-replace" style="vertical-align:-2px;margin-right:4px"></i>Acting role import</div>
              <div style="font-size:12px;color:var(--g-soft);margin-bottom:.625rem">Copy responsibilities and permissions from another role into this user's custom settings — without changing their assigned role.</div>
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <select id="ur-acting-role" style="flex:1;min-width:160px;padding:7px 10px;font-size:13px;font-family:var(--ff);border:1px solid var(--border2);border-radius:var(--r-sm);background:var(--surf);color:var(--t1)"><option value="">— Select a role to copy from —</option>${actingRoleOptions}</select>
                <button type="button" class="bs1" id="ur-import-resp"><i class="ti ti-file-import" style="font-size:12px;vertical-align:-1px"></i> Import responsibilities</button>
                <button type="button" class="bs1" id="ur-import-perms"><i class="ti ti-shield-plus" style="font-size:12px;vertical-align:-1px"></i> Import permissions</button>
              </div>
            </div>
            <div class="frow full"><div class="fg"><label>Role default responsibilities <span style="font-weight:400;color:var(--t3);text-transform:none;letter-spacing:0">— ${roleLabel(u.role)} defaults</span></label>${roleRespHtml}</div></div>
            <div class="frow full"><div class="fg"><label>Custom responsibilities <span style="font-weight:400;color:var(--t3);text-transform:none;letter-spacing:0">— specific to this user</span></label><textarea id="ur-resp" rows="5" placeholder="One responsibility per line…">${(u.user_responsibilities || []).join('\n')}</textarea></div></div>
            <div class="brow"><button type="button" class="bp1" id="ovSave">Save</button><button type="button" class="bs1" id="ovCancel">Cancel</button></div>
          `,
          async () => {
            const selectedPermissions = Array.from(document.querySelectorAll('#ur-permissions input.perm-checkbox:checked')).map((input) => input.value);
            const payload = {
              permissions: selectedPermissions,
              responsibilities: $('ur-resp').value
                .split(/\r?\n/)
                .map((item) => item.trim())
                .filter(Boolean)
            };
            const r = await UFCL.usersUpdate(STORAGE.user.id, id, payload);
            if (!r.ok) return showOverlayError(r.error || 'Failed to save permissions.');
            closeOverlay();
            await renderUsers();
          }
        );

        const getActingRole = () => {
          const sel = $('ur-acting-role');
          if (!sel || !sel.value) return null;
          return roles.find((x) => x.role === sel.value) || null;
        };

        const importRespBtn = $('ur-import-resp');
        if (importRespBtn) importRespBtn.onclick = () => {
          const entry = getActingRole();
          if (!entry) return;
          const incoming = (entry.responsibilities || []).join('\n');
          const current = $('ur-resp').value.trim();
          $('ur-resp').value = current ? `${current}\n${incoming}` : incoming;
        };

        const importPermsBtn = $('ur-import-perms');
        if (importPermsBtn) importPermsBtn.onclick = () => {
          const entry = getActingRole();
          if (!entry) return;
          (entry.permissions || []).forEach((pageId) => {
            const cb = document.querySelector(`#ur-permissions input.perm-checkbox[value="${pageId}"]`);
            if (cb) cb.checked = true;
          });
        };
      };
    });

    $('page-users').querySelectorAll('[data-role]').forEach((b) => {
      b.onclick = async () => {
        const role = b.dataset.role;
        const entry = roles.find((x) => x.role === role);
        if (!entry) return;
        openOverlay(
          `Edit ${roleLabel(entry.role)} role`,
          'Update description, permissions, and responsibilities for this role.',
          `
          <div class="frow full"><div class="fg"><label>Description</label><input type="text" id="rr-desc" value="${entry.description || ''}"></div></div>
          <div class="frow full"><div class="fg"><label>Permissions</label><div id="rr-permissions" style="max-height:260px;overflow:auto;padding:.75rem;border:1px solid var(--border);border-radius:var(--r-sm)">${renderPermissionCheckboxes(entry.permissions || [])}</div></div></div>
          <div class="frow full"><div class="fg"><label>Responsibilities</label><textarea id="rr-resp" rows="5" placeholder="One responsibility per line…">${(entry.responsibilities || []).join('\n')}</textarea></div></div>
          <div class="brow"><button type="button" class="bp1" id="ovSave">Save</button><button type="button" class="bs1" id="ovCancel">Cancel</button></div>
`,
          async () => {
            const selectedPermissions = Array.from(document.querySelectorAll('#rr-permissions input.perm-checkbox:checked')).map((input) => input.value);
            const payload = {
              description: $('rr-desc').value,
              permissions: selectedPermissions,
              responsibilities: $('rr-resp').value
                .split(/\r?\n/)
                .map((item) => item.trim())
                .filter(Boolean)
            };
            const r = await UFCL.rolesUpdate(STORAGE.user.id, role, payload);
            if (!r.ok) return showOverlayError(r.error || 'Failed to save role.');
            closeOverlay();
            await renderUsers();
          }
        );
      };
    });
  }

async function renderInventory() {
  const res = await UFCL.inventoryList(STORAGE.user.id);
  if (!res.ok) return renderDenied('inventory', res.error);

  const rows = res.rows || [];
  const lowRows = rows.filter((r) => Number(r.stock) <= Number(r.min_stock));
  const okRows = rows.filter((r) => Number(r.stock) > Number(r.min_stock));
  const totalValue = rows.reduce((s, r) => s + Number(r.stock) * Number(r.unit_cost), 0);

  $('page-inventory').innerHTML = `
    <div class="ptitle">Inventory</div>
    <div class="psub">Current stock levels for all logistics items. Items at or below minimum stock are flagged.</div>
    <div class="cards">
      <div class="mc"><div class="mclbl">Total items</div><div class="mcval">${rows.length}</div><div class="mcsub cg"><i class="ti ti-stack"></i>items</div></div>
      <div class="mc"><div class="mclbl">Low / out of stock</div><div class="mcval" style="${lowRows.length > 0 ? 'color:var(--red)' : ''}">${lowRows.length}</div><div class="mcsub ${lowRows.length > 0 ? 'cr' : 'cg'}"><i class="ti ti-alert-triangle"></i>items</div></div>
      <div class="mc"><div class="mclbl">Stock OK</div><div class="mcval">${okRows.length}</div><div class="mcsub cg"><i class="ti ti-circle-check"></i>items</div></div>
      <div class="mc"><div class="mclbl">Total stock value</div><div class="mcval">RWF ${totalValue.toLocaleString()}</div><div class="mcsub bp"><i class="ti ti-coin"></i>at cost</div></div>
    </div>
    ${lowRows.length ? `
    <div class="card" style="border-left:4px solid var(--red)">
      <h3 style="color:var(--red)"><i class="ti ti-alert-triangle"></i>Low / out of stock (${lowRows.length})</h3>
      <div class="tw">
        <table class="dt">
          <thead><tr><th>Category</th><th>Name</th><th>SKU</th><th>Stock</th><th>Min stock</th><th>UoM</th></tr></thead>
          <tbody>
            ${lowRows.map((r) => `<tr>
              <td><span class="badge bt">${r.category}</span></td>
              <td style="font-weight:500">${r.name}</td>
              <td style="font-family:var(--fm);color:var(--t3)">${r.sku || '—'}</td>
              <td style="color:var(--red);font-weight:600">${r.stock}</td>
              <td>${r.min_stock}</td>
              <td>${r.uom}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>` : ''}
    <div class="card">
      <h3><i class="ti ti-stack"></i>All stock</h3>
      <div class="tw">
        <table class="dt">
          <thead><tr><th>Category</th><th>Name</th><th>SKU</th><th>Stock</th><th>Min</th><th>UoM</th><th>Unit cost (RWF)</th><th>Stock value (RWF)</th><th>Status</th></tr></thead>
          <tbody>
            ${rows.length
              ? rows.map((r) => {
                  const low = Number(r.stock) <= Number(r.min_stock);
                  const stockVal = Number(r.stock) * Number(r.unit_cost);
                  return `<tr>
                    <td><span class="badge bt">${r.category}</span></td>
                    <td>${r.name}</td>
                    <td style="font-family:var(--fm);color:var(--t3)">${r.sku || '—'}</td>
                    <td style="${low ? 'color:var(--red);font-weight:600' : ''}">${r.stock}</td>
                    <td>${r.min_stock}</td>
                    <td>${r.uom}</td>
                    <td style="font-family:var(--fm)">${Number(r.unit_cost).toLocaleString()}</td>
                    <td style="font-family:var(--fm)">${stockVal.toLocaleString()}</td>
                    <td><span class="badge ${low ? 'br' : 'bg'}">${low ? 'Low stock' : 'OK'}</span></td>
                  </tr>`;
                }).join('')
              : '<tr><td colspan="9" style="text-align:center;color:var(--t3);padding:1.5rem">No inventory items. Add items via Logistics &amp; spare parts.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

async function renderSage() {
  const month = new Date().toISOString().slice(0, 7);

  $('page-sage').innerHTML = `
    <div class="ptitle">Sage Reconciliation</div>
    <div class="psub">Review and export monthly expense data for Sage accounting reconciliation.</div>
    <div class="card">
      <h3><i class="ti ti-refresh"></i>Select month</h3>
      <div class="frow">
        <div class="fg"><label>Month</label><input type="month" id="sage-month" value="${month}"></div>
      </div>
      <div class="brow" style="margin-top:.75rem">
        <button class="bp1" id="sageLoad"><i class="ti ti-refresh"></i>Load data</button>
        <button class="bs1" id="sageExport" disabled><i class="ti ti-file-export"></i>Export to Sage CSV</button>
      </div>
    </div>
    <div id="sage-panel"></div>
  `;

  let lastSummary = [];
  let lastTotals = {};
  let lastMonth = month;

  async function loadSage() {
    const m = $('sage-month').value || month;
    lastMonth = m;
    const res = await UFCL.weeklyCost(STORAGE.user.id);
    if (!res.ok) return alert(res.error || 'Failed to load data');

    const { summary = [], totals = {}, weekNumber } = res;
    lastSummary = summary;
    lastTotals = totals;

    $('sage-panel').innerHTML = `
      <div class="card">
        <h3><i class="ti ti-table"></i>Expense summary — ${m} (current week: ${weekNumber})</h3>
        <div class="tw">
          <table class="dt">
            <thead><tr><th>Category</th><th>This week (RWF)</th><th>Month to date (RWF)</th><th>Budget (RWF)</th><th>Variance</th><th>Reconciliation</th></tr></thead>
            <tbody>
              ${summary.map((cat) => `<tr>
                <td>${cat.name}</td>
                <td style="font-family:var(--fm)">${Number(cat.week_amount || 0).toLocaleString()}</td>
                <td style="font-family:var(--fm)">${Number(cat.month_amount || 0).toLocaleString()}</td>
                <td style="font-family:var(--fm)">${Number(cat.budget || 0).toLocaleString()}</td>
                <td style="color:${cat.variance > 5 ? 'var(--red)' : cat.variance > 0 ? 'var(--amber)' : 'var(--green)'}">${Number(cat.variance || 0).toFixed(1)}%</td>
                <td><span class="badge ${cat.status === 'red' ? 'br' : cat.status === 'amber' ? 'ba' : 'bg'}">${cat.status === 'red' ? 'Review needed' : cat.status === 'amber' ? 'Monitor' : 'Clear'}</span></td>
              </tr>`).join('')}
              <tr style="font-weight:600;border-top:2px solid var(--bdr)">
                <td>Total</td>
                <td style="font-family:var(--fm)">RWF ${Number(totals.week || 0).toLocaleString()}</td>
                <td style="font-family:var(--fm)">RWF ${Number(totals.month || 0).toLocaleString()}</td>
                <td style="font-family:var(--fm)">RWF ${Number(totals.budget || 0).toLocaleString()}</td>
                <td>${Number(totals.variance || 0).toFixed(1)}%</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
    const expBtn = $('sageExport');
    if (expBtn) expBtn.disabled = false;
  }

  $('sageLoad').onclick = loadSage;
  $('sageExport').onclick = () => {
    if (!lastSummary.length) return;
    const lines = ['Category,Week Amount (RWF),Month to Date (RWF),Budget (RWF),Variance %,Status'];
    for (const cat of lastSummary) {
      lines.push(`"${cat.name}",${cat.week_amount || 0},${cat.month_amount || 0},${cat.budget || 0},${Number(cat.variance || 0).toFixed(1)},${cat.status}`);
    }
    lines.push(`Total,${lastTotals.week || 0},${lastTotals.month || 0},${lastTotals.budget || 0},${Number(lastTotals.variance || 0).toFixed(1)},`);
    downloadCsv(lines.join('\n'), `sage-reconciliation-${lastMonth}.csv`);
  };

  await loadSage();
}

function renderDenied(id, message) {
  $(`page-${id}`).innerHTML = `
    <div class="denied">
      <i class="ti ti-lock"></i>
      <h3>Access denied</h3>
      <p>${message || 'Your role does not have permission to view this page.'}</p>
    </div>
  `;
}

function wireLogin() {
  const uname = $('uname');
  const upass = $('upass');
  const lerr = $('lerr');

  function strength(v) {
    const s = $('pwStrength');
    const p = String(v || '');
    let score = 0;
    if (p.length >= 8) score += 25;
    if (/[A-Z]/.test(p)) score += 25;
    if (/[0-9]/.test(p)) score += 25;
    if (/[^A-Za-z0-9]/.test(p)) score += 25;
    s.style.width = `${score}%`;
    s.style.background = score >= 75 ? '#22C55E' : score >= 50 ? '#F59E0B' : '#EF4444';
  }

  upass.addEventListener('input', () => strength(upass.value));

  async function doLogin() {
    console.log('[renderer] Starting login');
    lerr.style.display = 'none';
    try {
      const res = await UFCL.login(uname.value, upass.value);
      if (!res.ok) {
        lerr.textContent = res.error || 'Invalid username or password';
        lerr.style.display = 'block';
        return;
      }
      STORAGE.user = res.user;
      // Keep the login view visible while the app bootstraps to avoid
      console.log('[renderer] Login successful, starting bootstrap');
      // showing an empty shell if bootstrap fails or times out.
      const loginBtn = $('loginBtn');
      if (loginBtn) loginBtn.disabled = true;
      const timeoutMs = 10_000;
      const t = new Promise((_, rej) => setTimeout(() => rej(new Error('Startup timed out (DB connection?)')), timeoutMs));
      await Promise.race([bootstrap(), t]);

      if (loginBtn) loginBtn.disabled = false;
      show($('loginView'), false);
      // Ensure the shell is shown as a flex container (overrides CSS display:none).
      const shellEl = $('shell');
      if (shellEl) shellEl.style.display = 'flex';
    } catch (e) {
      const msg = e?.message || String(e);
      lerr.textContent = `Login OK, but app failed to load: ${msg}`;
      lerr.style.display = 'block';
      // revert UI
      const loginBtn = $('loginBtn');
      if (loginBtn) loginBtn.disabled = false;
      const shellEl = $('shell');
      if (shellEl) shellEl.style.display = 'none';
      show($('loginView'), true);
      STORAGE.user = null;
    }
  }

  const loginBtn = $('loginBtn');
  if (loginBtn) {
    loginBtn.disabled = false;
    loginBtn.onclick = doLogin;
    loginBtn.addEventListener('click', doLogin);
  }
  upass.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doLogin();
  });
  uname.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') upass.focus();
  });
}

function wireTopbar() {
  $('logoutBtn').onclick = async () => {
    await UFCL.logout();
    STORAGE.user = null;
    show($('shell'), false);
    show($('loginView'), true);
    $('upass').value = '';
  };
  $('notifBtn').onclick = () => showPage('notifications');

  const sidebar = $('sidebar');
  const toggleBtn = $('sidebarToggle');
  const toggleIcon = $('sidebarToggleIcon');

  function setSidebarCollapsed(collapsed) {
    sidebar.classList.toggle('collapsed', collapsed);
    if (toggleIcon) {
      toggleIcon.className = collapsed
        ? 'ti ti-layout-sidebar-left-expand'
        : 'ti ti-layout-sidebar-left-collapse';
    }
    try { localStorage.setItem('sidebarCollapsed', collapsed ? '1' : '0'); } catch {}
  }

  if (toggleBtn) {
    toggleBtn.onclick = () => setSidebarCollapsed(!sidebar.classList.contains('collapsed'));
    try {
      if (localStorage.getItem('sidebarCollapsed') === '1') setSidebarCollapsed(true);
    } catch {}
  }
}

window.addEventListener('DOMContentLoaded', () => {
  // Global error handlers to capture renderer exceptions during bootstrap/login.
  window.addEventListener('error', (ev) => {
    try { console.error('[renderer:error]', ev.message || ev); } catch (e) {}
  });
  window.addEventListener('unhandledrejection', (ev) => {
    try { console.error('[renderer:unhandledrejection]', ev.reason || ev); } catch (e) {}
  });

  try {
    if (!window.UFCL) {
      document.body.innerHTML = `<div style="font-family:Arial;padding:24px">
        <h2>UFCL app failed to load</h2>
        <p>Preload bridge <code>UFCL</code> is missing. Please restart the app.</p>
      </div>`;
      return;
    }
    wireLogin();
    wireTopbar();
  } catch (e) {
    const msg = e?.message || String(e);
    document.body.innerHTML = `<div style="font-family:Arial;padding:24px">
      <h2>UFCL app error</h2>
      <pre style="white-space:pre-wrap;background:#f3f4f6;padding:12px;border-radius:8px">${msg}</pre>
    </div>`;
  }
});

