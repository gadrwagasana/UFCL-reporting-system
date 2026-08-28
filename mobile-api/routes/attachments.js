'use strict';

// Enterprise Timber Lifecycle Integration Program — Phase 1. Generalized
// attachments (polymorphic entity_type/entity_id), extending the exact
// multer + disk pattern mobile-api/routes/supplierDocuments.js established
// (that route is the one place file bytes are written on disk anywhere in
// this app) rather than that supplier-only table. Electron proxies here over
// HTTP the same way it proxies to supplierDocuments — see
// electron/main.js's srm-documents:* handlers for the identical pattern this
// mirrors on the desktop side.

const express = require('express');
const fs      = require('fs');
const path    = require('path');
const crypto  = require('crypto');
const multer  = require('multer');
const data        = require('../../db/services/data');
const { respond } = require('../middleware/respond');

const router = express.Router();
const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads', 'lifecycle');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(UPLOAD_ROOT, String(req.params.entityType), String(Number(req.params.entityId) || 0));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 20);
    const safeName = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
    cb(null, safeName);
  },
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } }); // 25MB cap, same as supplierDocuments

// ── POST /api/attachments/:entityType/:entityId/upload ──────────────────────
router.post('/:entityType/:entityId/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, version: 1, error: { code: 'VALIDATION_ERROR', message: 'No file received' } });
  const { entityType, entityId } = req.params;
  const meta = {
    original_filename: req.file.originalname,
    stored_filename: path.join(entityType, String(Number(entityId)), req.file.filename),
    mime_type: req.file.mimetype,
    file_size: req.file.size,
  };
  const result = await data.attachmentRegister(req.user.userId, entityType, Number(entityId), meta);
  if (!result.ok) {
    // Registration failed (e.g. unsupported entity type) — remove the orphaned file.
    fs.unlink(path.join(UPLOAD_ROOT, meta.stored_filename), () => {});
  }
  respond(res, result);
});

// ── GET /api/attachments/:entityType/:entityId ───────────────────────────────
router.get('/:entityType/:entityId', async (req, res) => {
  respond(res, await data.attachmentsList(req.user.userId, req.params.entityType, Number(req.params.entityId)));
});

// ── GET /api/attachments/file/:attachmentId ──────────────────────────────────
// Streams the actual file — binary body, not the standard JSON envelope,
// same as supplierDocuments' /file/:documentId route.
router.get('/file/:attachmentId', async (req, res) => {
  const result = await data.attachmentGet(req.user.userId, Number(req.params.attachmentId));
  if (!result.ok) return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: result.error } });
  const filePath = path.join(UPLOAD_ROOT, result.attachment.stored_filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'File is missing from storage' } });
  res.download(filePath, result.attachment.original_filename);
});

// ── DELETE /api/attachments/:attachmentId ────────────────────────────────────
router.delete('/:attachmentId', async (req, res) => {
  const result = await data.attachmentDelete(req.user.userId, Number(req.params.attachmentId));
  if (result.ok && result.storedFilename) {
    fs.unlink(path.join(UPLOAD_ROOT, result.storedFilename), () => {});
  }
  respond(res, result);
});

module.exports = router;
