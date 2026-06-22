const { Pool } = require('pg');
const path = require('path');
const dotenv = require('dotenv');

// In packaged app, .env is placed next to app.asar in resources/ via extraResources.
// In dev, it lives at the project root.
const envPath = process.resourcesPath
  ? path.join(process.resourcesPath, '.env')
  : path.join(__dirname, '..', '.env');

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

