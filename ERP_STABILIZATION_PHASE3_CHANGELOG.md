# ERP Stabilization Program — Phase 3 — Changelog

## Added

- **`mobile-api/middleware/asyncErrors.js`** — patches `express.Router`'s HTTP-verb methods once, at require-time, so every route handler across all 44 route files (292 handlers total) automatically forwards a thrown error or rejected promise to Express's error pipeline instead of hanging the request. No route file was individually modified — the fix is a single shared mechanism, per the phase's "one shared pattern, avoid duplicated try/catch" requirement.

## Changed

- **`mobile-api/server.js`** — requires and installs the new async-error framework before any route file loads. The global error handler now logs the authenticated user (`userId`, `role`) and the full stack trace alongside the existing method/path, while the client-facing response remains an unchanged generic `500 INTERNAL_ERROR` — no internal detail is ever exposed to a client.

## Fixed (indirectly — failure mode only, not the underlying defect)

- `GET /api/reports/bi`'s pre-existing division-by-zero bug (documented in Phase 2) previously hung the request indefinitely; it now returns a clean `500` immediately, with full context captured in the server log. The underlying SQL defect itself is still open — see the completion report §7/§9.

## Verified

- Every module touched by Stabilization Phases 1 and 2 re-tested live and confirmed regression-free (Dispatch, Transport, Sales, Stock Catalog/Levels/Transfers, Compartments, Timber Inventory, Workshops, Reports, Administration, Automation, Fleet, Mechanician, Material Requests, Procurement).
- Standardized error envelope confirmed identical across permission failures, validation failures, missing-resource errors, unmatched routes, and unexpected exceptions.
- `node --check` clean on all 44 route files, `server.js`, and the new module. `tsc --noEmit` clean on mobile (no mobile app files touched this phase).

## Documented, not fixed (out of this phase's scope)

- `_biPredictStockRunout()`'s division-by-zero in `db/services/data.js` — business logic, pre-existing, not caused by this framework.
- Pre-existing route-level permission-array drift found in Phase 1 — unaffected by this phase.
