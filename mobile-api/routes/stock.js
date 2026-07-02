'use strict';
const express      = require('express');
const router       = express.Router();
const requireRoles = require('../middleware/authorize');
const respond      = require('../middleware/respond');
const data         = require('../../db/services/data');

const CATALOG_ROLES   = ['admin', 'ceo', 'operations', 'logistics', 'storekeeper'];
const INVENTORY_ROLES = ['ceo', 'operations', 'logistics', 'storekeeper'];
const MOVEMENTS_ROLES = ['admin', 'ceo', 'operations', 'logistics', 'supervisor',
                         'storekeeper', 'harvesting-leader', 'sawmill-leader',
                         'poles-leader', 'vat-leader', 'storekeeper-assistant'];

// ── Stock Catalog ─────────────────────────────────────────────────────────────

router.get('/', requireRoles(CATALOG_ROLES), async (req, res) => {
  const result = await data.stockItemsList(req.user.id, req.query.workshopId || null);
  respond(res, result, 60);
});

router.post('/', requireRoles(CATALOG_ROLES), async (req, res) => {
  const result = await data.stockItemsCreate(req.user.id, req.body);
  respond(res, result);
});

// ── Stock Categories (static — must precede /:id) ─────────────────────────────

router.get('/categories', requireRoles(CATALOG_ROLES), async (req, res) => {
  const result = await data.stockCategoriesList(req.user.id);
  respond(res, result, 120);
});

router.post('/categories', requireRoles(CATALOG_ROLES), async (req, res) => {
  const result = await data.stockCategoriesCreate(req.user.id, req.body.name);
  respond(res, result);
});

router.delete('/categories/:id', requireRoles(CATALOG_ROLES), async (req, res) => {
  const result = await data.stockCategoriesDelete(req.user.id, Number(req.params.id));
  respond(res, result);
});

// ── Inventory Overview (static — must precede /:id) ───────────────────────────

router.get('/inventory', requireRoles(INVENTORY_ROLES), async (req, res) => {
  const result = await data.inventoryList(req.user.id, req.query.workshopId || null);
  respond(res, result, 120);
});

// ── Stock Movements (static — must precede /:id) ──────────────────────────────

router.get('/movements', requireRoles(MOVEMENTS_ROLES), async (req, res) => {
  const result = await data.stockMovementsList(req.user.id, req.query.workshopId || null);
  respond(res, result, 60);
});

router.post('/movements', requireRoles(MOVEMENTS_ROLES), async (req, res) => {
  const result = await data.stockMovementsCreate(req.user.id, req.body);
  respond(res, result);
});

router.delete('/movements/:id', requireRoles(MOVEMENTS_ROLES), async (req, res) => {
  const result = await data.stockMovementsDelete(req.user.id, Number(req.params.id), req.body.reason);
  if (!result.ok && result.pendingApproval) {
    return respond(res, { ok: true, pendingApproval: true, message: result.message });
  }
  respond(res, result);
});

// ── Stock Item CRUD (parameterized — must come last) ──────────────────────────

router.put('/:id', requireRoles(CATALOG_ROLES), async (req, res) => {
  const result = await data.stockItemsUpdate(req.user.id, Number(req.params.id), req.body);
  if (!result.ok && result.pendingApproval) {
    return respond(res, { ok: true, pendingApproval: true, message: result.message });
  }
  respond(res, result);
});

router.delete('/:id', requireRoles(CATALOG_ROLES), async (req, res) => {
  const result = await data.stockItemsDelete(req.user.id, Number(req.params.id), req.body.reason);
  if (!result.ok && result.pendingApproval) {
    return respond(res, { ok: true, pendingApproval: true, message: result.message });
  }
  respond(res, result);
});

module.exports = router;
