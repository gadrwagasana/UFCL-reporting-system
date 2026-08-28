'use strict';

// Timber Lifecycle Phase 1 (Workstream 1) — Harvest Waste.
const express      = require('express');
const data         = require('../../db/services/data');
const { respond }  = require('../middleware/respond');

const router = express.Router();

// ── GET /api/harvest-waste/categories ────────────────────────────────────────
router.get('/categories', async (req, res) => {
  respond(res, await data.harvestWasteCategoriesList(req.user.userId));
});

// ── POST /api/harvest-waste/categories ───────────────────────────────────────
router.post('/categories', async (req, res) => {
  respond(res, await data.harvestWasteCategoryCreate(req.user.userId, req.body?.name));
});

// ── GET /api/harvest-waste ────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  respond(res, await data.harvestWasteList(req.user.userId, req.query.workshopId ? Number(req.query.workshopId) : null));
});

// ── POST /api/harvest-waste ───────────────────────────────────────────────────
// Body: harvest_log_id, category_id?, volume_logs, supervisor, reason
router.post('/', async (req, res) => {
  respond(res, await data.harvestWasteCreate(req.user.userId, req.body));
});

module.exports = router;
