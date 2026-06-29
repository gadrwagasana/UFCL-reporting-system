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

module.exports = { pool, closePool: () => pool.end() };

