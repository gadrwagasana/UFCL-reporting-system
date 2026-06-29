'use strict';

const express             = require('express');
const data                = require('../../db/services/data');
const { requireRoles }    = require('../middleware/authorize');
const { respond }         = require('../middleware/respond');

const router = express.Router();

// All CEO routes are ceo-only at the API layer (data.js enforces independently).
const ceoOnly = requireRoles('ceo', 'admin');

// ── GET /api/ceo/overview ─────────────────────────────────────────────────────
// Current-month KPI summary: production, harvest, sales, machines, pending items.
// data.js: getCeoOverview(userId) — requires role admin or ceo

router.get('/overview', ceoOnly, async (req, res) => {
  respond(res, await data.getCeoOverview(req.user.userId));
});

// ── GET /api/ceo/poles-requests ───────────────────────────────────────────────
// List poles purchase requests + deliveries + available stock.
// data.js: polesPurchaseList(userId, workshopId) — requires canAccessDaily

router.get('/poles-requests', ceoOnly, async (req, res) => {
  respond(res, await data.polesPurchaseList(req.user.userId));
});

// ── POST /api/ceo/poles-requests/:id/approve ─────────────────────────────────
// CEO approves or rejects a poles purchase request.
// Body: { approve: true|false, rejectionReason?: string }
// data.js: polesPurchaseApprove(userId, requestId, approve, rejectionReason) — ceo ONLY

router.post('/poles-requests/:id/approve', ceoOnly, async (req, res) => {
  const { approve, rejectionReason } = req.body || {};
  if (approve === undefined) {
    return res.status(400).json({ ok: false, error: '"approve" (true or false) is required' });
  }
  respond(res, await data.polesPurchaseApprove(
    req.user.userId,
    Number(req.params.id),
    Boolean(approve),
    rejectionReason || null
  ));
});

// ── GET /api/ceo/monthly ──────────────────────────────────────────────────────
// Monthly dashboard data for approval display.
// data.js: monthlyDashboard(userId, monthKey) — ceo/admin accessible

router.get('/monthly', ceoOnly, async (req, res) => {
  const monthKey = req.query.month || new Date().toISOString().slice(0, 7);
  respond(res, await data.monthlyDashboard(req.user.userId, monthKey));
});

// ── POST /api/ceo/monthly/:monthKey/approve ───────────────────────────────────
// CEO stamps the monthly production report as approved.
// data.js: monthlyApprove(userId, monthKey) — ceo ONLY

router.post('/monthly/:monthKey/approve', ceoOnly, async (req, res) => {
  respond(res, await data.monthlyApprove(req.user.userId, req.params.monthKey));
});

module.exports = router;
