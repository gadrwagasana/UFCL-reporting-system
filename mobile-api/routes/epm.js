'use strict';
const express          = require('express');
const router           = express.Router();
const { requireRoles } = require('../middleware/authorize');
const { respond }      = require('../middleware/respond');
const data             = require('../../db/services/data');

const ADMIN_CEO_OPS = requireRoles('ceo', 'admin', 'operations');

router.get('/dashboard',   ADMIN_CEO_OPS, async (req, res) => {
  respond(res, await data.performanceDashboard(req.user.userId), 120);
});

router.get('/departments', ADMIN_CEO_OPS, async (req, res) => {
  respond(res, await data.departmentScorecards(req.user.userId), 120);
});

router.get('/trends',      ADMIN_CEO_OPS, async (req, res) => {
  respond(res, await data.performanceTrends(req.user.userId), 120);
});

module.exports = router;
