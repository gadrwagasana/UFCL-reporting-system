/* global UFCL */

const STORAGE = {
  user: null,
  approved: { monthly: false },
  unread: 0,
  pages: []
};

const NAV = [
  { id: 'dashboard', icon: 'ti-layout-dashboard', label: 'Dashboard', sec: 'Overview' },
  { id: 'daily-timber',  icon: 'ti-trees',         label: 'Timber Daily Production',     sec: 'Production' },
  { id: 'daily-poles',   icon: 'ti-align-center',  label: 'Poles Daily Production',      sec: 'Production' },
  { id: 'daily-harvest', icon: 'ti-axe',            label: 'Harvesting Daily Production', sec: 'Production' },
  { id: 'sales', icon: 'ti-shopping-cart', label: 'Sales orders', sec: 'Commercial' },
  { id: 'products', icon: 'ti-package', label: 'Product catalog', sec: 'Commercial' },
  { id: 'weekly-cost', icon: 'ti-cash', label: 'Weekly cost report', sec: 'Reports' },
  { id: 'weekly-perf', icon: 'ti-chart-bar', label: 'Weekly performance', sec: 'Reports' },
  { id: 'monthly', icon: 'ti-report-analytics', label: 'Monthly dashboard', sec: 'Reports' },
  { id: 'sage', icon: 'ti-refresh', label: 'Sage reconciliation', sec: 'Finance' },
  { id: 'kpi', icon: 'ti-target', label: 'KPI scorecard', sec: 'Executive' },
  { id: 'changes', icon: 'ti-git-pull-request', label: 'Change requests', sec: 'Governance' },
  { id: 'notifications', icon: 'ti-bell', label: 'Notifications', sec: 'Governance' },
  { id: 'audit', icon: 'ti-shield-check', label: 'Audit trail', sec: 'Governance' },
  { id: 'export', icon: 'ti-file-export', label: 'Exports', sec: 'Tools' },
  { id: 'users', icon: 'ti-users', label: 'Users', sec: 'System' },
  { id: 'inventory',      icon: 'ti-stack',              label: 'Inventory',             sec: 'Logistics' },
  { id: 'logistics',      icon: 'ti-box',                label: 'Spare Parts',           sec: 'Logistics' },
  { id: 'warehouses',     icon: 'ti-building-warehouse', label: 'Warehouses',            sec: 'Logistics' },
  { id: 'stock-items',    icon: 'ti-package',            label: 'Stock Catalog',         sec: 'Logistics' },
  { id: 'stock-movements',icon: 'ti-arrows-exchange',    label: 'Stock Movements',       sec: 'Logistics' },
  { id: 'vehicles',       icon: 'ti-truck',              label: 'Vehicle Fleet',         sec: 'Logistics' },
  { id: 'deliveries',     icon: 'ti-truck-delivery',     label: 'Delivery Orders',       sec: 'Logistics' },
  { id: 'dispatch',       icon: 'ti-send',               label: 'Dispatch',              sec: 'Logistics' },
  { id: 'transport',      icon: 'ti-truck-loading',      label: 'Third-Party Transport', sec: 'Logistics' },
  { id: 'timber-inventory', icon: 'ti-trees', label: 'Timber inventory', sec: 'Forestry' },
  { id: 'harvest', icon: 'ti-axe', label: 'Harvest tracking', sec: 'Forestry' },
  { id: 'machines',     icon: 'ti-settings-2',  label: 'Machine Registry',   sec: 'Logistics' },
  { id: 'machine-logs', icon: 'ti-list-details', label: 'Machine Daily Logs', sec: 'Production' },
  { id: 'machine-kpi',  icon: 'ti-chart-line',   label: 'KPI Performance',    sec: 'Executive' }
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
  const pageIds = ['dashboard', 'daily', 'sales', 'products', 'logistics', 'weekly-cost', 'weekly-perf', 'monthly', 'inventory', 'sage', 'kpi', 'changes', 'audit', 'notifications', 'export', 'users', 'warehouses', 'stock-items', 'stock-movements', 'vehicles', 'deliveries', 'dispatch', 'timber-inventory', 'harvest', 'transport', 'machines', 'machine-logs', 'machine-kpi'];
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

function confirmDelete(label, onConfirm) {
  openOverlay('Confirm delete', null, `
    <p style="color:var(--t1);margin-bottom:.5rem">${label}</p>
    <p style="color:var(--red);font-size:13px;margin-bottom:1.25rem"><i class="ti ti-alert-triangle"></i> This cannot be undone.</p>
    <div class="brow">
      <button class="bp1" id="ovSave" style="background:var(--red);border-color:var(--red)"><i class="ti ti-trash"></i>Delete</button>
      <button class="bs1" id="ovCancel">Cancel</button>
    </div>`, onConfirm);
}

// ── Supervisor approval helpers ───────────────────────────────────────────────

function isSupervisor() {
  return STORAGE.user?.role === 'supervisor';
}

function canApproveEdits() {
  return ['admin', 'ceo', 'operations', 'logistics'].includes(STORAGE.user?.role);
}

// Inserts a pending-approvals panel at the top of a page container for managers.
// entityTypes: array of entity_type strings this page is responsible for.
async function insertPendingPanel(pageEl, entityTypes, onReviewed) {
  if (!canApproveEdits()) return;
  const res = await UFCL.pendingEditsList(STORAGE.user.id);
  if (!res.ok) return;
  const pending = (res.rows || []).filter(r =>
    entityTypes.includes(r.entity_type) && r.status === 'Pending'
  );
  if (!pending.length) return;

  const panel = document.createElement('div');
  panel.style.cssText = 'margin-bottom:1.25rem';
  panel.innerHTML = `
    <div style="border:1px solid rgba(245,158,11,.3);border-radius:8px;overflow:hidden">
      <div style="display:flex;align-items:center;gap:.625rem;padding:.75rem 1.25rem;background:rgba(245,158,11,.07);border-bottom:1px solid rgba(245,158,11,.2)">
        <i class="ti ti-clock" style="color:var(--amber);font-size:16px"></i>
        <span style="font-weight:600;font-size:13px;color:var(--amber)">${pending.length} pending approval${pending.length > 1 ? 's' : ''} from supervisor${pending.length > 1 ? 's' : ''}</span>
      </div>
      <div class="tw"><table class="dt">
        <thead><tr><th>Supervisor</th><th>Request</th><th>Item</th><th>Submitted</th><th>Review</th></tr></thead>
        <tbody>
          ${pending.map(p => `<tr>
            <td style="font-weight:500">${p.submitted_by_name || '—'}</td>
            <td><span class="badge ${p.action_type === 'delete' ? 'br' : 'ba'}">${p.action_type === 'delete' ? 'Delete' : 'Edit'}</span></td>
            <td style="font-weight:500">${p.entity_ref || p.entity_type + ' #' + p.entity_id}</td>
            <td style="font-size:12px;color:var(--t3)">${p.submitted_at}</td>
            <td style="white-space:nowrap;display:flex;gap:4px">
              <button class="bp1 pa-approve" data-id="${p.id}" style="padding:4px 10px;font-size:12px"><i class="ti ti-check"></i>Approve</button>
              <button class="bs1 pa-reject"  data-id="${p.id}" style="padding:4px 10px;font-size:12px;color:var(--red)"><i class="ti ti-x"></i>Reject</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table></div>
    </div>`;
  pageEl.prepend(panel);

  panel.querySelectorAll('.pa-approve').forEach(btn => {
    btn.onclick = async () => {
      const r = await UFCL.pendingEditsReview(STORAGE.user.id, Number(btn.dataset.id), 'Approved', null);
      if (!r.ok) { alert(r.error); return; }
      await onReviewed();
    };
  });

  panel.querySelectorAll('.pa-reject').forEach(btn => {
    btn.onclick = () => {
      openOverlay('Reject request', null, `
        <p style="font-size:13px;color:var(--t3);margin-bottom:1rem">The supervisor will not be notified but the request will be marked as rejected.</p>
        <div class="fg"><label>Reason for rejection *</label>
          <input id="rej-reason" type="text" placeholder="Why is this request being rejected?">
        </div>
        <div class="brow">
          <button class="bp1" id="ovSave" style="background:var(--red);border-color:var(--red)"><i class="ti ti-x"></i>Reject</button>
          <button class="bs1" id="ovCancel">Cancel</button>
        </div>`,
        async () => {
          const reason = $('rej-reason')?.value?.trim();
          if (!reason) { showOverlayError('Reason is required'); return; }
          const r = await UFCL.pendingEditsReview(STORAGE.user.id, Number(btn.dataset.id), 'Rejected', reason);
          if (!r.ok) { showOverlayError(r.error); return; }
          showOverlaySuccess('Request rejected.'); await onReviewed();
        });
    };
  });
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
  STORAGE.pages = pages;
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
    case 'daily-timber':
      return renderPageDailyTimber();
    case 'daily-poles':
      return renderPageDailyPoles();
    case 'daily-harvest':
      return renderPageDailyHarvest();
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
    case 'warehouses':
      return renderWarehouses();
    case 'stock-items':
      return renderStockItems();
    case 'stock-movements':
      return renderStockMovements();
    case 'vehicles':
      return renderVehicles();
    case 'deliveries':
      return renderDeliveries();
    case 'dispatch':
      return renderDispatch();
    case 'harvest':
      return renderHarvest();
    case 'timber-inventory':
      return renderTimberInventory();
    case 'transport':
      return renderTransport();
    case 'machines':
      return renderMachines();
    case 'machine-logs':
      return renderMachineLogs();
    case 'machine-kpi':
      return renderMachineKpi();
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

// Daily production page — sub-type remembered across re-renders
let _dailySubType = null;

async function renderDaily(subType = null) {
  // ── Determine which sub-types this user is allowed to use ──────────────────
  const pages = STORAGE.pages || [];
  const hasAll = pages.includes('daily');
  const allowed = [
    { id: 'timber',  label: 'Timber Daily Production',     icon: 'ti-trees',     perm: 'daily-timber'  },
    { id: 'poles',   label: 'Poles Daily Production',      icon: 'ti-align-center', perm: 'daily-poles'   },
    { id: 'harvest', label: 'Harvesting Daily Production', icon: 'ti-axe',       perm: 'daily-harvest' }
  ].filter(st => hasAll || pages.includes(st.perm));

  if (!allowed.length) return renderDenied('daily', 'You do not have permission for any production type on this page.');

  // Remember the last selected sub-type across re-renders
  if (subType) _dailySubType = subType;
  if (!_dailySubType || !allowed.find(a => a.id === _dailySubType)) _dailySubType = allowed[0].id;
  const current = _dailySubType;

  // ── Load data ──────────────────────────────────────────────────────────────
  const [dailyRes, harvestRes] = await Promise.all([
    (current === 'timber' || current === 'poles') ? UFCL.dailyList(STORAGE.user.id) : Promise.resolve({ ok: true, rows: [], stock: {} }),
    current === 'harvest' ? UFCL.dailyHarvestData(STORAGE.user.id) : Promise.resolve({ ok: true, rows: [], summary: {} })
  ]);

  if (current !== 'harvest' && !dailyRes.ok) return renderDenied('daily', dailyRes.error);
  if (current === 'harvest' && !harvestRes.ok) return renderDenied('daily', harvestRes.error);

  const allDailyRows = dailyRes.rows || [];
  const stock = dailyRes.stock || {};
  const harvestRows = harvestRes.rows || [];
  const harvestSummary = harvestRes.summary || {};

  // Filter logs to relevant sub-type
  const timberRows = allDailyRows.filter(r => Number(r.timber_units || 0) > 0 || Number(r.timber_kiln_dried || 0) > 0 || Number(r.timber_cca_treated || 0) > 0 || Number(r.timber_untreated || 0) > 0);
  const polesRows  = allDailyRows.filter(r => Number(r.poles_units || 0) > 0);

  // ── Dropdown selector ──────────────────────────────────────────────────────
  const dropdownOpts = allowed.map(a =>
    `<option value="${a.id}" ${a.id === current ? 'selected' : ''}>${a.label}</option>`
  ).join('');

  const currentMeta = allowed.find(a => a.id === current);

  $('page-daily').innerHTML = `
    <div class="ptitle">Daily Production Log</div>
    <div class="psub">Select a production type below. Only the types assigned to your role are shown.</div>

    <div style="display:flex;align-items:center;gap:12px;margin-bottom:1.25rem;padding:.75rem 1rem;background:var(--surf);border:1px solid var(--bdr);border-radius:8px">
      <i class="ti ${currentMeta.icon}" style="font-size:20px;color:var(--green);flex-shrink:0"></i>
      <div style="flex:1">
        <div style="font-size:11px;font-weight:600;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px">Production type</div>
        <select id="daily-type-sel" style="font-size:14px;font-weight:600;background:transparent;border:none;color:var(--t1);cursor:pointer;width:100%;outline:none">
          ${dropdownOpts}
        </select>
      </div>
      <span class="badge bg" style="font-size:11px">${allowed.length} type${allowed.length > 1 ? 's' : ''} available</span>
    </div>

    <div id="daily-content"></div>
  `;

  // Re-render when the user changes the dropdown selection
  $('daily-type-sel').onchange = e => renderDaily(e.target.value);

  // ── Render the selected sub-type content ───────────────────────────────────
  if (current === 'timber') renderDailyTimber(stock, timberRows);
  else if (current === 'poles') renderDailyPoles(stock, polesRows);
  else renderDailyHarvest(harvestRows, harvestSummary);
}

// ── Standalone page wrappers (called from showPage / sidebar) ─────────────────

async function renderPageDailyTimber() {
  $('page-daily-timber').innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;padding:2rem;color:var(--t3);font-size:13px">
      <i class="ti ti-loader-2" style="font-size:18px;animation:spin 1s linear infinite"></i> Loading…
    </div>`;
  const res = await UFCL.dailyList(STORAGE.user.id);
  if (!res.ok) return renderDenied('daily-timber', res.error);
  const rows = (res.rows || []).filter(r =>
    Number(r.timber_units || 0) > 0 ||
    Number(r.timber_kiln_dried || 0) > 0 ||
    Number(r.timber_cca_treated || 0) > 0 ||
    Number(r.timber_untreated || 0) > 0
  );
  $('page-daily-timber').innerHTML = '<div id="daily-content"></div>';
  renderDailyTimber(res.stock || {}, rows, 'page-daily-timber', renderPageDailyTimber);
  await insertPendingPanel($('page-daily-timber'), ['daily_log'], renderPageDailyTimber);
}

async function renderPageDailyPoles() {
  $('page-daily-poles').innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;padding:2rem;color:var(--t3);font-size:13px">
      <i class="ti ti-loader-2" style="font-size:18px;animation:spin 1s linear infinite"></i> Loading…
    </div>`;
  const res = await UFCL.dailyList(STORAGE.user.id);
  if (!res.ok) return renderDenied('daily-poles', res.error);
  const rows = (res.rows || []).filter(r => Number(r.poles_units || 0) > 0);
  $('page-daily-poles').innerHTML = '<div id="daily-content"></div>';
  renderDailyPoles(res.stock || {}, rows, 'page-daily-poles', renderPageDailyPoles);
  await insertPendingPanel($('page-daily-poles'), ['daily_log'], renderPageDailyPoles);
}

async function renderPageDailyHarvest() {
  $('page-daily-harvest').innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;padding:2rem;color:var(--t3);font-size:13px">
      <i class="ti ti-loader-2" style="font-size:18px;animation:spin 1s linear infinite"></i> Loading…
    </div>`;
  const res = await UFCL.dailyHarvestData(STORAGE.user.id);
  if (!res.ok) return renderDenied('daily-harvest', res.error);
  $('page-daily-harvest').innerHTML = '<div id="daily-content"></div>';
  renderDailyHarvest(res.rows || [], res.summary || {}, 'page-daily-harvest', renderPageDailyHarvest);
  await insertPendingPanel($('page-daily-harvest'), ['harvest_log'], renderPageDailyHarvest);
}

// ── Timber sub-view ───────────────────────────────────────────────────────────
function renderDailyTimber(stock, rows, cid = 'daily-content', onRefresh = null) {
  const today = new Date().toISOString().split('T')[0];
  const refresh = onRefresh || (() => renderDaily('timber'));

  $(cid).innerHTML = `
    <div class="cards">
      <div class="mc" style="border-top:3px solid #D97706">
        <div class="mclbl">Kiln-dried in stock</div>
        <div class="mcval" style="color:${stock.kilnDriedStock < 0 ? 'var(--red)' : 'inherit'}">${Number(stock.kilnDriedStock || 0).toLocaleString()}</div>
        <div class="mcsub ca"><i class="ti ti-flame"></i>${Number(stock.kilnDriedProduced || 0).toLocaleString()} prod · ${Number(stock.kilnDriedSold || 0).toLocaleString()} sold</div>
      </div>
      <div class="mc" style="border-top:3px solid #2E8B57">
        <div class="mclbl">CCA-treated in stock</div>
        <div class="mcval" style="color:${stock.ccaTreatedStock < 0 ? 'var(--red)' : 'inherit'}">${Number(stock.ccaTreatedStock || 0).toLocaleString()}</div>
        <div class="mcsub cg"><i class="ti ti-droplet"></i>${Number(stock.ccaTreatedProduced || 0).toLocaleString()} prod · ${Number(stock.ccaTreatedSold || 0).toLocaleString()} sold</div>
      </div>
      <div class="mc" style="border-top:3px solid #0F766E">
        <div class="mclbl">Untreated in stock</div>
        <div class="mcval" style="color:${stock.untreatedStock < 0 ? 'var(--red)' : 'inherit'}">${Number(stock.untreatedStock || 0).toLocaleString()}</div>
        <div class="mcsub cg"><i class="ti ti-tree"></i>${Number(stock.untreatedProduced || 0).toLocaleString()} prod · ${Number(stock.untreatedSold || 0).toLocaleString()} sold</div>
      </div>
      <div class="mc">
        <div class="mclbl">Total timber in stock</div>
        <div class="mcval" style="color:${stock.timberStock < 0 ? 'var(--red)' : 'var(--green)'}">${Number(stock.timberStock || 0).toLocaleString()}</div>
        <div class="mcsub cg"><i class="ti ti-trees"></i>all types</div>
      </div>
    </div>
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem">
        <h3 style="margin-bottom:0"><i class="ti ti-trees"></i>Timber production entries</h3>
        <button class="appbtn" id="newTimber"><i class="ti ti-plus" style="font-size:12px;vertical-align:-1px"></i> Add timber entry</button>
      </div>
      <div class="tw"><table class="dt">
        <thead><tr><th>Date</th><th>Supervisor</th><th>Size</th><th>Machine</th><th>Kiln-dried</th><th>CCA-treated</th><th>Untreated</th><th>Total</th><th>Waste</th><th>Downtime</th><th>Remarks</th><th>Action</th></tr></thead>
        <tbody>
          ${rows.length === 0
            ? '<tr><td colspan="12" style="text-align:center;color:var(--t3);padding:2rem">No timber entries yet. Click "Add timber entry" to log production.</td></tr>'
            : rows.map(r => `<tr>
              <td style="font-family:var(--fm);font-weight:500">${r.date}</td>
              <td>${r.supervisor || '—'}</td>
              <td><span style="font-size:12px;font-weight:600;color:var(--green)">${r.product_size || '—'}</span></td>
              <td style="color:var(--t3);font-size:12px">${r.machine || '—'}</td>
              <td style="color:#D97706;font-weight:500">${Number(r.timber_kiln_dried || 0).toLocaleString()}</td>
              <td style="color:var(--g-soft);font-weight:500">${Number(r.timber_cca_treated || 0).toLocaleString()}</td>
              <td style="font-weight:500">${Number(r.timber_untreated || 0).toLocaleString()}</td>
              <td style="font-weight:600;color:var(--green)">${Number(r.timber_units || 0).toLocaleString()}</td>
              <td style="color:var(--amber)">${Number(r.timber_waste || 0).toLocaleString()}</td>
              <td style="font-family:var(--fm);color:var(--t3)">${Number(r.downtime_hours || 0).toFixed(1)}h</td>
              <td style="color:var(--t3);font-size:12px">${r.remarks || '—'}</td>
              <td style="white-space:nowrap">
                <button class="bs1 dl-edit" data-id="${r.id}"><i class="ti ti-edit"></i>Edit</button>
                <button class="bs1 dl-del" data-id="${r.id}" style="color:var(--red)"><i class="ti ti-trash"></i></button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table></div>
    </div>`;

  $('newTimber').onclick = async () => {
    const [productsRes, machinesRes] = await Promise.all([
      UFCL.productsActiveForForm(STORAGE.user.id, 'Timber'),
      UFCL.machinesForDropdown(STORAGE.user.id)
    ]);
    const tProducts = productsRes.ok ? productsRes.rows : [];
    const tMachines = machinesRes.ok  ? machinesRes.rows  : [];
    const productOpts = tProducts.length
      ? tProducts.map(p => `<option value="${p.size}">${p.sub_type ? p.sub_type + ' — ' : ''}${p.size}</option>`).join('')
      : '<option value="" disabled>No active timber products — add in Product Catalog first</option>';
    const mOpts = tMachines.length
      ? tMachines.map(m => `<option value="${m.name}">${m.name} (${m.category_name})</option>`).join('')
      : '<option value="" disabled>No active machines registered</option>';
    openOverlay(
      'Add Timber Production Entry',
      `Stock — Kiln: <strong>${Number(stock.kilnDriedStock||0).toLocaleString()}</strong> &nbsp;CCA: <strong>${Number(stock.ccaTreatedStock||0).toLocaleString()}</strong> &nbsp;Untreated: <strong>${Number(stock.untreatedStock||0).toLocaleString()}</strong>`,
      `<div class="frow three">
        <div class="fg"><label>Date *</label><input type="date" id="dl-date" value="${today}"></div>
        <div class="fg"><label>Supervisor</label><input type="text" id="dl-sup" placeholder="${STORAGE.user.name}"></div>
        <div class="fg"><label>Machine</label><select id="dl-machine"><option value="">— Select machine —</option>${mOpts}</select></div>
      </div>
      <div class="frow full">
        <div class="fg"><label>Product</label><select id="dl-ps"><option value="">— Select product —</option>${productOpts}</select></div>
      </div>
      <div style="background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:.75rem;margin-bottom:.75rem">
        <div style="font-size:11px;font-weight:600;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.5rem">Timber breakdown</div>
        <div class="frow three">
          <div class="fg"><label>Kiln-dried (units)</label><input type="number" id="dl-kd" placeholder="0" min="0"></div>
          <div class="fg"><label>CCA-treated (units)</label><input type="number" id="dl-cca" placeholder="0" min="0"></div>
          <div class="fg"><label>Untreated (units)</label><input type="number" id="dl-unt" placeholder="0" min="0"></div>
        </div>
        <div class="frow">
          <div class="fg"><label>Timber waste (pcs)</label><input type="number" id="dl-tw" placeholder="0" min="0"></div>
          <div class="fg"><label>Total timber</label><input type="text" id="dl-total" readonly style="background:var(--g-light);color:var(--g-dark);font-weight:600" placeholder="0"></div>
        </div>
      </div>
      <div class="frow">
        <div class="fg"><label>Downtime (hrs)</label><input type="number" id="dl-dt" placeholder="0" step="0.5" min="0"></div>
        <div class="fg"><label>Downtime reason</label><input type="text" id="dl-dr" placeholder="e.g. Blade replacement"></div>
      </div>
      <div class="fg"><label>Remarks</label><textarea id="dl-rem" rows="2" placeholder="Any notes for this shift"></textarea></div>
      <div class="brow"><button class="bp1" id="ovSave"><i class="ti ti-device-floppy"></i>Save entry</button><button class="bs1" id="ovCancel">Cancel</button></div>`,
      async () => {
        const r = await UFCL.dailyCreate(STORAGE.user.id, {
          date: $('dl-date').value, supervisor: $('dl-sup').value || STORAGE.user.name,
          product_size: $('dl-ps').value || null,
          machine: $('dl-machine').value || null,
          timber_kiln_dried: $('dl-kd').value, timber_cca_treated: $('dl-cca').value,
          timber_untreated: $('dl-unt').value, timber_waste: $('dl-tw').value,
          poles_units: 0, poles_waste: 0,
          downtime_hours: $('dl-dt').value, downtime_reason: $('dl-dr').value,
          remarks: $('dl-rem').value
        });
        if (!r.ok) { showOverlayError(r.error); return; }
        showOverlaySuccess('Timber entry saved.'); await refresh();
      }
    );
    ['dl-kd','dl-cca','dl-unt'].forEach(id => {
      const el = $(id);
      if (el) el.oninput = () => {
        const t = Number($('dl-kd')?.value||0) + Number($('dl-cca')?.value||0) + Number($('dl-unt')?.value||0);
        const el2 = $('dl-total'); if (el2) el2.value = t > 0 ? t.toLocaleString() : '';
      };
    });
  };

  document.querySelectorAll('.dl-edit').forEach(btn => {
    btn.onclick = async () => {
      const r = rows.find(x => x.id === Number(btn.dataset.id));
      if (!r) return;
      const isoDate = r.date.split('/').reverse().join('-');
      const [productsRes, machinesRes] = await Promise.all([
        UFCL.productsActiveForForm(STORAGE.user.id, 'Timber'),
        UFCL.machinesForDropdown(STORAGE.user.id)
      ]);
      const tProducts = productsRes.ok ? productsRes.rows : [];
      const tMachines = machinesRes.ok  ? machinesRes.rows  : [];
      const productOpts = tProducts.map(p =>
        `<option value="${p.size}" ${r.product_size === p.size ? 'selected' : ''}>${p.sub_type ? p.sub_type + ' — ' : ''}${p.size}</option>`
      ).join('');
      const mOpts = tMachines.map(m =>
        `<option value="${m.name}" ${r.machine === m.name ? 'selected' : ''}>${m.name} (${m.category_name})</option>`
      ).join('');
      openOverlay('Edit Timber Entry', r.date, `
        <div class="frow three">
          <div class="fg"><label>Date *</label><input type="date" id="dl-date" value="${isoDate}"></div>
          <div class="fg"><label>Supervisor</label><input type="text" id="dl-sup" value="${r.supervisor||''}"></div>
          <div class="fg"><label>Machine</label><select id="dl-machine"><option value="">— Select machine —</option>${mOpts}</select></div>
        </div>
        <div class="frow full">
          <div class="fg"><label>Product</label><select id="dl-ps"><option value="">— Select product —</option>${productOpts}${r.product_size && !tProducts.find(p=>p.size===r.product_size) ? `<option value="${r.product_size}" selected>${r.product_size} (inactive)</option>` : ''}</select></div>
        </div>
        <div style="background:var(--surf);border:1px solid var(--bdr);border-radius:6px;padding:.75rem;margin-bottom:.75rem">
          <div class="frow three">
            <div class="fg"><label>Kiln-dried</label><input type="number" id="dl-kd" value="${r.timber_kiln_dried||0}" min="0"></div>
            <div class="fg"><label>CCA-treated</label><input type="number" id="dl-cca" value="${r.timber_cca_treated||0}" min="0"></div>
            <div class="fg"><label>Untreated</label><input type="number" id="dl-unt" value="${r.timber_untreated||0}" min="0"></div>
          </div>
          <div class="fg" style="margin-top:.5rem"><label>Timber waste</label><input type="number" id="dl-tw" value="${r.timber_waste||0}" min="0"></div>
        </div>
        <div class="frow">
          <div class="fg"><label>Downtime (hrs)</label><input type="number" id="dl-dt" value="${r.downtime_hours||0}" step="0.5" min="0"></div>
          <div class="fg"><label>Downtime reason</label><input type="text" id="dl-dr" value="${r.downtime_reason||''}"></div>
        </div>
        <div class="fg"><label>Remarks</label><textarea id="dl-rem" rows="2">${r.remarks||''}</textarea></div>
        <div class="brow"><button class="bp1" id="ovSave"><i class="ti ti-device-floppy"></i>Save</button><button class="bs1" id="ovCancel">Cancel</button></div>`,
        async () => {
          const payload = {
            date: $('dl-date').value, supervisor: $('dl-sup').value,
            product_size: $('dl-ps').value || null,
            machine: $('dl-machine').value || null,
            timber_kiln_dried: $('dl-kd').value, timber_cca_treated: $('dl-cca').value,
            timber_untreated: $('dl-unt').value, timber_waste: $('dl-tw').value,
            poles_units: r.poles_units || 0, poles_waste: r.poles_waste || 0,
            downtime_hours: $('dl-dt').value, downtime_reason: $('dl-dr').value,
            remarks: $('dl-rem').value
          };
          if (isSupervisor()) {
            const r2 = await UFCL.pendingEditsCreate(STORAGE.user.id, {
              action_type: 'edit', entity_type: 'daily_log',
              entity_id: r.id, entity_ref: r.date, payload
            });
            if (!r2.ok) { showOverlayError(r2.error); return; }
            showOverlaySuccess('Edit request submitted — awaiting manager approval.');
            await refresh();
            return;
          }
          const res2 = await UFCL.dailyUpdate(STORAGE.user.id, r.id, payload);
          if (!res2.ok) { showOverlayError(res2.error); return; }
          showOverlaySuccess('Entry updated.'); await refresh();
        });
    };
  });

  document.querySelectorAll('.dl-del').forEach(btn => {
    btn.onclick = () => {
      const r = rows.find(x => x.id === Number(btn.dataset.id));
      if (!r) return;
      if (isSupervisor()) {
        confirmDelete(`Submit delete request for timber log <strong>${r.date}</strong>? A manager must approve before it is removed.`, async () => {
          const r2 = await UFCL.pendingEditsCreate(STORAGE.user.id, {
            action_type: 'delete', entity_type: 'daily_log',
            entity_id: r.id, entity_ref: r.date, payload: null
          });
          if (!r2.ok) { showOverlayError(r2.error); return; }
          showOverlaySuccess('Delete request submitted — awaiting manager approval.');
          await refresh();
        });
        return;
      }
      confirmDelete(`Delete timber log for <strong>${r.date}</strong>?`, async () => {
        const res2 = await UFCL.dailyDelete(STORAGE.user.id, r.id);
        if (!res2.ok) { showOverlayError(res2.error); return; }
        showOverlaySuccess('Entry deleted.'); await refresh();
      });
    };
  });
}

// ── Poles sub-view ────────────────────────────────────────────────────────────
function renderDailyPoles(stock, rows, cid = 'daily-content', onRefresh = null) {
  const today = new Date().toISOString().split('T')[0];
  const refresh = onRefresh || (() => renderDaily('poles'));

  $(cid).innerHTML = `
    <div class="cards">
      <div class="mc" style="border-top:3px solid #1D4ED8">
        <div class="mclbl">Poles in stock</div>
        <div class="mcval" style="color:${stock.polesStock < 0 ? 'var(--red)' : 'inherit'}">${Number(stock.polesStock || 0).toLocaleString()}</div>
        <div class="mcsub bp"><i class="ti ti-align-center"></i>${Number(stock.polesProduced || 0).toLocaleString()} prod · ${Number(stock.polesSold || 0).toLocaleString()} sold</div>
      </div>
      <div class="mc">
        <div class="mclbl">Pole entries (last 50)</div>
        <div class="mcval">${rows.length}</div>
        <div class="mcsub cg"><i class="ti ti-clipboard-list"></i>log records</div>
      </div>
      <div class="mc">
        <div class="mclbl">Total poles logged</div>
        <div class="mcval">${rows.reduce((s,r)=>s+Number(r.poles_units||0),0).toLocaleString()}</div>
        <div class="mcsub cg"><i class="ti ti-sum"></i>all entries</div>
      </div>
    </div>
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem">
        <h3 style="margin-bottom:0"><i class="ti ti-align-center"></i>Poles production entries</h3>
        <button class="appbtn" id="newPoles"><i class="ti ti-plus" style="font-size:12px;vertical-align:-1px"></i> Add poles entry</button>
      </div>
      <div class="tw"><table class="dt">
        <thead><tr><th>Date</th><th>Supervisor</th><th>Size</th><th>Machine</th><th>Poles (units)</th><th>Poles waste</th><th>Downtime (hrs)</th><th>Remarks</th><th>Action</th></tr></thead>
        <tbody>
          ${rows.length === 0
            ? '<tr><td colspan="9" style="text-align:center;color:var(--t3);padding:2rem">No poles entries yet. Click "Add poles entry" to log production.</td></tr>'
            : rows.map(r => `<tr>
              <td style="font-family:var(--fm);font-weight:500">${r.date}</td>
              <td>${r.supervisor || '—'}</td>
              <td><span style="font-size:12px;font-weight:600;color:#1D4ED8">${r.product_size || '—'}</span></td>
              <td style="color:var(--t3);font-size:12px">${r.machine || '—'}</td>
              <td style="color:#1D4ED8;font-weight:600">${Number(r.poles_units || 0).toLocaleString()}</td>
              <td style="color:var(--amber)">${Number(r.poles_waste || 0).toLocaleString()}</td>
              <td style="font-family:var(--fm);color:var(--t3)">${Number(r.downtime_hours || 0).toFixed(1)}h</td>
              <td style="color:var(--t3);font-size:12px">${r.remarks || '—'}</td>
              <td style="white-space:nowrap">
                <button class="bs1 pl-edit" data-id="${r.id}"><i class="ti ti-edit"></i>Edit</button>
                <button class="bs1 pl-del" data-id="${r.id}" style="color:var(--red)"><i class="ti ti-trash"></i></button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table></div>
    </div>`;

  $('newPoles').onclick = async () => {
    const [productsRes, machinesRes] = await Promise.all([
      UFCL.productsActiveForForm(STORAGE.user.id, 'Poles'),
      UFCL.machinesForDropdown(STORAGE.user.id)
    ]);
    const pProducts = productsRes.ok ? productsRes.rows : [];
    const pMachines = machinesRes.ok  ? machinesRes.rows  : [];
    const productOpts = pProducts.length
      ? pProducts.map(p => `<option value="${p.size}">${p.size}</option>`).join('')
      : '<option value="" disabled>No active poles products — add in Product Catalog first</option>';
    const mOpts = pMachines.length
      ? pMachines.map(m => `<option value="${m.name}">${m.name} (${m.category_name})</option>`).join('')
      : '<option value="" disabled>No active machines registered</option>';
    openOverlay(
      'Add Poles Production Entry',
      `Poles in stock: <strong>${Number(stock.polesStock||0).toLocaleString()}</strong>`,
      `<div class="frow three">
        <div class="fg"><label>Date *</label><input type="date" id="pl-date" value="${today}"></div>
        <div class="fg"><label>Supervisor</label><input type="text" id="pl-sup" placeholder="${STORAGE.user.name}"></div>
        <div class="fg"><label>Machine</label><select id="pl-machine"><option value="">— Select machine —</option>${mOpts}</select></div>
      </div>
      <div class="frow full">
        <div class="fg"><label>Product</label><select id="pl-ps"><option value="">— Select product —</option>${productOpts}</select></div>
      </div>
      <div class="frow">
        <div class="fg"><label>Poles produced (units) *</label><input type="number" id="pl-pu" placeholder="0" min="0"></div>
        <div class="fg"><label>Poles waste (pcs)</label><input type="number" id="pl-pw" placeholder="0" min="0"></div>
      </div>
      <div class="frow">
        <div class="fg"><label>Downtime (hrs)</label><input type="number" id="pl-dt" placeholder="0" step="0.5" min="0"></div>
        <div class="fg"><label>Downtime reason</label><input type="text" id="pl-dr" placeholder="e.g. Machine servicing"></div>
      </div>
      <div class="fg"><label>Remarks</label><textarea id="pl-rem" rows="2" placeholder="Any notes for this shift"></textarea></div>
      <div class="brow"><button class="bp1" id="ovSave"><i class="ti ti-device-floppy"></i>Save entry</button><button class="bs1" id="ovCancel">Cancel</button></div>`,
      async () => {
        const r = await UFCL.dailyCreate(STORAGE.user.id, {
          date: $('pl-date').value, supervisor: $('pl-sup').value || STORAGE.user.name,
          product_size: $('pl-ps').value || null,
          machine: $('pl-machine').value || null,
          timber_kiln_dried: 0, timber_cca_treated: 0, timber_untreated: 0, timber_waste: 0,
          poles_units: $('pl-pu').value, poles_waste: $('pl-pw').value,
          downtime_hours: $('pl-dt').value, downtime_reason: $('pl-dr').value,
          remarks: $('pl-rem').value
        });
        if (!r.ok) { showOverlayError(r.error); return; }
        showOverlaySuccess('Poles entry saved.'); await refresh();
      }
    );
  };

  document.querySelectorAll('.pl-edit').forEach(btn => {
    btn.onclick = async () => {
      const r = rows.find(x => x.id === Number(btn.dataset.id));
      if (!r) return;
      const [productsRes, machinesRes] = await Promise.all([
        UFCL.productsActiveForForm(STORAGE.user.id, 'Poles'),
        UFCL.machinesForDropdown(STORAGE.user.id)
      ]);
      const pProducts = productsRes.ok ? productsRes.rows : [];
      const pMachines = machinesRes.ok  ? machinesRes.rows  : [];
      const productOpts = pProducts.map(p =>
        `<option value="${p.size}" ${r.product_size === p.size ? 'selected' : ''}>${p.size}</option>`
      ).join('');
      const mOpts = pMachines.map(m =>
        `<option value="${m.name}" ${r.machine === m.name ? 'selected' : ''}>${m.name} (${m.category_name})</option>`
      ).join('');
      openOverlay('Edit Poles Entry', r.date, `
        <div class="frow three">
          <div class="fg"><label>Date *</label><input type="date" id="pl-date" value="${r.date.split('/').reverse().join('-')}"></div>
          <div class="fg"><label>Supervisor</label><input type="text" id="pl-sup" value="${r.supervisor||''}"></div>
          <div class="fg"><label>Machine</label><select id="pl-machine"><option value="">— Select machine —</option>${mOpts}</select></div>
        </div>
        <div class="frow full">
          <div class="fg"><label>Product</label><select id="pl-ps"><option value="">— Select product —</option>${productOpts}${r.product_size && !pProducts.find(p=>p.size===r.product_size) ? `<option value="${r.product_size}" selected>${r.product_size} (inactive)</option>` : ''}</select></div>
        </div>
        <div class="frow">
          <div class="fg"><label>Poles (units)</label><input type="number" id="pl-pu" value="${r.poles_units||0}" min="0"></div>
          <div class="fg"><label>Poles waste</label><input type="number" id="pl-pw" value="${r.poles_waste||0}" min="0"></div>
        </div>
        <div class="frow">
          <div class="fg"><label>Downtime (hrs)</label><input type="number" id="pl-dt" value="${r.downtime_hours||0}" step="0.5" min="0"></div>
          <div class="fg"><label>Downtime reason</label><input type="text" id="pl-dr" value="${r.downtime_reason||''}"></div>
        </div>
        <div class="fg"><label>Remarks</label><textarea id="pl-rem" rows="2">${r.remarks||''}</textarea></div>
        <div class="brow"><button class="bp1" id="ovSave"><i class="ti ti-device-floppy"></i>Save</button><button class="bs1" id="ovCancel">Cancel</button></div>`,
        async () => {
          const payload = {
            date: $('pl-date').value, supervisor: $('pl-sup').value,
            product_size: $('pl-ps').value || null,
            machine: $('pl-machine').value || null,
            timber_kiln_dried: r.timber_kiln_dried || 0, timber_cca_treated: r.timber_cca_treated || 0,
            timber_untreated: r.timber_untreated || 0, timber_waste: r.timber_waste || 0,
            poles_units: $('pl-pu').value, poles_waste: $('pl-pw').value,
            downtime_hours: $('pl-dt').value, downtime_reason: $('pl-dr').value,
            remarks: $('pl-rem').value
          };
          if (isSupervisor()) {
            const r2 = await UFCL.pendingEditsCreate(STORAGE.user.id, {
              action_type: 'edit', entity_type: 'daily_log',
              entity_id: r.id, entity_ref: r.date, payload
            });
            if (!r2.ok) { showOverlayError(r2.error); return; }
            showOverlaySuccess('Edit request submitted — awaiting manager approval.');
            await refresh();
            return;
          }
          const res2 = await UFCL.dailyUpdate(STORAGE.user.id, r.id, payload);
          if (!res2.ok) { showOverlayError(res2.error); return; }
          showOverlaySuccess('Entry updated.'); await refresh();
        });
    };
  });

  document.querySelectorAll('.pl-del').forEach(btn => {
    btn.onclick = () => {
      const r = rows.find(x => x.id === Number(btn.dataset.id));
      if (!r) return;
      if (isSupervisor()) {
        confirmDelete(`Submit delete request for poles log <strong>${r.date}</strong>? A manager must approve before it is removed.`, async () => {
          const r2 = await UFCL.pendingEditsCreate(STORAGE.user.id, {
            action_type: 'delete', entity_type: 'daily_log',
            entity_id: r.id, entity_ref: r.date, payload: null
          });
          if (!r2.ok) { showOverlayError(r2.error); return; }
          showOverlaySuccess('Delete request submitted — awaiting manager approval.');
          await refresh();
        });
        return;
      }
      confirmDelete(`Delete poles log for <strong>${r.date}</strong>?`, async () => {
        const res2 = await UFCL.dailyDelete(STORAGE.user.id, r.id);
        if (!res2.ok) { showOverlayError(res2.error); return; }
        showOverlaySuccess('Entry deleted.'); await refresh();
      });
    };
  });
}

// ── Harvest sub-view ──────────────────────────────────────────────────────────
function renderDailyHarvest(rows, summary, cid = 'daily-content', onRefresh = null) {
  const today = new Date().toISOString().split('T')[0];
  const refresh = onRefresh || (() => renderDaily('harvest'));
  const totalHarvested = rows.reduce((s, r) => s + Number(r.quantity), 0);

  $(cid).innerHTML = `
    <div class="cards">
      <div class="mc"><div class="mclbl">Total harvest entries</div><div class="mcval">${rows.length}</div><div class="mcsub cg"><i class="ti ti-axe"></i>records</div></div>
      <div class="mc"><div class="mclbl">Total quantity</div><div class="mcval">${totalHarvested.toLocaleString()}</div><div class="mcsub cg"><i class="ti ti-trees"></i>units</div></div>
      <div class="mc"><div class="mclbl">Species tracked</div><div class="mcval">${Object.keys(summary).length}</div><div class="mcsub bp"><i class="ti ti-leaf"></i>species</div></div>
    </div>
    ${Object.keys(summary).length ? `
    <div class="card">
      <h3><i class="ti ti-trees"></i>Harvest by species</h3>
      <div class="tw"><table class="dt">
        <thead><tr><th>Species</th><th>Total quantity</th></tr></thead>
        <tbody>${Object.entries(summary).map(([sp, qty]) => `<tr>
          <td style="font-weight:500">${sp}</td>
          <td style="font-family:var(--fm)">${Number(qty).toLocaleString()}</td>
        </tr>`).join('')}
        </tbody>
      </table></div>
    </div>` : ''}
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem">
        <h3 style="margin-bottom:0"><i class="ti ti-axe"></i>Harvest log</h3>
        <button class="appbtn" id="newHarvest"><i class="ti ti-plus" style="font-size:12px;vertical-align:-1px"></i> Log harvest</button>
      </div>
      <div class="tw"><table class="dt">
        <thead><tr><th>Date</th><th>Location</th><th>Species</th><th>Quantity</th><th>UoM</th><th>Notes</th><th>Logged by</th><th>Action</th></tr></thead>
        <tbody>
          ${rows.length === 0
            ? '<tr><td colspan="8" style="text-align:center;color:var(--t3);padding:2rem">No harvest records yet. Click "Log harvest" to record a harvest.</td></tr>'
            : rows.map(r => `<tr>
              <td style="font-weight:500">${r.harvest_date}</td>
              <td>${r.location}</td>
              <td><span class="badge bt">${r.species}</span></td>
              <td style="font-family:var(--fm);font-weight:600">${Number(r.quantity).toLocaleString()}</td>
              <td>${r.uom}</td>
              <td style="color:var(--t3)">${r.notes || '—'}</td>
              <td>${r.logged_by || '—'}</td>
              <td style="white-space:nowrap">
                <button class="bs1 hv2-edit" data-id="${r.id}"><i class="ti ti-edit"></i>Edit</button>
                <button class="bs1 hv2-del" data-id="${r.id}" style="color:var(--red)"><i class="ti ti-trash"></i></button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table></div>
    </div>`;

  $('newHarvest').onclick = () => openOverlay('Log Harvest', null, `
    <div class="frow">
      <div class="fg"><label>Harvest date *</label><input id="hv-date" type="date" value="${today}"></div>
      <div class="fg"><label>Location *</label><input id="hv-loc" type="text" placeholder="Forest block / GPS ref"></div>
    </div>
    <div class="frow">
      <div class="fg"><label>Species *</label><input id="hv-species" type="text" placeholder="e.g. Eucalyptus, Pine"></div>
      <div class="fg"><label>Quantity *</label><input id="hv-qty" type="number" min="1" placeholder="0"></div>
      <div class="fg"><label>Unit</label><input id="hv-uom" type="text" value="units" placeholder="units, m³, kg"></div>
    </div>
    <div class="fg"><label>Notes</label><input id="hv-notes" type="text"></div>
    <div class="brow"><button class="bp1" id="ovSave"><i class="ti ti-check"></i>Save</button><button class="bs1" id="ovCancel">Cancel</button></div>`,
    async () => {
      const r = await UFCL.harvestCreate(STORAGE.user.id, {
        harvest_date: $('hv-date').value, location: $('hv-loc').value.trim(),
        species: $('hv-species').value.trim(), quantity: $('hv-qty').value,
        uom: $('hv-uom').value.trim() || 'units', notes: $('hv-notes').value.trim()
      });
      if (!r.ok) { showOverlayError(r.error); return; }
      showOverlaySuccess('Harvest logged.'); await refresh();
    }
  );

  document.querySelectorAll('.hv2-edit').forEach(btn => {
    btn.onclick = () => {
      const r = rows.find(x => x.id === Number(btn.dataset.id));
      if (!r) return;
      openOverlay('Edit Harvest Log', r.species, `
        <div class="frow">
          <div class="fg"><label>Date *</label><input id="hv-date" type="date" value="${r.harvest_date.split('/').reverse().join('-')}"></div>
          <div class="fg"><label>Location *</label><input id="hv-loc" type="text" value="${r.location}"></div>
        </div>
        <div class="frow">
          <div class="fg"><label>Species *</label><input id="hv-species" type="text" value="${r.species}"></div>
          <div class="fg"><label>Quantity *</label><input id="hv-qty" type="number" min="1" value="${r.quantity}"></div>
          <div class="fg"><label>UoM</label><input id="hv-uom" type="text" value="${r.uom}"></div>
        </div>
        <div class="fg"><label>Notes</label><input id="hv-notes" type="text" value="${r.notes||''}"></div>
        <div class="brow"><button class="bp1" id="ovSave"><i class="ti ti-check"></i>Save</button><button class="bs1" id="ovCancel">Cancel</button></div>`,
        async () => {
          const payload = {
            harvest_date: $('hv-date').value, location: $('hv-loc').value.trim(),
            species: $('hv-species').value.trim(), quantity: $('hv-qty').value,
            uom: $('hv-uom').value.trim(), notes: $('hv-notes').value.trim()
          };
          if (isSupervisor()) {
            const r2 = await UFCL.pendingEditsCreate(STORAGE.user.id, {
              action_type: 'edit', entity_type: 'harvest_log',
              entity_id: r.id, entity_ref: `${r.species} — ${r.harvest_date}`, payload
            });
            if (!r2.ok) { showOverlayError(r2.error); return; }
            showOverlaySuccess('Edit request submitted — awaiting manager approval.');
            await refresh();
            return;
          }
          const res2 = await UFCL.harvestUpdate(STORAGE.user.id, r.id, payload);
          if (!res2.ok) { showOverlayError(res2.error); return; }
          showOverlaySuccess('Harvest log updated.'); await refresh();
        });
    };
  });

  document.querySelectorAll('.hv2-del').forEach(btn => {
    btn.onclick = () => {
      const r = rows.find(x => x.id === Number(btn.dataset.id));
      if (!r) return;
      if (isSupervisor()) {
        confirmDelete(`Submit delete request for harvest: <strong>${r.species}</strong> on ${r.harvest_date}? A manager must approve before it is removed.`, async () => {
          const r2 = await UFCL.pendingEditsCreate(STORAGE.user.id, {
            action_type: 'delete', entity_type: 'harvest_log',
            entity_id: r.id, entity_ref: `${r.species} — ${r.harvest_date}`, payload: null
          });
          if (!r2.ok) { showOverlayError(r2.error); return; }
          showOverlaySuccess('Delete request submitted — awaiting manager approval.');
          await refresh();
        });
        return;
      }
      confirmDelete(`Delete harvest log: <strong>${r.species}</strong> at ${r.location} on ${r.harvest_date}?`, async () => {
        const res2 = await UFCL.harvestDelete(STORAGE.user.id, r.id);
        if (!res2.ok) { showOverlayError(res2.error); return; }
        showOverlaySuccess('Harvest log deleted.'); await refresh();
      });
    };
  });
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
        <div class="mcsub ${polesLow ? 'cr' : 'cg'}"><i class="ti ti-package"></i>${Number(stock.polesProduced || 0).toLocaleString()} prod · ${Number(stock.polesSold || 0).toLocaleString()} sold</div>
      </div>
      <div class="mc" style="border-top:3px solid #D97706">
        <div class="mclbl">Kiln-dried in stock</div>
        <div class="mcval" style="color:${stock.kilnDriedStock < 0 ? 'var(--red)' : 'inherit'}">${Number(stock.kilnDriedStock || 0).toLocaleString()}</div>
        <div class="mcsub ca"><i class="ti ti-flame"></i>kiln-dried</div>
      </div>
      <div class="mc" style="border-top:3px solid #2E8B57">
        <div class="mclbl">CCA-treated in stock</div>
        <div class="mcval" style="color:${stock.ccaTreatedStock < 0 ? 'var(--red)' : 'inherit'}">${Number(stock.ccaTreatedStock || 0).toLocaleString()}</div>
        <div class="mcsub cg"><i class="ti ti-droplet"></i>CCA-treated</div>
      </div>
      <div class="mc">
        <div class="mclbl">Untreated in stock</div>
        <div class="mcval" style="color:${stock.untreatedStock < 0 ? 'var(--red)' : 'inherit'}">${Number(stock.untreatedStock || 0).toLocaleString()}</div>
        <div class="mcsub cg"><i class="ti ti-tree"></i>untreated</div>
      </div>
    </div>

    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem">
        <h3 style="margin-bottom:0"><i class="ti ti-shopping-cart"></i>Orders</h3>
        <button class="appbtn" id="newSO"><i class="ti ti-plus" style="font-size:12px;vertical-align:-1px"></i> New order</button>
      </div>
      <div class="tw">
        <table class="dt">
          <thead><tr><th>Order #</th><th>Customer</th><th>Category</th><th>Type</th><th>Size / Spec</th><th>Qty</th><th>Unit (RWF)</th><th>Total (RWF)</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
          <tbody>
            ${rows.length === 0
              ? '<tr><td colspan="11" style="text-align:center;color:var(--t3);padding:2rem">No orders yet.</td></tr>'
              : rows.map((r) => {
                  const subBadge = r.product_sub_type === 'Kiln-dried' ? 'ba' : r.product_sub_type === 'CCA-treated' ? 'bg' : r.product_sub_type === 'Untreated' ? 'bt' : '';
                  return `<tr>
                    <td style="font-family:var(--fm);font-weight:500">${r.order_number}</td>
                    <td>${r.customer_name}</td>
                    <td><span class="badge ${r.product_type === 'Timber' ? 'ba' : 'bb'}">${r.product_type}</span></td>
                    <td>${r.product_sub_type ? `<span class="badge ${subBadge}">${r.product_sub_type}</span>` : '<span style="color:var(--t3)">—</span>'}</td>
                    <td style="font-family:var(--fm)">${r.product_size}</td>
                    <td style="font-weight:500">${Number(r.quantity).toLocaleString()}</td>
                    <td style="font-family:var(--fm)">${Number(r.unit_price).toLocaleString()}</td>
                    <td style="font-family:var(--fm);font-weight:500">${(Number(r.quantity)*Number(r.unit_price)).toLocaleString()}</td>
                    <td><button class="so-status-btn" data-so="${r.id}" data-cur="${r.status||'Pending'}" style="all:unset;cursor:pointer">${soStatusBadge(r.status||'Pending')}</button></td>
                    <td style="color:var(--t3)">${new Date(r.created_at).toLocaleDateString('en-GB')}</td>
                    <td style="white-space:nowrap;display:flex;gap:4px">
                      <button class="bs1 so-edit-btn" data-so="${r.id}"><i class="ti ti-edit"></i>Edit</button>
                      <button class="bs1 so-transport-btn" data-so="${r.id}"><i class="ti ti-truck-loading"></i>Transport</button>
                      <button class="bs1 so-del-btn" data-so="${r.id}" style="color:var(--red)"><i class="ti ti-trash"></i></button>
                    </td>
                  </tr>`;
                }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  $('newSO').onclick = () => {
    openOverlay(
      'New sales order',
      `Stock — Kiln: <strong>${Number(stock.kilnDriedStock||0).toLocaleString()}</strong> &nbsp;CCA: <strong>${Number(stock.ccaTreatedStock||0).toLocaleString()}</strong> &nbsp;Untreated: <strong>${Number(stock.untreatedStock||0).toLocaleString()}</strong> &nbsp;Poles: <strong>${Number(stock.polesStock||0).toLocaleString()}</strong>`,
      `
      <div class="frow">
        <div class="fg"><label>Order number</label><input type="text" placeholder="SO-2026-XXX" id="so-num"></div>
        <div class="fg"><label>Customer name</label><input type="text" placeholder="Customer company" id="so-cust"></div>
      </div>
      <div class="frow">
        <div class="fg">
          <label>Product category</label>
          <select id="so-type"><option value="">— Select —</option><option value="Timber">Timber</option><option value="Poles">Wooden Poles</option></select>
        </div>
        <div class="fg" id="so-sub-row" style="display:none">
          <label>Timber type</label>
          <select id="so-sub"><option value="Kiln-dried">Kiln-dried</option><option value="CCA-treated">CCA-treated</option><option value="Untreated">Untreated (sawn)</option></select>
        </div>
      </div>
      <div class="frow">
        <div class="fg"><label>Size / spec</label><input type="text" id="so-size" placeholder="e.g. 100x200x4m or O255x9m"></div>
        <div class="fg"><label>Quantity</label><input type="number" placeholder="0" min="1" id="so-qty"></div>
      </div>
      <div class="frow">
        <div class="fg"><label>Unit price (RWF)</label><input type="number" placeholder="0" min="0" id="so-price"></div>
        <div class="fg"><label>Notes (optional)</label><input type="text" id="so-notes" placeholder="Delivery or special instructions"></div>
      </div>
      <div class="frow full"><div class="fg"><label>Reason / description</label><input type="text" id="so-reason" placeholder="Required for audit trail"></div></div>
      <div class="brow"><button class="bp1" id="ovSave"><i class="ti ti-device-floppy" style="font-size:13px;vertical-align:-1px"></i> Save order</button><button class="bs1" id="ovCancel">Cancel</button></div>
      `,
      async () => {
        const payload = {
          order_number:      $('so-num').value.trim(),
          customer_name:     $('so-cust').value.trim(),
          product_type:      $('so-type').value,
          product_sub_type:  $('so-type').value === 'Timber' ? $('so-sub').value : null,
          product_size:      $('so-size').value.trim(),
          quantity:          $('so-qty').value,
          unit_price:        $('so-price').value,
          notes:             $('so-notes').value.trim(),
          reason:            $('so-reason').value.trim()
        };
        const r = await UFCL.salesCreate(STORAGE.user.id, payload);
        if (!r.ok) return showOverlayError(r.error || 'Failed to save order.');
        closeOverlay();
        await renderSales();
      }
    );
    setTimeout(() => {
      const soType = $('so-type');
      const soSubRow = $('so-sub-row');
      if (soType && soSubRow) soType.onchange = () => {
        soSubRow.style.display = soType.value === 'Timber' ? '' : 'none';
      };
    }, 30);
  };

  const STATUSES = ['Pending', 'Confirmed', 'Dispatched', 'Delivered', 'Cancelled'];

  $('page-sales').querySelectorAll('.so-edit-btn').forEach((btn) => {
    btn.onclick = () => {
      const r = rows.find(x => Number(x.id) === Number(btn.dataset.so));
      if (!r) return;
      openOverlay('Edit sales order', r.order_number, `
        <div class="frow">
          <div class="fg"><label>Order number</label><input id="soe-num" type="text" value="${r.order_number}"></div>
          <div class="fg"><label>Customer name</label><input id="soe-cust" type="text" value="${r.customer_name}"></div>
        </div>
        <div class="frow">
          <div class="fg"><label>Product category</label>
            <select id="soe-type"><option value="Timber" ${r.product_type==='Timber'?'selected':''}>Timber</option><option value="Poles" ${r.product_type==='Poles'?'selected':''}>Wooden Poles</option></select>
          </div>
          <div class="fg"><label>Timber type</label>
            <select id="soe-sub">
              <option value="Kiln-dried" ${r.product_sub_type==='Kiln-dried'?'selected':''}>Kiln-dried</option>
              <option value="CCA-treated" ${r.product_sub_type==='CCA-treated'?'selected':''}>CCA-treated</option>
              <option value="Untreated" ${r.product_sub_type==='Untreated'?'selected':''}>Untreated</option>
            </select>
          </div>
        </div>
        <div class="frow">
          <div class="fg"><label>Size / spec</label><input id="soe-size" type="text" value="${r.product_size}"></div>
          <div class="fg"><label>Quantity</label><input id="soe-qty" type="number" min="1" value="${r.quantity}"></div>
        </div>
        <div class="frow">
          <div class="fg"><label>Unit price (RWF)</label><input id="soe-price" type="number" min="0" value="${r.unit_price}"></div>
          <div class="fg"><label>Notes</label><input id="soe-notes" type="text" value="${r.notes||''}"></div>
        </div>
        <div class="brow"><button class="bp1" id="ovSave"><i class="ti ti-device-floppy"></i>Save</button><button class="bs1" id="ovCancel">Cancel</button></div>`,
        async () => {
          const res2 = await UFCL.salesUpdate(STORAGE.user.id, r.id, {
            order_number: $('soe-num').value.trim(),
            customer_name: $('soe-cust').value.trim(),
            product_type: $('soe-type').value,
            product_sub_type: $('soe-type').value === 'Timber' ? $('soe-sub').value : null,
            product_size: $('soe-size').value.trim(),
            quantity: $('soe-qty').value,
            unit_price: $('soe-price').value,
            notes: $('soe-notes').value.trim()
          });
          if (!res2.ok) { showOverlayError(res2.error); return; }
          showOverlaySuccess('Order updated.'); await renderSales();
        });
    };
  });

  $('page-sales').querySelectorAll('.so-del-btn').forEach((btn) => {
    btn.onclick = () => {
      const r = rows.find(x => Number(x.id) === Number(btn.dataset.so));
      if (!r) return;
      confirmDelete(`Delete order <strong>${r.order_number}</strong> for ${r.customer_name}?`, async () => {
        const res2 = await UFCL.salesDelete(STORAGE.user.id, r.id);
        if (!res2.ok) { showOverlayError(res2.error); return; }
        showOverlaySuccess('Order deleted.'); await renderSales();
      });
    };
  });

  $('page-sales').querySelectorAll('.so-transport-btn').forEach((btn) => {
    btn.onclick = async () => {
      const soId = Number(btn.dataset.so);
      const tcRes = await UFCL.transportJobsList(STORAGE.user.id);
      if (!tcRes.ok) { alert(tcRes.error); return; }
      openTransportJobOverlay(tcRes.companies, tcRes.salesOrders, soId, () => renderSales());
    };
  });

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
  const [res, machinesRes] = await Promise.all([
    UFCL.productsList(STORAGE.user.id, currentFilter),
    UFCL.machinesForDropdown(STORAGE.user.id)
  ]);
  if (!res.ok) return renderDenied('products', res.error);
  const rows = res.rows || [];
  const machines = machinesRes.ok ? machinesRes.rows : [];
  const isAdmin = !!res.isAdmin;

  const activeCount  = rows.filter((p) => p.active).length;
  const kilnCount    = rows.filter((p) => p.sub_type === 'Kiln-dried').length;
  const ccaCount     = rows.filter((p) => p.sub_type === 'CCA-treated').length;
  const untreatedCnt = rows.filter((p) => p.sub_type === 'Untreated').length;
  const polesCount   = rows.filter((p) => p.type === 'Poles').length;
  const cols = isAdmin ? 10 : 9;
  const machineOpts = machines.map(m => `<option value="${m.name}">${m.name} (${m.category_name})</option>`).join('');

  $('page-products').innerHTML = `
    <div class="ptitle">Product catalog</div>
    <div class="psub">Timber and poles available for production and dispatch. All changes are logged to the audit trail.</div>

    <div class="cards">
      <div class="mc"><div class="mclbl">Kiln-dried</div><div class="mcval">${kilnCount}</div><div class="mcsub ca"><i class="ti ti-flame"></i>sizes</div></div>
      <div class="mc"><div class="mclbl">CCA-treated</div><div class="mcval">${ccaCount}</div><div class="mcsub cg"><i class="ti ti-droplet"></i>sizes</div></div>
      <div class="mc"><div class="mclbl">Untreated</div><div class="mcval">${untreatedCnt}</div><div class="mcsub bt"><i class="ti ti-tree"></i>sizes</div></div>
      <div class="mc"><div class="mclbl">Poles</div><div class="mcval">${polesCount}</div><div class="mcsub bp"><i class="ti ti-current-location"></i>specs</div></div>
      <div class="mc"><div class="mclbl">Active</div><div class="mcval">${activeCount}</div><div class="mcsub cg"><i class="ti ti-circle-check"></i>in use</div></div>
    </div>

    <div class="card">
      <h3><i class="ti ti-plus"></i>Add product</h3>
      <div class="frow">
        <div class="fg">
          <label>Category</label>
          <select id="np-type">
            <option value="Timber">Timber</option>
            <option value="Poles">Wooden Poles</option>
          </select>
        </div>
        <div class="fg" id="np-sub-row">
          <label>Timber type</label>
          <select id="np-sub">
            <option value="Kiln-dried">Kiln-dried</option>
            <option value="CCA-treated">CCA-treated</option>
            <option value="Untreated">Untreated (sawn)</option>
          </select>
        </div>
      </div>
      <div class="frow three" id="np-dim-timber">
        <div class="fg"><label>Width (mm)</label><input type="number" id="np-w" placeholder="e.g. 100" min="1"></div>
        <div class="fg"><label>Height (mm)</label><input type="number" id="np-h" placeholder="e.g. 200" min="1"></div>
        <div class="fg"><label>Length (m)</label><input type="number" id="np-lt" placeholder="e.g. 4" min="0.1" step="0.5"></div>
      </div>
      <div class="frow" id="np-dim-poles" style="display:none">
        <div class="fg"><label>Diameter (mm)</label><input type="number" id="np-d" placeholder="e.g. 255" min="1"></div>
        <div class="fg"><label>Length (m)</label><input type="number" id="np-lp" placeholder="e.g. 9" min="0.5" step="0.5"></div>
      </div>
      <div class="frow three">
        <div class="fg"><label>Size preview</label><input type="text" id="np-size-preview" readonly placeholder="Auto-generated from dimensions" style="background:var(--surf);color:var(--t2)"></div>
        <div class="fg"><label>Machine</label><select id="np-machine"><option value="">— None / multiple —</option>${machineOpts}</select></div>
        <div class="fg"><label>Customer ref</label><input type="text" id="np-ref" placeholder="e.g. SO-2026-120 (optional)"></div>
      </div>
      <div class="frow full"><div class="fg"><label>Reason for adding</label><textarea id="np-reason" rows="2" placeholder="Briefly explain the business need — required for audit…"></textarea></div></div>
      <div class="brow"><button class="bp1" id="np-save"><i class="ti ti-circle-check" style="font-size:13px;vertical-align:-1px"></i> Add product</button></div>
      <div class="lerr" id="np-err"></div>
    </div>

    <div class="fchips" id="prodFilter" data-v="${currentFilter}">
      <button class="fchip ${currentFilter === 'All' ? 'active' : ''}" data-f="All">All</button>
      <button class="fchip ${currentFilter === 'Kiln-dried' ? 'active' : ''}" data-f="Kiln-dried">Kiln-dried</button>
      <button class="fchip ${currentFilter === 'CCA-treated' ? 'active' : ''}" data-f="CCA-treated">CCA-treated</button>
      <button class="fchip ${currentFilter === 'Untreated' ? 'active' : ''}" data-f="Untreated">Untreated</button>
      <button class="fchip ${currentFilter === 'Poles' ? 'active' : ''}" data-f="Poles">Poles</button>
      <button class="fchip ${currentFilter === 'Active' ? 'active' : ''}" data-f="Active">Active only</button>
    </div>

    <div class="card">
      <h3><i class="ti ti-table"></i>Products</h3>
      <div class="tw">
        <table class="dt">
          <thead><tr><th>Category</th><th>Type</th><th>Dimensions</th><th>Machine</th><th>Status</th><th>Added by</th><th>Date</th><th>Reason</th><th>Ref</th>${isAdmin ? '<th></th>' : ''}</tr></thead>
          <tbody>
            ${rows.length === 0
              ? `<tr><td colspan="${cols}" style="text-align:center;color:var(--t3);padding:2rem">No products match this filter.</td></tr>`
              : rows.map((p) => {
                  const subBadge = p.sub_type === 'Kiln-dried' ? 'ba' : p.sub_type === 'CCA-treated' ? 'bg' : p.sub_type === 'Untreated' ? 'bt' : '';
                  return `<tr>
                    <td><span class="badge ${p.type === 'Timber' ? 'ba' : 'bb'}">${p.type}</span></td>
                    <td>${p.sub_type ? `<span class="badge ${subBadge}">${p.sub_type}</span>` : '<span style="color:var(--t3)">—</span>'}</td>
                    <td style="font-family:var(--fm);font-weight:500">${p.size}</td>
                    <td style="color:var(--t3)">${p.machine || '—'}</td>
                    <td><span class="badge ${p.active ? 'bg' : 'br'}">${p.active ? 'Active' : 'Inactive'}</span></td>
                    <td>${p.by || '—'}</td>
                    <td style="font-family:var(--fm);color:var(--t3)">${p.date}</td>
                    <td style="color:var(--t3);max-width:180px">${p.reason || '—'}</td>
                    <td style="font-family:var(--fm);color:var(--t3)">${p.ref || '—'}</td>
                    ${isAdmin ? `<td><button class="${p.active ? 'bdanger' : 'bs1'}" style="font-size:11px;padding:4px 10px" data-tog="${p.id}" data-active="${p.active}" data-size="${p.size}">${p.active ? 'Deactivate' : 'Reactivate'}</button></td>` : ''}
                  </tr>`;
                }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // dimension helper
  const updateSizePreview = () => {
    const type = $('np-type').value;
    const preview = $('np-size-preview');
    if (type === 'Timber') {
      const w = $('np-w').value, h = $('np-h').value, l = $('np-lt').value;
      preview.value = (w && h && l) ? `${w}x${h}x${l}m` : '';
    } else {
      const d = $('np-d').value, l = $('np-lp').value;
      preview.value = (d && l) ? `O${d}x${l}m` : '';
    }
  };

  const toggleProductForm = () => {
    const isTimber = $('np-type').value === 'Timber';
    $('np-sub-row').style.display    = isTimber ? '' : 'none';
    $('np-dim-timber').style.display = isTimber ? '' : 'none';
    $('np-dim-poles').style.display  = isTimber ? 'none' : '';
    updateSizePreview();
  };

  $('np-type').onchange = toggleProductForm;
  ['np-w','np-h','np-lt','np-d','np-lp'].forEach((id) => {
    const el = $(id); if (el) el.oninput = updateSizePreview;
  });

  const npErr = $('np-err');
  $('np-save').onclick = async () => {
    npErr.style.display = 'none';
    const type = $('np-type').value;
    const isTimber = type === 'Timber';
    const size = $('np-size-preview').value.trim();
    const payload = {
      type,
      sub_type:    isTimber ? $('np-sub').value : null,
      size,
      width_mm:    isTimber ? $('np-w').value  : null,
      height_mm:   isTimber ? $('np-h').value  : null,
      length_m:    isTimber ? $('np-lt').value : $('np-lp').value,
      diameter_mm: !isTimber ? $('np-d').value : null,
      machine: $('np-machine').value || null,
      ref:    $('np-ref').value.trim(),
      reason: $('np-reason').value.trim()
    };
    if (!size) { npErr.textContent = 'Enter dimensions to generate the size spec.'; npErr.style.display = 'block'; return; }
    if (!payload.reason) { npErr.textContent = 'A reason is required for the audit trail.'; npErr.style.display = 'block'; return; }
    const r = await UFCL.productsCreate(STORAGE.user.id, payload);
    if (!r.ok) { npErr.textContent = r.error || 'Failed to add product.'; npErr.style.display = 'block'; return; }
    await renderProducts();
  };

  $('page-products').querySelectorAll('#prodFilter .fchip').forEach((b) => {
    b.onclick = async () => { $('prodFilter').dataset.v = b.dataset.f; await renderProducts(); };
  });

  $('page-products').querySelectorAll('[data-tog]').forEach((btn) => {
    btn.onclick = () => {
      const id = Number(btn.dataset.tog);
      const active = btn.dataset.active === 'true';
      const size = btn.dataset.size;
      openOverlay(
        active ? 'Deactivate product' : 'Reactivate product',
        active ? `<strong>${size}</strong> will be hidden from new orders.` : `<strong>${size}</strong> will be available again.`,
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
  const liLow  = rows.filter(r => Number(r.stock) <= Number(r.min_stock)).length;
  const liVal  = rows.reduce((s, r) => s + Number(r.stock) * Number(r.unit_cost), 0);
  const liCats = new Set(rows.map(r => r.category)).size;

  $('page-logistics').innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:1.5rem">
      <div>
        <div class="ptitle">Spare Parts & Materials</div>
        <div class="psub">Track spare parts, consumables, lubricants and tools. Items at or below minimum stock are flagged for reorder.</div>
      </div>
      <button class="bp1" id="newLI" style="flex-shrink:0;white-space:nowrap"><i class="ti ti-plus"></i>Add item</button>
    </div>
    <div class="cards" style="margin-bottom:1.25rem">
      <div class="mc"><div class="mclbl">Total items</div><div class="mcval">${rows.length}</div><div class="mcsub cg"><i class="ti ti-box"></i>in catalog</div></div>
      <div class="mc"><div class="mclbl">Reorder needed</div><div class="mcval" style="${liLow>0?'color:var(--red)':''}">${liLow}</div><div class="mcsub ${liLow>0?'cr':'cg'}"><i class="ti ti-alert-triangle"></i>items</div></div>
      <div class="mc"><div class="mclbl">Stock value (RWF)</div><div class="mcval">${Math.round(liVal).toLocaleString()}</div><div class="mcsub bp"><i class="ti ti-coin"></i>at cost</div></div>
      <div class="mc"><div class="mclbl">Categories</div><div class="mcval">${liCats}</div><div class="mcsub cg"><i class="ti ti-tag"></i>types</div></div>
    </div>
    ${liLow>0?`<div style="display:flex;align-items:center;gap:.625rem;padding:.75rem 1rem;background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.2);border-radius:7px;margin-bottom:1.25rem;font-size:13px;color:var(--red)"><i class="ti ti-alert-triangle" style="font-size:16px;flex-shrink:0"></i><strong style="margin-right:.25rem">${liLow} item${liLow>1?'s':''}</strong> at or below minimum stock — review and reorder.</div>`:''}
    <div class="card" style="padding:0">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;border-bottom:1px solid var(--bdr)">
        <h3 style="margin:0"><i class="ti ti-box"></i>Items register</h3>
        <span style="font-size:12px;color:var(--t3)">${rows.length} item${rows.length!==1?'s':''}</span>
      </div>
      <div class="tw">
        <table class="dt">
          <thead><tr><th>Category</th><th>Name</th><th>SKU</th><th>UoM</th><th>Stock</th><th>Min</th><th>Unit cost (RWF)</th><th>Stock value (RWF)</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${rows.length ? rows.map((r) => {
              const low = Number(r.stock) <= Number(r.min_stock);
              const out = Number(r.stock) === 0;
              return `<tr>
                <td><span class="badge bt">${r.category}</span></td>
                <td style="font-weight:500">${r.name}</td>
                <td style="font-family:var(--fm);color:var(--t3)">${r.sku||'—'}</td>
                <td>${r.uom}</td>
                <td style="${out?'color:var(--red);font-weight:700':low?'color:var(--amber);font-weight:600':''}">${r.stock}</td>
                <td style="color:var(--t3)">${r.min_stock}</td>
                <td style="font-family:var(--fm)">${Number(r.unit_cost).toLocaleString()}</td>
                <td style="font-family:var(--fm)">${Math.round(Number(r.stock)*Number(r.unit_cost)).toLocaleString()}</td>
                <td><span class="badge ${out?'br':low?'ba':'bg'}">${out?'Out of stock':low?'Reorder':'OK'}</span></td>
                <td style="white-space:nowrap">
                  <button class="bs1 li-edit" data-id="${r.id}"><i class="ti ti-edit"></i>Edit</button>
                  <button class="bs1 li-del" data-id="${r.id}" style="color:var(--red)"><i class="ti ti-trash"></i></button>
                </td>
              </tr>`;
            }).join('') : '<tr><td colspan="10" style="text-align:center;color:var(--t3);padding:3rem"><i class="ti ti-box" style="font-size:2rem;display:block;margin-bottom:.5rem;opacity:.35"></i>No items yet. Click <strong>Add item</strong> to get started.</td></tr>'}
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

  document.querySelectorAll('.li-edit').forEach(btn => {
    btn.onclick = () => {
      const r = rows.find(x => x.id === Number(btn.dataset.id));
      if (!r) return;
      openOverlay('Edit logistics item', r.name, `
        <div class="frow">
          <div class="fg"><label>Category</label><select id="lie-cat"><option ${r.category==='Spare Part'?'selected':''}>Spare Part</option><option ${r.category==='Consumable'?'selected':''}>Consumable</option><option ${r.category==='Lubricant'?'selected':''}>Lubricant</option><option ${r.category==='Tool'?'selected':''}>Tool</option><option ${r.category==='Safety Gear'?'selected':''}>Safety Gear</option><option ${r.category==='Other'?'selected':''}>Other</option></select></div>
          <div class="fg"><label>Name *</label><input id="lie-name" type="text" value="${r.name}"></div>
        </div>
        <div class="frow">
          <div class="fg"><label>SKU</label><input id="lie-sku" type="text" value="${r.sku||''}"></div>
          <div class="fg"><label>UoM</label><select id="lie-uom"><option ${r.uom==='EA'?'selected':''}>EA</option><option ${r.uom==='L'?'selected':''}>L</option><option ${r.uom==='KG'?'selected':''}>KG</option><option ${r.uom==='M'?'selected':''}>M</option><option ${r.uom==='BX'?'selected':''}>BX</option><option ${r.uom==='SET'?'selected':''}>SET</option></select></div>
        </div>
        <div class="frow">
          <div class="fg"><label>Unit cost (RWF)</label><input id="lie-cost" type="number" min="0" value="${r.unit_cost}"></div>
          <div class="fg"><label>Stock</label><input id="lie-stock" type="number" min="0" value="${r.stock}"></div>
          <div class="fg"><label>Min stock</label><input id="lie-min" type="number" min="0" value="${r.min_stock}"></div>
        </div>
        <div class="brow"><button class="bp1" id="ovSave"><i class="ti ti-device-floppy"></i>Save</button><button class="bs1" id="ovCancel">Cancel</button></div>`,
        async () => {
          const payload = {
            category: $('lie-cat').value, name: $('lie-name').value.trim(),
            sku: $('lie-sku').value.trim(), uom: $('lie-uom').value,
            unit_cost: $('lie-cost').value, stock: $('lie-stock').value, min_stock: $('lie-min').value
          };
          if (isSupervisor()) {
            const r2 = await UFCL.pendingEditsCreate(STORAGE.user.id, {
              action_type: 'edit', entity_type: 'logistics_item',
              entity_id: r.id, entity_ref: r.name, payload
            });
            if (!r2.ok) { showOverlayError(r2.error); return; }
            showOverlaySuccess('Edit request submitted — awaiting manager approval.');
            await renderLogistics();
            return;
          }
          const res2 = await UFCL.logisticsUpdate(STORAGE.user.id, r.id, payload);
          if (!res2.ok) { showOverlayError(res2.error); return; }
          showOverlaySuccess('Item updated.'); await renderLogistics();
        });
    };
  });

  document.querySelectorAll('.li-del').forEach(btn => {
    btn.onclick = () => {
      const r = rows.find(x => x.id === Number(btn.dataset.id));
      if (!r) return;
      if (isSupervisor()) {
        confirmDelete(`Submit delete request for <strong>${r.name}</strong>? A manager must approve before it is removed.`, async () => {
          const r2 = await UFCL.pendingEditsCreate(STORAGE.user.id, {
            action_type: 'delete', entity_type: 'logistics_item',
            entity_id: r.id, entity_ref: r.name, payload: null
          });
          if (!r2.ok) { showOverlayError(r2.error); return; }
          showOverlaySuccess('Delete request submitted — awaiting manager approval.');
          await renderLogistics();
        });
        return;
      }
      confirmDelete(`Delete logistics item <strong>${r.name}</strong>?`, async () => {
        const res2 = await UFCL.logisticsDelete(STORAGE.user.id, r.id);
        if (!res2.ok) { showOverlayError(res2.error); return; }
        showOverlaySuccess('Item deleted.'); await renderLogistics();
      });
    };
  });

  await insertPendingPanel($('page-logistics'), ['logistics_item'], renderLogistics);
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
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:1.5rem">
      <div>
        <div class="ptitle">Inventory Overview</div>
        <div class="psub">Live stock levels across all spare parts and materials. Items flagged in red require immediate reorder attention.</div>
      </div>
    </div>
    <div class="cards" style="margin-bottom:1.25rem">
      <div class="mc"><div class="mclbl">Total SKUs</div><div class="mcval">${rows.length}</div><div class="mcsub cg"><i class="ti ti-stack"></i>tracked</div></div>
      <div class="mc"><div class="mclbl">Reorder alerts</div><div class="mcval" style="${lowRows.length>0?'color:var(--red)':''}">${lowRows.length}</div><div class="mcsub ${lowRows.length>0?'cr':'cg'}"><i class="ti ti-alert-triangle"></i>items</div></div>
      <div class="mc"><div class="mclbl">Healthy stock</div><div class="mcval">${okRows.length}</div><div class="mcsub cg"><i class="ti ti-circle-check"></i>items</div></div>
      <div class="mc"><div class="mclbl">Total value (RWF)</div><div class="mcval">${Math.round(totalValue).toLocaleString()}</div><div class="mcsub bp"><i class="ti ti-coin"></i>at cost</div></div>
    </div>
    ${lowRows.length ? `
    <div style="margin-bottom:1.25rem;border:1px solid rgba(239,68,68,.25);border-radius:8px;overflow:hidden">
      <div style="display:flex;align-items:center;gap:.5rem;padding:.75rem 1rem;background:rgba(239,68,68,.07);border-bottom:1px solid rgba(239,68,68,.15)">
        <i class="ti ti-alert-triangle" style="color:var(--red);font-size:16px"></i>
        <span style="font-weight:600;color:var(--red);font-size:13px">Reorder required — ${lowRows.length} item${lowRows.length>1?'s':''}</span>
      </div>
      <div class="tw">
        <table class="dt">
          <thead><tr><th>Category</th><th>Name</th><th>SKU</th><th>Current stock</th><th>Min stock</th><th>UoM</th></tr></thead>
          <tbody>
            ${lowRows.map((r) => `<tr>
              <td><span class="badge bt">${r.category}</span></td>
              <td style="font-weight:500">${r.name}</td>
              <td style="font-family:var(--fm);color:var(--t3)">${r.sku||'—'}</td>
              <td style="color:var(--red);font-weight:700">${r.stock}</td>
              <td>${r.min_stock}</td>
              <td>${r.uom}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>` : ''}
    <div class="card" style="padding:0">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;border-bottom:1px solid var(--bdr)">
        <h3 style="margin:0"><i class="ti ti-stack"></i>Full stock register</h3>
        <span style="font-size:12px;color:var(--t3)">${rows.length} item${rows.length!==1?'s':''}</span>
      </div>
      <div class="tw">
        <table class="dt">
          <thead><tr><th>Category</th><th>Name</th><th>SKU</th><th>Stock</th><th>Min</th><th>UoM</th><th>Unit cost (RWF)</th><th>Stock value (RWF)</th><th>Status</th></tr></thead>
          <tbody>
            ${rows.length
              ? rows.map((r) => {
                  const low = Number(r.stock) <= Number(r.min_stock);
                  const out = Number(r.stock) === 0;
                  const stockVal = Number(r.stock) * Number(r.unit_cost);
                  return `<tr>
                    <td><span class="badge bt">${r.category}</span></td>
                    <td style="font-weight:500">${r.name}</td>
                    <td style="font-family:var(--fm);color:var(--t3)">${r.sku || '—'}</td>
                    <td style="${out?'color:var(--red);font-weight:700':low?'color:var(--amber);font-weight:600':''}">${r.stock}</td>
                    <td style="color:var(--t3)">${r.min_stock}</td>
                    <td>${r.uom}</td>
                    <td style="font-family:var(--fm)">${Number(r.unit_cost).toLocaleString()}</td>
                    <td style="font-family:var(--fm)">${Math.round(stockVal).toLocaleString()}</td>
                    <td><span class="badge ${out?'br':low?'ba':'bg'}">${out?'Out of stock':low?'Reorder':'OK'}</span></td>
                  </tr>`;
                }).join('')
              : '<tr><td colspan="9" style="text-align:center;color:var(--t3);padding:2rem">No items found. Add items via <strong>Spare Parts</strong>.</td></tr>'}
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

// ── Warehouses ────────────────────────────────────────────────────────────────

async function renderWarehouses() {
  const res = await UFCL.warehousesList(STORAGE.user.id);
  if (!res.ok) return renderDenied('warehouses', res.error);
  const rows = res.rows || [];

  const whActive = rows.filter(r=>r.active).length;
  const whCap    = rows.reduce((s,r)=>s+Number(r.capacity||0),0);

  $('page-warehouses').innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:1.5rem">
      <div>
        <div class="ptitle">Warehouses</div>
        <div class="psub">Manage your storage network — add locations, track capacities, and activate or deactivate sites.</div>
      </div>
      <button class="bp1" id="whAdd" style="flex-shrink:0;white-space:nowrap"><i class="ti ti-plus"></i>Add warehouse</button>
    </div>
    <div class="cards" style="margin-bottom:1.25rem">
      <div class="mc"><div class="mclbl">Locations</div><div class="mcval">${rows.length}</div><div class="mcsub cg"><i class="ti ti-building-warehouse"></i>total</div></div>
      <div class="mc"><div class="mclbl">Active</div><div class="mcval">${whActive}</div><div class="mcsub cg"><i class="ti ti-circle-check"></i>in use</div></div>
      <div class="mc"><div class="mclbl">Inactive</div><div class="mcval">${rows.length-whActive}</div><div class="mcsub ca"><i class="ti ti-circle-x"></i>offline</div></div>
      <div class="mc"><div class="mclbl">Total capacity</div><div class="mcval">${whCap.toLocaleString()}</div><div class="mcsub bp"><i class="ti ti-database"></i>units</div></div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem">
      ${rows.length ? rows.map(r => `
        <div style="background:var(--surf);border:1px solid var(--bdr);border-radius:10px;padding:1.25rem;display:flex;flex-direction:column;gap:.75rem">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem">
            <div>
              <div style="font-weight:600;font-size:15px">${r.name}</div>
              <div style="font-size:12px;color:var(--t3);margin-top:2px">${r.location||'No location set'}</div>
            </div>
            <span class="badge ${r.active?'bg':'br'}">${r.active?'Active':'Inactive'}</span>
          </div>
          <div style="display:flex;gap:1.5rem">
            <div><div style="font-size:11px;color:var(--t3);text-transform:uppercase;letter-spacing:.04em">Capacity</div><div style="font-weight:600;font-family:var(--fm)">${r.capacity?Number(r.capacity).toLocaleString():'—'}</div></div>
          </div>
          ${r.notes?`<div style="font-size:12px;color:var(--t3);padding:.5rem .75rem;background:var(--bg2);border-radius:5px">${r.notes}</div>`:''}
          <div style="display:flex;gap:.5rem;margin-top:auto;padding-top:.25rem;border-top:1px solid var(--bdr)">
            <button class="bs1 wh-edit" data-id="${r.id}" style="flex:1;justify-content:center"><i class="ti ti-edit"></i>Edit</button>
            <button class="bs1 wh-del" data-id="${r.id}" style="color:var(--red);padding:6px 10px"><i class="ti ti-trash"></i></button>
          </div>
        </div>`).join('')
      : `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--t3)"><i class="ti ti-building-warehouse" style="font-size:2rem;display:block;margin-bottom:.5rem;opacity:.35"></i>No warehouses yet. Click <strong>Add warehouse</strong> to create your first location.</div>`}
    </div>
  `;

  $('whAdd').onclick = () => openOverlay('Add warehouse', null, `
    <div class="frow">
      <div class="fg"><label>Name *</label><input id="wh-name" type="text" placeholder="e.g. Main Warehouse"></div>
      <div class="fg"><label>Location</label><input id="wh-location" type="text" placeholder="Site or address"></div>
    </div>
    <div class="frow">
      <div class="fg"><label>Capacity (units)</label><input id="wh-cap" type="number" min="0" placeholder="0"></div>
      <div class="fg"><label>Notes</label><input id="wh-notes" type="text"></div>
    </div>
    <div class="brow"><button class="bp1" id="ovSave"><i class="ti ti-check"></i>Save</button>
    <button class="bs1" id="ovCancel">Cancel</button></div>`, async () => {
    const res2 = await UFCL.warehousesCreate(STORAGE.user.id, {
      name: $('wh-name').value.trim(),
      location: $('wh-location').value.trim(),
      capacity: $('wh-cap').value,
      notes: $('wh-notes').value.trim()
    });
    if (!res2.ok) { showOverlayError(res2.error); return; }
    showOverlaySuccess('Warehouse added.');
    await renderWarehouses();
  });

  document.querySelectorAll('.wh-del').forEach(btn => {
    btn.onclick = () => {
      const r = rows.find(x => x.id === Number(btn.dataset.id));
      if (!r) return;
      confirmDelete(`Delete warehouse <strong>${r.name}</strong>? All stock levels in this warehouse will also be removed.`, async () => {
        const res2 = await UFCL.warehousesDelete(STORAGE.user.id, r.id);
        if (!res2.ok) { showOverlayError(res2.error); return; }
        showOverlaySuccess('Warehouse deleted.'); await renderWarehouses();
      });
    };
  });

  document.querySelectorAll('.wh-edit').forEach(btn => {
    btn.onclick = () => {
      const row = rows.find(r => r.id === Number(btn.dataset.id));
      if (!row) return;
      openOverlay('Edit warehouse', row.name, `
        <div class="frow">
          <div class="fg"><label>Name *</label><input id="whe-name" type="text" value="${row.name}"></div>
          <div class="fg"><label>Location</label><input id="whe-location" type="text" value="${row.location||''}"></div>
        </div>
        <div class="frow">
          <div class="fg"><label>Capacity</label><input id="whe-cap" type="number" min="0" value="${row.capacity||''}"></div>
          <div class="fg"><label>Notes</label><input id="whe-notes" type="text" value="${row.notes||''}"></div>
        </div>
        <div class="fg"><label>Status</label>
          <select id="whe-active"><option value="true" ${row.active?'selected':''}>Active</option><option value="false" ${!row.active?'selected':''}>Inactive</option></select>
        </div>
        <div class="brow"><button class="bp1" id="ovSave"><i class="ti ti-check"></i>Save</button>
        <button class="bs1" id="ovCancel">Cancel</button></div>`, async () => {
        const res2 = await UFCL.warehousesUpdate(STORAGE.user.id, row.id, {
          name: $('whe-name').value.trim(),
          location: $('whe-location').value.trim(),
          capacity: $('whe-cap').value,
          notes: $('whe-notes').value.trim(),
          active: $('whe-active').value === 'true'
        });
        if (!res2.ok) { showOverlayError(res2.error); return; }
        showOverlaySuccess('Warehouse updated.');
        await renderWarehouses();
      });
    };
  });
}

// ── Stock Catalog ─────────────────────────────────────────────────────────────

const STOCK_CATEGORIES = ['Timber', 'Poles', 'Fuel', 'Spare Parts', 'Tools', 'Packaging', 'Raw Materials', 'Other'];

async function renderStockItems() {
  const res = await UFCL.stockItemsList(STORAGE.user.id);
  if (!res.ok) return renderDenied('stock-items', res.error);
  const rows = res.rows || [];
  const warehouses = res.warehouses || [];

  const lowRows = rows.filter(r => r.total_stock <= Number(r.min_stock));
  const totalValue = rows.reduce((s,r) => s + Number(r.total_stock) * Number(r.unit_cost), 0);

  const catTotals = {};
  for (const r of rows) {
    catTotals[r.category] = (catTotals[r.category] || 0) + 1;
  }

  $('page-stock-items').innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:1.5rem">
      <div>
        <div class="ptitle">Stock Catalog</div>
        <div class="psub">Maintain your master item list with categories, costs, and warehouse-level stock tracking.</div>
      </div>
      <button class="bp1" id="siAdd" style="flex-shrink:0;white-space:nowrap"><i class="ti ti-plus"></i>Add item</button>
    </div>
    <div class="cards" style="margin-bottom:1.25rem">
      <div class="mc"><div class="mclbl">Total SKUs</div><div class="mcval">${rows.length}</div><div class="mcsub cg"><i class="ti ti-package"></i>catalog</div></div>
      <div class="mc"><div class="mclbl">Alerts</div><div class="mcval" style="${lowRows.length>0?'color:var(--red)':''}">${lowRows.length}</div><div class="mcsub ${lowRows.length>0?'cr':'cg'}"><i class="ti ti-alert-triangle"></i>low stock</div></div>
      <div class="mc"><div class="mclbl">Stock value (RWF)</div><div class="mcval">${Math.round(totalValue).toLocaleString()}</div><div class="mcsub bp"><i class="ti ti-coin"></i>at cost</div></div>
      <div class="mc"><div class="mclbl">Categories</div><div class="mcval">${Object.keys(catTotals).length}</div><div class="mcsub cg"><i class="ti ti-tag"></i>types</div></div>
    </div>
    ${lowRows.length ? `<div style="display:flex;align-items:center;gap:.625rem;padding:.75rem 1rem;background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.2);border-radius:7px;margin-bottom:1.25rem;font-size:13px;color:var(--red)"><i class="ti ti-alert-triangle" style="font-size:16px;flex-shrink:0"></i><strong style="margin-right:.25rem">${lowRows.length} item${lowRows.length>1?'s':''}</strong> require reorder — check minimum stock levels.</div>` : ''}
    <div class="card" style="padding:0">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;border-bottom:1px solid var(--bdr)">
        <h3 style="margin:0"><i class="ti ti-package"></i>Item register</h3>
        <span style="font-size:12px;color:var(--t3)">${rows.length} item${rows.length!==1?'s':''}</span>
      </div>
      <div class="tw"><table class="dt">
        <thead><tr><th>Category</th><th>Name</th><th>SKU</th><th>UoM</th><th>Stock</th><th>Min / Max</th><th>Unit cost (RWF)</th><th>Value (RWF)</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${rows.length ? rows.map(r => {
          const low = r.total_stock <= Number(r.min_stock);
          const out = r.total_stock === 0;
          const over = r.max_stock && r.total_stock > Number(r.max_stock);
          const status = out ? 'Out of stock' : low ? 'Reorder' : over ? 'Overstock' : 'OK';
          const cls = out||low ? 'br' : over ? 'ba' : 'bg';
          return `<tr>
            <td><span class="badge bt">${r.category}</span></td>
            <td style="font-weight:500">${r.name}</td>
            <td style="font-family:var(--fm);color:var(--t3)">${r.sku||'—'}</td>
            <td>${r.uom}</td>
            <td style="${out?'color:var(--red);font-weight:700':low?'color:var(--amber);font-weight:600':''}">${r.total_stock}</td>
            <td style="font-family:var(--fm);color:var(--t3)">${r.min_stock} / ${r.max_stock||'∞'}</td>
            <td style="font-family:var(--fm)">${Number(r.unit_cost).toLocaleString()}</td>
            <td style="font-family:var(--fm)">${Math.round(r.total_stock*Number(r.unit_cost)).toLocaleString()}</td>
            <td><span class="badge ${cls}">${status}</span></td>
            <td style="white-space:nowrap">
              <button class="bs1 si-edit" data-id="${r.id}"><i class="ti ti-edit"></i>Edit</button>
              <button class="bs1 si-del" data-id="${r.id}" style="color:var(--red)"><i class="ti ti-trash"></i></button>
            </td>
          </tr>`;
        }).join('') : '<tr><td colspan="10" style="text-align:center;color:var(--t3);padding:3rem"><i class="ti ti-package" style="font-size:2rem;display:block;margin-bottom:.5rem;opacity:.35"></i>No items yet. Click <strong>Add item</strong> to build your catalog.</td></tr>'}
        </tbody>
      </table></div>
    </div>`;

  function itemForm(r) {
    const catOpts = STOCK_CATEGORIES.map(c=>`<option value="${c}" ${r&&r.category===c?'selected':''}>${c}</option>`).join('');
    return `
      <div class="frow">
        <div class="fg"><label>Category *</label><select id="si-cat">${catOpts}</select></div>
        <div class="fg"><label>Name *</label><input id="si-name" type="text" value="${r?r.name:''}" placeholder="Item name"></div>
      </div>
      <div class="frow">
        <div class="fg"><label>SKU</label><input id="si-sku" type="text" value="${r?r.sku||'':''}" placeholder="Stock keeping unit"></div>
        <div class="fg"><label>Unit of measure *</label><input id="si-uom" type="text" value="${r?r.uom:''}" placeholder="e.g. pcs, kg, litres"></div>
      </div>
      <div class="frow">
        <div class="fg"><label>Unit cost (RWF)</label><input id="si-cost" type="number" min="0" value="${r?r.unit_cost:0}"></div>
        <div class="fg"><label>Min stock</label><input id="si-min" type="number" min="0" value="${r?r.min_stock:0}"></div>
        <div class="fg"><label>Max stock</label><input id="si-max" type="number" min="0" value="${r&&r.max_stock?r.max_stock:''}"></div>
      </div>
      <div class="fg"><label>Notes</label><input id="si-notes" type="text" value="${r?r.notes||'':''}"></div>
      <div class="brow"><button class="bp1" id="ovSave"><i class="ti ti-check"></i>Save</button><button class="bs1" id="ovCancel">Cancel</button></div>`;
  }

  $('siAdd').onclick = () => openOverlay('Add stock item', null, itemForm(null), async () => {
    const res2 = await UFCL.stockItemsCreate(STORAGE.user.id, {
      category: $('si-cat').value,
      name: $('si-name').value.trim(),
      sku: $('si-sku').value.trim(),
      uom: $('si-uom').value.trim(),
      unit_cost: $('si-cost').value,
      min_stock: $('si-min').value,
      max_stock: $('si-max').value
    });
    if (!res2.ok) { showOverlayError(res2.error); return; }
    showOverlaySuccess('Item added.');
    await renderStockItems();
  });

  document.querySelectorAll('.si-del').forEach(btn => {
    btn.onclick = () => {
      const r = rows.find(x => x.id === Number(btn.dataset.id));
      if (!r) return;
      confirmDelete(`Delete stock item <strong>${r.name}</strong>? All movement history for this item will also be removed.`, async () => {
        const res2 = await UFCL.stockItemsDelete(STORAGE.user.id, r.id);
        if (!res2.ok) { showOverlayError(res2.error); return; }
        showOverlaySuccess('Stock item deleted.'); await renderStockItems();
      });
    };
  });

  document.querySelectorAll('.si-edit').forEach(btn => {
    btn.onclick = () => {
      const row = rows.find(r => r.id === Number(btn.dataset.id));
      if (!row) return;
      openOverlay('Edit stock item', row.name, itemForm(row), async () => {
        const res2 = await UFCL.stockItemsUpdate(STORAGE.user.id, row.id, {
          category: $('si-cat').value,
          name: $('si-name').value.trim(),
          sku: $('si-sku').value.trim(),
          uom: $('si-uom').value.trim(),
          unit_cost: $('si-cost').value,
          min_stock: $('si-min').value,
          max_stock: $('si-max').value,
          active: true
        });
        if (!res2.ok) { showOverlayError(res2.error); return; }
        showOverlaySuccess('Item updated.');
        await renderStockItems();
      });
    };
  });
}

// ── Stock Movements ───────────────────────────────────────────────────────────

async function renderStockMovements() {
  const res = await UFCL.stockMovementsList(STORAGE.user.id);
  if (!res.ok) return renderDenied('stock-movements', res.error);
  const rows = res.rows || [];
  const items = res.items || [];
  const warehouses = res.warehouses || [];

  const typeBadge = (t) => {
    const map = { in:'bg', out:'br', adjustment:'ba', transfer:'bp', return:'bb' };
    return `<span class="badge ${map[t]||'bt'}">${t}</span>`;
  };

  $('page-stock-movements').innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:1.5rem">
      <div>
        <div class="ptitle">Stock Movements</div>
        <div class="psub">Full audit trail of every stock in, out, adjustment, transfer, and return. Deleting a movement automatically reverses the stock level.</div>
      </div>
      <button class="bp1" id="smAdd" style="flex-shrink:0;white-space:nowrap"><i class="ti ti-plus"></i>Record movement</button>
    </div>
    <div class="cards" style="margin-bottom:1.25rem">
      <div class="mc"><div class="mclbl">Total entries</div><div class="mcval">${rows.length}</div><div class="mcsub cg"><i class="ti ti-arrows-exchange"></i>last 100</div></div>
      <div class="mc"><div class="mclbl">Stock In</div><div class="mcval">${rows.filter(r=>r.movement_type==='in').length}</div><div class="mcsub cg"><i class="ti ti-arrow-down-circle"></i>receipts</div></div>
      <div class="mc"><div class="mclbl">Stock Out</div><div class="mcval">${rows.filter(r=>r.movement_type==='out').length}</div><div class="mcsub cr"><i class="ti ti-arrow-up-circle"></i>issues</div></div>
      <div class="mc"><div class="mclbl">Transfers</div><div class="mcval">${rows.filter(r=>r.movement_type==='transfer').length}</div><div class="mcsub bp"><i class="ti ti-switch-2"></i>between sites</div></div>
    </div>
    <div class="card" style="padding:0">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;border-bottom:1px solid var(--bdr)">
        <h3 style="margin:0"><i class="ti ti-arrows-exchange"></i>Movement log</h3>
        <span style="font-size:12px;color:var(--t3)">${rows.length} entr${rows.length!==1?'ies':'y'}</span>
      </div>
      <div class="tw"><table class="dt">
        <thead><tr><th>Date</th><th>Item</th><th>Category</th><th>Type</th><th>Qty</th><th>From warehouse</th><th>To warehouse</th><th>Reference</th><th>Recorded by</th><th></th></tr></thead>
        <tbody>${rows.length ? rows.map(r=>`<tr>
          <td style="white-space:nowrap;color:var(--t3);font-size:12px">${r.created_at}</td>
          <td style="font-weight:500">${r.item_name}</td>
          <td><span class="badge bt">${r.category}</span></td>
          <td>${typeBadge(r.movement_type)}</td>
          <td style="font-family:var(--fm);font-weight:600">${r.quantity} <span style="color:var(--t3);font-weight:400">${r.uom}</span></td>
          <td>${r.warehouse_name||'—'}</td>
          <td>${r.to_warehouse_name||'—'}</td>
          <td style="font-family:var(--fm);color:var(--t3)">${r.reference||'—'}</td>
          <td>${r.created_by||'—'}</td>
          <td><button class="bs1 sm-del" data-id="${r.id}" style="color:var(--red);padding:3px 8px" title="Delete &amp; reverse"><i class="ti ti-trash"></i></button></td>
        </tr>`).join('') : '<tr><td colspan="10" style="text-align:center;color:var(--t3);padding:3rem"><i class="ti ti-arrows-exchange" style="font-size:2rem;display:block;margin-bottom:.5rem;opacity:.35"></i>No movements recorded yet.</td></tr>'}
        </tbody>
      </table></div>
    </div>`;

  document.querySelectorAll('.sm-del').forEach(btn => {
    btn.onclick = () => {
      const r = rows.find(x => x.id === Number(btn.dataset.id));
      if (!r) return;
      confirmDelete(`Delete stock movement: <strong>${r.movement_type}</strong> ${r.quantity} ${r.uom} of ${r.item_name}? Stock level will be reversed.`, async () => {
        const res2 = await UFCL.stockMovementsDelete(STORAGE.user.id, r.id);
        if (!res2.ok) { showOverlayError(res2.error); return; }
        showOverlaySuccess('Movement deleted and stock level reversed.'); await renderStockMovements();
      });
    };
  });

  $('smAdd').onclick = () => {
    const itemOpts = items.map(i=>`<option value="${i.id}">${i.name} (${i.category}) — stock: ${i.total_stock} ${i.uom}</option>`).join('');
    const whOpts = warehouses.map(w=>`<option value="${w.id}">${w.name}</option>`).join('');
    openOverlay('Record stock movement', null, `
      <div class="frow">
        <div class="fg"><label>Item *</label><select id="sm-item">${itemOpts||'<option>No items</option>'}</select></div>
        <div class="fg"><label>Movement type *</label>
          <select id="sm-type">
            <option value="in">Stock In</option>
            <option value="out">Stock Out</option>
            <option value="adjustment">Adjustment (set quantity)</option>
            <option value="transfer">Transfer</option>
            <option value="return">Return</option>
          </select>
        </div>
      </div>
      <div class="frow">
        <div class="fg"><label>Quantity *</label><input id="sm-qty" type="number" min="1" placeholder="0"></div>
        <div class="fg"><label>Warehouse</label><select id="sm-wh">${whOpts||'<option value="">No warehouses</option>'}</select></div>
        <div class="fg sm-towh-row"><label>To warehouse (transfer)</label><select id="sm-towh">${whOpts||'<option value="">No warehouses</option>'}</select></div>
      </div>
      <div class="frow">
        <div class="fg"><label>Reference</label><input id="sm-ref" type="text" placeholder="PO#, invoice, etc."></div>
        <div class="fg"><label>Notes</label><input id="sm-notes" type="text"></div>
      </div>
      <div class="brow"><button class="bp1" id="ovSave"><i class="ti ti-check"></i>Save</button><button class="bs1" id="ovCancel">Cancel</button></div>`, async () => {
      const res2 = await UFCL.stockMovementsCreate(STORAGE.user.id, {
        item_id: $('sm-item').value,
        movement_type: $('sm-type').value,
        quantity: $('sm-qty').value,
        warehouse_id: $('sm-wh').value || null,
        to_warehouse_id: $('sm-towh').value || null,
        reference: $('sm-ref').value.trim(),
        notes: $('sm-notes').value.trim()
      });
      if (!res2.ok) { showOverlayError(res2.error); return; }
      showOverlaySuccess('Movement recorded.');
      await renderStockMovements();
    });
  };
}

// ── Vehicles ──────────────────────────────────────────────────────────────────

function vehicleStatusBadge(s) {
  const map = { Active: 'bg', 'In Maintenance': 'ba', Inactive: 'br' };
  return `<span class="badge ${map[s]||'bt'}">${s}</span>`;
}

async function renderVehicles() {
  const res = await UFCL.vehiclesList(STORAGE.user.id);
  if (!res.ok) return renderDenied('vehicles', res.error);
  const rows = res.rows || [];
  const active = rows.filter(r=>r.status==='Active').length;
  const maintenance = rows.filter(r=>r.status==='In Maintenance').length;

  const insExpiredCount = rows.filter(r => r.insurance_expiry && new Date(r.insurance_expiry) < new Date()).length;
  const totalFuel = Math.round(rows.reduce((s,r)=>s+Number(r.total_fuel_cost||0),0));

  $('page-vehicles').innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:1.5rem">
      <div>
        <div class="ptitle">Vehicle Fleet</div>
        <div class="psub">Manage your entire fleet — track fuel consumption, schedule maintenance, and monitor insurance validity.</div>
      </div>
      <button class="bp1" id="vAdd" style="flex-shrink:0;white-space:nowrap"><i class="ti ti-plus"></i>Register vehicle</button>
    </div>
    <div class="cards" style="margin-bottom:1.25rem">
      <div class="mc"><div class="mclbl">Fleet size</div><div class="mcval">${rows.length}</div><div class="mcsub cg"><i class="ti ti-truck"></i>vehicles</div></div>
      <div class="mc"><div class="mclbl">Active</div><div class="mcval">${active}</div><div class="mcsub cg"><i class="ti ti-circle-check"></i>operational</div></div>
      <div class="mc"><div class="mclbl">In maintenance</div><div class="mcval" style="${maintenance>0?'color:var(--amber)':''}">${maintenance}</div><div class="mcsub ${maintenance>0?'ca':'cg'}"><i class="ti ti-tool"></i>off-road</div></div>
      <div class="mc"><div class="mclbl">Total fuel cost (RWF)</div><div class="mcval">${totalFuel.toLocaleString()}</div><div class="mcsub bp"><i class="ti ti-gas-station"></i>all time</div></div>
    </div>
    ${insExpiredCount>0?`<div style="display:flex;align-items:center;gap:.625rem;padding:.75rem 1rem;background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.2);border-radius:7px;margin-bottom:1.25rem;font-size:13px;color:var(--red)"><i class="ti ti-id-off" style="font-size:16px;flex-shrink:0"></i><strong style="margin-right:.25rem">${insExpiredCount} vehicle${insExpiredCount>1?'s':''}</strong> with expired insurance — update before dispatching.</div>`:''}
    <div class="card" style="padding:0">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;border-bottom:1px solid var(--bdr)">
        <h3 style="margin:0"><i class="ti ti-truck"></i>Fleet register</h3>
        <span style="font-size:12px;color:var(--t3)">${rows.length} vehicle${rows.length!==1?'s':''}</span>
      </div>
      <div class="tw"><table class="dt">
        <thead><tr><th>Registration</th><th>Make / Model</th><th>Type</th><th>Status</th><th>Fuel type</th><th>Insurance expiry</th><th>Fuel cost (RWF)</th><th>Maintenance records</th><th>Actions</th></tr></thead>
        <tbody>${rows.length ? rows.map(r=>{
          const insExpiry = r.insurance_expiry ? new Date(r.insurance_expiry) : null;
          const insExpired = insExpiry && insExpiry < new Date();
          const insWarn = insExpiry && !insExpired && (insExpiry - new Date()) < 30*24*60*60*1000;
          return `<tr>
            <td style="font-weight:700;font-family:var(--fm)">${r.registration}</td>
            <td>${[r.make,r.model].filter(Boolean).join(' ')||'—'}</td>
            <td>${r.vehicle_type||'—'}</td>
            <td>${vehicleStatusBadge(r.status)}</td>
            <td>${r.fuel_type||'—'}</td>
            <td style="${insExpired?'color:var(--red);font-weight:600':insWarn?'color:var(--amber);font-weight:500':''}">${r.insurance_expiry?new Date(r.insurance_expiry).toLocaleDateString('en-GB'):'—'}${insExpired?' <span style="font-size:11px">(expired)</span>':insWarn?' <span style="font-size:11px">(expiring soon)</span>':''}</td>
            <td style="font-family:var(--fm)">${Math.round(r.total_fuel_cost||0).toLocaleString()}</td>
            <td style="text-align:center">${r.maintenance_count||0}</td>
            <td style="white-space:nowrap;display:flex;gap:4px">
              <button class="bs1 v-fuel" data-id="${r.id}" data-reg="${r.registration}" title="Log fuel"><i class="ti ti-gas-station"></i></button>
              <button class="bs1 v-maint" data-id="${r.id}" data-reg="${r.registration}" title="Add maintenance"><i class="ti ti-tool"></i></button>
              <button class="bs1 v-edit" data-id="${r.id}" title="Edit"><i class="ti ti-edit"></i></button>
              <button class="bs1 v-del" data-id="${r.id}" style="color:var(--red)" title="Delete"><i class="ti ti-trash"></i></button>
            </td>
          </tr>`;
        }).join('') : '<tr><td colspan="9" style="text-align:center;color:var(--t3);padding:3rem"><i class="ti ti-truck" style="font-size:2rem;display:block;margin-bottom:.5rem;opacity:.35"></i>No vehicles registered yet.</td></tr>'}
        </tbody>
      </table></div>
    </div>`;

  function vehicleForm(r) {
    const statOpts = ['Active','In Maintenance','Inactive'].map(s=>`<option value="${s}" ${r&&r.status===s?'selected':''}>${s}</option>`).join('');
    return `
      <div class="frow">
        <div class="fg"><label>Registration *</label><input id="v-reg" type="text" value="${r?r.registration:''}" placeholder="e.g. RAB 123A"></div>
        <div class="fg"><label>Make</label><input id="v-make" type="text" value="${r?r.make||'':''}" placeholder="e.g. Toyota"></div>
        <div class="fg"><label>Model</label><input id="v-model" type="text" value="${r?r.model||'':''}" placeholder="e.g. Hilux"></div>
      </div>
      <div class="frow">
        <div class="fg"><label>Vehicle type</label><input id="v-type" type="text" value="${r?r.vehicle_type||'':''}" placeholder="Truck, Van, Pickup…"></div>
        <div class="fg"><label>Status</label><select id="v-status">${statOpts}</select></div>
        <div class="fg"><label>Fuel type</label><select id="v-fuel"><option value="">—</option><option value="Diesel" ${r&&r.fuel_type==='Diesel'?'selected':''}>Diesel</option><option value="Petrol" ${r&&r.fuel_type==='Petrol'?'selected':''}>Petrol</option></select></div>
      </div>
      <div class="frow">
        <div class="fg"><label>Insurance expiry</label><input id="v-ins" type="date" value="${r&&r.insurance_expiry?new Date(r.insurance_expiry).toISOString().slice(0,10):''}"></div>
        <div class="fg"><label>Notes</label><input id="v-notes" type="text" value="${r?r.notes||'':''}"></div>
      </div>
      <div class="brow"><button class="bp1" id="ovSave"><i class="ti ti-check"></i>Save</button><button class="bs1" id="ovCancel">Cancel</button></div>`;
  }

  $('vAdd').onclick = () => openOverlay('Register vehicle', null, vehicleForm(null), async () => {
    const res2 = await UFCL.vehiclesCreate(STORAGE.user.id, {
      registration: $('v-reg').value.trim(),
      make: $('v-make').value.trim(),
      model: $('v-model').value.trim(),
      vehicle_type: $('v-type').value.trim(),
      status: $('v-status').value,
      fuel_type: $('v-fuel').value || null,
      insurance_expiry: $('v-ins').value || null,
      notes: $('v-notes').value.trim()
    });
    if (!res2.ok) { showOverlayError(res2.error); return; }
    showOverlaySuccess('Vehicle registered.');
    await renderVehicles();
  });

  document.querySelectorAll('.v-edit').forEach(btn => {
    btn.onclick = () => {
      const row = rows.find(r => r.id === Number(btn.dataset.id));
      if (!row) return;
      openOverlay('Edit vehicle', row.registration, vehicleForm(row), async () => {
        const res2 = await UFCL.vehiclesUpdate(STORAGE.user.id, row.id, {
          registration: $('v-reg').value.trim(),
          make: $('v-make').value.trim(),
          model: $('v-model').value.trim(),
          vehicle_type: $('v-type').value.trim(),
          status: $('v-status').value,
          fuel_type: $('v-fuel').value || null,
          insurance_expiry: $('v-ins').value || null,
          notes: $('v-notes').value.trim()
        });
        if (!res2.ok) { showOverlayError(res2.error); return; }
        showOverlaySuccess('Vehicle updated.');
        await renderVehicles();
      });
    };
  });

  document.querySelectorAll('.v-del').forEach(btn => {
    btn.onclick = () => {
      const r = rows.find(x => x.id === Number(btn.dataset.id));
      if (!r) return;
      confirmDelete(`Delete vehicle <strong>${r.registration}</strong>? All fuel logs and maintenance records for this vehicle will also be removed.`, async () => {
        const res2 = await UFCL.vehiclesDelete(STORAGE.user.id, r.id);
        if (!res2.ok) { showOverlayError(res2.error); return; }
        showOverlaySuccess('Vehicle deleted.'); await renderVehicles();
      });
    };
  });

  document.querySelectorAll('.v-fuel').forEach(btn => {
    btn.onclick = () => {
      const vid = btn.dataset.id;
      const reg = btn.dataset.reg;
      openOverlay('Log fuel', reg, `
        <div class="frow">
          <div class="fg"><label>Date *</label><input id="fl-date" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
          <div class="fg"><label>Litres *</label><input id="fl-liters" type="number" min="0.1" step="0.1" placeholder="0.0"></div>
        </div>
        <div class="frow">
          <div class="fg"><label>Cost per litre (RWF)</label><input id="fl-cpl" type="number" min="0" placeholder="0"></div>
          <div class="fg"><label>Odometer (km)</label><input id="fl-odo" type="number" min="0" placeholder="0"></div>
        </div>
        <div class="fg"><label>Notes</label><input id="fl-notes" type="text"></div>
        <div class="brow"><button class="bp1" id="ovSave"><i class="ti ti-check"></i>Save</button><button class="bs1" id="ovCancel">Cancel</button></div>`, async () => {
        const liters = Number($('fl-liters').value);
        const cpl = Number($('fl-cpl').value || 0);
        const res2 = await UFCL.fuelLogsCreate(STORAGE.user.id, {
          vehicle_id: vid,
          liters,
          cost_per_liter: cpl || null,
          total_cost: liters * cpl || null,
          odometer: $('fl-odo').value || null,
          log_date: $('fl-date').value,
          notes: $('fl-notes').value.trim()
        });
        if (!res2.ok) { showOverlayError(res2.error); return; }
        showOverlaySuccess('Fuel log saved.');
        await renderVehicles();
      });
    };
  });

  document.querySelectorAll('.v-maint').forEach(btn => {
    btn.onclick = () => {
      const vid = btn.dataset.id;
      const reg = btn.dataset.reg;
      openOverlay('Add maintenance record', reg, `
        <div class="frow">
          <div class="fg"><label>Date *</label><input id="mr-date" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
          <div class="fg"><label>Type *</label>
            <select id="mr-type"><option value="Scheduled">Scheduled</option><option value="Corrective">Corrective</option><option value="Inspection">Inspection</option></select>
          </div>
        </div>
        <div class="fg"><label>Description *</label><input id="mr-desc" type="text" placeholder="What was done?"></div>
        <div class="frow">
          <div class="fg"><label>Cost (RWF)</label><input id="mr-cost" type="number" min="0" placeholder="0"></div>
          <div class="fg"><label>Next due date</label><input id="mr-next" type="date"></div>
          <div class="fg"><label>Performed by</label><input id="mr-by" type="text" placeholder="Name or garage"></div>
        </div>
        <div class="fg"><label>Notes</label><input id="mr-notes" type="text"></div>
        <div class="brow"><button class="bp1" id="ovSave"><i class="ti ti-check"></i>Save</button><button class="bs1" id="ovCancel">Cancel</button></div>`, async () => {
        const res2 = await UFCL.maintenanceCreate(STORAGE.user.id, {
          vehicle_id: vid,
          maintenance_type: $('mr-type').value,
          description: $('mr-desc').value.trim(),
          cost: $('mr-cost').value || null,
          maintenance_date: $('mr-date').value,
          next_due_date: $('mr-next').value || null,
          performed_by: $('mr-by').value.trim() || null,
          notes: $('mr-notes').value.trim()
        });
        if (!res2.ok) { showOverlayError(res2.error); return; }
        showOverlaySuccess('Maintenance record saved.');
        await renderVehicles();
      });
    };
  });
}

// ── Deliveries ────────────────────────────────────────────────────────────────

async function renderDeliveries() {
  const res = await UFCL.deliveriesList(STORAGE.user.id);
  if (!res.ok) return renderDenied('deliveries', res.error);
  const rows = res.rows || [];
  const vehicles = res.vehicles || [];
  const salesOrders = res.salesOrders || [];

  const statBadge = (s) => {
    const map = { Pending:'ba', Assigned:'bb', 'In Transit':'bp', Delivered:'bg', Failed:'br' };
    return `<span class="badge ${map[s]||'ba'}">${s}</span>`;
  };

  $('page-deliveries').innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:1.5rem">
      <div>
        <div class="ptitle">Delivery Orders</div>
        <div class="psub">Create delivery orders, assign drivers and vehicles, and track every shipment from pickup to delivery confirmation.</div>
      </div>
      <button class="bp1" id="doAdd" style="flex-shrink:0;white-space:nowrap"><i class="ti ti-plus"></i>New delivery order</button>
    </div>
    <div class="cards" style="margin-bottom:1.25rem">
      <div class="mc"><div class="mclbl">Total orders</div><div class="mcval">${rows.length}</div><div class="mcsub cg"><i class="ti ti-truck-delivery"></i>all time</div></div>
      <div class="mc"><div class="mclbl">Pending</div><div class="mcval">${rows.filter(r=>r.status==='Pending').length}</div><div class="mcsub ca"><i class="ti ti-clock"></i>awaiting dispatch</div></div>
      <div class="mc"><div class="mclbl">In transit</div><div class="mcval">${rows.filter(r=>r.status==='In Transit').length}</div><div class="mcsub bp"><i class="ti ti-truck"></i>on the road</div></div>
      <div class="mc"><div class="mclbl">Delivered</div><div class="mcval">${rows.filter(r=>r.status==='Delivered').length}</div><div class="mcsub cg"><i class="ti ti-circle-check"></i>completed</div></div>
    </div>
    <div class="card" style="padding:0">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;border-bottom:1px solid var(--bdr)">
        <h3 style="margin:0"><i class="ti ti-truck-delivery"></i>Order log</h3>
        <span style="font-size:12px;color:var(--t3)">${rows.length} order${rows.length!==1?'s':''}</span>
      </div>
      <div class="tw"><table class="dt">
        <thead><tr><th>Order #</th><th>Sales order</th><th>Customer</th><th>Driver</th><th>Vehicle</th><th>Delivery date</th><th>Route</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${rows.length ? rows.map(r=>`<tr>
          <td style="font-family:var(--fm);font-weight:700">${r.order_number}</td>
          <td style="font-family:var(--fm);color:var(--t3)">${r.sales_order_number||'—'}</td>
          <td style="font-weight:500">${r.customer_name||'—'}</td>
          <td>${r.driver_name||'—'}</td>
          <td style="font-family:var(--fm)">${r.vehicle_registration||'—'}</td>
          <td>${r.delivery_date||'—'}</td>
          <td>${r.route||'—'}</td>
          <td>${statBadge(r.status)}</td>
          <td style="white-space:nowrap;display:flex;gap:4px;align-items:center">
            <select class="do-status-sel" data-id="${r.id}" style="font-size:12px;padding:3px 6px;background:var(--bg2);border:1px solid var(--bdr);color:var(--t1);border-radius:4px">
              ${['Pending','Assigned','In Transit','Delivered','Failed'].map(s=>`<option value="${s}" ${r.status===s?'selected':''}>${s}</option>`).join('')}
            </select>
            <button class="bs1 do-edit" data-id="${r.id}"><i class="ti ti-edit"></i></button>
            <button class="bs1 do-del" data-id="${r.id}" style="color:var(--red)"><i class="ti ti-trash"></i></button>
          </td>
        </tr>`).join('') : '<tr><td colspan="9" style="text-align:center;color:var(--t3);padding:3rem"><i class="ti ti-truck-delivery" style="font-size:2rem;display:block;margin-bottom:.5rem;opacity:.35"></i>No delivery orders yet. Click <strong>New delivery order</strong> to get started.</td></tr>'}
        </tbody>
      </table></div>
    </div>`;

  $('doAdd').onclick = () => {
    const vOpts = vehicles.map(v=>`<option value="${v.id}">${v.registration}${v.make?' — '+v.make:''}</option>`).join('');
    const soOpts = `<option value="">— None —</option>` + salesOrders.map(s=>`<option value="${s.id}">${s.order_number} — ${s.customer_name}</option>`).join('');
    openOverlay('Create delivery order', null, `
      <div class="frow">
        <div class="fg"><label>Driver name *</label><input id="do-driver" type="text" placeholder="Full name"></div>
        <div class="fg"><label>Vehicle</label><select id="do-vehicle">${vOpts||'<option>No vehicles</option>'}</select></div>
      </div>
      <div class="frow">
        <div class="fg"><label>Sales order</label><select id="do-so">${soOpts}</select></div>
        <div class="fg"><label>Delivery date</label><input id="do-date" type="date"></div>
      </div>
      <div class="frow">
        <div class="fg"><label>Route</label><input id="do-route" type="text" placeholder="Origin → Destination"></div>
        <div class="fg"><label>Notes</label><input id="do-notes" type="text"></div>
      </div>
      <div class="brow"><button class="bp1" id="ovSave"><i class="ti ti-check"></i>Create</button><button class="bs1" id="ovCancel">Cancel</button></div>`, async () => {
      const res2 = await UFCL.deliveriesCreate(STORAGE.user.id, {
        driver_name: $('do-driver').value.trim(),
        vehicle_id: $('do-vehicle').value || null,
        sales_order_id: $('do-so').value || null,
        delivery_date: $('do-date').value || null,
        route: $('do-route').value.trim(),
        notes: $('do-notes').value.trim()
      });
      if (!res2.ok) { showOverlayError(res2.error); return; }
      showOverlaySuccess('Delivery order created.');
      await renderDeliveries();
    });
  };

  document.querySelectorAll('.do-status-sel').forEach(sel => {
    sel.onchange = async () => {
      const res2 = await UFCL.deliveriesUpdateStatus(STORAGE.user.id, Number(sel.dataset.id), sel.value);
      if (!res2.ok) { alert(res2.error); sel.value = rows.find(r=>r.id===Number(sel.dataset.id))?.status||'Pending'; }
      else await renderDeliveries();
    };
  });

  document.querySelectorAll('.do-edit').forEach(btn => {
    btn.onclick = () => {
      const r = rows.find(x => x.id === Number(btn.dataset.id));
      if (!r) return;
      const vOpts = vehicles.map(v=>`<option value="${v.id}" ${r.vehicle_registration===v.registration?'selected':''}>${v.registration}</option>`).join('');
      openOverlay('Edit delivery order', r.order_number, `
        <div class="frow">
          <div class="fg"><label>Driver name *</label><input id="doe-driver" type="text" value="${r.driver_name||''}"></div>
          <div class="fg"><label>Vehicle</label><select id="doe-vehicle"><option value="">— None —</option>${vOpts}</select></div>
        </div>
        <div class="frow">
          <div class="fg"><label>Delivery date</label><input id="doe-date" type="date" value="${r.delivery_date ? r.delivery_date.split('/').reverse().join('-') : ''}"></div>
          <div class="fg"><label>Route</label><input id="doe-route" type="text" value="${r.route||''}"></div>
        </div>
        <div class="fg"><label>Notes</label><input id="doe-notes" type="text" value="${r.notes||''}"></div>
        <div class="brow"><button class="bp1" id="ovSave"><i class="ti ti-check"></i>Save</button><button class="bs1" id="ovCancel">Cancel</button></div>`,
        async () => {
          const res2 = await UFCL.deliveriesUpdate(STORAGE.user.id, r.id, {
            driver_name: $('doe-driver').value.trim(),
            vehicle_id: $('doe-vehicle').value || null,
            delivery_date: $('doe-date').value || null,
            route: $('doe-route').value.trim(),
            notes: $('doe-notes').value.trim()
          });
          if (!res2.ok) { showOverlayError(res2.error); return; }
          showOverlaySuccess('Delivery order updated.'); await renderDeliveries();
        });
    };
  });

  document.querySelectorAll('.do-del').forEach(btn => {
    btn.onclick = () => {
      const r = rows.find(x => x.id === Number(btn.dataset.id));
      if (!r) return;
      confirmDelete(`Delete delivery order <strong>${r.order_number}</strong>? This will also remove any linked dispatch requests.`, async () => {
        const res2 = await UFCL.deliveriesDelete(STORAGE.user.id, r.id);
        if (!res2.ok) { showOverlayError(res2.error); return; }
        showOverlaySuccess('Delivery order deleted.'); await renderDeliveries();
      });
    };
  });
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

async function renderDispatch() {
  const res = await UFCL.dispatchList(STORAGE.user.id);
  if (!res.ok) return renderDenied('dispatch', res.error);
  const rows = res.rows || [];
  const pendingDeliveries = res.pendingDeliveries || [];

  const dsBadge = (s) => {
    const map = { Pending:'ba', Approved:'bg', Rejected:'br', Dispatched:'bp' };
    return `<span class="badge ${map[s]||'ba'}">${s}</span>`;
  };

  const canApprove = ['admin','ceo','logistics','operations'].includes(STORAGE.user.role);

  const dsPending = rows.filter(r=>r.status==='Pending').length;

  $('page-dispatch').innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:1.5rem">
      <div>
        <div class="ptitle">Dispatch Control</div>
        <div class="psub">Review and authorise vehicle dispatch. Requests must be approved before a vehicle leaves the yard.</div>
      </div>
      <button class="bp1" id="dsAdd" style="flex-shrink:0;white-space:nowrap"><i class="ti ti-plus"></i>New request</button>
    </div>
    <div class="cards" style="margin-bottom:1.25rem">
      <div class="mc"><div class="mclbl">Awaiting approval</div><div class="mcval" style="${dsPending>0?'color:var(--amber)':''}">${dsPending}</div><div class="mcsub ${dsPending>0?'ca':'cg'}"><i class="ti ti-clock"></i>pending</div></div>
      <div class="mc"><div class="mclbl">Approved</div><div class="mcval">${rows.filter(r=>r.status==='Approved').length}</div><div class="mcsub cg"><i class="ti ti-circle-check"></i>ready</div></div>
      <div class="mc"><div class="mclbl">Dispatched</div><div class="mcval">${rows.filter(r=>r.status==='Dispatched').length}</div><div class="mcsub bp"><i class="ti ti-send"></i>in transit</div></div>
      <div class="mc"><div class="mclbl">Rejected</div><div class="mcval">${rows.filter(r=>r.status==='Rejected').length}</div><div class="mcsub cr"><i class="ti ti-x"></i>declined</div></div>
    </div>
    ${dsPending>0&&canApprove?`<div style="display:flex;align-items:center;gap:.625rem;padding:.75rem 1rem;background:rgba(245,158,11,.07);border:1px solid rgba(245,158,11,.25);border-radius:7px;margin-bottom:1.25rem;font-size:13px;color:var(--amber)"><i class="ti ti-clock" style="font-size:16px;flex-shrink:0"></i><strong style="margin-right:.25rem">${dsPending} request${dsPending>1?'s':''}</strong> awaiting your approval — see the queue below.</div>`:''}
    <div class="card" style="padding:0">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;border-bottom:1px solid var(--bdr)">
        <h3 style="margin:0"><i class="ti ti-send"></i>Dispatch queue</h3>
        <span style="font-size:12px;color:var(--t3)">${rows.length} request${rows.length!==1?'s':''}</span>
      </div>
      <div class="tw"><table class="dt">
        <thead><tr><th>Request #</th><th>Delivery order</th><th>Driver</th><th>Vehicle</th><th>Route</th><th>Status</th><th>Raised by</th><th>Approved by</th><th>Date</th>${canApprove?'<th>Actions</th>':''}</tr></thead>
        <tbody>${rows.length ? rows.map(r=>`<tr${r.status==='Pending'?' style="background:rgba(245,158,11,.04)"':''}>
          <td style="font-family:var(--fm);font-weight:700">${r.request_number}</td>
          <td style="font-family:var(--fm);color:var(--t3)">${r.delivery_order_number||'—'}</td>
          <td style="font-weight:500">${r.driver_name||'—'}</td>
          <td style="font-family:var(--fm)">${r.vehicle_registration||'—'}</td>
          <td>${r.route||'—'}</td>
          <td>${dsBadge(r.status)}</td>
          <td>${r.created_by||'—'}</td>
          <td>${r.approved_by||'—'}</td>
          <td style="color:var(--t3);font-size:12px;white-space:nowrap">${r.created_at}</td>
          ${canApprove && r.status==='Pending' ? `
          <td style="white-space:nowrap;display:flex;gap:4px">
            <button class="bp1 ds-approve" data-id="${r.id}" style="padding:4px 10px;font-size:12px"><i class="ti ti-check"></i>Approve</button>
            <button class="bs1 ds-dispatch" data-id="${r.id}" style="padding:4px 10px;font-size:12px"><i class="ti ti-send"></i>Dispatch</button>
            <button class="bs1 ds-reject" data-id="${r.id}" style="padding:4px 10px;font-size:12px;color:var(--red)"><i class="ti ti-x"></i>Reject</button>
            <button class="bs1 ds-del" data-id="${r.id}" style="padding:4px 8px;font-size:12px;color:var(--red)"><i class="ti ti-trash"></i></button>
          </td>` : canApprove ? `<td><button class="bs1 ds-del" data-id="${r.id}" style="padding:4px 8px;font-size:12px;color:var(--red)"><i class="ti ti-trash"></i></button></td>` : ''}
        </tr>`).join('') : `<tr><td colspan="${canApprove?10:9}" style="text-align:center;color:var(--t3);padding:3rem"><i class="ti ti-send" style="font-size:2rem;display:block;margin-bottom:.5rem;opacity:.35"></i>No dispatch requests yet.</td></tr>`}
        </tbody>
      </table></div>
    </div>`;

  $('dsAdd').onclick = () => {
    const doOpts = pendingDeliveries.map(d=>`<option value="${d.id}">${d.order_number} — ${d.driver_name}</option>`).join('');
    openOverlay('New dispatch request', null, `
      <div class="fg"><label>Delivery order *</label><select id="ds-do">${doOpts||'<option>No assigned delivery orders</option>'}</select></div>
      <div class="fg"><label>Notes</label><input id="ds-notes" type="text" placeholder="Reason or instructions"></div>
      <div class="brow"><button class="bp1" id="ovSave"><i class="ti ti-check"></i>Submit</button><button class="bs1" id="ovCancel">Cancel</button></div>`, async () => {
      const res2 = await UFCL.dispatchCreate(STORAGE.user.id, {
        delivery_order_id: $('ds-do').value,
        notes: $('ds-notes').value.trim()
      });
      if (!res2.ok) { showOverlayError(res2.error); return; }
      showOverlaySuccess('Dispatch request submitted.');
      await renderDispatch();
    });
  };

  if (canApprove) {
    document.querySelectorAll('.ds-approve').forEach(btn => {
      btn.onclick = async () => {
        const res2 = await UFCL.dispatchReview(STORAGE.user.id, Number(btn.dataset.id), 'Approved', null);
        if (!res2.ok) alert(res2.error); else await renderDispatch();
      };
    });
    document.querySelectorAll('.ds-dispatch').forEach(btn => {
      btn.onclick = async () => {
        const res2 = await UFCL.dispatchReview(STORAGE.user.id, Number(btn.dataset.id), 'Dispatched', null);
        if (!res2.ok) alert(res2.error); else await renderDispatch();
      };
    });
    document.querySelectorAll('.ds-del').forEach(btn => {
      btn.onclick = () => {
        confirmDelete(`Delete dispatch request <strong>#${btn.dataset.id}</strong>?`, async () => {
          const res2 = await UFCL.dispatchDelete(STORAGE.user.id, Number(btn.dataset.id));
          if (!res2.ok) { showOverlayError(res2.error); return; }
          showOverlaySuccess('Dispatch request deleted.'); await renderDispatch();
        });
      };
    });

    document.querySelectorAll('.ds-reject').forEach(btn => {
      btn.onclick = () => {
        openOverlay('Reject dispatch', null, `
          <div class="fg"><label>Reason for rejection</label><input id="ds-rej-notes" type="text" placeholder="Explain why…"></div>
          <div class="brow"><button class="bp1" id="ovSave" style="background:var(--red)"><i class="ti ti-x"></i>Reject</button><button class="bs1" id="ovCancel">Cancel</button></div>`, async () => {
          const res2 = await UFCL.dispatchReview(STORAGE.user.id, Number(btn.dataset.id), 'Rejected', $('ds-rej-notes').value.trim());
          if (!res2.ok) { showOverlayError(res2.error); return; }
          showOverlaySuccess('Dispatch rejected.'); await renderDispatch();
        });
      };
    });
  }
}

// ── Harvest Tracking ──────────────────────────────────────────────────────────

async function renderHarvest() {
  const res = await UFCL.harvestList(STORAGE.user.id);
  if (!res.ok) return renderDenied('harvest', res.error);
  const rows = res.rows || [];
  const summary = res.summary || {};

  const totalHarvested = rows.reduce((s,r) => s + Number(r.quantity), 0);

  $('page-harvest').innerHTML = `
    <div class="ptitle">Harvest Tracking</div>
    <div class="psub">Log and review harvest operations by location, species, and date.</div>
    <div class="cards">
      <div class="mc"><div class="mclbl">Total harvests</div><div class="mcval">${rows.length}</div><div class="mcsub cg"><i class="ti ti-axe"></i>entries</div></div>
      <div class="mc"><div class="mclbl">Total quantity</div><div class="mcval">${totalHarvested.toLocaleString()}</div><div class="mcsub cg"><i class="ti ti-trees"></i>units</div></div>
      <div class="mc"><div class="mclbl">Species tracked</div><div class="mcval">${Object.keys(summary).length}</div><div class="mcsub bp"><i class="ti ti-leaf"></i>species</div></div>
    </div>
    ${Object.keys(summary).length ? `<div class="card">
      <h3><i class="ti ti-trees"></i>Harvest by species</h3>
      <div class="tw"><table class="dt">
        <thead><tr><th>Species</th><th>Total quantity</th></tr></thead>
        <tbody>${Object.entries(summary).map(([sp,qty])=>`<tr>
          <td style="font-weight:500">${sp}</td>
          <td style="font-family:var(--fm)">${Number(qty).toLocaleString()}</td>
        </tr>`).join('')}
        </tbody>
      </table></div>
    </div>` : ''}
    <div class="card">
      <div class="brow"><h3><i class="ti ti-axe"></i>Harvest log</h3>
        <button class="bp1" id="hvAdd"><i class="ti ti-plus"></i>Log harvest</button>
      </div>
      <div class="tw"><table class="dt">
        <thead><tr><th>Date</th><th>Location</th><th>Species</th><th>Quantity</th><th>UoM</th><th>Notes</th><th>Logged by</th><th>Action</th></tr></thead>
        <tbody>${rows.length ? rows.map(r=>`<tr>
          <td style="font-weight:500">${r.harvest_date}</td>
          <td>${r.location}</td>
          <td><span class="badge bt">${r.species}</span></td>
          <td style="font-family:var(--fm);font-weight:600">${Number(r.quantity).toLocaleString()}</td>
          <td>${r.uom}</td>
          <td style="color:var(--t3)">${r.notes||'—'}</td>
          <td>${r.logged_by||'—'}</td>
          <td style="white-space:nowrap">
            <button class="bs1 hv-edit" data-id="${r.id}"><i class="ti ti-edit"></i>Edit</button>
            <button class="bs1 hv-del" data-id="${r.id}" style="color:var(--red)"><i class="ti ti-trash"></i></button>
          </td>
        </tr>`).join('') : '<tr><td colspan="8" style="text-align:center;color:var(--t3);padding:1.5rem">No harvest records yet.</td></tr>'}
        </tbody>
      </table></div>
    </div>`;

  document.querySelectorAll('.hv-edit').forEach(btn => {
    btn.onclick = () => {
      const r = rows.find(x => x.id === Number(btn.dataset.id));
      if (!r) return;
      const isoDate = r.harvest_date.split('/').reverse().join('-');
      openOverlay('Edit harvest log', r.species, `
        <div class="frow">
          <div class="fg"><label>Harvest date *</label><input id="hv-date" type="date" value="${isoDate}"></div>
          <div class="fg"><label>Location *</label><input id="hv-loc" type="text" value="${r.location}"></div>
        </div>
        <div class="frow">
          <div class="fg"><label>Species *</label><input id="hv-species" type="text" value="${r.species}"></div>
          <div class="fg"><label>Quantity *</label><input id="hv-qty" type="number" min="1" value="${r.quantity}"></div>
          <div class="fg"><label>UoM</label><input id="hv-uom" type="text" value="${r.uom}"></div>
        </div>
        <div class="fg"><label>Notes</label><input id="hv-notes" type="text" value="${r.notes||''}"></div>
        <div class="brow"><button class="bp1" id="ovSave"><i class="ti ti-check"></i>Save</button><button class="bs1" id="ovCancel">Cancel</button></div>`,
        async () => {
          const res2 = await UFCL.harvestUpdate(STORAGE.user.id, r.id, {
            harvest_date: $('hv-date').value, location: $('hv-loc').value.trim(),
            species: $('hv-species').value.trim(), quantity: $('hv-qty').value,
            uom: $('hv-uom').value.trim(), notes: $('hv-notes').value.trim()
          });
          if (!res2.ok) { showOverlayError(res2.error); return; }
          showOverlaySuccess('Harvest log updated.'); await renderHarvest();
        });
    };
  });

  document.querySelectorAll('.hv-del').forEach(btn => {
    btn.onclick = () => {
      const r = rows.find(x => x.id === Number(btn.dataset.id));
      if (!r) return;
      confirmDelete(`Delete harvest log: <strong>${r.species}</strong> at ${r.location} on ${r.harvest_date}?`, async () => {
        const res2 = await UFCL.harvestDelete(STORAGE.user.id, r.id);
        if (!res2.ok) { showOverlayError(res2.error); return; }
        showOverlaySuccess('Harvest log deleted.'); await renderHarvest();
      });
    };
  });

  $('hvAdd').onclick = () => openOverlay('Log harvest', null, `
    <div class="frow">
      <div class="fg"><label>Harvest date *</label><input id="hv-date" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
      <div class="fg"><label>Location *</label><input id="hv-loc" type="text" placeholder="Forest block or GPS ref."></div>
    </div>
    <div class="frow">
      <div class="fg"><label>Species *</label><input id="hv-species" type="text" placeholder="e.g. Eucalyptus, Pine"></div>
      <div class="fg"><label>Quantity *</label><input id="hv-qty" type="number" min="1" placeholder="0"></div>
      <div class="fg"><label>Unit of measure</label><input id="hv-uom" type="text" value="units" placeholder="units, m³, kg"></div>
    </div>
    <div class="fg"><label>Notes</label><input id="hv-notes" type="text"></div>
    <div class="brow"><button class="bp1" id="ovSave"><i class="ti ti-check"></i>Save</button><button class="bs1" id="ovCancel">Cancel</button></div>`, async () => {
    const res2 = await UFCL.harvestCreate(STORAGE.user.id, {
      harvest_date: $('hv-date').value,
      location: $('hv-loc').value.trim(),
      species: $('hv-species').value.trim(),
      quantity: $('hv-qty').value,
      uom: $('hv-uom').value.trim() || 'units',
      notes: $('hv-notes').value.trim()
    });
    if (!res2.ok) { showOverlayError(res2.error); return; }
    showOverlaySuccess('Harvest logged.');
    await renderHarvest();
  });
}

// ── Third-Party Transport ─────────────────────────────────────────────────────

async function renderTransport() {
  const res = await UFCL.transportJobsList(STORAGE.user.id);
  if (!res.ok) return renderDenied('transport', res.error);
  const jobs = res.rows || [];
  const companies = res.companies || [];
  const salesOrders = res.salesOrders || [];

  const jBadge = (s) => {
    const m = { Scheduled: 'ba', 'In Transit': 'bp', Completed: 'bg', Cancelled: 'br' };
    return `<span class="badge ${m[s] || 'ba'}">${s}</span>`;
  };

  const totalCost = jobs.reduce((s, j) => s + Number(j.cost || 0), 0);
  const activeCompanies = companies.length;

  $('page-transport').innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:1.5rem">
      <div>
        <div class="ptitle">Third-Party Transport</div>
        <div class="psub">Manage external carriers, log transport jobs, and link shipments to sales orders for full traceability.</div>
      </div>
      <div style="display:flex;gap:.5rem;flex-shrink:0">
        <button class="bp1" id="tcAdd"><i class="ti ti-building"></i>Add carrier</button>
        <button class="bp1" id="tjAdd" style="background:var(--bg2);color:var(--t1);border:1px solid var(--bdr)"><i class="ti ti-plus"></i>Log job</button>
      </div>
    </div>
    <div class="cards" style="margin-bottom:1.25rem">
      <div class="mc"><div class="mclbl">Carriers</div><div class="mcval">${activeCompanies}</div><div class="mcsub cg"><i class="ti ti-building"></i>registered</div></div>
      <div class="mc"><div class="mclbl">Total jobs</div><div class="mcval">${jobs.length}</div><div class="mcsub cg"><i class="ti ti-truck-loading"></i>last 100</div></div>
      <div class="mc"><div class="mclbl">In transit</div><div class="mcval">${jobs.filter(j=>j.status==='In Transit').length}</div><div class="mcsub bp"><i class="ti ti-truck"></i>active</div></div>
      <div class="mc"><div class="mclbl">Total spend (RWF)</div><div class="mcval">${Math.round(totalCost).toLocaleString()}</div><div class="mcsub ca"><i class="ti ti-coin"></i>all jobs</div></div>
    </div>

    <div class="card" style="padding:0;margin-bottom:1.25rem">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;border-bottom:1px solid var(--bdr)">
        <h3 style="margin:0"><i class="ti ti-building"></i>Registered carriers</h3>
        <span style="font-size:12px;color:var(--t3)">${companies.length} carrier${companies.length!==1?'s':''}</span>
      </div>
      <div class="tw"><table class="dt">
        <thead><tr><th>Company</th><th>Contact person</th><th>Phone</th><th>Rate / km (RWF)</th><th>Jobs assigned</th><th>Total paid (RWF)</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody id="tc-tbody">
          ${companies.length ? companies.map(c => `<tr>
            <td style="font-weight:600">${c.name}</td>
            <td>${c.contact_person||'—'}</td>
            <td>${c.phone||'—'}</td>
            <td style="font-family:var(--fm)">${c.rate_per_km?Number(c.rate_per_km).toLocaleString():'—'}</td>
            <td style="font-family:var(--fm)">${c.job_count}</td>
            <td style="font-family:var(--fm)">${Math.round(Number(c.total_cost||0)).toLocaleString()}</td>
            <td><span class="badge ${c.active?'bg':'br'}">${c.active?'Active':'Inactive'}</span></td>
            <td style="white-space:nowrap">
              <button class="bs1 tc-edit" data-id="${c.id}"><i class="ti ti-edit"></i>Edit</button>
              <button class="bs1 tc-del" data-id="${c.id}" style="color:var(--red)"><i class="ti ti-trash"></i></button>
            </td>
          </tr>`).join('') : '<tr><td colspan="8" style="text-align:center;color:var(--t3);padding:2rem"><i class="ti ti-building" style="font-size:1.75rem;display:block;margin-bottom:.5rem;opacity:.35"></i>No carriers registered yet.</td></tr>'}
        </tbody>
      </table></div>
    </div>

    <div class="card" style="padding:0">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;border-bottom:1px solid var(--bdr)">
        <h3 style="margin:0"><i class="ti ti-truck-loading"></i>Transport jobs</h3>
        <span style="font-size:12px;color:var(--t3)">${jobs.length} job${jobs.length!==1?'s':''}</span>
      </div>
      <div class="tw"><table class="dt">
        <thead><tr><th>Job #</th><th>Date</th><th>Carrier</th><th>Type</th><th>Sales order</th><th>Origin → Destination</th><th>Qty</th><th>Waybill</th><th>Cost (RWF)</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          ${jobs.length ? jobs.map(j => `<tr>
            <td style="font-family:var(--fm);font-weight:700">${j.job_number}</td>
            <td style="white-space:nowrap;color:var(--t3);font-size:12px">${j.job_date}</td>
            <td style="font-weight:500">${j.company_name}</td>
            <td><span class="badge bt">${j.job_type}</span></td>
            <td style="font-family:var(--fm)">${j.sales_order_number||'—'}${j.customer_name?`<div style="font-size:11px;color:var(--t3)">${j.customer_name}</div>`:''}</td>
            <td>${j.origin||'—'}${j.destination?` → ${j.destination}`:''}</td>
            <td style="font-family:var(--fm)">${j.quantity?Number(j.quantity).toLocaleString()+(j.uom?' '+j.uom:''):'—'}</td>
            <td style="font-family:var(--fm);color:var(--t3)">${j.waybill_ref||'—'}</td>
            <td style="font-family:var(--fm)">${j.cost?Number(j.cost).toLocaleString():'—'}</td>
            <td>${jBadge(j.status)}</td>
            <td style="white-space:nowrap;display:flex;gap:4px;align-items:center">
              <select class="tj-status-sel" data-id="${j.id}" style="font-size:12px;padding:3px 6px;background:var(--bg2);border:1px solid var(--bdr);color:var(--t1);border-radius:4px">
                ${['Scheduled','In Transit','Completed','Cancelled'].map(s=>`<option value="${s}" ${j.status===s?'selected':''}>${s}</option>`).join('')}
              </select>
              <button class="bs1 tj-edit" data-id="${j.id}" style="padding:3px 8px"><i class="ti ti-edit"></i></button>
              <button class="bs1 tj-del" data-id="${j.id}" style="padding:3px 8px;color:var(--red)"><i class="ti ti-trash"></i></button>
            </td>
          </tr>`).join('') : '<tr><td colspan="11" style="text-align:center;color:var(--t3);padding:3rem"><i class="ti ti-truck-loading" style="font-size:2rem;display:block;margin-bottom:.5rem;opacity:.35"></i>No jobs logged yet. Click <strong>Log job</strong> to record your first transport.</td></tr>'}
        </tbody>
      </table></div>
    </div>`;

  // ── Add company ────────────────────────────────────────────────────────────
  function companyForm(c) {
    return `
      <div class="frow">
        <div class="fg"><label>Company name *</label><input id="tc-name" type="text" value="${c ? c.name : ''}" placeholder="e.g. Kigali Transport Ltd"></div>
        <div class="fg"><label>Contact person</label><input id="tc-contact" type="text" value="${c ? c.contact_person || '' : ''}" placeholder="Full name"></div>
      </div>
      <div class="frow">
        <div class="fg"><label>Phone</label><input id="tc-phone" type="text" value="${c ? c.phone || '' : ''}" placeholder="+250 7XX XXX XXX"></div>
        <div class="fg"><label>Email</label><input id="tc-email" type="email" value="${c ? c.email || '' : ''}" placeholder="contact@company.com"></div>
      </div>
      <div class="frow">
        <div class="fg"><label>Rate per km (RWF)</label><input id="tc-rate" type="number" min="0" value="${c ? c.rate_per_km || '' : ''}" placeholder="0"></div>
        <div class="fg"><label>Notes</label><input id="tc-notes" type="text" value="${c ? c.notes || '' : ''}"></div>
      </div>
      <div class="brow"><button class="bp1" id="ovSave"><i class="ti ti-check"></i>Save</button><button class="bs1" id="ovCancel">Cancel</button></div>`;
  }

  $('tcAdd').onclick = () => openOverlay('Add transport company', null, companyForm(null), async () => {
    const r = await UFCL.transportCompaniesCreate(STORAGE.user.id, {
      name: $('tc-name').value.trim(),
      contact_person: $('tc-contact').value.trim(),
      phone: $('tc-phone').value.trim(),
      email: $('tc-email').value.trim(),
      rate_per_km: $('tc-rate').value,
      notes: $('tc-notes').value.trim()
    });
    if (!r.ok) { showOverlayError(r.error); return; }
    showOverlaySuccess('Company added.');
    await renderTransport();
  });

  document.querySelectorAll('.tc-edit').forEach(btn => {
    btn.onclick = () => {
      const c = companies.find(x => x.id === Number(btn.dataset.id));
      if (!c) return;
      openOverlay('Edit transport company', c.name, companyForm(c), async () => {
        const r = await UFCL.transportCompaniesUpdate(STORAGE.user.id, c.id, {
          name: $('tc-name').value.trim(),
          contact_person: $('tc-contact').value.trim(),
          phone: $('tc-phone').value.trim(),
          email: $('tc-email').value.trim(),
          rate_per_km: $('tc-rate').value,
          notes: $('tc-notes').value.trim(),
          active: c.active
        });
        if (!r.ok) { showOverlayError(r.error); return; }
        showOverlaySuccess('Company updated.');
        await renderTransport();
      });
    };
  });

  document.querySelectorAll('.tc-del').forEach(btn => {
    btn.onclick = () => {
      const c = companies.find(x => x.id === Number(btn.dataset.id));
      if (!c) return;
      confirmDelete(`Delete transport company <strong>${c.name}</strong>?`, async () => {
        const res2 = await UFCL.transportCompaniesDelete(STORAGE.user.id, c.id);
        if (!res2.ok) { showOverlayError(res2.error); return; }
        showOverlaySuccess('Company deleted.'); await renderTransport();
      });
    };
  });

  // ── Log transport job ──────────────────────────────────────────────────────
  $('tjAdd').onclick = () => openTransportJobOverlay(companies, salesOrders, null, async () => renderTransport());

  // ── Update job status ──────────────────────────────────────────────────────
  document.querySelectorAll('.tj-status-sel').forEach(sel => {
    sel.onchange = async () => {
      const r = await UFCL.transportJobsUpdateStatus(STORAGE.user.id, Number(sel.dataset.id), sel.value);
      if (!r.ok) { alert(r.error); await renderTransport(); }
    };
  });

  document.querySelectorAll('.tj-edit').forEach(btn => {
    btn.onclick = () => {
      const j = jobs.find(x => x.id === Number(btn.dataset.id));
      if (!j) return;
      const coOpts = companies.map(c => `<option value="${c.id}" ${j.company_name===c.name?'selected':''}>${c.name}</option>`).join('');
      const soOpts = `<option value="">— None —</option>` +
        salesOrders.map(s => `<option value="${s.id}" ${j.sales_order_number===s.order_number?'selected':''}>${s.order_number} — ${s.customer_name}</option>`).join('');
      openOverlay('Edit transport job', j.job_number, `
        <div class="frow">
          <div class="fg"><label>Company *</label><select id="tje-co">${coOpts}</select></div>
          <div class="fg"><label>Date *</label><input id="tje-date" type="date" value="${j.job_date.split('/').reverse().join('-')}"></div>
          <div class="fg"><label>Type</label><select id="tje-type"><option ${j.job_type==='Delivery'?'selected':''}>Delivery</option><option ${j.job_type==='Pickup'?'selected':''}>Pickup</option><option ${j.job_type==='Return'?'selected':''}>Return</option><option ${j.job_type==='Transfer'?'selected':''}>Transfer</option></select></div>
        </div>
        <div class="fg"><label>Linked sales order</label><select id="tje-so">${soOpts}</select></div>
        <div class="frow">
          <div class="fg"><label>Origin</label><input id="tje-origin" type="text" value="${j.origin||''}"></div>
          <div class="fg"><label>Destination</label><input id="tje-dest" type="text" value="${j.destination||''}"></div>
        </div>
        <div class="frow">
          <div class="fg"><label>Quantity</label><input id="tje-qty" type="number" min="0" value="${j.quantity||''}"></div>
          <div class="fg"><label>UoM</label><input id="tje-uom" type="text" value="${j.uom||'units'}"></div>
          <div class="fg"><label>Cost (RWF)</label><input id="tje-cost" type="number" min="0" value="${j.cost||''}"></div>
        </div>
        <div class="frow">
          <div class="fg"><label>Waybill ref</label><input id="tje-waybill" type="text" value="${j.waybill_ref||''}"></div>
          <div class="fg"><label>Notes</label><input id="tje-notes" type="text" value="${j.notes||''}"></div>
        </div>
        <div class="brow"><button class="bp1" id="ovSave"><i class="ti ti-check"></i>Save</button><button class="bs1" id="ovCancel">Cancel</button></div>`,
        async () => {
          const res2 = await UFCL.transportJobsUpdate(STORAGE.user.id, j.id, {
            transport_company_id: $('tje-co').value,
            job_date: $('tje-date').value, job_type: $('tje-type').value,
            sales_order_id: $('tje-so').value || null,
            origin: $('tje-origin').value.trim(), destination: $('tje-dest').value.trim(),
            quantity: $('tje-qty').value || null, uom: $('tje-uom').value.trim(),
            cost: $('tje-cost').value || null, waybill_ref: $('tje-waybill').value.trim(),
            notes: $('tje-notes').value.trim()
          });
          if (!res2.ok) { showOverlayError(res2.error); return; }
          showOverlaySuccess('Transport job updated.'); await renderTransport();
        });
    };
  });

  document.querySelectorAll('.tj-del').forEach(btn => {
    btn.onclick = () => {
      const j = jobs.find(x => x.id === Number(btn.dataset.id));
      if (!j) return;
      confirmDelete(`Delete transport job <strong>${j.job_number}</strong> (${j.company_name})?`, async () => {
        const res2 = await UFCL.transportJobsDelete(STORAGE.user.id, j.id);
        if (!res2.ok) { showOverlayError(res2.error); return; }
        showOverlaySuccess('Transport job deleted.'); await renderTransport();
      });
    };
  });
}

function openTransportJobOverlay(companies, salesOrders, prefillSalesOrderId, onDone) {
  const coOpts = companies.map(c => `<option value="${c.id}">${c.name}${c.phone ? ' — ' + c.phone : ''}</option>`).join('');
  const soOpts = `<option value="">— None (standalone job) —</option>` +
    salesOrders.map(s => `<option value="${s.id}" ${prefillSalesOrderId && Number(prefillSalesOrderId) === s.id ? 'selected' : ''}>${s.order_number} — ${s.customer_name} (${s.product_type} ${s.product_size}, qty ${s.quantity})</option>`).join('');

  openOverlay('Log transport job', 'Assign a third-party company to move goods', `
    <div class="frow">
      <div class="fg"><label>Transport company *</label>
        <select id="tj-co">${coOpts || '<option>No companies registered</option>'}</select>
      </div>
      <div class="fg"><label>Job date *</label><input id="tj-date" type="date" value="${new Date().toISOString().slice(0, 10)}"></div>
      <div class="fg"><label>Job type</label>
        <select id="tj-type">
          <option value="Delivery">Delivery</option>
          <option value="Pickup">Pickup</option>
          <option value="Return">Return</option>
          <option value="Transfer">Internal Transfer</option>
        </select>
      </div>
    </div>
    <div class="fg"><label>Linked sales order</label><select id="tj-so">${soOpts}</select></div>
    <div class="frow">
      <div class="fg"><label>Origin</label><input id="tj-origin" type="text" placeholder="Loading point / address"></div>
      <div class="fg"><label>Destination</label><input id="tj-dest" type="text" placeholder="Delivery address"></div>
    </div>
    <div class="frow">
      <div class="fg"><label>Quantity</label><input id="tj-qty" type="number" min="0" placeholder="0"></div>
      <div class="fg"><label>Unit</label><input id="tj-uom" type="text" value="units" placeholder="units, m³, kg"></div>
      <div class="fg"><label>Cost (RWF)</label><input id="tj-cost" type="number" min="0" placeholder="0"></div>
    </div>
    <div class="frow">
      <div class="fg"><label>Waybill / ref #</label><input id="tj-waybill" type="text" placeholder="External reference number"></div>
      <div class="fg"><label>Notes</label><input id="tj-notes" type="text"></div>
    </div>
    <div class="brow"><button class="bp1" id="ovSave"><i class="ti ti-check"></i>Save job</button><button class="bs1" id="ovCancel">Cancel</button></div>`,
    async () => {
      const r = await UFCL.transportJobsCreate(STORAGE.user.id, {
        transport_company_id: $('tj-co').value,
        job_date: $('tj-date').value,
        job_type: $('tj-type').value,
        sales_order_id: $('tj-so').value || null,
        origin: $('tj-origin').value.trim(),
        destination: $('tj-dest').value.trim(),
        quantity: $('tj-qty').value || null,
        uom: $('tj-uom').value.trim(),
        cost: $('tj-cost').value || null,
        waybill_ref: $('tj-waybill').value.trim(),
        notes: $('tj-notes').value.trim()
      });
      if (!r.ok) { showOverlayError(r.error); return; }
      showOverlaySuccess(`Job ${r.jobNum} saved.`);
      await onDone();
    }
  );
}

// ── Timber Inventory ──────────────────────────────────────────────────────────

async function renderTimberInventory() {
  const res = await UFCL.timberInventoryList(STORAGE.user.id);
  if (!res.ok) return renderDenied('timber-inventory', res.error);
  const { stock, logs7 = [], harvestSummary = [], wasteRate } = res;

  $('page-timber-inventory').innerHTML = `
    <div class="ptitle">Timber Inventory</div>
    <div class="psub">Real-time view of all timber, poles, and production stock balances derived from daily production and sales.</div>

    <div class="cards">
      <div class="mc"><div class="mclbl">Timber in stock</div><div class="mcval">${stock.timberStock.toLocaleString()}</div><div class="mcsub cg"><i class="ti ti-trees"></i>units</div></div>
      <div class="mc"><div class="mclbl">Poles in stock</div><div class="mcval">${stock.polesStock.toLocaleString()}</div><div class="mcsub bp"><i class="ti ti-align-center"></i>units</div></div>
      <div class="mc"><div class="mclbl">Timber produced</div><div class="mcval">${stock.timberProduced.toLocaleString()}</div><div class="mcsub cg"><i class="ti ti-hammer"></i>all time</div></div>
      <div class="mc"><div class="mclbl">Waste rate</div><div class="mcval">${wasteRate}%</div><div class="mcsub ${Number(wasteRate)>15?'cr':'ca'}"><i class="ti ti-recycle"></i>all time</div></div>
    </div>

    <div class="cards" style="margin-top:.5rem">
      <div class="card" style="flex:1;min-width:280px;margin:0">
        <h3><i class="ti ti-trees"></i>Timber stock breakdown</h3>
        <table class="dt">
          <thead><tr><th>Type</th><th>Produced</th><th>Sold</th><th>Stock</th></tr></thead>
          <tbody>
            <tr><td>Kiln-dried</td><td style="font-family:var(--fm)">${stock.kilnDriedProduced.toLocaleString()}</td><td style="font-family:var(--fm)">${stock.kilnDriedSold.toLocaleString()}</td><td style="font-family:var(--fm);font-weight:600;color:${stock.kilnDriedStock<=0?'var(--red)':'inherit'}">${stock.kilnDriedStock.toLocaleString()}</td></tr>
            <tr><td>CCA-treated</td><td style="font-family:var(--fm)">${stock.ccaTreatedProduced.toLocaleString()}</td><td style="font-family:var(--fm)">${stock.ccaTreatedSold.toLocaleString()}</td><td style="font-family:var(--fm);font-weight:600;color:${stock.ccaTreatedStock<=0?'var(--red)':'inherit'}">${stock.ccaTreatedStock.toLocaleString()}</td></tr>
            <tr><td>Untreated</td><td style="font-family:var(--fm)">${stock.untreatedProduced.toLocaleString()}</td><td style="font-family:var(--fm)">${stock.untreatedSold.toLocaleString()}</td><td style="font-family:var(--fm);font-weight:600;color:${stock.untreatedStock<=0?'var(--red)':'inherit'}">${stock.untreatedStock.toLocaleString()}</td></tr>
            <tr style="font-weight:600;border-top:2px solid var(--bdr)"><td>Total timber</td><td style="font-family:var(--fm)">${stock.timberProduced.toLocaleString()}</td><td style="font-family:var(--fm)">${stock.timberSold.toLocaleString()}</td><td style="font-family:var(--fm);color:${stock.timberStock<=0?'var(--red)':'var(--green)'}">${stock.timberStock.toLocaleString()}</td></tr>
            <tr><td>Poles</td><td style="font-family:var(--fm)">${stock.polesProduced.toLocaleString()}</td><td style="font-family:var(--fm)">${stock.polesSold.toLocaleString()}</td><td style="font-family:var(--fm);font-weight:600;color:${stock.polesStock<=0?'var(--red)':'inherit'}">${stock.polesStock.toLocaleString()}</td></tr>
          </tbody>
        </table>
      </div>
      <div class="card" style="flex:1;min-width:280px;margin:0">
        <h3><i class="ti ti-trees"></i>Harvest by species</h3>
        ${harvestSummary.length ? `<table class="dt">
          <thead><tr><th>Species</th><th>Total harvested</th><th>Harvest runs</th></tr></thead>
          <tbody>${harvestSummary.map(r=>`<tr>
            <td style="font-weight:500">${r.species}</td>
            <td style="font-family:var(--fm)">${Number(r.total).toLocaleString()}</td>
            <td style="font-family:var(--fm)">${r.harvests}</td>
          </tr>`).join('')}
          </tbody>
        </table>` : `<p style="color:var(--t3);font-size:13px">No harvest records yet. Add them in the Harvest Tracking page.</p>`}
      </div>
    </div>

    <div class="card">
      <h3><i class="ti ti-clipboard-list"></i>Last 7 production days</h3>
      <div class="tw"><table class="dt">
        <thead><tr><th>Date</th><th>Timber total</th><th>Kiln-dried</th><th>CCA-treated</th><th>Untreated</th><th>Timber waste</th><th>Poles</th><th>Pole waste</th><th>Downtime (h)</th><th>Supervisor</th></tr></thead>
        <tbody>${logs7.length ? logs7.map(r=>`<tr>
          <td style="font-weight:500;white-space:nowrap">${r.date}</td>
          <td style="font-family:var(--fm)">${r.timber_units}</td>
          <td style="font-family:var(--fm)">${r.timber_kiln_dried}</td>
          <td style="font-family:var(--fm)">${r.timber_cca_treated}</td>
          <td style="font-family:var(--fm)">${r.timber_untreated}</td>
          <td style="font-family:var(--fm);color:${Number(r.timber_waste)>0?'var(--amber)':''}">${r.timber_waste}</td>
          <td style="font-family:var(--fm)">${r.poles_units}</td>
          <td style="font-family:var(--fm);color:${Number(r.poles_waste)>0?'var(--amber)':''}">${r.poles_waste}</td>
          <td style="font-family:var(--fm);color:${Number(r.downtime_hours)>0?'var(--red)':''}">${Number(r.downtime_hours).toFixed(1)}</td>
          <td>${r.supervisor||'—'}</td>
        </tr>`).join('') : '<tr><td colspan="10" style="text-align:center;color:var(--t3);padding:1.5rem">No production logs in the last 7 days.</td></tr>'}
        </tbody>
      </table></div>
    </div>`;
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

// ── Machine Registry ──────────────────────────────────────────────────────────

async function renderMachines() {
  $('page-machines').innerHTML = `<div style="padding:2rem;color:var(--t3);font-size:13px"><i class="ti ti-loader-2" style="font-size:18px;animation:spin 1s linear infinite"></i> Loading…</div>`;
  const res = await UFCL.machinesList(STORAGE.user.id);
  if (!res.ok) return renderDenied('machines', res.error);

  const rows = res.rows || [];
  const categories = res.categories || [];
  const canManage = ['admin', 'operations', 'ceo', 'logistics'].includes(STORAGE.user?.role);

  const statusCls = s => ({ Available:'bg', Running:'bb', Maintenance:'ba', Breakdown:'br' }[s] || 'bt');
  const byStatus = s => rows.filter(r => r.status === s).length;

  const catOpts = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

  $('page-machines').innerHTML = `
    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:1.5rem">
      <div>
        <div class="ptitle">Machine Registry</div>
        <div class="psub">Manage machine profiles, specifications, operational status, and maintenance schedules.</div>
      </div>
      ${canManage ? `<button class="bp1" id="mchAdd" style="flex-shrink:0;white-space:nowrap"><i class="ti ti-plus"></i>Register machine</button>` : ''}
    </div>
    <div class="cards" style="margin-bottom:1.25rem">
      <div class="mc"><div class="mclbl">Total Machines</div><div class="mcval">${rows.length}</div><div class="mcsub cg"><i class="ti ti-settings-2"></i>registered</div></div>
      <div class="mc"><div class="mclbl">Available</div><div class="mcval">${byStatus('Available')}</div><div class="mcsub cg"><i class="ti ti-circle-check"></i>ready</div></div>
      <div class="mc"><div class="mclbl">Running</div><div class="mcval">${byStatus('Running')}</div><div class="mcsub bp"><i class="ti ti-player-play"></i>active</div></div>
      <div class="mc"><div class="mclbl">Maintenance / Breakdown</div><div class="mcval" style="${(byStatus('Maintenance')+byStatus('Breakdown'))>0?'color:var(--amber)':''}">${byStatus('Maintenance')+byStatus('Breakdown')}</div><div class="mcsub ca"><i class="ti ti-tool"></i>offline</div></div>
    </div>
    <div class="card" style="padding:0">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;border-bottom:1px solid var(--bdr)">
        <h3 style="margin:0"><i class="ti ti-settings-2"></i>Machine register</h3>
        <span style="font-size:12px;color:var(--t3)">${rows.length} machine${rows.length!==1?'s':''}</span>
      </div>
      <div class="tw"><table class="dt">
        <thead><tr><th>Code</th><th>Name</th><th>Category</th><th>Status</th><th>Capacity</th><th>Fuel Rate</th><th>Next Maintenance</th>${canManage?'<th>Actions</th>':''}</tr></thead>
        <tbody>${rows.length ? rows.map(r => `<tr>
          <td style="font-family:var(--fm);font-weight:600">${r.machine_code}</td>
          <td style="font-weight:500">${r.name}</td>
          <td><span class="badge bt">${r.category_name}</span></td>
          <td><span class="badge ${statusCls(r.status)}">${r.status}</span></td>
          <td style="font-family:var(--fm)">${r.production_capacity ? Number(r.production_capacity).toLocaleString()+' '+r.capacity_unit+'/day' : '—'}</td>
          <td style="font-family:var(--fm)">${r.fuel_consumption_rate ? Number(r.fuel_consumption_rate)+' L/hr' : '—'}</td>
          <td style="${r.next_maintenance && new Date(r.next_maintenance) <= new Date() ? 'color:var(--red);font-weight:600' : 'color:var(--t3)'}">
            ${r.next_maintenance ? new Date(r.next_maintenance).toLocaleDateString('en-GB') : '—'}
          </td>
          ${canManage ? `<td style="white-space:nowrap">
            <button class="bs1 mch-edit" data-id="${r.id}" style="margin-right:4px"><i class="ti ti-edit"></i>Edit</button>
            <button class="bs1 mch-maint" data-id="${r.id}" title="Maintenance schedules"><i class="ti ti-calendar"></i></button>
          </td>` : ''}
        </tr>`).join('')
        : `<tr><td colspan="${canManage?8:7}" style="text-align:center;color:var(--t3);padding:3rem"><i class="ti ti-settings-2" style="font-size:2rem;display:block;margin-bottom:.5rem;opacity:.35"></i>No machines registered yet.</td></tr>`}
        </tbody>
      </table></div>
    </div>`;

  function machineForm(r) {
    const catSel = categories.map(c => `<option value="${c.id}" ${r&&Number(r.category_id)===c.id?'selected':''}>${c.name}</option>`).join('');
    const statusOpts = ['Available','Running','Maintenance','Breakdown'].map(s => `<option value="${s}" ${r&&r.status===s?'selected':''}>${s}</option>`).join('');
    return `
      <div class="frow">
        <div class="fg"><label>Machine Code *</label><input id="mch-code" type="text" value="${r?r.machine_code:''}" placeholder="e.g. SW-001" ${r?'readonly':''}></div>
        <div class="fg"><label>Name *</label><input id="mch-name" type="text" value="${r?r.name:''}" placeholder="Machine name"></div>
      </div>
      <div class="frow">
        <div class="fg"><label>Category *</label><select id="mch-cat">${catSel}</select></div>
        <div class="fg"><label>Status</label><select id="mch-status">${statusOpts}</select></div>
      </div>
      <div class="frow">
        <div class="fg"><label>Production Capacity (per day)</label><input id="mch-cap" type="number" min="0" value="${r?r.production_capacity:0}"></div>
        <div class="fg"><label>Capacity Unit</label><input id="mch-capunit" type="text" value="${r?r.capacity_unit:'m³'}" placeholder="m³"></div>
      </div>
      <div class="frow">
        <div class="fg"><label>Fuel Consumption (L/hr)</label><input id="mch-fuel" type="number" min="0" step="0.1" value="${r?r.fuel_consumption_rate:0}"></div>
        <div class="fg"><label>Fuel Type</label><input id="mch-fueltype" type="text" value="${r?r.fuel_type||'':''}" placeholder="Diesel / Petrol"></div>
      </div>
      <div class="frow">
        <div class="fg"><label>Manufacturer</label><input id="mch-mfg" type="text" value="${r?r.manufacturer||'':''}"></div>
        <div class="fg"><label>Model</label><input id="mch-model" type="text" value="${r?r.model_number||'':''}"></div>
      </div>
      <div class="frow">
        <div class="fg"><label>Serial Number</label><input id="mch-serial" type="text" value="${r?r.serial_number||'':''}"></div>
        <div class="fg"><label>Year Manufactured</label><input id="mch-year" type="number" min="1900" max="2099" value="${r&&r.year_manufactured?r.year_manufactured:''}"></div>
      </div>
      <div class="frow">
        <div class="fg"><label>Date Acquired</label><input id="mch-acquired" type="date" value="${r&&r.date_acquired?String(r.date_acquired).slice(0,10):''}"></div>
        <div class="fg"><label>Notes</label><input id="mch-notes" type="text" value="${r?r.notes||'':''}"></div>
      </div>
      <div class="brow"><button class="bp1" id="ovSave"><i class="ti ti-check"></i>Save</button><button class="bs1" id="ovCancel">Cancel</button></div>`;
  }

  if (canManage) {
    $('mchAdd').onclick = () => openOverlay('Register machine', null, machineForm(null), async () => {
      const r2 = await UFCL.machinesCreate(STORAGE.user.id, {
        machine_code: $('mch-code').value.trim(),
        name: $('mch-name').value.trim(),
        category_id: $('mch-cat').value,
        status: $('mch-status').value,
        production_capacity: $('mch-cap').value,
        capacity_unit: $('mch-capunit').value.trim() || 'm³',
        fuel_consumption_rate: $('mch-fuel').value,
        fuel_type: $('mch-fueltype').value.trim(),
        manufacturer: $('mch-mfg').value.trim(),
        model_number: $('mch-model').value.trim(),
        serial_number: $('mch-serial').value.trim(),
        year_manufactured: $('mch-year').value || null,
        date_acquired: $('mch-acquired').value || null,
        notes: $('mch-notes').value.trim()
      });
      if (!r2.ok) { showOverlayError(r2.error); return; }
      showOverlaySuccess('Machine registered.');
      await renderMachines();
    });

    document.querySelectorAll('.mch-edit').forEach(btn => {
      btn.onclick = () => {
        const row = rows.find(r => r.id === Number(btn.dataset.id));
        if (!row) return;
        openOverlay('Edit machine', row.machine_code + ' — ' + row.name, machineForm(row), async () => {
          const r2 = await UFCL.machinesUpdate(STORAGE.user.id, row.id, {
            name: $('mch-name').value.trim(),
            category_id: $('mch-cat').value,
            status: $('mch-status').value,
            production_capacity: $('mch-cap').value,
            capacity_unit: $('mch-capunit').value.trim() || 'm³',
            fuel_consumption_rate: $('mch-fuel').value,
            fuel_type: $('mch-fueltype').value.trim(),
            manufacturer: $('mch-mfg').value.trim(),
            model_number: $('mch-model').value.trim(),
            serial_number: $('mch-serial').value.trim(),
            year_manufactured: $('mch-year').value || null,
            date_acquired: $('mch-acquired').value || null,
            notes: $('mch-notes').value.trim()
          });
          if (!r2.ok) { showOverlayError(r2.error); return; }
          showOverlaySuccess('Machine updated.');
          await renderMachines();
        });
      };
    });

    document.querySelectorAll('.mch-maint').forEach(btn => {
      btn.onclick = async () => {
        const row = rows.find(r => r.id === Number(btn.dataset.id));
        if (!row) return;
        const mr = await UFCL.machineMaintList(STORAGE.user.id, row.id);
        const schedules = mr.ok ? (mr.rows || []) : [];
        const schedHtml = schedules.length
          ? schedules.map(s => `<tr>
              <td style="font-weight:500">${s.maintenance_type}</td>
              <td>${s.frequency_days}d</td>
              <td>${s.last_performed ? new Date(s.last_performed).toLocaleDateString('en-GB') : '—'}</td>
              <td style="${s.next_due && new Date(s.next_due)<=new Date()?'color:var(--red);font-weight:600':''}">${s.next_due ? new Date(s.next_due).toLocaleDateString('en-GB') : '—'}</td>
              <td>${s.estimated_hours}h</td>
            </tr>`).join('')
          : `<tr><td colspan="5" style="text-align:center;color:var(--t3);padding:1rem">No schedules defined yet.</td></tr>`;
        openOverlay('Maintenance schedules', row.machine_code + ' — ' + row.name, `
          <div class="tw" style="margin-bottom:1rem"><table class="dt">
            <thead><tr><th>Type</th><th>Frequency</th><th>Last done</th><th>Next due</th><th>Est. hrs</th></tr></thead>
            <tbody>${schedHtml}</tbody>
          </table></div>
          <div style="border-top:1px solid var(--bdr);padding-top:1rem;margin-top:.5rem">
            <div style="font-weight:600;font-size:13px;margin-bottom:.75rem">Add new schedule</div>
            <div class="frow">
              <div class="fg"><label>Type *</label><input id="ms-type" type="text" placeholder="e.g. Oil Change"></div>
              <div class="fg"><label>Frequency (days)</label><input id="ms-freq" type="number" min="1" value="30"></div>
            </div>
            <div class="frow">
              <div class="fg"><label>Last Performed</label><input id="ms-last" type="date"></div>
              <div class="fg"><label>Next Due</label><input id="ms-next" type="date"></div>
            </div>
            <div class="frow">
              <div class="fg"><label>Est. Hours</label><input id="ms-hours" type="number" min="0.5" step="0.5" value="1"></div>
              <div class="fg"><label>Notes</label><input id="ms-notes" type="text"></div>
            </div>
          </div>
          <div class="brow"><button class="bp1" id="ovSave"><i class="ti ti-plus"></i>Add schedule</button><button class="bs1" id="ovCancel">Cancel</button></div>`,
          async () => {
            const r2 = await UFCL.machineMaintCreate(STORAGE.user.id, {
              machine_id: row.id,
              maintenance_type: $('ms-type').value.trim(),
              frequency_days: $('ms-freq').value || 30,
              last_performed: $('ms-last').value || null,
              next_due: $('ms-next').value || null,
              estimated_hours: $('ms-hours').value || 1,
              notes: $('ms-notes').value.trim()
            });
            if (!r2.ok) { showOverlayError(r2.error); return; }
            showOverlaySuccess('Schedule added.');
            await renderMachines();
          });
      };
    });
  }
}

// ── Machine Daily Logs ────────────────────────────────────────────────────────

async function renderMachineLogs() {
  $('page-machine-logs').innerHTML = `<div style="padding:2rem;color:var(--t3);font-size:13px"><i class="ti ti-loader-2" style="font-size:18px;animation:spin 1s linear infinite"></i> Loading…</div>`;

  const today = new Date();
  const defaultMonth = today.toISOString().slice(0, 7);

  const res = await UFCL.machineLogsList(STORAGE.user.id, null, defaultMonth);
  if (!res.ok) return renderDenied('machine-logs', res.error);

  const rows = res.rows || [];
  const machines = res.machines || [];
  const canDelete = ['admin', 'operations'].includes(STORAGE.user?.role);
  const canAdd = ['admin', 'operations', 'supervisor'].includes(STORAGE.user?.role);

  const totalHours = rows.reduce((s, r) => s + Number(r.hours_worked), 0);
  const totalDowntime = rows.reduce((s, r) => s + Number(r.downtime_hours), 0);
  const totalProduction = rows.reduce((s, r) => s + Number(r.daily_production), 0);
  const totalCapacity = rows.reduce((s, r) => s + Number(r.capacity_per_day), 0);
  const avgEfficiency = totalCapacity > 0 ? Math.round((totalProduction / totalCapacity) * 100) : 0;

  const machineOpts = machines.map(m => `<option value="${m.id}">${m.machine_code} — ${m.name}</option>`).join('');
  const shiftOpts = ['Full Day','Day Shift','Night Shift'].map(s => `<option>${s}</option>`).join('');

  $('page-machine-logs').innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:1.5rem">
      <div>
        <div class="ptitle">Machine Daily Logs</div>
        <div class="psub">Log daily production, hours worked, downtime, and fuel consumption for each machine.</div>
      </div>
      ${canAdd ? `<button class="bp1" id="mlAdd" style="flex-shrink:0;white-space:nowrap"><i class="ti ti-plus"></i>Add log entry</button>` : ''}
    </div>
    <div class="cards" style="margin-bottom:1.25rem">
      <div class="mc"><div class="mclbl">Entries This Month</div><div class="mcval">${rows.length}</div><div class="mcsub cg"><i class="ti ti-list-details"></i>${defaultMonth}</div></div>
      <div class="mc"><div class="mclbl">Total Hours Worked</div><div class="mcval">${totalHours.toFixed(1)}</div><div class="mcsub cg"><i class="ti ti-clock"></i>productive hrs</div></div>
      <div class="mc"><div class="mclbl">Total Downtime</div><div class="mcval" style="${totalDowntime>0?'color:var(--amber)':''}">${totalDowntime.toFixed(1)}</div><div class="mcsub ca"><i class="ti ti-clock-x"></i>hrs</div></div>
      <div class="mc"><div class="mclbl">Avg Efficiency</div><div class="mcval" style="${avgEfficiency<75?'color:var(--amber)':'color:var(--green)'}">${avgEfficiency}%</div><div class="mcsub ${avgEfficiency>=75?'cg':'ca'}"><i class="ti ti-chart-line"></i>production vs capacity</div></div>
    </div>
    <div class="card" style="padding:0">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;border-bottom:1px solid var(--bdr)">
        <h3 style="margin:0"><i class="ti ti-list-details"></i>Log entries — ${defaultMonth}</h3>
        <span style="font-size:12px;color:var(--t3)">${rows.length} entr${rows.length!==1?'ies':'y'}</span>
      </div>
      <div class="tw"><table class="dt">
        <thead><tr><th>Date</th><th>Machine</th><th>Category</th><th>Shift</th><th>Hrs Worked</th><th>Downtime</th><th>Production</th><th>Capacity</th><th>Efficiency</th><th>Fuel (L)</th>${canDelete?'<th>Actions</th>':''}</tr></thead>
        <tbody>${rows.length ? rows.map(r => {
          const eff = Number(r.capacity_per_day) > 0
            ? Math.round((Number(r.daily_production) / Number(r.capacity_per_day)) * 100)
            : null;
          const effCol = eff === null ? 'color:var(--t3)' : eff >= 90 ? 'color:var(--green);font-weight:600' : eff >= 70 ? 'color:var(--amber)' : 'color:var(--red);font-weight:600';
          return `<tr>
            <td>${new Date(r.log_date+'T12:00:00').toLocaleDateString('en-GB')}</td>
            <td style="font-weight:500">${r.machine_code} — ${r.machine_name}</td>
            <td><span class="badge bt">${r.category_name}</span></td>
            <td>${r.shift}</td>
            <td style="font-family:var(--fm)">${Number(r.hours_worked).toFixed(1)}</td>
            <td style="font-family:var(--fm);${Number(r.downtime_hours)>0?'color:var(--amber)':''}">${Number(r.downtime_hours).toFixed(1)}</td>
            <td style="font-family:var(--fm)">${Number(r.daily_production) > 0 ? Number(r.daily_production).toLocaleString() : '—'}</td>
            <td style="font-family:var(--fm);color:var(--t3)">${Number(r.capacity_per_day) > 0 ? Number(r.capacity_per_day).toLocaleString() : '—'}</td>
            <td style="font-family:var(--fm);${effCol}">${eff !== null ? eff+'%' : '—'}</td>
            <td style="font-family:var(--fm);color:var(--t3)">${Number(r.fuel_consumed) > 0 ? Number(r.fuel_consumed).toFixed(1) : '—'}</td>
            ${canDelete ? `<td style="white-space:nowrap">
              <button class="bs1 ml-edit" data-id="${r.id}" style="margin-right:4px"><i class="ti ti-edit"></i></button>
              <button class="bs1 ml-del" data-id="${r.id}" style="color:var(--red)"><i class="ti ti-trash"></i></button>
            </td>` : ''}
          </tr>`;
        }).join('')
        : `<tr><td colspan="${canDelete?11:10}" style="text-align:center;color:var(--t3);padding:3rem"><i class="ti ti-list-details" style="font-size:2rem;display:block;margin-bottom:.5rem;opacity:.35"></i>No log entries for this month.</td></tr>`}
        </tbody>
      </table></div>
    </div>`;

  function logForm(r) {
    const mOpts = machines.map(m => `<option value="${m.id}" ${r&&Number(r.machine_id)===m.id?'selected':''}>${m.machine_code} — ${m.name} (${m.category_name})</option>`).join('');
    const sOpts = ['Full Day','Day Shift','Night Shift'].map(s => `<option ${r&&r.shift===s?'selected':''}>${s}</option>`).join('');
    return `
      <div class="frow">
        <div class="fg"><label>Machine *</label><select id="ml-machine" ${r?'disabled':''}>${mOpts}</select></div>
        <div class="fg"><label>Date *</label><input id="ml-date" type="date" value="${r?String(r.log_date).slice(0,10):today.toISOString().slice(0,10)}"></div>
      </div>
      <div class="frow">
        <div class="fg"><label>Shift</label><select id="ml-shift">${sOpts}</select></div>
        <div class="fg"><label>Hours Worked</label><input id="ml-hours" type="number" min="0" step="0.25" value="${r?r.hours_worked:0}"></div>
      </div>
      <div class="frow">
        <div class="fg"><label>Downtime (hrs)</label><input id="ml-dt" type="number" min="0" step="0.25" value="${r?r.downtime_hours:0}"></div>
        <div class="fg"><label>Downtime Reason</label><input id="ml-dtr" type="text" value="${r?r.downtime_reason||'':''}" placeholder="Reason if any"></div>
      </div>
      <div class="frow">
        <div class="fg"><label>Daily Production</label><input id="ml-prod" type="number" min="0" step="0.1" value="${r?r.daily_production:0}"></div>
        <div class="fg"><label>Capacity for Day</label><input id="ml-cap" type="number" min="0" step="0.1" value="${r?r.capacity_per_day:0}"></div>
      </div>
      <div class="frow">
        <div class="fg"><label>Product Type</label><input id="ml-ptype" type="text" value="${r?r.product_type||'':''}" placeholder="e.g. Sawn Timber, Poles"></div>
        <div class="fg"><label>Fuel Consumed (L)</label><input id="ml-fuel" type="number" min="0" step="0.1" value="${r?r.fuel_consumed:0}"></div>
      </div>
      <div style="font-size:12px;color:var(--t3);font-weight:600;margin-bottom:.5rem;margin-top:.25rem">Log Loader fields (fill if applicable)</div>
      <div class="frow">
        <div class="fg"><label>Logs Loaded (m³)</label><input id="ml-loaded" type="number" min="0" step="0.1" value="${r?r.logs_loaded:0}"></div>
        <div class="fg"><label>Logs Unloaded (m³)</label><input id="ml-unloaded" type="number" min="0" step="0.1" value="${r?r.logs_unloaded:0}"></div>
        <div class="fg"><label>Loading Trips</label><input id="ml-trips" type="number" min="0" value="${r?r.loading_trips:0}"></div>
      </div>
      <div class="fg"><label>Remarks</label><input id="ml-remarks" type="text" value="${r&&r.remarks?r.remarks:''}" placeholder="Any notes for this shift"></div>
      <div class="brow"><button class="bp1" id="ovSave"><i class="ti ti-check"></i>Save</button><button class="bs1" id="ovCancel">Cancel</button></div>`;
  }

  function collectLog() {
    return {
      machine_id: $('ml-machine').value,
      log_date: $('ml-date').value,
      shift: $('ml-shift').value,
      hours_worked: $('ml-hours').value,
      downtime_hours: $('ml-dt').value,
      downtime_reason: $('ml-dtr').value.trim() || null,
      daily_production: $('ml-prod').value,
      capacity_per_day: $('ml-cap').value,
      product_type: $('ml-ptype').value.trim() || null,
      fuel_consumed: $('ml-fuel').value,
      logs_loaded: $('ml-loaded').value,
      logs_unloaded: $('ml-unloaded').value,
      loading_trips: $('ml-trips').value,
      remarks: $('ml-remarks').value.trim() || null
    };
  }

  if (canAdd) {
    $('mlAdd').onclick = () => openOverlay('Add machine log', null, logForm(null), async () => {
      const r2 = await UFCL.machineLogsCreate(STORAGE.user.id, collectLog());
      if (!r2.ok) { showOverlayError(r2.error); return; }
      showOverlaySuccess('Log entry saved.');
      await renderMachineLogs();
    });
  }

  if (canDelete) {
    document.querySelectorAll('.ml-edit').forEach(btn => {
      btn.onclick = () => {
        const row = rows.find(r => r.id === Number(btn.dataset.id));
        if (!row) return;
        openOverlay('Edit log entry', row.machine_code + ' · ' + new Date(row.log_date+'T12:00:00').toLocaleDateString('en-GB'), logForm(row), async () => {
          const r2 = await UFCL.machineLogsUpdate(STORAGE.user.id, row.id, collectLog());
          if (!r2.ok) { showOverlayError(r2.error); return; }
          showOverlaySuccess('Log updated.');
          await renderMachineLogs();
        });
      };
    });

    document.querySelectorAll('.ml-del').forEach(btn => {
      btn.onclick = () => {
        const row = rows.find(r => r.id === Number(btn.dataset.id));
        if (!row) return;
        confirmDelete(`Delete log for <strong>${row.machine_code}</strong> on ${new Date(row.log_date+'T12:00:00').toLocaleDateString('en-GB')}?`, async () => {
          const r2 = await UFCL.machineLogsDelete(STORAGE.user.id, row.id);
          if (!r2.ok) { showOverlayError(r2.error); return; }
          showOverlaySuccess('Deleted.'); await renderMachineLogs();
        });
      };
    });
  }
}

// ── Machine KPI Performance ───────────────────────────────────────────────────

async function renderMachineKpi() {
  $('page-machine-kpi').innerHTML = `<div style="padding:2rem;color:var(--t3);font-size:13px"><i class="ti ti-loader-2" style="font-size:18px;animation:spin 1s linear infinite"></i> Loading…</div>`;

  const today = new Date();
  const defaultMonth = today.toISOString().slice(0, 7);
  const [perfRes, machRes] = await Promise.all([
    UFCL.machineKpiPerformance(STORAGE.user.id, defaultMonth),
    UFCL.machinesList(STORAGE.user.id)
  ]);
  if (!perfRes.ok) return renderDenied('machine-kpi', perfRes.ok === false ? perfRes.error : 'Access denied');

  const rows = perfRes.rows || [];
  const machines = machRes.ok ? (machRes.rows || []) : [];
  const canConfig = ['admin', 'operations', 'ceo'].includes(STORAGE.user?.role);

  const withTargets = rows.filter(r => r.kpiResults && r.kpiResults.length > 0);
  const avgAch = withTargets.filter(r => r.avgAchievement !== null);
  const overallAch = avgAch.length ? Math.round(avgAch.reduce((s,r)=>s+r.avgAchievement,0)/avgAch.length) : null;
  const avgUtil = rows.length ? Math.round(rows.reduce((s,r)=>s+Number(r.utilization_pct),0)/rows.length) : 0;
  const top = rows.reduce((best,r) => (!best || Number(r.utilization_pct)>Number(best.utilization_pct)) ? r : best, null);
  const underperf = rows.filter(r => r.avgAchievement !== null && r.avgAchievement < 75).length;

  const achColor = v => v === null ? '' : v >= 90 ? 'color:var(--green);font-weight:700' : v >= 75 ? 'color:var(--amber);font-weight:600' : 'color:var(--red);font-weight:700';
  const achBadge = v => v === null ? '<span style="color:var(--t3)">—</span>'
    : `<span class="badge ${v>=90?'bg':v>=75?'ba':'br'}">${v}%</span>`;

  // Bar chart helper: utilization by machine
  function utilChart(data) {
    if (!data.length) return '<p style="color:var(--t3);font-size:12px">No data yet.</p>';
    const max = Math.max(...data.map(d => Number(d.utilization_pct)), 1);
    return data.map(d => {
      const pct = Math.round(Number(d.utilization_pct));
      const barW = Math.round((pct / max) * 100);
      const col = pct >= 85 ? '#22C55E' : pct >= 65 ? '#F59E0B' : '#EF4444';
      return `<div style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;margin-bottom:2px">
          <span style="font-size:11px;color:var(--t2)">${d.machine_code}</span>
          <span style="font-size:11px;font-family:var(--fm);color:var(--t3)">${pct}%</span>
        </div>
        <div style="background:var(--surf);border-radius:3px;height:8px;overflow:hidden">
          <div style="background:${col};height:100%;width:${barW}%;border-radius:3px;transition:width .3s"></div>
        </div>
      </div>`;
    }).join('');
  }

  $('page-machine-kpi').innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:1.5rem">
      <div>
        <div class="ptitle">KPI Performance</div>
        <div class="psub">Track machine performance against KPI targets — utilisation, production efficiency, and achievement scoring.</div>
      </div>
      <div style="display:flex;align-items:center;gap:.75rem;flex-shrink:0">
        <div style="font-size:12px;color:var(--t3)">Month</div>
        <input type="month" id="kpi-month" value="${defaultMonth}" style="font-size:13px;padding:6px 10px;border:1px solid var(--bdr);border-radius:6px;background:var(--surf);color:var(--t1)">
        ${canConfig ? `<button class="bp1" id="kpiCfg"><i class="ti ti-adjustments"></i>Configure KPIs</button>` : ''}
      </div>
    </div>
    <div class="cards" style="margin-bottom:1.25rem">
      <div class="mc"><div class="mclbl">Avg KPI Achievement</div><div class="mcval" style="${achColor(overallAch)}">${overallAch !== null ? overallAch+'%' : '—'}</div><div class="mcsub ${overallAch===null?'':overallAch>=75?'cg':'cr'}"><i class="ti ti-target"></i>${defaultMonth}</div></div>
      <div class="mc"><div class="mclbl">Avg Utilization</div><div class="mcval" style="${achColor(avgUtil)}">${avgUtil}%</div><div class="mcsub ${avgUtil>=75?'cg':'ca'}"><i class="ti ti-clock"></i>all machines</div></div>
      <div class="mc"><div class="mclbl">Top Machine</div><div class="mcval" style="font-size:16px">${top ? top.machine_code : '—'}</div><div class="mcsub cg"><i class="ti ti-trophy"></i>${top ? Number(top.utilization_pct).toFixed(0)+'% util.' : 'no data'}</div></div>
      <div class="mc"><div class="mclbl">Below Target</div><div class="mcval" style="${underperf>0?'color:var(--red)':''}">${underperf}</div><div class="mcsub ${underperf>0?'cr':'cg'}"><i class="ti ti-alert-triangle"></i>machines <75% KPI</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.25rem">
      <div class="card">
        <h3><i class="ti ti-chart-bar"></i>Utilization by machine</h3>
        ${utilChart(rows)}
      </div>
      <div class="card">
        <h3><i class="ti ti-list-details"></i>Production vs Capacity (${defaultMonth})</h3>
        ${rows.length ? rows.map(r => {
          const eff = Number(r.efficiency_pct);
          const col = eff >= 90 ? '#22C55E' : eff >= 70 ? '#F59E0B' : eff > 0 ? '#EF4444' : '#9CA3AF';
          return `<div style="margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;margin-bottom:2px">
              <span style="font-size:11px;color:var(--t2)">${r.machine_code} <span style="color:var(--t3)">${r.category_name}</span></span>
              <span style="font-size:11px;font-family:var(--fm);color:var(--t3)">${Number(r.total_production).toLocaleString()} / ${Number(r.total_capacity).toLocaleString()}</span>
            </div>
            <div style="background:var(--surf);border-radius:3px;height:8px;overflow:hidden">
              <div style="background:${col};height:100%;width:${Math.min(eff,100)}%;border-radius:3px"></div>
            </div>
          </div>`;
        }).join('') : '<p style="color:var(--t3);font-size:12px">No production data for this month.</p>'}
      </div>
    </div>
    <div class="card" style="padding:0">
      <div style="padding:1rem 1.25rem;border-bottom:1px solid var(--bdr)">
        <h3 style="margin:0"><i class="ti ti-target"></i>KPI achievement by machine — ${defaultMonth}</h3>
      </div>
      <div class="tw"><table class="dt">
        <thead><tr><th>Machine</th><th>Category</th><th>Status</th><th>Util %</th><th>Efficiency %</th><th>Days Logged</th><th>Total Hrs</th><th>KPI Achievement</th>${canConfig?'<th>Set Targets</th>':''}</tr></thead>
        <tbody>${rows.length ? rows.map(r => `<tr>
          <td style="font-weight:600;font-family:var(--fm)">${r.machine_code}<br><span style="font-size:11px;font-weight:400;font-family:inherit;color:var(--t3)">${r.machine_name}</span></td>
          <td><span class="badge bt">${r.category_name}</span></td>
          <td><span class="badge ${r.status==='Available'?'bg':r.status==='Running'?'bb':r.status==='Maintenance'?'ba':r.status==='Breakdown'?'br':'bt'}">${r.status}</span></td>
          <td style="${achColor(Number(r.utilization_pct))};font-family:var(--fm)">${Number(r.utilization_pct).toFixed(1)}%</td>
          <td style="${achColor(Number(r.efficiency_pct))};font-family:var(--fm)">${Number(r.efficiency_pct) > 0 ? Number(r.efficiency_pct).toFixed(1)+'%' : '—'}</td>
          <td style="font-family:var(--fm)">${r.days_logged}</td>
          <td style="font-family:var(--fm)">${Number(r.total_hours_worked).toFixed(1)}</td>
          <td>
            ${achBadge(r.avgAchievement)}
            ${r.kpiResults && r.kpiResults.length ? `<div style="margin-top:4px">${r.kpiResults.map(k =>
              `<div style="font-size:11px;color:var(--t3);display:flex;gap:4px;align-items:center">
                <span>${k.kpi_name}:</span>
                <span style="font-family:var(--fm)">${k.actual !== null ? Number(k.actual).toFixed(1)+' '+k.unit : '—'}</span>
                ${k.achievement !== null ? `<span style="color:${k.achievement>=90?'var(--green)':k.achievement>=75?'var(--amber)':'var(--red)'}">(${k.achievement}%)</span>` : ''}
              </div>`).join('')}
            </div>` : '<div style="font-size:11px;color:var(--t3);margin-top:3px">No KPI targets set</div>'}
          </td>
          ${canConfig ? `<td><button class="bs1 kpi-set" data-id="${r.machine_id}" data-name="${r.machine_code}" style="font-size:12px;padding:4px 8px"><i class="ti ti-target"></i>Set targets</button></td>` : ''}
        </tr>`).join('')
        : `<tr><td colspan="${canConfig?9:8}" style="text-align:center;color:var(--t3);padding:3rem"><i class="ti ti-chart-line" style="font-size:2rem;display:block;margin-bottom:.5rem;opacity:.35"></i>No machines found. Register machines first.</td></tr>`}
        </tbody>
      </table></div>
    </div>`;

  // Month change → reload
  $('kpi-month').onchange = async () => {
    const m = $('kpi-month').value;
    if (!m) return;
    const nr = await UFCL.machineKpiPerformance(STORAGE.user.id, m);
    if (nr.ok) {
      // Re-render with new month (simple approach: rebuild the table section)
      await renderMachineKpi();
    }
  };

  // Set KPI targets overlay
  if (canConfig) {
    document.querySelectorAll('.kpi-set').forEach(btn => {
      btn.onclick = async () => {
        const machineId = Number(btn.dataset.id);
        const machName = btn.dataset.name;
        const month = $('kpi-month')?.value || defaultMonth;
        const tr = await UFCL.machineKpiTargetsList(STORAGE.user.id, machineId, month);
        if (!tr.ok) { alert(tr.error); return; }
        const kpiDefs = tr.kpiDefs || [];
        const existingTargets = tr.rows || [];
        const targetMap = Object.fromEntries(existingTargets.map(t => [t.kpi_id, t.target_value]));

        const kpiRows = kpiDefs.map(d => `
          <div class="frow" style="align-items:center;gap:.75rem;margin-bottom:.625rem">
            <div style="flex:2;font-size:13px;font-weight:500">${d.kpi_name} <span style="color:var(--t3);font-size:11px">(${d.unit})</span>${d.category_name?`<span class="badge bt" style="margin-left:4px;font-size:10px">${d.category_name}</span>`:''}</div>
            <div style="flex:1"><input class="kpi-target-val" data-kpi-id="${d.id}" type="number" min="0" step="0.1" value="${targetMap[d.id]||''}" placeholder="Target value" style="width:100%"></div>
          </div>`).join('');

        openOverlay('Set KPI Targets', `${machName} — ${month}`, `
          <div style="font-size:12px;color:var(--t3);margin-bottom:1rem">Enter monthly targets for each KPI. Leave blank to skip.</div>
          ${kpiRows}
          <div class="fg"><label>Reason / Note</label><input id="kpi-reason" type="text" placeholder="Why are these targets being updated?"></div>
          <div class="brow"><button class="bp1" id="ovSave"><i class="ti ti-check"></i>Save all targets</button><button class="bs1" id="ovCancel">Cancel</button></div>`,
          async () => {
            const reason = $('kpi-reason')?.value?.trim() || null;
            const inputs = document.querySelectorAll('.kpi-target-val');
            let saved = 0;
            for (const inp of inputs) {
              if (!inp.value) continue;
              const r2 = await UFCL.machineKpiTargetsSave(STORAGE.user.id, {
                machine_id: machineId,
                kpi_id: Number(inp.dataset.kpiId),
                target_value: inp.value,
                effective_month: month,
                reason
              });
              if (!r2.ok) { showOverlayError(r2.error); return; }
              saved++;
            }
            showOverlaySuccess(`${saved} KPI target${saved!==1?'s':''} saved.`);
            await renderMachineKpi();
          });
      };
    });

    // Configure KPI definitions
    if ($('kpiCfg')) {
      $('kpiCfg').onclick = async () => {
        const dr = await UFCL.machineKpiDefinitionsList(STORAGE.user.id);
        const defs = dr.ok ? dr.rows : [];
        const mc = machRes.ok ? (machRes.categories || []) : [];
        const catOpts = `<option value="">All categories</option>` + mc.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        const defTable = defs.length
          ? defs.map(d => `<tr><td>${d.kpi_name}</td><td style="font-family:var(--fm)">${d.kpi_code}</td><td>${d.unit||'—'}</td><td>${d.category_name||'All'}</td><td>${d.higher_is_better?'Higher':'Lower'}</td><td>${d.weight}</td></tr>`).join('')
          : `<tr><td colspan="6" style="text-align:center;color:var(--t3);padding:1rem">No KPI definitions yet.</td></tr>`;
        openOverlay('Configure KPI Definitions', null, `
          <div class="tw" style="margin-bottom:1.25rem"><table class="dt">
            <thead><tr><th>Name</th><th>Code</th><th>Unit</th><th>Category</th><th>Direction</th><th>Weight</th></tr></thead>
            <tbody>${defTable}</tbody>
          </table></div>
          <div style="border-top:1px solid var(--bdr);padding-top:1rem">
            <div style="font-weight:600;font-size:13px;margin-bottom:.75rem">Add new KPI definition</div>
            <div class="frow">
              <div class="fg"><label>KPI Name *</label><input id="kd-name" type="text" placeholder="e.g. Daily Output"></div>
              <div class="fg"><label>KPI Code *</label><input id="kd-code" type="text" placeholder="e.g. daily_output"></div>
            </div>
            <div class="frow">
              <div class="fg"><label>Unit</label><input id="kd-unit" type="text" placeholder="m³, hrs, %"></div>
              <div class="fg"><label>Category (optional)</label><select id="kd-cat">${catOpts}</select></div>
            </div>
            <div class="frow">
              <div class="fg"><label>Direction</label><select id="kd-dir"><option value="true">Higher is better</option><option value="false">Lower is better</option></select></div>
              <div class="fg"><label>Weight</label><input id="kd-weight" type="number" min="0.1" step="0.1" value="1.0"></div>
            </div>
          </div>
          <div class="brow"><button class="bp1" id="ovSave"><i class="ti ti-plus"></i>Add definition</button><button class="bs1" id="ovCancel">Cancel</button></div>`,
          async () => {
            const r2 = await UFCL.machineKpiDefinitionsCreate(STORAGE.user.id, {
              kpi_name: $('kd-name').value.trim(),
              kpi_code: $('kd-code').value.trim(),
              unit: $('kd-unit').value.trim(),
              category_id: $('kd-cat').value || null,
              higher_is_better: $('kd-dir').value === 'true',
              weight: $('kd-weight').value || 1.0
            });
            if (!r2.ok) { showOverlayError(r2.error); return; }
            showOverlaySuccess('KPI definition added.');
            await renderMachineKpi();
          });
      };
    }
  }
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

