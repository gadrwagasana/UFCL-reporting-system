'use strict';

const express  = require('express');
const router   = express.Router();
const data     = require('../../db/services/data');
const { requireRoles } = require('../middleware/authorize');
const { respond }      = require('../middleware/respond');

// Stabilization Phase 4 — synced against db/migrate.js's 'timber-inventory'
// holders, which is timberInventoryList's exact (and only) gate:
// 'logistics' removed (never actually granted 'timber-inventory' — a dead
// route entry); 'sawmill-leader', 'vat-leader', 'showroom-staff' added (all
// three hold it but were excluded here).
// Sawmill Phase 1 — 'sawmill-supervisor' added, now also granted 'timber-inventory'.
const ALLOWED = ['admin', 'ceo', 'operations', 'supervisor', 'sawmill-leader', 'sawmill-supervisor', 'vat-leader', 'showroom-staff'];

// GET /api/timber-inventory
// Read-only aggregate: stock balances, last 7 production days, harvest by species, waste rate.
router.get('/', requireRoles(...ALLOWED), async (req, res) => {
  const result = await data.timberInventoryList(req.user.userId);
  if (!result.ok) return respond(res, { ok: false, error: result.error }, 403);
  return respond(res, result, 200, 120);
});

module.exports = router;
