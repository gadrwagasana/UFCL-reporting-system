'use strict';

const express          = require('express');
const data              = require('../../db/services/data');
const { requireRoles }  = require('../middleware/authorize');
const { respond }       = require('../middleware/respond');

const router = express.Router();

// HR Enterprise Phase 1 — the Casuals (casual worker) registry existed only
// on desktop before this phase (renderer/app.js renderCasuals); this is its
// first REST exposure. Roles mirror data.js's own mustRole('casuals')
// fallback (ROLE_PAGES) plus 'supervisor', which this phase's approved fix
// also granted write access to (scoped to their own workshop — enforced
// inside casualsUpdate/casualsDelete themselves via isWorkshopRestricted,
// same as every other workshop-scoped write in this codebase).
const CASUAL_ROLES = ['admin', 'ceo', 'operations', 'supervisor'];

// GET /api/casuals — list casual workers (workshop-scoped for restricted roles)
router.get('/', requireRoles(...CASUAL_ROLES), async (req, res) => {
  respond(res, await data.casualsList(req.user.userId));
});

// POST /api/casuals — register a casual worker
router.post('/', requireRoles(...CASUAL_ROLES), async (req, res) => {
  respond(res, await data.casualsCreate(req.user.userId, req.body));
});

// PUT /api/casuals/:id — edit a casual worker (also used to activate/
// deactivate via the `active` field, same convention as the desktop form).
router.put('/:id', requireRoles(...CASUAL_ROLES), async (req, res) => {
  respond(res, await data.casualsUpdate(req.user.userId, Number(req.params.id), req.body));
});

// DELETE /api/casuals/:id — casualsDelete is a hard delete in data.js
// (no soft-delete/deactivate-only path exists for this table); `reason` is
// recorded in the audit log meta only, matching desktop's confirmDelete flow.
router.delete('/:id', requireRoles(...CASUAL_ROLES), async (req, res) => {
  respond(res, await data.casualsDelete(req.user.userId, Number(req.params.id), req.body?.reason));
});

module.exports = router;
