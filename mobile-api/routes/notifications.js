'use strict';

const express     = require('express');
const data        = require('../../db/services/data');
const { respond } = require('../middleware/respond');

const router = express.Router();

// ── GET /api/notifications ────────────────────────────────────────────────────
// List notifications visible to the caller.
// Optional query params: category, search, fromDate, toDate, page, limit
// data.js: notificationsList(userId, filters) — all roles that have 'notifications' page

router.get('/', async (req, res) => {
  const { category, search, fromDate, toDate, page, limit } = req.query;
  respond(res, await data.notificationsList(req.user.userId, {
    category:  category  || null,
    search:    search    || null,
    fromDate:  fromDate  || null,
    toDate:    toDate    || null,
    page:      page      || 0,
    limit:     limit     || 50,
  }));
});

// ── GET /api/notifications/poll ───────────────────────────────────────────────
// Lightweight poll — returns unread count only. Called every 30s.
// data.js: notificationsPoll(userId)

router.get('/poll', async (req, res) => {
  respond(res, await data.notificationsPoll(req.user.userId));
});

// ── POST /api/notifications/read-all ─────────────────────────────────────────
// Mark every visible notification as read.
// data.js: notificationsMarkAllRead(userId)

router.post('/read-all', async (req, res) => {
  respond(res, await data.notificationsMarkAllRead(req.user.userId));
});

// ── POST /api/notifications/:id/read ─────────────────────────────────────────
// Mark a single notification as read.
// data.js: notificationsMarkRead(userId, notificationId)

router.post('/:id/read', async (req, res) => {
  respond(res, await data.notificationsMarkRead(req.user.userId, Number(req.params.id)));
});

module.exports = router;
