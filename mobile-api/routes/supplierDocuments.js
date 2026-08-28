'use strict';

// Supplier Document Center — Phase 4 (SRM). This is the one place file bytes
// are written on disk anywhere in this app. Metadata (who/when/what/expiry)
// lives in Postgres via db.services/data.js's supplierDocument* functions —
// this route only handles the multipart transport and disk I/O, then hands
// off to the same data.js functions Electron calls too (Electron proxies
// its uploads through this exact route over HTTP rather than writing to its
// own local disk, since this server's filesystem is the one place both
// platforms can reach — see the Phase 4 completion report).

const express = require('express');
const fs      = require('fs');
const path    = require('path');
const crypto  = require('crypto');
const multer  = require('multer');
const data        = require('../../db/services/data');
const { respond } = require('../middleware/respond');

const router = express.Router();
const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads', 'suppliers');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(UPLOAD_ROOT, String(Number(req.params.supplierId) || 0));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 20);
    const safeName = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
    cb(null, safeName);
  },
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } }); // 25MB cap

// ── POST /api/srm/documents/:supplierId/upload ──────────────────────────────
router.post('/:supplierId/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, version: 1, error: { code: 'VALIDATION_ERROR', message: 'No file received' } });
  const supplierId = Number(req.params.supplierId);
  const meta = {
    contract_id: req.body.contract_id ? Number(req.body.contract_id) : undefined,
    compliance_id: req.body.compliance_id ? Number(req.body.compliance_id) : undefined,
    document_type: req.body.document_type,
    original_filename: req.file.originalname,
    stored_filename: path.join(String(supplierId), req.file.filename),
    mime_type: req.file.mimetype,
    file_size: req.file.size,
    expiry_date: req.body.expiry_date || undefined,
    notes: req.body.notes,
  };
  const result = await data.supplierDocumentRegister(req.user.userId, supplierId, meta);
  if (!result.ok) {
    // Registration failed (e.g. permission denied) — remove the orphaned file.
    fs.unlink(path.join(UPLOAD_ROOT, meta.stored_filename), () => {});
  }
  respond(res, result);
});

// ── GET /api/srm/documents/:supplierId ───────────────────────────────────────
router.get('/:supplierId', async (req, res) => {
  respond(res, await data.supplierDocumentsList(req.user.userId, Number(req.params.supplierId)));
});

// ── GET /api/srm/documents/file/:documentId ─────────────────────────────────
// Streams the actual file — the one route in this app that returns a binary
// body instead of the standard JSON envelope, since a browser/RN <Image>/
// document viewer needs the raw bytes, not JSON.
router.get('/file/:documentId', async (req, res) => {
  const result = await data.supplierDocumentGet(req.user.userId, Number(req.params.documentId));
  if (!result.ok) return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: result.error } });
  const filePath = path.join(UPLOAD_ROOT, result.document.stored_filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'File is missing from storage' } });
  res.download(filePath, result.document.original_filename);
});

// ── DELETE /api/srm/documents/:documentId ────────────────────────────────────
router.delete('/:documentId', async (req, res) => {
  respond(res, await data.supplierDocumentDeactivate(req.user.userId, Number(req.params.documentId), req.body?.reason));
});

// ── GET /api/srm/documents (fleet-wide register) ─────────────────────────────
router.get('/', async (req, res) => {
  respond(res, await data.supplierDocumentsRegister(req.user.userId, req.query));
});

module.exports = router;
