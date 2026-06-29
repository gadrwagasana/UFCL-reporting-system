'use strict';

// Dropdown / reference data endpoints.
// All require a valid JWT (mounted after the authenticate middleware in server.js).
// No write operations — read-only reference data for form dropdowns.

const express          = require('express');
const { pool }         = require('../../db/pool');
const data             = require('../../db/services/data');
const { respond }      = require('../middleware/respond');

const router = express.Router();

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
// Direct pool query (no permission restriction — just needs valid JWT).
// Returns: id, registration, make, model, vehicle_category, status

router.get('/vehicles', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `select id, registration, make, model, vehicle_category, driver_assigned, status
       from vehicles
       where status = 'Active'
       order by vehicle_category, registration`
    );
    res.json({ ok: true, rows });
  } catch (err) {
    console.error('[meta/vehicles]', err.message);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// ── GET /api/meta/stock-items ─────────────────────────────────────────────────
// Active stock catalog items — for material request form dropdown.
// Direct pool query (permission guard is on materialRequestsCreate, not on the list).

router.get('/stock-items', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `select id, name, category, uom
       from stock_catalog
       where active = true
       order by category, name`
    );
    res.json({ ok: true, rows });
  } catch (err) {
    console.error('[meta/stock-items]', err.message);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// ── GET /api/meta/warehouses ──────────────────────────────────────────────────
// Active warehouses — for material request approval (source warehouse picker).

router.get('/warehouses', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `select id, name, location, workshop_type
       from warehouses
       where active = true
       order by name`
    );
    res.json({ ok: true, rows });
  } catch (err) {
    console.error('[meta/warehouses]', err.message);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
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
