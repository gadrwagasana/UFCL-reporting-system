const { Pool } = require('pg');
const path = require('path');
const dotenv = require('dotenv');

// app.isPackaged = true when running as installed .exe/.app, false on npm start
const { app } = require('electron');
const envPath = app.isPackaged
  ? path.join(process.resourcesPath, '.env')  // installed: resources/.env
  : path.join(__dirname, '..', '.env');         // dev (Mac/Windows npm start): project root

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

module.exports = { pool };

