'use strict';

const express = require('express');
const router  = express.Router();
const data    = require('../../db/services/data');
const { requireRoles } = require('../middleware/authorize');
const { respond }      = require('../middleware/respond');

// Stabilization Phase 4 — VIEW_ROLES previously excluded 'operations' despite
// it holding the 'dispatch' page permission (db/migrate.js) that
// dispatchList/Create/Delete actually gate on, and despite REVIEW_ROLES
// already including it for the review step. operations could approve a
// dispatch request but never list, create, or delete one via this route.
const VIEW_ROLES    = ['admin', 'ceo', 'logistics', 'operations'];
const REVIEW_ROLES  = ['admin', 'ceo', 'logistics', 'operations'];

// ── GET /api/dispatch ─────────────────────────────────────────────────────────
router.get('/', requireRoles(...VIEW_ROLES), async (req, res) => {
  const result = await data.dispatchList(req.user.userId);
  if (!result.ok) return respond(res, { ok: false, error: result.error }, 403);
  return respond(res, result, 200, 30);
});

// ── POST /api/dispatch ────────────────────────────────────────────────────────
router.post('/', requireRoles(...VIEW_ROLES), async (req, res) => {
  const result = await data.dispatchCreate(req.user.userId, req.body);
  if (!result.ok) return respond(res, { ok: false, error: result.error }, 400);
  return respond(res, result, 201);
});

// ── PATCH /api/dispatch/:id ───────────────────────────────────────────────────
// Approve / Reject / Dispatch — status in body
router.patch('/:id', requireRoles(...REVIEW_ROLES), async (req, res) => {
  const { status, notes } = req.body || {};
  const result = await data.dispatchReview(req.user.userId, Number(req.params.id), status, notes || null);
  if (!result.ok) return respond(res, { ok: false, error: result.error }, 400);
  return respond(res, result, 200);
});

// ── DELETE /api/dispatch/:id ──────────────────────────────────────────────────
router.delete('/:id', requireRoles(...VIEW_ROLES), async (req, res) => {
  const { reason } = req.body || {};
  const result = await data.dispatchDelete(req.user.userId, Number(req.params.id), reason);
  if (result.pendingApproval) return respond(res, result, 202);
  if (!result.ok) return respond(res, { ok: false, error: result.error }, 400);
  return respond(res, result, 200);
});

module.exports = router;
