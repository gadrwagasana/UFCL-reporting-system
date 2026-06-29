'use strict';

const express          = require('express');
const data             = require('../../db/services/data');
const { requireRoles } = require('../middleware/authorize');
const { respond }      = require('../middleware/respond');

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// MACHINE FUEL LOGS  (table: machine_fuel_logs)
// Tracks fuel issued from the store to machines and vehicles.
// Accessible to: supervisor, operations, logistics, admin, ceo
// ─────────────────────────────────────────────────────────────────────────────

// ── GET /api/fuel/machine ─────────────────────────────────────────────────────
// List machine fuel issue records.
// data.js: machineFuelLogsList(userId)
//   Requires: machine-fuel page (supervisor, operations, logistics)

router.get('/machine', async (req, res) => {
  respond(res, await data.machineFuelLogsList(req.user.userId));
});

// ── POST /api/fuel/machine ────────────────────────────────────────────────────
// Record fuel issued to a machine or vehicle from the store.
// Body:
//   Required: log_date (YYYY-MM-DD), fuel_type, quantity,
//             AND ONE OF: machine_id | vehicle_id
//   Optional: operator, unit (default "liters"), notes
// data.js: machineFuelLogsCreate(userId, payload)
//   Requires: machine-fuel page (supervisor, operations, logistics)
//   No workshop isolation in this function — applies to any machine.

router.post('/machine', async (req, res) => {
  respond(res, await data.machineFuelLogsCreate(req.user.userId, req.body));
});

// ─────────────────────────────────────────────────────────────────────────────
// VEHICLE FUEL LOGS  (table: fuel_logs)
// Tracks fill-up events with odometer readings and cost per litre.
// Accessible to: logistics, admin ONLY (requires 'vehicles' page)
// ─────────────────────────────────────────────────────────────────────────────

// ── GET /api/fuel/vehicle ─────────────────────────────────────────────────────
// List vehicle fuel fill-up records for a specific vehicle.
// Query params: vehicleId (required — fuelLogsList requires a vehicle filter)
// data.js: fuelLogsList(userId, vehicleId)
//   Requires: vehicles page (logistics, admin)

router.get('/vehicle', requireRoles('logistics', 'admin'), async (req, res) => {
  const { vehicleId } = req.query;
  if (!vehicleId) return res.status(400).json({ ok: false, error: 'vehicleId query parameter is required' });
  respond(res, await data.fuelLogsList(req.user.userId, Number(vehicleId)));
});

// ── POST /api/fuel/vehicle ────────────────────────────────────────────────────
// Record a vehicle fuel fill-up.
// Body:
//   Required: vehicle_id, log_date (YYYY-MM-DD), liters
//   Optional: cost_per_liter, total_cost, odometer, notes
// data.js: fuelLogsCreate(userId, payload)
//   Requires: vehicles page (logistics, admin)

router.post('/vehicle', requireRoles('logistics', 'admin'), async (req, res) => {
  respond(res, await data.fuelLogsCreate(req.user.userId, req.body));
});

module.exports = router;
