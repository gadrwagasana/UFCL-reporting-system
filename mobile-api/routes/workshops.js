'use strict';
const router = require('express').Router();
const data   = require('../../db/services/data');
const { requireRoles } = require('../middleware/authorize');
const { respond }      = require('../middleware/respond');

// Stabilization Phase 4 — 'operations' removed: warehousesList/Create/Update/
// Delete all gate on mustRole('warehouses'), which db/migrate.js never grants
// to 'operations' (verified against both the original seedRoles() and the
// additive updateRolePermissions() blocks) — it was a dead route entry that
// always 403'd at the service layer regardless. 'storekeeper' added: it does
// hold 'warehouses' but was previously only let through on GET '/'.
const MANAGE_ROLES   = ['admin', 'ceo', 'logistics', 'storekeeper'];
// Phase 1 Logistics fix — logistics-officer has 'workshop-overview' granted
// (db/migrate.js) but not full workshop management, so it's added only here,
// not to MANAGE_ROLES — matches the mobile nav split (Workshop Overview tab
// kept, Workshop Management tab hidden) for this role.
// Stabilization Phase 4 — 'supervisor' and 'storekeeper-assistant' both hold
// 'workshop-overview' (db/migrate.js) but were excluded here; both are also
// in mobile's 'workshop' nav tab group, so they could reach this screen and
// always 403.
const OVERVIEW_ROLES = ['admin', 'ceo', 'operations', 'logistics', 'logistics-officer', 'storekeeper', 'supervisor', 'storekeeper-assistant'];

// Static routes registered before /:id

router.get('/overview', requireRoles(...OVERVIEW_ROLES), async (req, res) => {
  const result = await data.workshopOverview(req.user.userId);
  respond(res, result, 30);
});

// Phase 1 (Inventory audit Critical-03) — legacy stock_movements-based
// transfer approval, superseded by /api/stock-transfers/:id/approve (the
// dedicated stock_transfers lifecycle). Kept working (not removed, per
// "preserve APIs") for any already-cached mobile build still calling it;
// role gate widened to match data.js's stockTransferApprove fix rather
// than left narrower than the function it calls.
router.post('/transfers/:movementId/approve', requireRoles('admin', 'ceo', 'operations', 'logistics', 'logistics-officer', 'supervisor', 'storekeeper'), async (req, res) => {
  const { action, rejectionReason } = req.body;
  const result = await data.stockTransferApprove(
    req.user.userId,
    Number(req.params.movementId),
    action,
    rejectionReason || null,
  );
  respond(res, result);
});

// Management CRUD

router.get('/', requireRoles(...MANAGE_ROLES), async (req, res) => {
  const result = await data.workshopsListWithMetrics(req.user.userId);
  respond(res, result, 60);
});

router.post('/', requireRoles(...MANAGE_ROLES), async (req, res) => {
  const result = await data.warehousesCreate(req.user.userId, req.body);
  respond(res, result);
});

router.put('/:id', requireRoles(...MANAGE_ROLES), async (req, res) => {
  const result = await data.warehousesUpdate(req.user.userId, Number(req.params.id), req.body);
  respond(res, result);
});

router.delete('/:id', requireRoles(...MANAGE_ROLES), async (req, res) => {
  const result = await data.warehousesDelete(req.user.userId, Number(req.params.id));
  respond(res, result);
});

module.exports = router;
