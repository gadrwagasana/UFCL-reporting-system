'use strict';

// PM2 ecosystem file — UFCL Mobile API
// ─────────────────────────────────────────────────────────────────────────────
// Start (production):  pm2 start ecosystem.config.js --env production
// Reload (zero-down):  pm2 reload ecosystem.config.js --env production
// Monitor:             pm2 monit
// Status:              pm2 status
// Logs:                pm2 logs mobile-api
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  apps: [
    {
      name:      'mobile-api',
      script:    './server.js',
      cwd:       '/opt/ufcl-api/mobile-api',

      // Single instance — the PostgreSQL pool is shared within one process.
      // Cluster mode would create multiple pools and saturate the DB connection limit.
      instances:  1,
      exec_mode:  'fork',

      // Environment passed when --env production is used
      env_production: {
        NODE_ENV:         'production',
        MOBILE_API_PORT:  '3001',
        API_BIND_HOST:    '127.0.0.1',  // nginx fronts us; bind to loopback only
        API_BEHIND_PROXY: 'true',
      },

      // Restart policy
      max_restarts:   10,     // give up after 10 consecutive crashes
      min_uptime:     '30s',  // a restart within 30s counts as a crash
      restart_delay:  3000,   // wait 3s between restart attempts

      // PM2 log files (structured API logs are written by lib/logger.js separately)
      out_file:        '/opt/ufcl-api/logs/pm2-out.log',
      error_file:      '/opt/ufcl-api/logs/pm2-error.log',
      merge_logs:      true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Never watch files in production; use `pm2 reload` for zero-downtime deploys
      watch: false,

      // Restart automatically if heap grows past 512 MB (possible memory leak guard)
      max_memory_restart: '512M',
    },
  ],
};
