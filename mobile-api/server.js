'use strict';

// Load .env before any module that needs DB credentials or JWT_SECRET
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express   = require('express');
const rateLimit = require('express-rate-limit');
const helmet    = require('helmet');
const { authenticate } = require('./middleware/auth');

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ── Health check — no JWT, no rate limit ─────────────────────────────────────
// Registered before apiLimiter so health checks never consume rate limit quota.

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime(), ts: new Date().toISOString() });
});

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
app.use('/api/material-requests',require('./routes/materialRequests'));
app.use('/api/casual-labour',    require('./routes/casualLabour'));
app.use('/api/poles',            require('./routes/poles'));
app.use('/api/deliveries',       require('./routes/deliveries'));
app.use('/api/machine-logs',     require('./routes/machineLogs'));
app.use('/api/fuel',             require('./routes/fuel'));
app.use('/api/my-requests',      require('./routes/myRequests'));
app.use('/api/meta',             require('./routes/meta'));

// Phase 2 skeletons (routes exist, return 501 until implemented)
app.use('/api/stock-transfers',  require('./routes/stockTransfers'));
app.use('/api/dispatch',         require('./routes/dispatch'));

// ── 404 catch-all ─────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ ok: false, error: `Route not found: ${req.method} ${req.path}` });
});

// ── Global error handler ──────────────────────────────────────────────────────

app.use((err, req, res, _next) => {
  console.error('[server]', err.message);
  res.status(500).json({ ok: false, error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, HOST, () => {
  console.log(`UFCL Mobile API listening on ${HOST}:${PORT}`);
  console.log(`  DB host  : ${process.env.PGHOST}:${process.env.PGPORT}`);
  console.log(`  Proxy    : ${process.env.API_BEHIND_PROXY === 'true' ? 'yes (trust X-Real-IP)' : 'no'}`);
  console.log(`  JWT exp  : 8h`);
});
