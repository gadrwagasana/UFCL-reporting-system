'use strict';

const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { pool } = require('../../db/pool');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

function clientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || req.ip
    || null;
}

// Phase C6 (NF-01 remediation) — `workshopId` is the authenticated user's own
// workshop_id (already looked up by the caller from app_users before this is
// invoked), or null for the "user not found" case where no user, and
// therefore no workshop, can be determined — never guessed.
async function auditLogin(userId, username, fullName, role, actionType, action, ip, meta, workshopId) {
  try {
    await pool.query(
      `insert into audit_log(
         user_id, username, full_name, role,
         action, icon, meta,
         module, action_type, ip_address, workshop_id
       ) values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11)`,
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
        ip,
        workshopId != null ? workshopId : null,
      ]
    );
  } catch (e) {
    console.error('[audit/login]', e.message);
  }
}

// ── POST /api/auth/login ──────────────────────────────────────────────────────
// Public — issues a JWT valid for 8 hours.
// Body: { username, password }

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  const ip = clientIp(req);

  if (!username || !password) {
    return res.status(400).json({ ok: false, error: 'username and password are required' });
  }

  try {
    const { rows } = await pool.query(
      `select u.id, u.username, u.name, u.role, u.password_hash, u.active,
              u.workshop_id, w.name as workshop_name
       from app_users u
       left join warehouses w on w.id = u.workshop_id
       where lower(u.username) = lower($1)
       limit 1`,
      [username.trim()]
    );

    if (!rows.length) {
      await auditLogin(null, username.trim(), null, 'unknown',
        'login_failed',
        `Mobile login failed: "${username.trim()}" — user not found`,
        ip, { attempted_username: username.trim() });
      return res.status(401).json({ ok: false, error: 'Invalid username or password' });
    }

    const user = rows[0];

    if (!user.active) {
      await auditLogin(user.id, user.username, user.name, user.role,
        'login_denied',
        `Mobile login denied: "${user.username}" — account deactivated`,
        ip, {}, user.workshop_id);
      return res.status(403).json({ ok: false, error: 'Account is deactivated — contact your administrator' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      await auditLogin(user.id, user.username, user.name, user.role,
        'login_failed',
        `Mobile login failed: "${user.username}" — wrong password`,
        ip, {}, user.workshop_id);
      return res.status(401).json({ ok: false, error: 'Invalid username or password' });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('[auth/login] JWT_SECRET not set');
      return res.status(500).json({ ok: false, error: 'Server configuration error' });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role, workshopId: user.workshop_id, name: user.name },
      secret,
      { expiresIn: '8h' }
    );

    await auditLogin(user.id, user.username, user.name, user.role,
      'login',
      `Mobile login: "${user.username}" (${user.role})`,
      ip, { workshop_id: user.workshop_id }, user.workshop_id);

    return res.json({
      ok: true,
      token,
      user: {
        id:           user.id,
        name:         user.name,
        role:         user.role,
        workshopId:   user.workshop_id,
        workshopName: user.workshop_name
      }
    });
  } catch (err) {
    console.error('[auth/login]', err.message);
    return res.status(500).json({ ok: false, error: 'Server error during login' });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
// Protected — verify token is still valid, return current user profile.
// Used by the mobile app on startup to restore session.

router.get('/me', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `select u.id, u.name, u.role, u.active, u.workshop_id, w.name as workshop_name
       from app_users u
       left join warehouses w on w.id = u.workshop_id
       where u.id = $1`,
      [req.user.userId]
    );
    if (!rows.length || !rows[0].active) {
      return res.status(401).json({ ok: false, error: 'User not found or deactivated' });
    }
    const u = rows[0];
    return res.json({
      ok:   true,
      user: {
        id:           u.id,
        name:         u.name,
        role:         u.role,
        active:       u.active,
        workshopId:   u.workshop_id,
        workshopName: u.workshop_name,
      },
    });
  } catch (err) {
    console.error('[auth/me]', err.message);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

module.exports = router;
