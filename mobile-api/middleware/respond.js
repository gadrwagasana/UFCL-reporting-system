'use strict';

const { ErrorCode, HTTP_STATUS } = require('../constants/errorCodes');

/**
 * Build the standard API envelope.
 *
 * Success:  { ok, version, generatedAt, cacheSeconds, data }
 * Error:    { ok, version, error: { code, message } }
 */
function buildEnvelope(ok, payload, cacheSeconds = 0) {
  if (ok) {
    return {
      ok:           true,
      version:      1,
      generatedAt:  new Date().toISOString(),
      cacheSeconds,
      data:         payload,
    };
  }
  return {
    ok:      false,
    version: 1,
    error:   payload,   // { code, message }
  };
}

/**
 * Translate a data.js result into a versioned HTTP response.
 *
 * data.js always returns { ok: true, ... } or { ok: false, error: '...' }.
 * Routes pass an optional cacheSeconds hint (default 0 = no caching guidance).
 *
 * Usage:
 *   respond(res, await data.someFunction(...))
 *   respond(res, await data.someFunction(...), 30)
 */
function respond(res, result, cacheSeconds = 0) {
  // Fleet & Equipment Phase 1 fix — a governed action queued for approval
  // (applyGovernance's `{ ok:false, pendingApproval:true, level, message }`
  // response) is not an error, but it was falling into the generic
  // `ok===false` branch below, which discards everything except a mapped
  // .error string (pendingApproval/message/level have no .error field, so
  // it defaulted to "An unexpected error occurred.") and returns a non-2xx
  // status. Axios then rejects the request before the mobile hooks'
  // `if (result.pendingApproval)` checks (useFuelLogDelete,
  // useMaintenanceDelete, useVehicleUpdate/Delete) ever ran — every governed
  // mobile action showed a generic error instead of "Submitted for Review",
  // even though the desktop/web client already handled this correctly.
  // Sent as a 200 success envelope so the client resolves normally; the
  // nested `result.ok: false` is preserved (object spread order) so
  // unwrapEnvelope's reconstructed object still reads pendingApproval/
  // message/level exactly as the mobile hooks expect.
  if (result && result.ok === false && result.pendingApproval) {
    return res.json(buildEnvelope(true, result, cacheSeconds));
  }
  if (!result || result.ok === false) {
    const rawError = result?.error ?? 'An unexpected error occurred.';
    let code;
    let message;

    if (typeof rawError === 'object' && rawError.code) {
      code    = rawError.code;
      message = rawError.message ?? 'An unexpected error occurred.';
    } else {
      const msg = String(rawError);
      if (/access denied|insufficient role|forbidden/i.test(msg)) {
        code = ErrorCode.FORBIDDEN;
      } else if (/not found/i.test(msg)) {
        code = ErrorCode.NOT_FOUND;
      } else if (/user not found|user inactive|invalid token|token expired/i.test(msg)) {
        code = ErrorCode.UNAUTHORIZED;
      } else if (/required|invalid|must be/i.test(msg)) {
        code = ErrorCode.VALIDATION_ERROR;
      } else {
        code = ErrorCode.INTERNAL_ERROR;
      }
      message = msg;
    }

    const status = HTTP_STATUS[code] ?? 500;
    return res.status(status).json(buildEnvelope(false, { code, message }));
  }

  const { ok: _, ...payload } = result;
  return res.json(buildEnvelope(true, payload, cacheSeconds));
}

module.exports = { respond, buildEnvelope };
