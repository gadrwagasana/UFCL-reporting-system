const { Pool } = require('pg');
const path = require('path');
const dotenv = require('dotenv');

// Detect Electron vs plain Node (Express mobile API, tests, migration scripts)
let envPath;
try {
  const { app } = require('electron');
  // app.isPackaged = true in installed .exe/.app, false on npm start
  envPath = app.isPackaged
    ? path.join(process.resourcesPath, '.env')  // installed: resources/.env
    : path.join(__dirname, '..', '.env');         // dev (npm start): project root
} catch {
  // Not in an Electron context — use the project root .env
  envPath = path.join(__dirname, '..', '.env');
}

dotenv.config({ path: envPath });

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name} (set it in .env)`);
  return v;
}

const pool = new Pool({
  host: required('PGHOST'),
  port: Number(required('PGPORT')),
  database: required('PGDATABASE'),
  user: required('PGUSER'),
  password: required('PGPASSWORD'),
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000
});

// Stale connections left in the pool after machine sleep emit ECONNABORTED /
// ECONNRESET when pg-pool tries to close them.  Without this handler those
// errors become uncaught exceptions and crash the Electron main process.
const STALE_CODES = new Set(['ECONNABORTED', 'ECONNRESET', 'ECONNREFUSED', 'EPIPE', 'ETIMEDOUT']);
pool.on('error', (err) => {
  if (STALE_CODES.has(err.code)) {
    console.warn('[pool] stale client discarded after sleep:', err.code);
  } else {
    console.error('[pool] unexpected idle client error:', err.message);
  }
});

module.exports = { pool, closePool: () => pool.end() };

