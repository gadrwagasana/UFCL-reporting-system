'use strict';

// Load .env before any module that needs DB credentials or JWT_SECRET
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express   = require('express');
const rateLimit = require('express-rate-limit');
const helmet    = require('helmet');
const { authenticate }  = require('./middleware/auth');
const { buildEnvelope } = require('./middleware/respond');
const { ErrorCode }     = require('./constants/errorCodes');
const logger  = require('./lib/logger');
const metrics = require('./lib/metrics');

// Stabilization Phase 3 — must run before any route file is required below,
// since each one calls express.Router() and registers handlers at
// require-time. See middleware/asyncErrors.js for why this exists.
require('./middleware/asyncErrors').installAsyncErrorHandling();

const app  = express();
const PORT = process.env.MOBILE_API_PORT || 3001;

// Bind address: 0.0.0.0 for direct LAN access (dev), 127.0.0.1 when nginx fronts it (prod).
// Set API_BIND_HOST=127.0.0.1 in .env to enable nginx-proxy isolation.
const HOST = process.env.API_BIND_HOST ?? '0.0.0.0';

// When behind nginx, Express must trust the X-Real-IP forwarded header so that
// rate limiting counts per-device IP rather than per-proxy IP.
if (process.env.API_BEHIND_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// ── Security headers (P2) ─────────────────────────────────────────────────────
// Helmet sets safe HTTP response headers. CSP and COEP are disabled because
// this server returns JSON only — those headers apply to HTML documents.
// crossOriginResourcePolicy is set to cross-origin so React Native can fetch freely.
app.use(helmet({
  contentSecurityPolicy:      false,
  crossOriginEmbedderPolicy:  false,
  crossOriginResourcePolicy:  { policy: 'cross-origin' },
}));

// ── Rate limiters (P1) ────────────────────────────────────────────────────────
//
// Login limiter  — 10 attempts per 15 min per IP.
//   Brute-force protection for POST /api/auth/login.
//   On limit: 429 { ok:false, error:'...' }.  Window resets after 15 min.
//   skipSuccessfulRequests is intentionally false — counts all attempts to
//   prevent enumeration attacks via timing.
//
// API limiter    — 300 req/min per IP across all /api/* routes.
//   Covers every authenticated endpoint. 300/min ≈ 5 req/s average, which is
//   generous for a single mobile user. Per-device (see trust proxy note above).
//   Health check requests are excluded via the skip function.

const loginLimiter = rateLimit({
  windowMs:              15 * 60 * 1_000,
  max:                   10,
  standardHeaders:       true,
  legacyHeaders:         false,
  skipSuccessfulRequests: false,
  message:               { ok: false, error: 'Too many login attempts — try again in 15 minutes' },
});

// Update endpoint limiter — 30 req/hour per device IP.
// One version check every 2 min is already generous; this prevents scraping.
const updateLimiter = rateLimit({
  windowMs:        60 * 60 * 1_000,
  max:             30,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { ok: false, error: 'Too many update requests — try again later' },
});

const apiLimiter = rateLimit({
  windowMs:        60 * 1_000,
  max:             300,
  standardHeaders: true,
  legacyHeaders:   false,
  skip:            (req) => req.path === '/api/health',
  message:         { ok: false, error: 'Too many requests — please slow down' },
});

// ── Global middleware ─────────────────────────────────────────────────────────

// 512 kb body limit — prevents large-payload DoS on JSON endpoints.
app.use(express.json({ limit: '512kb' }));

// CORS for LAN clients (React Native Expo + future web dashboards).
// * is acceptable on a private LAN; tighten to the LAN subnet if needed.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ── Request tracking — must be before routes ──────────────────────────────────
// Observes every completed response:
//   • Counts by status code bucket (5xx, 401, 403, 429)
//   • Records duration for avg/p95 metrics
//   • Logs slow requests (> 1 s) with method, path, and status

const SLOW_THRESHOLD_MS = parseInt(process.env.SLOW_REQUEST_MS || '1000', 10);

app.use((req, res, next) => {
  req._startMs = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - req._startMs;
    metrics.inc('requests_total');
    metrics.recordDuration(ms);
    if (res.statusCode >= 500)  metrics.inc('requests_5xx');
    if (res.statusCode === 401) metrics.inc('auth_invalid_token');
    if (res.statusCode === 403) metrics.inc('permission_denied');
    if (res.statusCode === 429) metrics.inc('rate_limit_hits');
    if (ms >= SLOW_THRESHOLD_MS) {
      metrics.recordSlowRequest(req.method, req.path, ms, res.statusCode);
      logger.warn('slow_request', { method: req.method, path: req.path, ms, status: res.statusCode });
    }
  });
  next();
});

// ── Health / ready / metrics — no JWT, no rate limit ─────────────────────────
// Registered before apiLimiter so monitoring never consumes rate limit quota.
// /api/health is backward-compatible with the original { ok, uptime, ts } shape.

app.use('/api', require('./routes/health'));

// ── Public update distribution — no JWT required ──────────────────────────────
// /version.json and /downloads/* are intentionally unauthenticated:
// the mobile app must be able to check for updates before login.
// Isolated from /api/* — no existing route or middleware is affected.

app.use(['/version.json', '/downloads'], updateLimiter);
app.use(require('./routes/updates'));

// ── General rate limit on all remaining /api/* routes ────────────────────────

app.use('/api', apiLimiter);

// ── Public routes — login gets both the general + strict limiter ──────────────

app.post('/api/auth/login', loginLimiter);   // applied on top of apiLimiter above
app.use('/api/auth', require('./routes/auth'));

// ── All routes below require a valid JWT ─────────────────────────────────────

app.use('/api', authenticate);

// Phase 1 — production / supervisors
app.use('/api/ceo',              require('./routes/ceo'));
app.use('/api/sawmill',          require('./routes/sawmill'));
app.use('/api/harvest',          require('./routes/harvest'));
app.use('/api/log-transport',    require('./routes/logTransport'));
// Timber Lifecycle Phase 1 — Harvest Waste / Resolution Engine / Production
// Offcuts + Resaw + Quality Inspection, plus the generalized attachments
// subsystem (files live on this server's disk under uploads/lifecycle/,
// same non-Postgres-storage pattern as supplierDocuments.js).
app.use('/api/harvest-waste',    require('./routes/harvestWaste'));
app.use('/api/resolutions',      require('./routes/resolutions'));
app.use('/api/production-offcuts', require('./routes/productionOffcuts'));
app.use('/api/rejection-holds',    require('./routes/rejectionHolds'));
app.use('/api/attachments',      require('./routes/attachments'));
app.use('/api/material-requests',require('./routes/materialRequests'));
app.use('/api/casual-labour',    require('./routes/casualLabour'));
app.use('/api/casuals',          require('./routes/casuals'));
app.use('/api/attendance',       require('./routes/attendance'));
app.use('/api/payroll',          require('./routes/payroll'));
app.use('/api/finance-center',   require('./routes/finance'));
app.use('/api/poles',            require('./routes/poles'));
app.use('/api/deliveries',       require('./routes/deliveries'));
app.use('/api/machine-logs',     require('./routes/machineLogs'));
app.use('/api/fuel',             require('./routes/fuel'));
app.use('/api/my-requests',      require('./routes/myRequests'));
app.use('/api/meta',             require('./routes/meta'));

// Sprint 4 — VAT workflow
app.use('/api/vat',              require('./routes/vat'));

// Timber Lifecycle Phase 3 — Showroom Quality/Damage Check
app.use('/api/showroom-damage',  require('./routes/showroomDamage'));

// Notifications — all authenticated roles
app.use('/api/notifications',    require('./routes/notifications'));

// Dashboard — general stats (multi-role) + logistics warehouse view
app.use('/api/dashboard',        require('./routes/dashboard'));
app.use('/api/logistics',        require('./routes/logistics'));

app.use('/api/customers',        require('./routes/customers'));
app.use('/api/products',         require('./routes/products'));
app.use('/api/vehicles',         require('./routes/vehicles'));
app.use('/api/machines',         require('./routes/machines'));
app.use('/api/maintenance-jobs', require('./routes/maintenanceJobs'));
app.use('/api/workshops',        require('./routes/workshops'));
app.use('/api/compartments',     require('./routes/compartments'));
app.use('/api/stock',            require('./routes/stock'));
app.use('/api/timber-inventory', require('./routes/timberInventory'));

// Phase 2 skeletons (routes exist, return 501 until implemented)
app.use('/api/stock-transfers',  require('./routes/stockTransfers'));
app.use('/api/dispatch',         require('./routes/dispatch'));
app.use('/api/sales',            require('./routes/sales'));
app.use('/api/transport',        require('./routes/transport'));

app.use('/api/reports',        require('./routes/reports'));
app.use('/api/admin',          require('./routes/admin'));
app.use('/api/automation',     require('./routes/automation'));
app.use('/api/epm',            require('./routes/epm'));

// Global Search — cross-module search, access enforced inside data.globalSearch
app.use('/api/search',         require('./routes/search'));

// Procurement Management — Requisition → RFQ/Quotation → PO → Goods Receipt →
// Invoice Match → Payment, driven by data.procurementApprovalAction's generic
// multi-stage chain. Access enforced inside each data.js function.
app.use('/api/procurement/suppliers',    require('./routes/procurementSuppliers'));
app.use('/api/procurement/requisitions', require('./routes/procurementRequisitions'));
app.use('/api/procurement/rfq',          require('./routes/procurementRfq'));
app.use('/api/procurement/orders',       require('./routes/procurementOrders'));
app.use('/api/procurement/invoices',     require('./routes/procurementInvoices'));

// Supplier Relationship Management (SRM) — Phase 4. Contracts/compliance/
// communications/improvement-plans/dashboard/reports, plus the document
// center (files live on this server's disk under uploads/suppliers/, never
// in Postgres — see supplierDocuments.js). The documents mount is more
// specific than /api/srm so it must be registered first.
app.use('/api/srm/documents',            require('./routes/supplierDocuments'));
app.use('/api/srm',                      require('./routes/srm'));

// ERP Enterprise Completion Phase 4 — Pending Edit / Deletion Request
// governance review (approve/reject side). Submission side already worked
// on mobile via each entity route's existing applyGovernance() passthrough.
app.use('/api/governance',               require('./routes/governance'));

// ── Monitoring dashboard (static HTML, no JWT) ────────────────────────────────
// Served at /dashboard.html — admin opens in browser, fetches /api/metrics with token.

app.use(express.static(path.join(__dirname, 'public')));

// ── 404 catch-all ─────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json(buildEnvelope(false, {
    code:    ErrorCode.NOT_FOUND,
    message: `Route not found: ${req.method} ${req.path}`,
  }));
});

// ── Global error handler ──────────────────────────────────────────────────────

app.use((err, req, res, _next) => {
  // Stabilization Phase 3 — this is now the actual destination for every
  // route handler's thrown/rejected error (see middleware/asyncErrors.js),
  // not just the rare synchronous throw it used to catch. Logs the full
  // context needed to debug a live incident; the response itself stays a
  // generic 500 — never leak err.message/stack to the client.
  logger.error('request_error', {
    method:  req.method,
    path:    req.path,
    userId:  req.user?.userId ?? null,
    role:    req.user?.role ?? null,
    message: err.message,
    stack:   err.stack,
  });
  console.error('[server]', err.message);
  res.status(500).json(buildEnvelope(false, {
    code:    ErrorCode.INTERNAL_ERROR,
    message: 'Internal server error',
  }));
});

// ── Process-level safety nets ─────────────────────────────────────────────────
// Catch unhandled errors so they appear in structured logs before the process exits.

process.on('uncaughtException', (err) => {
  logger.error('uncaught_exception', { message: err.message, stack: err.stack });
  console.error('[fatal]', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('unhandled_rejection', { reason: String(reason) });
  console.error('[rejected]', reason);
});

// Graceful shutdown — flush logs before exiting
function shutdown(signal) {
  logger.info('server_shutdown', { signal });
  console.log(`[server] shutting down (${signal})`);
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, HOST, () => {
  console.log(`UFCL Mobile API listening on ${HOST}:${PORT}`);
  console.log(`  DB host  : ${process.env.PGHOST}:${process.env.PGPORT}`);
  console.log(`  Proxy    : ${process.env.API_BEHIND_PROXY === 'true' ? 'yes (trust X-Real-IP)' : 'no'}`);
  console.log(`  JWT exp  : 8h`);
  console.log(`  Logs     : ${logger.dir}`);
  logger.info('server_start', {
    host:         HOST,
    port:         PORT,
    db_host:      process.env.PGHOST,
    db_port:      process.env.PGPORT,
    behind_proxy: process.env.API_BEHIND_PROXY === 'true',
  });
});
