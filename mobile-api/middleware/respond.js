'use strict';

/**
 * Translate a data.js result object into an HTTP response.
 *
 * data.js always returns { ok: true, ... } or { ok: false, error: '...' }.
 * This maps common error strings to appropriate HTTP status codes so the
 * mobile client can distinguish auth failures from validation errors.
 */
function respond(res, result) {
  if (result.ok) return res.json(result);

  const msg = result.error || 'Unknown error';

  if (/access denied|insufficient role/i.test(msg)) return res.status(403).json(result);
  if (/not found/i.test(msg))                        return res.status(404).json(result);
  if (/user not found|user inactive/i.test(msg))     return res.status(401).json(result);

  return res.status(400).json(result);
}

module.exports = { respond };
