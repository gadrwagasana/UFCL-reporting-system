'use strict';

const express  = require('express');
const router   = express.Router();
const data     = require('../../db/services/data');
const { requireRoles } = require('../middleware/auth');
const { respond }      = require('../middleware/respond');

const ALLOWED = ['admin', 'ceo', 'operations', 'logistics', 'supervisor'];

// GET /api/timber-inventory
// Read-only aggregate: stock balances, last 7 production days, harvest by species, waste rate.
router.get('/', requireRoles(ALLOWED), async (req, res) => {
  const result = await data.timberInventoryList(req.user.id);
  if (!result.ok) return respond(res, { ok: false, error: result.error }, 403);
  return respond(res, result, 200, 120);
});

module.exports = router;
