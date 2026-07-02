'use strict';

const express               = require('express');
const data                  = require('../../db/services/data');
const { requireRoles }      = require('../middleware/authorize');
const { respond, buildEnvelope } = require('../middleware/respond');

const router = express.Router();

// Roles with 'customers' in ROLE_PAGES (db/services/data.js lines 94-111)
const CUSTOMER_ROLES = ['admin', 'ceo', 'operations', 'sales'];

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
router.post('/', requireRoles(...CUSTOMER_ROLES), async (req, res) => {
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

module.exports = router;
