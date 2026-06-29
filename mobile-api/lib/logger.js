'use strict';

/**
 * Lightweight structured JSON logger.
 *
 * Writes one JSON object per line to daily rotating files:
 *   {LOG_DIR}/app-YYYY-MM-DD.log
 *
 * Errors and warnings are also mirrored to stderr so PM2 / systemd
 * captures them without reading files.
 *
 * No npm dependencies — uses only Node.js built-ins.
 */

const fs   = require('fs');
const path = require('path');

const LOG_DIR  = process.env.LOG_DIR || path.join(__dirname, '..', 'logs');
const LOG_KEEP = parseInt(process.env.LOG_KEEP_DAYS || '30', 10); // keep 30 daily files

// Ensure log directory exists at require-time
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

let _currentDay = '';
let _stream     = null;

// Return (or open) the write stream for today's log file.
function getStream() {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  if (today !== _currentDay) {
    if (_stream) {
      _stream.end();
      _stream = null;
    }
    _currentDay = today;
    const filepath = path.join(LOG_DIR, `app-${today}.log`);
    _stream = fs.createWriteStream(filepath, { flags: 'a', encoding: 'utf8' });
    _stream.on('error', (err) => process.stderr.write(`[logger] stream error: ${err.message}\n`));

    // Rotate old files (async, best-effort — never throws)
    setImmediate(() => _rotateOldLogs());
  }
  return _stream;
}

function _rotateOldLogs() {
  try {
    const files = fs.readdirSync(LOG_DIR)
      .filter(f => /^app-\d{4}-\d{2}-\d{2}\.log$/.test(f))
      .sort()
      .reverse();
    files.slice(LOG_KEEP).forEach(f => {
      try { fs.unlinkSync(path.join(LOG_DIR, f)); } catch {}
    });
  } catch {}
}

function write(level, event, data) {
  const entry = JSON.stringify({
    ts:    new Date().toISOString(),
    level,
    event,
    ...data,
  });
  try {
    getStream().write(entry + '\n');
  } catch {}
  // Mirror errors and warnings to stderr for PM2 / systemd capture
  if (level === 'error' || level === 'warn') {
    process.stderr.write(entry + '\n');
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

module.exports = {
  info:  (event, data = {}) => write('info',  event, data),
  warn:  (event, data = {}) => write('warn',  event, data),
  error: (event, data = {}) => write('error', event, data),
  debug: (event, data = {}) => {
    if (process.env.LOG_LEVEL === 'debug') write('debug', event, data);
  },
  /** Path to the current log directory — for use in diagnostics */
  dir: LOG_DIR,
};
