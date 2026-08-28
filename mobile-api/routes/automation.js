'use strict';

const express          = require('express');
const router           = express.Router();
const { requireRoles } = require('../middleware/authorize');
const { respond }      = require('../middleware/respond');
const data             = require('../../db/services/data');

const ADMIN_CEO_OPS = requireRoles('ceo', 'admin', 'operations');
const ADMIN_CEO     = requireRoles('ceo', 'admin');
const MGR_ROLES     = requireRoles('ceo', 'admin', 'operations', 'director', 'manager');

// Full dashboard snapshot (summary + rules + log + jobs + escalations + scheduler)
router.get('/dashboard', ADMIN_CEO_OPS, async (req, res) => {
  respond(res, await data.automationDashboard(req.user.userId), 60);
});

// Manual trigger — rate-limited to 1/min in data.js
router.post('/run', ADMIN_CEO_OPS, async (req, res) => {
  respond(res, await data.triggerAutomationNow(req.user.userId));
});

// Rules list
router.get('/rules', ADMIN_CEO_OPS, async (req, res) => {
  respond(res, await data.getAutomationRules(req.user.userId), 60);
});

// Single rule (for detail/edit screen)
router.get('/rules/:key', ADMIN_CEO_OPS, async (req, res) => {
  respond(res, await data.getAutomationRule(req.user.userId, req.params.key));
});

// Update rule — merges enabled toggle + full field updates via same endpoint
router.put('/rules/:key', ADMIN_CEO, async (req, res) => {
  respond(res, await data.updateAutomationRule(req.user.userId, req.params.key, req.body));
});

// Master Professionalization Phase C3 (PR-22/23) — createAutomationRule/
// deleteAutomationRule were already fully built and desktop-wired; mobile had
// no route for either (only GET/PUT existed here). Same admin/ceo gate as the
// backend functions' own internal check.
router.post('/rules', ADMIN_CEO, async (req, res) => {
  respond(res, await data.createAutomationRule(req.user.userId, req.body));
});

router.delete('/rules/:key', ADMIN_CEO, async (req, res) => {
  respond(res, await data.deleteAutomationRule(req.user.userId, req.params.key));
});

// Active escalations
router.get('/escalations', ADMIN_CEO_OPS, async (req, res) => {
  respond(res, await data.getEscalations(req.user.userId, { status: 'active', limit: 100 }), 30);
});

// Resolve escalation — admin/ceo/director/manager/operations (data.js enforces fine-grain)
router.put('/escalations/:id/resolve', MGR_ROLES, async (req, res) => {
  const reason = req.body?.reason || 'Manually resolved';
  respond(res, await data.resolveEscalation(req.user.userId, Number(req.params.id), reason));
});

// Acknowledge escalation
router.put('/escalations/:id/ack', ADMIN_CEO_OPS, async (req, res) => {
  respond(res, await data.acknowledgeEscalation(req.user.userId, Number(req.params.id)));
});

module.exports = router;
