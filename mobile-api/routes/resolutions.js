'use strict';

// Timber Lifecycle Phase 1 (Workstream 2) — the one reusable Resolution
// Engine, shared by harvest_waste and production_offcuts.
const express      = require('express');
const data         = require('../../db/services/data');
const { respond }  = require('../middleware/respond');

const router = express.Router();

// ── GET /api/resolutions?sourceType=harvest_waste|production_offcut ─────────
router.get('/', async (req, res) => {
  respond(res, await data.resolutionsList(req.user.userId, req.query.sourceType));
});

// ── POST /api/resolutions ─────────────────────────────────────────────────────
// Body: source_type, source_id, destination, destination_detail?, volume,
//       unit_cost?, warehouse_id?, notes?
router.post('/', async (req, res) => {
  respond(res, await data.resolutionCreate(req.user.userId, req.body));
});

module.exports = router;
