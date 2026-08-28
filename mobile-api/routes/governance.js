'use strict';

const express     = require('express');
const data        = require('../../db/services/data');
const { respond } = require('../middleware/respond');

const router = express.Router();

// ERP Enterprise Completion Phase 4 — mobile exposure for the existing Step 3
// governance engine (Pending Edit Requests / Deletion Requests). The
// submission side already works on mobile today: every entity update/delete
// function that calls applyGovernance() (customers, deliveries, harvest,
// machines, sales, sawmill, stock, vehicles, compartments, ...) already
// returns { pendingApproval: true } and the corresponding mobile-api route
// already passes it through — confirmed across 11 existing route files
// before writing this one. What was missing was the REVIEW side: no
// mobile-api route existed for pendingEditsList/Review or
// deletionRequestsList/Approve/Reject. No route-level role gate is added
// here, matching the established pattern in poles.js/rejectionHolds.js —
// pendingEditsList/deletionRequestsList/processApprovalDecision each already
// do their own internal role check against LEADER_APPROVERS/
// MANAGER_APPROVERS (data.js), which is the single source of truth for who
// can view/approve at which level. Duplicating that role list here would
// only risk drift.

// ── GET /api/governance/pending-edits ─────────────────────────────────────────
// List pending edit/delete-via-pending_edits requests visible to the caller.
// data.js: pendingEditsList(userId)
//   Managers (MANAGER_APPROVERS) see all; leader-tier (LEADER_APPROVERS) see
//   only 'leader'-level requests; everyone else sees only their own submissions.

router.get('/pending-edits', async (req, res) => {
  respond(res, await data.pendingEditsList(req.user.userId));
});

// ── POST /api/governance/pending-edits/:id/review ─────────────────────────────
// Approve or reject a pending edit request.
// Body: { status: "Approved"|"Rejected", reviewNotes?: string }
// data.js: pendingEditsReview(userId, pendingId, status, reviewNotes)
//   Delegates to processApprovalDecision, which validates the approver's role
//   against the request's required_level.

router.post('/pending-edits/:id/review', async (req, res) => {
  const { status, reviewNotes } = req.body || {};
  if (!['Approved', 'Rejected'].includes(status)) {
    return res.status(400).json({ ok: false, error: '"status" must be "Approved" or "Rejected"' });
  }
  respond(res, await data.pendingEditsReview(req.user.userId, Number(req.params.id), status, reviewNotes || null));
});

// ── GET /api/governance/deletion-requests ─────────────────────────────────────
// List pending deletion requests visible to the caller.
// data.js: deletionRequestsList(userId)
//   Managers see all; leader-tier see only 'leader'-level requests; anyone
//   else gets Access denied (unlike pendingEditsList, there is no "see your
//   own" tier here — pre-existing data.js behavior, not changed this phase).

router.get('/deletion-requests', async (req, res) => {
  respond(res, await data.deletionRequestsList(req.user.userId));
});

// ── POST /api/governance/deletion-requests/:id/approve ────────────────────────
// data.js: deletionRequestApprove(userId, requestId, notes)

router.post('/deletion-requests/:id/approve', async (req, res) => {
  respond(res, await data.deletionRequestApprove(req.user.userId, Number(req.params.id), req.body?.notes || null));
});

// ── POST /api/governance/deletion-requests/:id/reject ──────────────────────────
// data.js: deletionRequestReject(userId, requestId, notes)

router.post('/deletion-requests/:id/reject', async (req, res) => {
  respond(res, await data.deletionRequestReject(req.user.userId, Number(req.params.id), req.body?.notes || null));
});

module.exports = router;
