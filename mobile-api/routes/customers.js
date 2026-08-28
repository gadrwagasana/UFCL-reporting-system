'use strict';

const express               = require('express');
const data                  = require('../../db/services/data');
const { requireRoles }      = require('../middleware/authorize');
const { respond, buildEnvelope } = require('../middleware/respond');

const router = express.Router();

// Roles with 'customers' in ROLE_PAGES (db/services/data.js lines 94-111)
const CUSTOMER_ROLES = ['admin', 'ceo', 'operations', 'sales'];

// Sales Enterprise Phase 1 — data.js customersCreate now accepts either the
// 'customers' or 'sales' permission (a walk-in customer can be registered by
// anyone who can sell, not just Customers-page admins). sales-staff and
// showroom-staff hold 'sales' but not 'customers' (db/migrate.js), and were
// previously 403'd here on mobile even though desktop had no gate at all for
// this specific action — this list closes that gap for Create only; List and
// Update stay on the narrower CUSTOMER_ROLES, matching customersList/Update's
// own 'customers'-only gate in data.js.
const CUSTOMER_CREATE_ROLES = ['admin', 'ceo', 'operations', 'sales', 'sales-staff', 'showroom-staff'];

// GET /api/customers/dropdown — active customers for Sales Order picker.
// data.js customersForDropdown has auth-only gating (no role check), so any
// authenticated user may call this endpoint — matches desktop behaviour.
router.get('/dropdown', async (req, res) => {
  respond(res, await data.customersForDropdown(req.user.userId), 60);
});

// GET /api/customers — full customer list (Customers page)
router.get('/', requireRoles(...CUSTOMER_ROLES), async (req, res) => {
  respond(res, await data.customersList(req.user.userId));
});

// POST /api/customers — register a new customer
router.post('/', requireRoles(...CUSTOMER_CREATE_ROLES), async (req, res) => {
  respond(res, await data.customersCreate(req.user.userId, req.body));
});

// PUT /api/customers/:id — update a customer.
// data.js customersUpdate may return a governance-pending response
// { ok: false, pendingApproval: true, level, message } when the edit must be
// approved before it takes effect. We surface that as a 200 success with
// pendingApproval: true so the client can show the appropriate UX rather than
// treating it as an error.
router.put('/:id', requireRoles(...CUSTOMER_ROLES), async (req, res) => {
  const result = await data.customersUpdate(
    req.user.userId,
    Number(req.params.id),
    req.body,
  );
  if (!result.ok && result.pendingApproval) {
    return res.json(buildEnvelope(true, {
      pendingApproval: true,
      level:           result.level,
      message:         result.message,
    }));
  }
  respond(res, result);
});

// PATCH /api/customers/:id/toggle — deactivate/reactivate a customer.
router.patch('/:id/toggle', requireRoles(...CUSTOMER_ROLES), async (req, res) => {
  respond(res, await data.customersToggle(req.user.userId, Number(req.params.id), req.body?.reason));
});

// GET /api/customers/:id/orders — ERP Final Enterprise Completion Gate:
// confirmed no Customer Detail/order-history view existed on either
// platform. Gated the same as List/Update ('customers'-only), not the
// broader CREATE_ROLES set.
router.get('/:id/orders', requireRoles(...CUSTOMER_ROLES), async (req, res) => {
  respond(res, await data.customersOrders(req.user.userId, Number(req.params.id)));
});

module.exports = router;
