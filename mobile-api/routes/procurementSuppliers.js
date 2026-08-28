'use strict';

const express      = require('express');
const data         = require('../../db/services/data');
const { respond }  = require('../middleware/respond');

const router = express.Router();

// ── GET /api/procurement/suppliers ──────────────────────────────────────────
router.get('/', async (req, res) => {
  respond(res, await data.procurementSuppliersList(req.user.userId, req.query));
});

// ── POST /api/procurement/suppliers ─────────────────────────────────────────
router.post('/', async (req, res) => {
  respond(res, await data.procurementSupplierCreate(req.user.userId, req.body));
});

// ── PATCH /api/procurement/suppliers/:id ────────────────────────────────────
router.patch('/:id', async (req, res) => {
  respond(res, await data.procurementSupplierUpdate(req.user.userId, Number(req.params.id), req.body));
});

// ── POST /api/procurement/suppliers/:id/blacklist ───────────────────────────
router.post('/:id/blacklist', async (req, res) => {
  const { blacklisted, reason } = req.body || {};
  respond(res, await data.procurementSupplierToggleBlacklist(req.user.userId, Number(req.params.id), !!blacklisted, reason));
});

// ── POST /api/procurement/suppliers/:id/status ──────────────────────────────
// Generic lifecycle transition (activate/deactivate/restore/archive) — one
// route for every target status, matching the Electron IPC side.
router.post('/:id/status', async (req, res) => {
  const { status, reason } = req.body || {};
  respond(res, await data.procurementSupplierSetStatus(req.user.userId, Number(req.params.id), status, reason));
});

// ── DELETE /api/procurement/suppliers/:id ───────────────────────────────────
router.delete('/:id', async (req, res) => {
  respond(res, await data.procurementSupplierDelete(req.user.userId, Number(req.params.id)));
});

// ── Supplier contacts ────────────────────────────────────────────────────────
router.get('/:id/contacts', async (req, res) => {
  respond(res, await data.procurementSupplierContactsList(req.user.userId, Number(req.params.id)));
});
router.post('/:id/contacts', async (req, res) => {
  respond(res, await data.procurementSupplierContactCreate(req.user.userId, Number(req.params.id), req.body));
});
router.patch('/contacts/:contactId', async (req, res) => {
  respond(res, await data.procurementSupplierContactUpdate(req.user.userId, Number(req.params.contactId), req.body));
});
router.delete('/contacts/:contactId', async (req, res) => {
  respond(res, await data.procurementSupplierContactDelete(req.user.userId, Number(req.params.contactId)));
});

// ── Supplier contracts ───────────────────────────────────────────────────────
router.get('/:id/contracts', async (req, res) => {
  respond(res, await data.procurementSupplierContractsList(req.user.userId, Number(req.params.id)));
});
router.post('/:id/contracts', async (req, res) => {
  respond(res, await data.procurementSupplierContractCreate(req.user.userId, Number(req.params.id), req.body));
});
router.patch('/contracts/:contractId', async (req, res) => {
  respond(res, await data.procurementSupplierContractUpdate(req.user.userId, Number(req.params.contractId), req.body));
});

// ── Supplier performance (computed) ──────────────────────────────────────────
router.get('/:id/performance', async (req, res) => {
  respond(res, await data.procurementSupplierPerformance(req.user.userId, Number(req.params.id)));
});

module.exports = router;
