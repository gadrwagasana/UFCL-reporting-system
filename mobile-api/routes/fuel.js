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

// ── PUT /api/fuel/machine/:id — edit a machine/vehicle fuel issue record ──────
// Stabilization Phase 5 (F-21) — machineFuelLogsUpdate had backend/IPC wiring
// (desktop) with no REST route or mobile UI at all.
// data.js machineFuelLogsUpdate uses applyGovernance — passthrough as 200
// success when pending, same convention as vehicles.js's maintenance routes.
router.put('/machine/:id', async (req, res) => {
  const result = await data.machineFuelLogsUpdate(req.user.userId, Number(req.params.id), req.body);
  if (!result.ok && result.pendingApproval) {
    return respond(res, { ok: true, pendingApproval: true, level: result.level, message: result.message });
  }
  respond(res, result);
});

// ── DELETE /api/fuel/machine/:id — remove a machine/vehicle fuel issue record ─
// Remediation Phase 2 — machineFuelLogsDelete had backend/IPC wiring (desktop)
// with no REST route or mobile UI at all. Same governance passthrough
// convention as the PUT route above.
router.delete('/machine/:id', async (req, res) => {
  const result = await data.machineFuelLogsDelete(req.user.userId, Number(req.params.id), req.body?.reason);
  if (!result.ok && result.pendingApproval) {
    return respond(res, { ok: true, pendingApproval: true, level: result.level, message: result.message });
  }
  respond(res, result);
});

// ─────────────────────────────────────────────────────────────────────────────
// VEHICLE FUEL LOGS  (table: fuel_logs)
// Tracks fill-up events with odometer readings and cost per litre.
// Accessible to: admin, ceo, logistics, logistics-officer (requires 'vehicles'
// page) — Stabilization Phase 4: this comment and the route gate below both
// previously said "logistics, admin ONLY", but db/migrate.js has always
// granted 'vehicles' to ceo and logistics-officer too, matching
// vehicles.js's own VEHICLE_ROLES exactly. ceo/logistics-officer passed
// fuelLogsList/Create's mustRole('vehicles') check but were blocked here.
// ─────────────────────────────────────────────────────────────────────────────

const VEHICLE_FUEL_ROLES = ['admin', 'ceo', 'logistics', 'logistics-officer'];

// ── GET /api/fuel/vehicle ─────────────────────────────────────────────────────
// List vehicle fuel fill-up records for a specific vehicle.
// Query params: vehicleId (required — fuelLogsList requires a vehicle filter)
// data.js: fuelLogsList(userId, vehicleId)
//   Requires: vehicles page (admin, ceo, logistics, logistics-officer)

router.get('/vehicle', requireRoles(...VEHICLE_FUEL_ROLES), async (req, res) => {
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
//   Requires: vehicles page (admin, ceo, logistics, logistics-officer)

router.post('/vehicle', requireRoles(...VEHICLE_FUEL_ROLES), async (req, res) => {
  respond(res, await data.fuelLogsCreate(req.user.userId, req.body));
});

module.exports = router;
