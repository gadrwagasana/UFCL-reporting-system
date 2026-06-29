'use strict';

const express          = require('express');
const { pool }         = require('../../db/pool');
const data             = require('../../db/services/data');
const { respond }      = require('../middleware/respond');

const router = express.Router();

// Manager roles that see ALL pending requests in data.js (pendingEditsList returns all)
const MANAGER_ROLES = ['admin', 'ceo', 'operations', 'logistics'];

// ── GET /api/my-requests ──────────────────────────────────────────────────────
// Returns pending edit and deletion requests submitted by the caller.
//
// Gap B implementation:
//   - Managers (admin, ceo, operations, logistics) receive ALL pending requests
//     via data.js pendingEditsList — the standard desktop view.
//   - All other roles (supervisor, storekeeper, poles-leader, etc.) receive only
//     their OWN submissions, filtered in the API layer (WHERE submitted_by = userId).
//     This requires a direct pool query because pendingEditsList has no user filter.
//
// data.js: pendingEditsList(userId) — NO role check, any authenticated user.

router.get('/', async (req, res) => {
  const { userId, role } = req.user;

  try {
    if (MANAGER_ROLES.includes(role)) {
      return respond(res, await data.pendingEditsList(userId));
    }

    // Non-manager: return only this user's own submissions
    const [{ rows: edits }, { rows: deletions }] = await Promise.all([
      pool.query(
        `select pe.id,
                pe.action_type,
                pe.entity_type,
                pe.entity_ref,
                pe.status,
                pe.review_notes,
                to_char(pe.submitted_at,'DD/MM/YYYY HH24:MI') as submitted_at,
                to_char(pe.reviewed_at,'DD/MM/YYYY HH24:MI')  as reviewed_at
         from pending_edits pe
         where pe.submitted_by = $1
         order by pe.submitted_at desc
         limit 100`,
        [userId]
      ),
      pool.query(
        `select dr.id,
                'deletion'                                        as action_type,
                dr.entity_type,
                dr.entity_ref,
                dr.deletion_reason                               as reason,
                dr.status,
                dr.review_notes,
                to_char(dr.requested_at,'DD/MM/YYYY HH24:MI')   as submitted_at,
                to_char(dr.reviewed_at,'DD/MM/YYYY HH24:MI')    as reviewed_at
         from deletion_requests dr
         where dr.requested_by = $1
         order by dr.requested_at desc
         limit 100`,
        [userId]
      )
    ]);

    return res.json({ ok: true, edits, deletions });
  } catch (err) {
    console.error('[my-requests]', err.message);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

module.exports = router;
