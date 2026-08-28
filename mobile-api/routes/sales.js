'use strict';
const { Router }        = require('express');
const { requireRoles }  = require('../middleware/authorize');
const { respond }       = require('../middleware/respond');
const data              = require('../../db/services/data');
const { pool }          = require('../../db/pool');

const router     = Router();
// Timber Lifecycle Phase 3 — 'sales-staff'/'showroom-staff' both hold the
// 'sales' PERMISSION (role_definitions) that data.salesCreate itself checks,
// but this literal-role array (a route-layer gate, separate from the
// permission model) didn't include them — desktop worked (no literal-role
// gate there), mobile 403'd. Added so Gatare/Nyanza/Showroom mobile sales
// actually work for the roles that are supposed to hold them.
const SALES_ROLES = ['admin', 'ceo', 'operations', 'sales', 'sales-staff', 'showroom-staff'];
// Stabilization Phase 4 — /:id/deliver calls deliveryOrdersCreate, which
// gates on mustRole('deliveries'), a different key than the rest of this
// file's mustRole('sales') routes. 'operations' holds 'sales' but not
// 'deliveries' (db/migrate.js) — it passed this route's old SALES_ROLES gate
// but was always refused by the function itself. admin/ceo/sales all hold
// both keys — as do sales-staff/showroom-staff (Timber Lifecycle Phase 3).
const DELIVER_ROLES = ['admin', 'ceo', 'sales', 'sales-staff', 'showroom-staff'];

// ── helpers ───────────────────────────────────────────────────────────────────
function computeMetrics(rows) {
  return rows.reduce((acc, r) => {
    const s = r.status || 'Pending';
    if      (s === 'Pending')   acc.pending++;
    else if (s === 'Confirmed') acc.confirmed++;
    else if (['In Progress', 'Dispatched', 'Partially Delivered'].includes(s)) acc.inProgress++;
    else if (['Fully Delivered', 'Delivered'].includes(s)) acc.delivered++;
    else if (s === 'Closed (Short)') acc.closed++;
    return acc;
  }, { pending: 0, confirmed: 0, inProgress: 0, delivered: 0, closed: 0 });
}

// ── Static sub-routes BEFORE /:id ────────────────────────────────────────────

// PATCH /api/sales/:id/pay
router.patch('/:id/pay', requireRoles(...SALES_ROLES), async (req, res) => {
  const { paymentStatus } = req.body;
  const result = await data.salesUpdatePayment(req.user.userId, Number(req.params.id), paymentStatus);
  if (result.pendingApproval) return respond(res, result, 202);
  respond(res, result);
});

// PATCH /api/sales/:id/status
router.patch('/:id/status', requireRoles(...SALES_ROLES), async (req, res) => {
  const { status } = req.body;
  const result = await data.salesUpdateStatus(req.user.userId, Number(req.params.id), status);
  if (result.pendingApproval) return respond(res, result, 202);
  respond(res, result);
});

// POST /api/sales/:id/close-short
router.post('/:id/close-short', requireRoles(...SALES_ROLES), async (req, res) => {
  respond(res, await data.salesCloseShort(req.user.userId, Number(req.params.id)));
});

// POST /api/sales/:id/deliver  — creates a delivery order from this SO
// Phase 1 Logistics fix — this called data.deliveriesCreate, which does not
// exist (the real function is deliveryOrdersCreate); every use of this route
// failed with an uncaught TypeError and no response was ever sent back.
router.post('/:id/deliver', requireRoles(...DELIVER_ROLES), async (req, res) => {
  const soId    = Number(req.params.id);
  const payload = { ...req.body, sales_order_id: soId };
  respond(res, await data.deliveryOrdersCreate(req.user.userId, payload));
});

// ── Generic routes ────────────────────────────────────────────────────────────

// GET /api/sales
// Master Professionalization Phase C1 (Gap Register PR-01) — mobile's
// useSalesOrdersList used to accept no params at all, matching the old
// data.salesList(userId, workshopId) signature which only ever took a
// workshop id. Forwards the same search/filter/sort/pagination query params
// the extended salesList now accepts, so mobile search/filter chips work
// against the real dataset rather than only the currently-loaded page.
router.get('/', requireRoles(...SALES_ROLES), async (req, res) => {
  const userId = req.user.userId;
  const q      = req.query;
  const opts = {
    workshopId:    q.workshop_id ? Number(q.workshop_id) : null,
    search:        q.search || undefined,
    status:        q.status || undefined,
    paymentStatus: q.payment_status || undefined,
    customerId:    q.customer_id ? Number(q.customer_id) : undefined,
    dateFrom:      q.date_from || undefined,
    dateTo:        q.date_to || undefined,
    sortBy:        q.sort_by || undefined,
    sortDir:       q.sort_dir || undefined,
    page:          q.page ? Number(q.page) : undefined,
    pageSize:      q.page_size ? Number(q.page_size) : undefined,
  };

  const [listRes, prodsRes, custsRes, vehiclesRes] = await Promise.all([
    data.salesList(userId, opts),
    data.salesProductsForDropdown(userId),
    data.customersForDropdown(userId),
    pool.query(
      `select id, registration, make, driver_assigned
       from vehicles where status='Active' order by registration`
    ),
  ]);

  if (!listRes.ok)  return respond(res, listRes);

  const rows = listRes.rows || [];

  respond(res, {
    ok:      true,
    rows,
    total:   listRes.total,
    page:    listRes.page,
    pageSize: listRes.pageSize,
    metrics: computeMetrics(rows),
    stock:   listRes.stock,
    dropdowns: {
      customers: custsRes.ok ? (custsRes.rows || []) : [],
      products:  prodsRes.ok ? (prodsRes.rows || []) : [],
      vehicles:  vehiclesRes.rows || [],
    },
  }, 200, 30);
});

// GET /api/sales/dashboard — ERP Final Enterprise Completion Gate: confirmed
// no Sales Dashboard existed on either platform. Real status-count/revenue
// aggregate, gated on the new 'sales-dashboard' permission (data.js).
router.get('/dashboard', requireRoles(...SALES_ROLES), async (req, res) => {
  respond(res, await data.salesDashboard(req.user.userId, req.query.workshopId ? Number(req.query.workshopId) : null), 200, 30);
});

// GET /api/sales/report — Sales History with date-range/workshop filters, no
// row cap (unlike GET / above, which is UI-list-capped at 50).
router.get('/report', requireRoles(...SALES_ROLES), async (req, res) => {
  respond(res, await data.salesReport(req.user.userId, {
    date_from: req.query.dateFrom || null,
    date_to: req.query.dateTo || null,
    workshop_id: req.query.workshopId ? Number(req.query.workshopId) : null,
  }));
});

// GET /api/sales/:id — Master Professionalization Phase C1: mobile had no
// single-order detail fetch at all (every screen re-derived a row from the
// already-fetched list). Must be registered after the literal /dashboard
// and /report paths above, since Express would otherwise match those as
// :id first.
router.get('/:id', requireRoles(...SALES_ROLES), async (req, res) => {
  respond(res, await data.salesGet(req.user.userId, Number(req.params.id)));
});

// POST /api/sales  — create order
router.post('/', requireRoles(...SALES_ROLES), async (req, res) => {
  respond(res, await data.salesCreate(req.user.userId, req.body));
});

// PATCH /api/sales/:id  — edit order (governance-aware)
router.patch('/:id', requireRoles(...SALES_ROLES), async (req, res) => {
  const result = await data.salesUpdate(req.user.userId, Number(req.params.id), req.body);
  if (result.pendingApproval) return respond(res, result, 202);
  respond(res, result);
});

// DELETE /api/sales/:id  — soft-delete (governance-aware)
router.delete('/:id', requireRoles(...SALES_ROLES), async (req, res) => {
  const result = await data.salesDelete(req.user.userId, Number(req.params.id), req.body?.reason);
  if (result.pendingApproval) return respond(res, result, 202);
  respond(res, result);
});

module.exports = router;
