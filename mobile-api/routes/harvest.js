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

// ── GET /api/harvest/dashboard — static route, must precede /:id ─────────────
// Harvesting Phase 1 (Workstream 2) — Today/Weekly/Monthly Harvest, Active/
// Completed Compartments, Logs Produced, Volume Produced, Transport Waiting,
// Raw Log Inventory. See harvestDashboard in data.js for exactly what each
// figure is computed from (all read-only, no new tables).
// data.js: harvestDashboard(userId, workshopId?)
//   Requires: harvest, daily-harvest, or timber-inventory page

router.get('/dashboard', async (req, res) => {
  respond(res, await data.harvestDashboard(req.user.userId), 30);
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

// ── Harvest Planning (Harvesting Phase 2, Workstream 1) ───────────────────────
// Registered ahead of /:id below — /plans and /plans/:id are distinct path
// shapes from the harvest-log /:id routes, but kept together with the other
// static routes for the same reason /dashboard is: readable route ordering.

router.get('/plans', async (req, res) => {
  respond(res, await data.harvestPlanList(req.user.userId));
});

router.post('/plans', async (req, res) => {
  respond(res, await data.harvestPlanCreate(req.user.userId, req.body));
});

router.put('/plans/:id', async (req, res) => {
  const result = await data.harvestPlanUpdate(req.user.userId, Number(req.params.id), req.body);
  if (!result.ok && result.pendingApproval) {
    return respond(res, { ok: true, pendingApproval: true, level: result.level, message: result.message });
  }
  respond(res, result);
});

router.delete('/plans/:id', async (req, res) => {
  const result = await data.harvestPlanDelete(req.user.userId, Number(req.params.id), req.body?.reason);
  if (!result.ok && result.pendingApproval) {
    return respond(res, { ok: true, pendingApproval: true, level: result.level, message: result.message });
  }
  respond(res, result);
});

// ── Active Harvest Operations / Production Performance / Delays
//    (Harvesting Phase 3, Workstreams 1-3) ──────────────────────────────────

router.get('/operations', async (req, res) => {
  respond(res, await data.harvestCompartmentStatus(req.user.userId));
});

router.get('/performance', async (req, res) => {
  respond(res, await data.harvestPerformance(req.user.userId), 30);
});

router.get('/delays', async (req, res) => {
  respond(res, await data.harvestDelayList(req.user.userId));
});

router.post('/delays', async (req, res) => {
  respond(res, await data.harvestDelayCreate(req.user.userId, req.body));
});

// ── Decision Support / Executive Reporting Extras (Harvesting Phase 4) ───────

router.get('/decision-support', async (req, res) => {
  respond(res, await data.harvestDecisionSupport(req.user.userId), 60);
});

router.get('/executive-extras', async (req, res) => {
  respond(res, await data.harvestExecutiveExtras(req.user.userId), 60);
});

// ── PUT /api/harvest/:id — edit a harvest log entry ───────────────────────────
// Harvesting Phase 1 (Workstream 1) — harvestUpdate had backend/IPC wiring
// (desktop) with no REST route or mobile UI at all.
// data.js harvestUpdate uses applyGovernance — passthrough as 200 success
// when pending, same convention as every other governed route in this app.
router.put('/:id', async (req, res) => {
  const result = await data.harvestUpdate(req.user.userId, Number(req.params.id), req.body);
  if (!result.ok && result.pendingApproval) {
    return respond(res, { ok: true, pendingApproval: true, level: result.level, message: result.message });
  }
  respond(res, result);
});

// ── DELETE /api/harvest/:id — delete (soft) a harvest log entry ──────────────
// Harvesting Phase 1 (Workstream 1) — same gap/fix as the PUT route above.
router.delete('/:id', async (req, res) => {
  const result = await data.harvestDelete(req.user.userId, Number(req.params.id), req.body?.reason);
  if (!result.ok && result.pendingApproval) {
    return respond(res, { ok: true, pendingApproval: true, level: result.level, message: result.message });
  }
  respond(res, result);
});

module.exports = router;
