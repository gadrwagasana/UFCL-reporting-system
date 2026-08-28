'use strict';
const express      = require('express');
const router       = express.Router();
const { requireRoles } = require('../middleware/authorize');
const { respond }      = require('../middleware/respond');
const data         = require('../../db/services/data');

// Phase 1 Logistics fix — logistics-officer already has 'stock-items'/
// 'stock-movements'/'warehouses' granted via db/migrate.js but these routes
// excluded it, so the mobile Stock Catalog/Inventory/Movements tabs always
// 403'd for that role despite being shown in LogisticsNavigator.
const CATALOG_ROLES   = ['admin', 'ceo', 'operations', 'logistics', 'logistics-officer', 'storekeeper'];
// Phase 1 (Inventory audit) — this excluded 'admin' despite role_definitions
// granting 'inventory' to it same as every other role above; admin users
// were 403'd on the mobile Stock Levels tab. Now matches CATALOG_ROLES.
// Stock & Inventory Phase 4 (audit finding H-01) — 'ceo' was removed in
// Stabilization Phase 4 on the belief that db/migrate.js never granted 'ceo'
// the 'inventory' permission, making this route entry "dead". Re-verified
// live against role_definitions: ceo DOES currently hold 'inventory'
// (mustRole('inventory') passes for ceo in inventoryList/Dashboard/
// Intelligence), so this route was actually 403ing a real, authorized user
// — desktop already grants ceo full access to these same three screens.
// (Note: db/migrate.js's own declarative ceo permission list still doesn't
// textually include 'inventory' — the live grant predates or postdates that
// source, a drift worth revisiting separately if this app is ever reseeded
// from scratch, but not a reason to keep denying a currently-authorized role.)
const INVENTORY_ROLES = ['admin', 'ceo', 'operations', 'logistics', 'logistics-officer', 'storekeeper'];
// Stabilization Phase 4 — supervisor/harvesting-leader/sawmill-leader/
// poles-leader/vat-leader removed: stockMovementsList/Create/Delete gate on
// mustRole('stock-movements'), which none of these 5 roles hold — confirmed
// against db/migrate.js's own STOCK_MOVEMENTS_ROLES list (used to grant a
// related page-visibility permission, explicitly documented there as "the
// same live role list that already holds 'stock-movements', verified live").
// All 5 were dead route entries, always refused at the service layer.
const MOVEMENTS_ROLES = ['admin', 'ceo', 'operations', 'logistics', 'logistics-officer', 'storekeeper', 'storekeeper-assistant'];

// ── Stock Catalog ─────────────────────────────────────────────────────────────

router.get('/', requireRoles(...CATALOG_ROLES), async (req, res) => {
  const result = await data.stockItemsList(req.user.userId, req.query.workshopId || null);
  respond(res, result, 60);
});

router.post('/', requireRoles(...CATALOG_ROLES), async (req, res) => {
  const result = await data.stockItemsCreate(req.user.userId, req.body);
  respond(res, result);
});

// ── Stock Categories (static — must precede /:id) ─────────────────────────────

router.get('/categories', requireRoles(...CATALOG_ROLES), async (req, res) => {
  const result = await data.stockCategoriesList(req.user.userId);
  respond(res, result, 120);
});

router.post('/categories', requireRoles(...CATALOG_ROLES), async (req, res) => {
  const result = await data.stockCategoriesCreate(req.user.userId, req.body.name);
  respond(res, result);
});

router.delete('/categories/:id', requireRoles(...CATALOG_ROLES), async (req, res) => {
  const result = await data.stockCategoriesDelete(req.user.userId, Number(req.params.id));
  respond(res, result);
});

// ── Inventory Overview (static — must precede /:id) ───────────────────────────

router.get('/inventory', requireRoles(...INVENTORY_ROLES), async (req, res) => {
  const result = await data.inventoryList(req.user.userId, req.query.workshopId || null);
  respond(res, result, 120);
});

// Phase 2 — Inventory Dashboard (Executive KPIs + Operational Widgets).
router.get('/inventory/dashboard', requireRoles(...INVENTORY_ROLES), async (req, res) => {
  const result = await data.inventoryDashboard(req.user.userId, req.query.workshopId || null);
  respond(res, result, 60);
});

// Phase 3 — Inventory Operational Intelligence (trends, top items, aging,
// health, forecasting).
router.get('/inventory/intelligence', requireRoles(...INVENTORY_ROLES), async (req, res) => {
  const result = await data.inventoryIntelligence(req.user.userId, req.query.workshopId || null);
  respond(res, result, 120);
});

// ── Stock Movements (static — must precede /:id) ──────────────────────────────

router.get('/movements', requireRoles(...MOVEMENTS_ROLES), async (req, res) => {
  const result = await data.stockMovementsList(req.user.userId, req.query.workshopId || null);
  respond(res, result, 60);
});

router.post('/movements', requireRoles(...MOVEMENTS_ROLES), async (req, res) => {
  const result = await data.stockMovementsCreate(req.user.userId, req.body);
  respond(res, result);
});

// Stock & Inventory Phase 3 — adjustments now require approval; this
// submits a request into the existing pending_edits engine instead of
// writing stock_levels directly (see data.stockAdjustmentRequestCreate).
router.post('/movements/adjustment-request', requireRoles(...MOVEMENTS_ROLES), async (req, res) => {
  const result = await data.stockAdjustmentRequestCreate(req.user.userId, req.body);
  respond(res, result);
});

router.delete('/movements/:id', requireRoles(...MOVEMENTS_ROLES), async (req, res) => {
  const result = await data.stockMovementsDelete(req.user.userId, Number(req.params.id), req.body.reason);
  if (!result.ok && result.pendingApproval) {
    return respond(res, { ok: true, pendingApproval: true, message: result.message });
  }
  respond(res, result);
});

// ── Stock Item CRUD (parameterized — must come last) ──────────────────────────

router.put('/:id', requireRoles(...CATALOG_ROLES), async (req, res) => {
  const result = await data.stockItemsUpdate(req.user.userId, Number(req.params.id), req.body);
  if (!result.ok && result.pendingApproval) {
    return respond(res, { ok: true, pendingApproval: true, message: result.message });
  }
  respond(res, result);
});

router.delete('/:id', requireRoles(...CATALOG_ROLES), async (req, res) => {
  const result = await data.stockItemsDelete(req.user.userId, Number(req.params.id), req.body.reason);
  if (!result.ok && result.pendingApproval) {
    return respond(res, { ok: true, pendingApproval: true, message: result.message });
  }
  respond(res, result);
});

module.exports = router;
