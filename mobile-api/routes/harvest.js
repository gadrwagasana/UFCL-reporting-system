'use strict';

const express          = require('express');
const data             = require('../../db/services/data');
const { respond }      = require('../middleware/respond');

const router = express.Router();

// ── GET /api/harvest ──────────────────────────────────────────────────────────
// List harvest entries for the caller's workshop (workshop-isolated automatically).
// Includes compartment summary.
// data.js: dailyHarvestData(userId, workshopId?)
//   Requires: daily-harvest or harvest or daily page (supervisor, operations, ceo, admin)
//   Workshop isolation: YES — isWorkshopRestricted applied inside function

router.get('/', async (req, res) => {
  respond(res, await data.dailyHarvestData(req.user.userId));
});

// ── POST /api/harvest ─────────────────────────────────────────────────────────
// Create a new harvest log entry.
// Body:
//   Required: harvest_date (YYYY-MM-DD), species, quantity
//   Optional: uom (default "trees"), compt_id, sub_name, location,
//             logs_crosscut, logs_handrolled, notes
// data.js: harvestCreate(userId, payload)
//   Requires: harvest or daily-harvest page
//   Workshop isolation: YES — workshopId auto-set from user if workshop-restricted
//   Side effect: auto-marks compartment as Completed if fully harvested

router.post('/', async (req, res) => {
  respond(res, await data.harvestCreate(req.user.userId, req.body));
});

module.exports = router;
