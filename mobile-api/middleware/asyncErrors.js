'use strict';

/**
 * Express 4 does not catch a rejected promise thrown inside an async route
 * handler — it becomes a Node-level "unhandled rejection" that bypasses the
 * app's error-handling middleware entirely, so no response is ever sent and
 * the client hangs until it times out. Three separate production bugs
 * (ERP_STABILIZATION_PHASE1/2) manifested exactly this way.
 *
 * This patches express.Router's HTTP-verb methods once, at require-time, so
 * every handler registered on every router — present and future, across all
 * ~44 route files — is wrapped: a thrown error or rejected promise is
 * forwarded to the app's existing global error handler via next(err)
 * instead of hanging. Every express.Router() instance shares these methods
 * via its prototype chain (Object.setPrototypeOf(router, express.Router)),
 * so patching them here covers every router created after this file is
 * required — which is why it must be required before any route file.
 *
 * Error-handling middleware ((err, req, res, next) => {...}, arity 4) is
 * left untouched — wrapping it would break Express's own arity-based
 * detection of error handlers.
 */

const { Router } = require('express');

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'all'];

function wrapHandler(handler) {
  if (typeof handler !== 'function' || handler.length === 4) return handler;
  return function asyncWrapped(req, res, next) {
    try {
      const result = handler(req, res, next);
      if (result && typeof result.catch === 'function') {
        result.catch(next);
      }
    } catch (err) {
      next(err);
    }
  };
}

let patched = false;

function installAsyncErrorHandling() {
  if (patched) return;
  patched = true;
  for (const method of HTTP_METHODS) {
    const original = Router[method];
    Router[method] = function (path, ...handlers) {
      return original.call(this, path, ...handlers.map(wrapHandler));
    };
  }
}

module.exports = { installAsyncErrorHandling };
