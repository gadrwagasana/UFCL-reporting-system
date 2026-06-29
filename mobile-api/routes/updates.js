'use strict';

const express = require('express');
const path    = require('path');
const fs      = require('fs');

const router = express.Router();

// Configurable via env so the path works whether mobile-api lives in
// /opt/ufcl-api/ or a dev checkout.
const UPDATES_DIR = process.env.UPDATES_DIR
  || path.join(__dirname, '..', 'updates');

// ── Helpers ───────────────────────────────────────────────────────────────────

function noCache(res) {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
}

function fileExists(name) {
  return fs.existsSync(path.join(UPDATES_DIR, name));
}

// ── GET /version.json ─────────────────────────────────────────────────────────
// Returns the latest version metadata.  No authentication required — the mobile
// app must be able to check for updates even before the user logs in.

router.get('/version.json', (req, res) => {
  const filepath = path.join(UPDATES_DIR, 'version.json');

  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ ok: false, error: 'No update deployed yet' });
  }

  try {
    const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    noCache(res);
    return res.json(data);
  } catch {
    return res.status(500).json({ ok: false, error: 'Malformed version metadata' });
  }
});

// ── GET /downloads/UFCL-production.apk ───────────────────────────────────────
// Streams the release APK.  Supports HTTP Range requests so the mobile client
// can resume an interrupted download without restarting from byte 0.

router.get('/downloads/UFCL-production.apk', (req, res) => {
  const filepath = path.join(UPDATES_DIR, 'UFCL-production.apk');

  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ ok: false, error: 'APK not available' });
  }

  const stat = fs.statSync(filepath);
  const totalSize = stat.size;

  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.setHeader('Content-Disposition', 'attachment; filename="UFCL-production.apk"');
  res.setHeader('Accept-Ranges', 'bytes');
  noCache(res);

  const rangeHeader = req.headers['range'];

  if (rangeHeader) {
    // Partial content — client is resuming
    const [startStr, endStr] = rangeHeader.replace(/bytes=/, '').split('-');
    const start = parseInt(startStr, 10);
    const end   = endStr ? Math.min(parseInt(endStr, 10), totalSize - 1) : totalSize - 1;

    if (isNaN(start) || start < 0 || start >= totalSize || end < start) {
      res.setHeader('Content-Range', `bytes */${totalSize}`);
      return res.status(416).json({ ok: false, error: 'Requested range not satisfiable' });
    }

    const chunkSize = end - start + 1;
    res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
    res.setHeader('Content-Length', chunkSize);
    res.status(206);
    fs.createReadStream(filepath, { start, end }).pipe(res);
  } else {
    // Full download
    res.setHeader('Content-Length', totalSize);
    fs.createReadStream(filepath).pipe(res);
  }
});

// ── GET /downloads/apk.sha256 ─────────────────────────────────────────────────
// SHA-256 checksum — for manual IT verification with openssl/sha256sum.

router.get('/downloads/apk.sha256', (req, res) => {
  const filepath = path.join(UPDATES_DIR, 'apk.sha256');

  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ ok: false, error: 'Checksum not available' });
  }

  noCache(res);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  fs.createReadStream(filepath).pipe(res);
});

// ── GET /downloads/apk.md5 ───────────────────────────────────────────────────
// MD5 checksum — used by the mobile app after download to verify file integrity.
// expo-file-system provides getInfoAsync({md5:true}) so no extra native dep needed.

router.get('/downloads/apk.md5', (req, res) => {
  const filepath = path.join(UPDATES_DIR, 'apk.md5');

  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ ok: false, error: 'MD5 not available' });
  }

  noCache(res);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  fs.createReadStream(filepath).pipe(res);
});

module.exports = router;
