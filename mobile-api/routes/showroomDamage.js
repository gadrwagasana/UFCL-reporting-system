'use strict';

// Timber Lifecycle Phase 3 (Workstream 12) — Showroom Quality/Damage Check.
const express      = require('express');
const data         = require('../../db/services/data');
const { respond }  = require('../middleware/respond');

const router = express.Router();

// ── GET /api/showroom-damage?status= ──────────────────────────────────────────
router.get('/', async (req, res) => {
  respond(res, await data.showroomDamageReportsList(req.user.userId, req.query.status || null));
});

// ── POST /api/showroom-damage ──────────────────────────────────────────────────
// Body: stock_item_id, warehouse_id, quantity, reason
// data.js: showroomDamageReportCreate(userId, payload)
router.post('/', async (req, res) => {
  respond(res, await data.showroomDamageReportCreate(req.user.userId, req.body));
});

// ── GET /api/showroom-damage/inventory ────────────────────────────────────────
// Showroom stock (warehouse_id=5) — data.js: showroomInventoryList(userId)
router.get('/inventory', async (req, res) => {
  respond(res, await data.showroomInventoryList(req.user.userId));
});

module.exports = router;
