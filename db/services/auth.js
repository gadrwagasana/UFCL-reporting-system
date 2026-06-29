'use strict';

const bcrypt = require('bcryptjs');
const os     = require('os');
const { pool } = require('../pool');

// Counts failed login attempts for the given (normalized) username in the last
// 15 minutes and pushes a red security notification to CEO + admin when the
// count first hits 5 and every 5 failures thereafter.
// Errors are swallowed so a DB issue never surfaces to the login response.
async function checkLoginFailureAlert(username) {
  try {
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n
       FROM audit_log
       WHERE action_type = 'login_failed'
         AND (lower(username) = $1 OR meta->>'attempted_username' = $1)
         AND created_at > now() - interval '15 minutes'`,
      [username]
    );
    const n = rows[0]?.n || 0;
    if (n >= 5 && n % 5 === 0) {
      await pool.query(
        `INSERT INTO notifications(type,title,body,roles,category)
         VALUES ('red',$1,$2,'{ceo,admin}','security')`,
        [
          `Security Alert — ${n} failed login attempts`,
          `Account "${username}" has failed to log in ${n} times in the last 15 minutes. Possible brute-force attempt.`,
        ]
      );
    }
  } catch (e) {
    console.error('[auth/login-alert]', e.message);
  }
}

// Writes one audit row for every login attempt.
// Mirrors the auditLogin() pattern in mobile-api/routes/auth.js so desktop
// and mobile events are indistinguishable in the audit trail.
// Failures here are swallowed — authentication must never fail due to audit.
async function auditLogin(userId, username, fullName, role, actionType, action, deviceId, meta) {
  try {
    await pool.query(
      `INSERT INTO audit_log(
         user_id, username, full_name, role,
         action, icon, meta,
         module, action_type, ip_address
       ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10)`,
      [
        userId   || null,
        username || null,
        fullName || null,
        role     || null,
        action,
        actionType === 'login' ? 'ti-login' : 'ti-lock',
        JSON.stringify(meta || {}),
        'auth',
        actionType,
        deviceId || null,
      ]
    );
  } catch (e) {
    console.error('[audit/login]', e.message);
  }
}

async function login(username, password) {
  const u = (username || '').trim().toLowerCase();
  const p = String(password || '');
  if (!u || !p) return { ok: false, error: 'Missing credentials' };

  // Use hostname as a device identifier — desktop has no network IP in Electron context.
  const device = `desktop:${os.hostname()}`;

  const { rows } = await pool.query(
    `SELECT id, username, name, role, password_hash, active
     FROM app_users WHERE lower(username) = lower($1) LIMIT 1`,
    [u]
  );

  if (!rows.length) {
    await auditLogin(null, u, null, null,
      'login_failed',
      `Desktop login failed: "${u}" — user not found`,
      device, { attempted_username: u });
    await checkLoginFailureAlert(u);
    return { ok: false, error: 'Invalid credentials' };
  }

  const user = rows[0];

  if (!user.active) {
    await auditLogin(user.id, user.username, user.name, user.role,
      'login_denied',
      `Desktop login denied: "${user.username}" — account deactivated`,
      device, {});
    return { ok: false, error: 'User inactive' };
  }

  const ok = await bcrypt.compare(p, user.password_hash);
  if (!ok) {
    await auditLogin(user.id, user.username, user.name, user.role,
      'login_failed',
      `Desktop login failed: "${user.username}" — wrong password`,
      device, {});
    await checkLoginFailureAlert(u);
    return { ok: false, error: 'Invalid credentials' };
  }

  await auditLogin(user.id, user.username, user.name, user.role,
    'login',
    `Desktop login: "${user.username}" (${user.role})`,
    device, {});

  return {
    ok: true,
    user: { id: user.id, username: user.username, name: user.name, role: user.role }
  };
}

module.exports = { login };
