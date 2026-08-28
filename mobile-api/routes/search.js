'use strict';

const express     = require('express');
const data        = require('../../db/services/data');
const { respond } = require('../middleware/respond');

const router = express.Router();

// ── GET /api/search ───────────────────────────────────────────────────────────
// Cross-module search. Access control is fully handled inside data.globalSearch
// per-module (page permissions, admin-only gates, workshop isolation) — same
// pattern as material-requests: no requireRoles(...) gate at the route layer.
// Query params: q, module, status, workshop, department, createdBy, fromDate, toDate, page, limit, sort
// data.js: globalSearch(userId, filters)

router.get('/', async (req, res) => {
  const { q, module: mod, status, workshop, department, createdBy, fromDate, toDate, page, limit, sort } = req.query;
  const term = q ? String(q).trim() : '';
  // A bare module scope with no query text is a "browse this module" request (e.g. tapping
  // a suggested-module chip before typing) — only short-circuit when there's neither.
  if (term.length < 2 && !mod) {
    return respond(res, { ok: true, total: 0, moduleCounts: {}, results: [] });
  }
  respond(res, await data.globalSearch(req.user.userId, {
    q:          term,
    module:     mod        || null,
    status:     status     || null,
    workshop:   workshop   || null,
    department: department || null,
    createdBy:  createdBy  || null,
    fromDate:   fromDate   || null,
    toDate:     toDate     || null,
    page:       Number(page)  || 0,
    limit:      Number(limit) || 20,
    sort:       sort || 'newest',
  }));
});

module.exports = router;
