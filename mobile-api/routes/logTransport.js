'use strict';

const express          = require('express');
const data             = require('../../db/services/data');
const { respond }      = require('../middleware/respond');

const router = express.Router();

// ── GET /api/log-transport ────────────────────────────────────────────────────
// List log transport entries + totals (harvested vs transported vs remaining).
// data.js: logTransportList(userId, workshopId?)
//   Requires: log-transport page or role in [admin,ceo,operations,logistics,supervisor]
//   Workshop isolation: YES — isWorkshopRestricted applied inside function

router.get('/', async (req, res) => {
  respond(res, await data.logTransportList(req.user.userId));
});

// ── POST /api/log-transport ───────────────────────────────────────────────────
// Record a log transport trip from forest to sawmill.
// Body:
//   Required: transport_date (YYYY-MM-DD), qty_transported
//   Optional: unit (default "logs"), compt_id, sub_name,
//             tractor_plate, loggers_number, notes
// data.js: logTransportCreate(userId, payload)
//   Requires: log-transport page or role list (supervisor included)
//   Workshop isolation: YES — workshopId auto-set from user if workshop-restricted

router.post('/', async (req, res) => {
  respond(res, await data.logTransportCreate(req.user.userId, req.body));
});

module.exports = router;
