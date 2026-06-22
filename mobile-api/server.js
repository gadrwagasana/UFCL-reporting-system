'use strict';

// Load .env before any module that needs DB credentials or JWT_SECRET
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const { authenticate } = require('./middleware/auth');

const app  = express();
const PORT = process.env.MOBILE_API_PORT || 3001;

// ── Global middleware ─────────────────────────────────────────────────────────

app.use(express.json());

// Basic CORS for LAN clients (React Native Expo + future web dashboards)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ── Health check (no JWT required) ───────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime(), ts: new Date().toISOString() });
});

// ── Public routes (no JWT required) ──────────────────────────────────────────

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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`UFCL Mobile API listening on port ${PORT}`);
  console.log(`  DB host : ${process.env.PGHOST}:${process.env.PGPORT}`);
  console.log(`  JWT exp : 8h`);
});
