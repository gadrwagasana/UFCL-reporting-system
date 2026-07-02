'use strict';

const express          = require('express');
const data             = require('../../db/services/data');
const { requireRoles } = require('../middleware/authorize');
const { respond }      = require('../middleware/respond');

const router = express.Router();

// Roles with 'products' in ROLE_PAGES (data.js lines 100-111): ceo, operations, sales.
// admin is included in the route guard so that dynamic role_definitions overrides
// still reach data.js mustRole() rather than being blocked here first.
const PRODUCT_ROLES = ['admin', 'ceo', 'operations', 'sales'];

// Toggle (deactivate/reactivate) is ceo/operations only — matches desktop's
// data.js productsToggle() permission check (user.role === 'ceo' || 'operations').
const TOGGLE_ROLES = ['ceo', 'operations'];

// GET /api/products/active?type=Timber|Poles — active products for Daily Logs / VAT forms.
// No role restriction: productsActiveForForm has auth-only gating in data.js.
router.get('/active', async (req, res) => {
  respond(res, await data.productsActiveForForm(req.user.userId, req.query.type || 'Timber'), 120);
});

// GET /api/products/sales-dropdown — active products for Sales Order picker.
// No role restriction: salesProductsForDropdown has auth-only gating in data.js.
router.get('/sales-dropdown', async (req, res) => {
  respond(res, await data.salesProductsForDropdown(req.user.userId), 120);
});

// GET /api/products?filter=All|Timber|Poles|Kiln-dried|CCA-treated|Untreated|Active
router.get('/', requireRoles(...PRODUCT_ROLES), async (req, res) => {
  const filter = req.query.filter || 'All';
  respond(res, await data.productsList(req.user.userId, filter));
});

// POST /api/products — register a new product
router.post('/', requireRoles(...PRODUCT_ROLES), async (req, res) => {
  respond(res, await data.productsCreate(req.user.userId, req.body));
});

// PUT /api/products/:id — update product dimensions / ref / machine
// No applyGovernance() in data.js productsUpdate — applies immediately.
router.put('/:id', requireRoles(...PRODUCT_ROLES), async (req, res) => {
  respond(res, await data.productsUpdate(req.user.userId, Number(req.params.id), req.body));
});

// POST /api/products/:id/toggle — activate or deactivate a product (ceo/operations only)
router.post('/:id/toggle', requireRoles(...TOGGLE_ROLES), async (req, res) => {
  respond(res, await data.productsToggle(req.user.userId, Number(req.params.id), req.body.reason));
});

module.exports = router;
