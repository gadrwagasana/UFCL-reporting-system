'use strict';

/**
 * Route-level role guard — early rejection before the data.js call.
 * data.js is the authoritative permission check; this is a fast first gate.
 *
 * Usage:
 *   router.post('/', requireRoles('ceo'), handler)
 *   router.post('/', requireRoles('admin','ceo','operations'), handler)
 */
function requireRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ ok: false, error: 'Access denied — insufficient role' });
    }
    next();
  };
}

/**
 * Gap C fix: when the caller is a supervisor, verify their workshop_id matches
 * the workshop_id on the target resource. Pass resourceWorkshopId as a number.
 * Call this inside a route handler after fetching the resource, before calling
 * the data.js approve function.
 */
function supervisorWorkshopGuard(req, resourceWorkshopId) {
  if (req.user.role !== 'supervisor') return true;
  return req.user.workshopId != null && req.user.workshopId === resourceWorkshopId;
}

module.exports = { requireRoles, supervisorWorkshopGuard };
