'use strict';

const express          = require('express');
const data             = require('../../db/services/data');
const { requireRoles } = require('../middleware/authorize');
const { respond }      = require('../middleware/respond');

const router = express.Router();

// Roles with 'vehicles' in ROLE_PAGES (data.js): admin, ceo, logistics, logistics-officer.
// Phase 1 Logistics fix — logistics-officer already has 'vehicles' granted via
// db/migrate.js but this route excluded it, so the mobile Vehicles tab always
// 403'd for that role despite being shown in LogisticsNavigator.
const VEHICLE_ROLES = ['admin', 'ceo', 'logistics', 'logistics-officer'];

// GET /api/vehicles/transport-dropdown — auth-only, used to populate Third-Party owner picker.
// Must be registered before /:id to prevent Express matching 'transport-dropdown' as an id.
router.get('/transport-dropdown', async (req, res) => {
  respond(res, await data.transportCompaniesForDropdown(req.user.userId), 120);
});

// GET /api/vehicles/dashboard — Fleet & Equipment Phase 2 executive dashboard
// (vehicle + machine KPIs, operational widgets). Must be registered before
// /:id for the same reason as transport-dropdown above.
router.get('/dashboard', requireRoles(...VEHICLE_ROLES), async (req, res) => {
  respond(res, await data.fleetDashboard(req.user.userId), 30);
});

// GET /api/vehicles/intelligence — Fleet & Equipment Phase 3 operational
// intelligence (trends, top lists, forecasting, cross-department visibility).
// Must be registered before /:id for the same reason as transport-dropdown above.
router.get('/intelligence', requireRoles(...VEHICLE_ROLES), async (req, res) => {
  respond(res, await data.fleetIntelligence(req.user.userId), 60);
});

// GET /api/vehicles — fleet list with server-computed summary metrics.
// Metrics are derived from the same vehiclesList rows, keeping data.js additive.
router.get('/', requireRoles(...VEHICLE_ROLES), async (req, res) => {
  const result = await data.vehiclesList(req.user.userId);
  if (!result.ok) return respond(res, result);
  const rows = result.rows || [];
  const now = new Date();
  const metrics = {
    fleet:            rows.length,
    active:           rows.filter(r => r.status === 'Active').length,
    maintenance:      rows.filter(r => r.status === 'In Maintenance').length,
    fuelCost:         Math.round(rows.reduce((s, r) => s + Number(r.total_fuel_cost || 0), 0)),
    expiredInsurance: rows.filter(r => r.insurance_expiry && new Date(r.insurance_expiry) < now).length,
  };
  respond(res, { ok: true, rows, metrics });
});

// GET /api/vehicles/:id — aggregate for VehicleDetailScreen:
// vehicle data, per-vehicle fuel log history, per-vehicle maintenance history.
// Three data.js calls run in parallel per the user's "one request per screen" principle.
router.get('/:id', requireRoles(...VEHICLE_ROLES), async (req, res) => {
  const vehicleId = Number(req.params.id);
  const userId    = req.user.userId;
  const [listResult, fuelResult, maintResult] = await Promise.all([
    data.vehiclesList(userId),
    data.fuelLogsList(userId, vehicleId),
    data.maintenanceList(userId, vehicleId),
  ]);
  if (!listResult.ok) return respond(res, listResult);
  const vehicle = (listResult.rows || []).find(r => Number(r.id) === vehicleId);
  if (!vehicle) return respond(res, { ok: false, error: 'Vehicle not found' });
  respond(res, {
    ok:          true,
    vehicle,
    fuelLogs:    fuelResult.ok    ? fuelResult.rows    : [],
    maintenance: maintResult.ok   ? maintResult.rows   : [],
  }, 30);
});

// POST /api/vehicles — register a vehicle
router.post('/', requireRoles(...VEHICLE_ROLES), async (req, res) => {
  respond(res, await data.vehiclesCreate(req.user.userId, req.body));
});

// PUT /api/vehicles/:id — update vehicle record
router.put('/:id', requireRoles(...VEHICLE_ROLES), async (req, res) => {
  respond(res, await data.vehiclesUpdate(req.user.userId, Number(req.params.id), req.body));
});

// DELETE /api/vehicles/:id — soft-delete vehicle (governed; moves to Trash,
// restorable within 30 days; fuel logs and maintenance records are
// preserved, not cascaded)
router.delete('/:id', requireRoles(...VEHICLE_ROLES), async (req, res) => {
  respond(res, await data.vehiclesDelete(req.user.userId, Number(req.params.id), req.body.reason));
});

// POST /api/vehicles/:id/fuel-logs — log fuel for a vehicle
router.post('/:id/fuel-logs', requireRoles(...VEHICLE_ROLES), async (req, res) => {
  respond(res, await data.fuelLogsCreate(req.user.userId, {
    ...req.body, vehicle_id: req.params.id,
  }));
});

// DELETE /api/vehicles/fuel-logs/:logId — delete a fuel log entry.
// Two-segment path, no conflict with DELETE /:id.
// data.js fuelLogsDelete uses applyGovernance — passthrough as 200 success when pending.
router.delete('/fuel-logs/:logId', requireRoles(...VEHICLE_ROLES), async (req, res) => {
  const result = await data.fuelLogsDelete(
    req.user.userId, Number(req.params.logId), req.body.reason
  );
  if (!result.ok && result.pendingApproval) {
    return respond(res, { ok: true, pendingApproval: true, level: result.level, message: result.message });
  }
  respond(res, result);
});

// POST /api/vehicles/:id/maintenance — add a maintenance record
router.post('/:id/maintenance', requireRoles(...VEHICLE_ROLES), async (req, res) => {
  respond(res, await data.maintenanceCreate(req.user.userId, {
    ...req.body, vehicle_id: req.params.id,
  }));
});

// PUT /api/vehicles/maintenance/:recordId — edit a maintenance record.
// Two-segment path, same convention as the DELETE route below.
// Stabilization Phase 5 (F-16) — maintenanceUpdate had backend/IPC wiring
// (desktop) with no REST route or mobile UI at all.
// data.js maintenanceUpdate uses applyGovernance — passthrough as 200 success when pending.
router.put('/maintenance/:recordId', requireRoles(...VEHICLE_ROLES), async (req, res) => {
  const result = await data.maintenanceUpdate(req.user.userId, Number(req.params.recordId), req.body);
  if (!result.ok && result.pendingApproval) {
    return respond(res, { ok: true, pendingApproval: true, level: result.level, message: result.message });
  }
  respond(res, result);
});

// DELETE /api/vehicles/maintenance/:recordId — delete a maintenance record.
// Two-segment path, no conflict with DELETE /:id.
// data.js maintenanceDelete uses applyGovernance — passthrough as 200 success when pending.
router.delete('/maintenance/:recordId', requireRoles(...VEHICLE_ROLES), async (req, res) => {
  const result = await data.maintenanceDelete(
    req.user.userId, Number(req.params.recordId), req.body.reason
  );
  if (!result.ok && result.pendingApproval) {
    return respond(res, { ok: true, pendingApproval: true, level: result.level, message: result.message });
  }
  respond(res, result);
});

module.exports = router;
