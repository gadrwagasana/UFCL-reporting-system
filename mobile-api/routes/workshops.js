'use strict';
const router = require('express').Router();
const data   = require('../../db/services/data');
const { requireRoles } = require('../middleware/auth');
const { respond }      = require('../middleware/respond');

const MANAGE_ROLES   = ['admin', 'ceo', 'operations', 'logistics'];
const OVERVIEW_ROLES = ['admin', 'ceo', 'operations', 'logistics', 'storekeeper'];

// Static routes registered before /:id

router.get('/overview', requireRoles(OVERVIEW_ROLES), async (req, res) => {
  const result = await data.workshopOverview(req.user.id);
  respond(res, result, 30);
});

router.post('/transfers/:movementId/approve', requireRoles(MANAGE_ROLES), async (req, res) => {
  const { action, rejectionReason } = req.body;
  const result = await data.stockTransferApprove(
    req.user.id,
    Number(req.params.movementId),
    action,
    rejectionReason || null,
  );
  respond(res, result);
});

// Management CRUD

router.get('/', requireRoles([...MANAGE_ROLES, 'storekeeper']), async (req, res) => {
  const result = await data.workshopsListWithMetrics(req.user.id);
  respond(res, result, 60);
});

router.post('/', requireRoles(MANAGE_ROLES), async (req, res) => {
  const result = await data.warehousesCreate(req.user.id, req.body);
  respond(res, result);
});

router.put('/:id', requireRoles(MANAGE_ROLES), async (req, res) => {
  const result = await data.warehousesUpdate(req.user.id, Number(req.params.id), req.body);
  respond(res, result);
});

router.delete('/:id', requireRoles(MANAGE_ROLES), async (req, res) => {
  const result = await data.warehousesDelete(req.user.id, Number(req.params.id));
  respond(res, result);
});

module.exports = router;
