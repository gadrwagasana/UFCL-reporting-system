'use strict';

/**
 * Monitoring endpoints.  All three are registered before the rate limiter
 * and before authenticate — no JWT required.
 *
 * GET /api/health  — liveness probe (backward-compatible with original response)
 * GET /api/ready   — readiness probe (checks DB connectivity)
 * GET /api/metrics — full metrics snapshot (localhost or METRICS_TOKEN only)
 */

const express       = require('express');
const { pool }      = require('../../db/pool');
const metrics       = require('../lib/metrics');
const router        = express.Router();

const API_VERSION = (() => {
  try { return require('../package.json').version; } catch { return '1.0.0'; }
})();

// ── GET /api/health ───────────────────────────────────────────────────────────
// Liveness probe — always returns 200 while the process is alive.
// Backward-compatible: still returns { ok, uptime, ts } plus extended fields.
// Existing clients that only check `ok: true` continue to work unchanged.

router.get('/health', (req, res) => {
  const snap = metrics.snapshot();
  res.json({
    ok:      true,
    status:  'healthy',
    uptime:  process.uptime(),
    ts:      new Date().toISOString(),
    version: API_VERSION,
    // Extended — ignored by old clients
    memory: snap.memory,
    requests: {
      total:  snap.requests_total,
      errors: snap.requests_5xx,
      avg_ms: snap.response_ms.avg,
      p95_ms: snap.response_ms.p95,
    },
    apk_version: snap.apk_version,
  });
});

// ── GET /api/ready ────────────────────────────────────────────────────────────
// Readiness probe — checks PostgreSQL connectivity.
// Returns 200 when ready, 503 when the DB is unreachable.
// Used by load balancers and deployment health gates.

router.get('/ready', async (req, res) => {
  const t0 = Date.now();
  try {
    await pool.query('SELECT 1');
    const db_ms = Date.now() - t0;
    res.json({
      ok:     true,
      status: 'ready',
      db:     { connected: true, latency_ms: db_ms },
      ts:     new Date().toISOString(),
    });
  } catch (err) {
    metrics.inc('db_errors');
    res.status(503).json({
      ok:     false,
      status: 'not_ready',
      db:     { connected: false, error: err.message },
      ts:     new Date().toISOString(),
    });
  }
});

// ── GET /api/metrics ──────────────────────────────────────────────────────────
// Full diagnostics snapshot.
// Access restricted to:
//   • Localhost (127.0.0.1 / ::1) — for Prometheus/PM2 scraping
//   • Any IP with Authorization: Bearer <METRICS_TOKEN> (set in .env)
// Returns 403 to all other callers.

router.get('/metrics', async (req, res) => {
  const ip = req.ip ?? '';
  const isLocal = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip);
  const bearerToken = req.headers.authorization?.replace('Bearer ', '');
  const tokenOk = process.env.METRICS_TOKEN
    && bearerToken === process.env.METRICS_TOKEN;

  if (!isLocal && !tokenOk) {
    return res.status(403).json({ ok: false, error: 'Forbidden' });
  }

  // DB latency (best-effort — include even if it fails)
  let dbStatus = { connected: false, latency_ms: null, error: null };
  try {
    const t0 = Date.now();
    await pool.query('SELECT 1');
    dbStatus = { connected: true, latency_ms: Date.now() - t0, error: null };
  } catch (e) {
    dbStatus.error = e.message;
    metrics.inc('db_errors');
  }

  // Active-session estimate: logins in last 8 h from audit_log
  let activeSessions = null;
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(DISTINCT user_id) AS cnt
       FROM audit_log
       WHERE action_type = 'login'
         AND created_at >= NOW() - INTERVAL '8 hours'`
    );
    activeSessions = parseInt(rows[0]?.cnt ?? '0', 10);
  } catch {}

  const snap = metrics.snapshot();

  res.json({
    ok:              true,
    ts:              new Date().toISOString(),
    api_version:     API_VERSION,
    ...snap,
    db:              dbStatus,
    active_sessions: activeSessions,
  });
});

module.exports = router;
