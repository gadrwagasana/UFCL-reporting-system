'use strict';

const jwt = require('jsonwebtoken');

/**
 * Express middleware: verify Bearer JWT, attach decoded payload to req.user.
 * All protected routes mount this via server.js before their router.
 *
 * req.user shape after verification:
 *   { userId, role, workshopId, iat, exp }
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'Missing or malformed Authorization header' });
  }

  const token = header.slice(7);
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('[auth] JWT_SECRET is not set in .env');
    return res.status(500).json({ ok: false, error: 'Server configuration error' });
  }

  try {
    req.user = jwt.verify(token, secret);
    next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError' ? 'Token expired — please log in again' : 'Invalid token';
    return res.status(401).json({ ok: false, error: msg });
  }
}

module.exports = { authenticate };
