'use strict';

// Supplier Relationship Management (SRM) — Phase 4. Contracts, compliance,
// communications, improvement plans, executive dashboard and reports — all
// thin wrappers over db/services/data.js (single source of truth). Document
// upload/download lives in the separate supplierDocuments.js route (multer
// needs its own request handling and is mounted at a more specific prefix).

const express      = require('express');
const data         = require('../../db/services/data');
const { respond }  = require('../middleware/respond');

const router = express.Router();

// ── Contracts (cross-supplier register + governance actions) ────────────────
router.get('/contracts', async (req, res) => {
  respond(res, await data.procurementContractsRegister(req.user.userId, req.query));
});
router.post('/contracts/:id/approve', async (req, res) => {
  respond(res, await data.procurementSupplierContractApprove(req.user.userId, Number(req.params.id), req.body?.reason));
});
router.post('/contracts/:id/renew', async (req, res) => {
  respond(res, await data.procurementSupplierContractRenew(req.user.userId, Number(req.params.id), req.body));
});

// ── Compliance ────────────────────────────────────────────────────────────────
router.get('/compliance', async (req, res) => {
  respond(res, await data.supplierComplianceRegister(req.user.userId, req.query));
});
router.get('/compliance/:supplierId', async (req, res) => {
  respond(res, await data.supplierComplianceList(req.user.userId, Number(req.params.supplierId)));
});
router.post('/compliance/:supplierId', async (req, res) => {
  respond(res, await data.supplierComplianceUpsert(req.user.userId, Number(req.params.supplierId), req.body));
});

// ── Communications ────────────────────────────────────────────────────────────
router.get('/communications', async (req, res) => {
  respond(res, await data.supplierCommunicationsRegister(req.user.userId, req.query));
});
router.get('/communications/:supplierId', async (req, res) => {
  respond(res, await data.supplierCommunicationsList(req.user.userId, Number(req.params.supplierId)));
});
router.post('/communications/:supplierId', async (req, res) => {
  respond(res, await data.supplierCommunicationCreate(req.user.userId, Number(req.params.supplierId), req.body));
});
router.patch('/communications/entry/:communicationId', async (req, res) => {
  respond(res, await data.supplierCommunicationUpdate(req.user.userId, Number(req.params.communicationId), req.body));
});

// ── Improvement plans ─────────────────────────────────────────────────────────
router.get('/improvement-plans', async (req, res) => {
  respond(res, await data.supplierImprovementPlansRegister(req.user.userId, req.query));
});
router.get('/improvement-plans/:supplierId', async (req, res) => {
  respond(res, await data.supplierImprovementPlansList(req.user.userId, Number(req.params.supplierId)));
});
router.post('/improvement-plans/:supplierId', async (req, res) => {
  respond(res, await data.supplierImprovementPlanCreate(req.user.userId, Number(req.params.supplierId), req.body));
});
router.patch('/improvement-plans/entry/:planId', async (req, res) => {
  respond(res, await data.supplierImprovementPlanUpdate(req.user.userId, Number(req.params.planId), req.body));
});

// ── Executive dashboard ───────────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  respond(res, await data.srmExecutiveDashboard(req.user.userId));
});

// ── Reports (7 types, CSV built client-side from the returned rows) ──────────
router.get('/reports/:reportType', async (req, res) => {
  respond(res, await data.srmReport(req.user.userId, req.params.reportType, req.query));
});

module.exports = router;
