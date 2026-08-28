'use strict';

// Dropdown / reference data endpoints.
// All require a valid JWT (mounted after the authenticate middleware in server.js).
// No write operations — read-only reference data for form dropdowns.

const express          = require('express');
const { pool }         = require('../../db/pool');
const data             = require('../../db/services/data');
const { respond }      = require('../middleware/respond');
const { requireRoles } = require('../middleware/authorize');

const router = express.Router();

// Fleet & Equipment Phase 1 (Critical-02) — matches mobile-api/routes/vehicles.js's
// own VEHICLE_ROLES, which is itself the exact role set that holds the
// 'vehicles' page permission in role_definitions (desktop's mustRole('vehicles')
// gate). This endpoint previously had no permission check at all.
const VEHICLE_ROLES = ['admin', 'ceo', 'logistics', 'logistics-officer'];

// ── GET /api/meta/compartments ────────────────────────────────────────────────
// Forest compartments for harvest and log-transport dropdowns.
// data.js: compartmentsForDropdown(userId) — any authenticated user

router.get('/compartments', async (req, res) => {
  respond(res, await data.compartmentsForDropdown(req.user.userId));
});

// ── GET /api/meta/machines ────────────────────────────────────────────────────
// Active machines for machine-log and machine-fuel dropdowns.
// data.js: machinesForDropdown(userId) — any authenticated user

router.get('/machines', async (req, res) => {
  respond(res, await data.machinesForDropdown(req.user.userId));
});

// ── GET /api/meta/machine-fuel-targets ───────────────────────────────────────
// Active machines AND own-fleet vehicles combined — for machine fuel issue form.
// data.js: machineFuelDropdown(userId) — any authenticated user

router.get('/machine-fuel-targets', async (req, res) => {
  respond(res, await data.machineFuelDropdown(req.user.userId));
});

// ── GET /api/meta/vehicles ────────────────────────────────────────────────────
// All active vehicles — for vehicle fuel log form and stock transfer dispatch.
// Fleet & Equipment Phase 1 (Critical-02) — this previously ran an
// unrestricted direct pool query ("no permission restriction — just needs
// valid JWT"), letting any authenticated mobile user of any role read the
// full active-vehicle registry (registration, driver assignment, status).
// Now gated to the same role set desktop's mustRole('vehicles') resolves to.
// Returns: id, registration, make, model, vehicle_category, status

router.get('/vehicles', requireRoles(...VEHICLE_ROLES), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `select id, registration, make, model, vehicle_category, driver_assigned, status
       from vehicles
       where status = 'Active' and deleted_at is null
       order by vehicle_category, registration`
    );
    res.json({ ok: true, rows });
  } catch (err) {
    console.error('[meta/vehicles]', err.message);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// ── GET /api/meta/stock-items ─────────────────────────────────────────────────
// Active stock catalog items — for material request AND procurement
// requisition/PO line-item forms (Phase 2B). Permission guard is on the
// create actions, not on this list — data.js: stockItemsForDropdown(userId).
// Previously inlined here directly; centralized into data.js so Electron
// (which doesn't go through this route file) can call the identical function.

router.get('/stock-items', async (req, res) => {
  respond(res, await data.stockItemsForDropdown(req.user.userId));
});

// ── GET /api/meta/warehouses ──────────────────────────────────────────────────
// Active warehouses — for material request approval and procurement
// requisition workshop selection (Phase 2B).
// data.js: workshopsForDropdown(userId)

router.get('/warehouses', async (req, res) => {
  respond(res, await data.workshopsForDropdown(req.user.userId));
});

// ── GET /api/meta/poles-purchase-requests ─────────────────────────────────────
// Approved poles purchase requests — for poles delivery form dropdown
// (linking a delivery to its originating purchase request).

router.get('/poles-purchase-requests', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `select pr.id, pr.supplier_name, pr.requested_qty,
              to_char(pr.requested_at,'DD/MM/YYYY') as requested_at
       from poles_purchase_requests pr
       where pr.status = 'approved'
       order by pr.requested_at desc
       limit 50`
    );
    res.json({ ok: true, rows });
  } catch (err) {
    console.error('[meta/poles-purchase-requests]', err.message);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// ── GET /api/meta/machine-log-categories ──────────────────────────────────────
// Machine log item categories — for machine daily log form.

router.get('/machine-log-categories', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `select id, name from machine_log_categories where active = true order by name`
    );
    res.json({ ok: true, rows });
  } catch (err) {
    console.error('[meta/machine-log-categories]', err.message);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

module.exports = router;
