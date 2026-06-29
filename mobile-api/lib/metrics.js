'use strict';

/**
 * In-memory metrics store.
 * Survives process lifetime; resets on restart.
 * No dependencies — uses os and process builtins.
 */

const os       = require('os');
const fs       = require('fs');
const path     = require('path');
const START_TS = Date.now();

// ── Counters (increment-only) ─────────────────────────────────────────────────
const counters = {
  requests_total:      0,
  requests_5xx:        0,
  auth_invalid_token:  0,  // 401 responses (expired/bad JWT)
  permission_denied:   0,  // 403 responses
  rate_limit_hits:     0,  // 429 responses
  db_errors:           0,  // incremented by routes that catch pool errors
};

// ── Rolling response-time window (last 500 requests) ─────────────────────────
const WINDOW   = 500;
const durations = [];

// ── Slow-request log ──────────────────────────────────────────────────────────
const SLOW_LOG_MAX = 50;
const slowRequests = [];

// ── Public API ────────────────────────────────────────────────────────────────

function inc(name, by = 1) {
  if (Object.prototype.hasOwnProperty.call(counters, name)) {
    counters[name] += by;
  }
}

function recordDuration(ms) {
  durations.push(ms);
  if (durations.length > WINDOW) durations.shift();
}

function recordSlowRequest(method, routePath, ms, status) {
  slowRequests.push({ ts: new Date().toISOString(), method, path: routePath, ms, status });
  if (slowRequests.length > SLOW_LOG_MAX) slowRequests.shift();
}

function _avgDuration() {
  if (durations.length === 0) return 0;
  return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
}

function _p95Duration() {
  if (durations.length === 0) return 0;
  const sorted = [...durations].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * 0.95)] ?? 0;
}

/**
 * Try to read the deployed APK version from updates/version.json.
 * Returns null if not yet deployed.
 */
function _apkVersion() {
  try {
    const vf = path.join(__dirname, '..', 'updates', 'version.json');
    if (fs.existsSync(vf)) {
      return JSON.parse(fs.readFileSync(vf, 'utf8')).version || null;
    }
  } catch {}
  return null;
}

/**
 * Returns a full point-in-time snapshot.
 * All values are safe to JSON-serialise.
 */
function snapshot() {
  const mem  = process.memoryUsage();
  const load = os.loadavg();

  return {
    uptime_seconds:   Math.round((Date.now() - START_TS) / 1000),
    // Traffic
    requests_total:     counters.requests_total,
    requests_5xx:       counters.requests_5xx,
    auth_invalid_token: counters.auth_invalid_token,
    permission_denied:  counters.permission_denied,
    rate_limit_hits:    counters.rate_limit_hits,
    db_errors:          counters.db_errors,
    // Response times
    response_ms: {
      avg: _avgDuration(),
      p95: _p95Duration(),
      samples: durations.length,
    },
    // Process memory
    memory: {
      heap_used_mb:  Math.round(mem.heapUsed  / 1048576),
      heap_total_mb: Math.round(mem.heapTotal / 1048576),
      rss_mb:        Math.round(mem.rss       / 1048576),
    },
    // Host OS
    system: {
      cpu_count:    os.cpus().length,
      load_1m:      +load[0].toFixed(2),
      load_5m:      +load[1].toFixed(2),
      load_15m:     +load[2].toFixed(2),
      total_mem_mb: Math.round(os.totalmem() / 1048576),
      free_mem_mb:  Math.round(os.freemem()  / 1048576),
      platform:     os.platform(),
      node_version: process.version,
    },
    // Application
    apk_version:   _apkVersion(),
    slow_requests: slowRequests.slice(-10),  // last 10 slow reqs
  };
}

module.exports = { inc, recordDuration, recordSlowRequest, snapshot };
