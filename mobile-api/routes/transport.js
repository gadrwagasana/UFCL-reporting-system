'use strict';

const express = require('express');
const router  = express.Router();
const data    = require('../../db/services/data');
const { requireRoles } = require('../middleware/authorize');
const { respond }      = require('../middleware/respond');

// Phase 1 Logistics fix — Transport Carriers and Transport Jobs had full CRUD
// on desktop but no mobile route, screen, or hook at all. Thin wrappers only;
// all logic lives in data.js's existing transportCompanies*/transportJobs*
// functions (mustRole('transport') || mustRole('transport-jobs') internally).
// Stabilization Phase 4 — 'operations' and 'sales' both hold 'transport' in
// db/migrate.js (and would already pass the mustRole check above) but were
// excluded here, blocking them at the route before ever reaching it.
const ROLES = ['admin', 'ceo', 'logistics', 'logistics-officer', 'operations', 'sales'];

// ── Transport Carriers ───────────────────────────────────────────────────────

router.get('/companies', requireRoles(...ROLES), async (req, res) => {
  respond(res, await data.transportCompaniesList(req.user.userId), 60);
});

router.post('/companies', requireRoles(...ROLES), async (req, res) => {
  respond(res, await data.transportCompaniesCreate(req.user.userId, req.body));
});

router.put('/companies/:id', requireRoles(...ROLES), async (req, res) => {
  respond(res, await data.transportCompaniesUpdate(req.user.userId, Number(req.params.id), req.body));
});

router.delete('/companies/:id', requireRoles(...ROLES), async (req, res) => {
  respond(res, await data.transportCompaniesDelete(req.user.userId, Number(req.params.id), req.body?.reason));
});

// ── Transport Jobs ───────────────────────────────────────────────────────────

router.get('/jobs', requireRoles(...ROLES), async (req, res) => {
  respond(res, await data.transportJobsList(req.user.userId), 60);
});

router.post('/jobs', requireRoles(...ROLES), async (req, res) => {
  respond(res, await data.transportJobsCreate(req.user.userId, req.body));
});

router.put('/jobs/:id', requireRoles(...ROLES), async (req, res) => {
  respond(res, await data.transportJobsUpdate(req.user.userId, Number(req.params.id), req.body));
});

router.patch('/jobs/:id/status', requireRoles(...ROLES), async (req, res) => {
  respond(res, await data.transportJobsUpdateStatus(req.user.userId, Number(req.params.id), req.body?.status));
});

router.delete('/jobs/:id', requireRoles(...ROLES), async (req, res) => {
  respond(res, await data.transportJobsDelete(req.user.userId, Number(req.params.id), req.body?.reason));
});

module.exports = router;
