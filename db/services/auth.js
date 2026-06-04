const bcrypt = require('bcryptjs');
const { pool } = require('../pool');

async function login(username, password) {
  const u = (username || '').trim().toLowerCase();
  const p = String(password || '');
  if (!u || !p) return { ok: false, error: 'Missing credentials' };

  const { rows } = await pool.query(
    'select id, username, name, role, password_hash, active from app_users where lower(username)=lower($1) limit 1',
    [u]
  );
  if (!rows.length) return { ok: false, error: 'Invalid credentials' };
  const user = rows[0];
  if (!user.active) return { ok: false, error: 'User inactive' };

  const ok = await bcrypt.compare(p, user.password_hash);
  if (!ok) return { ok: false, error: 'Invalid credentials' };

  return {
    ok: true,
    user: { id: user.id, username: user.username, name: user.name, role: user.role }
  };
}

module.exports = { login };

