# UFCL Production Operations Manual

**System:** UFCL Enterprise Resource Planning + Mobile  
**Maintained by:** IT Department  
**Server:** 192.168.1.5  

---

## 1. System Components

| Component | Technology | Location | Port |
|---|---|---|---|
| Desktop ERP | Electron + Node.js | Each PC | — (local app) |
| Mobile API | Express.js + Node.js | 192.168.1.5 | 3001 |
| PostgreSQL | PostgreSQL 14+ | 192.168.1.5 | 5432 |
| nginx (optional) | nginx | 192.168.1.5 | 80/443 |
| Mobile App | React Native APK | Android devices | — |

---

## 2. Service Management

### Check service status

```bash
# If running with PM2 (recommended)
pm2 status
pm2 logs mobile-api

# If running with systemd
systemctl status ufcl-mobile-api
journalctl -u ufcl-mobile-api -f

# Check PostgreSQL
systemctl status postgresql
pg_isready -h localhost -p 5432
```

### Start / stop / restart

```bash
# PM2
pm2 start  mobile-api
pm2 stop   mobile-api
pm2 restart mobile-api
pm2 reload  mobile-api   # zero-downtime reload

# systemd
systemctl start   ufcl-mobile-api
systemctl stop    ufcl-mobile-api
systemctl restart ufcl-mobile-api
```

### PM2 startup (auto-start on server reboot)

```bash
pm2 startup
pm2 save
```

---

## 3. Health Checks

All health endpoints are public — no JWT required.

```bash
# Liveness: is the server process running?
curl http://192.168.1.5:3001/api/health

# Readiness: can the server reach PostgreSQL?
curl http://192.168.1.5:3001/api/ready

# Full metrics (localhost only, or with METRICS_TOKEN)
curl http://localhost:3001/api/metrics
curl -H "Authorization: Bearer $METRICS_TOKEN" http://192.168.1.5:3001/api/metrics
```

**Expected /api/health response:**
```json
{
  "ok": true,
  "status": "healthy",
  "uptime": 86400,
  "ts": "2026-06-29T12:00:00.000Z",
  "version": "1.0.0",
  "memory": { "heap_used_mb": 45, "heap_total_mb": 64, "rss_mb": 120 },
  "requests": { "total": 1200, "errors": 0, "avg_ms": 35, "p95_ms": 150 }
}
```

**Expected /api/ready response (healthy):** `200 { "ok": true, "db": { "connected": true } }`  
**Expected /api/ready response (DB down):** `503 { "ok": false, "db": { "connected": false } }`

---

## 4. Log Files

### Locations

| Log | Path | Format |
|---|---|---|
| API structured log | `/opt/ufcl-api/logs/app-YYYY-MM-DD.log` | JSON Lines |
| PM2 output | `~/.pm2/logs/mobile-api-out.log` | Plain text |
| PM2 errors | `~/.pm2/logs/mobile-api-error.log` | Plain text |
| nginx access | `/var/log/nginx/access.log` | Combined |
| nginx error | `/var/log/nginx/error.log` | Plain text |
| Backup log | `/opt/ufcl-backups/backup.log` | Plain text |
| Backup cron log | `/opt/ufcl-backups/cron.log` | Plain text |

### Reading structured logs

```bash
# Follow today's log
tail -f /opt/ufcl-api/logs/app-$(date +%Y-%m-%d).log | jq .

# Filter errors only
grep '"level":"error"' /opt/ufcl-api/logs/app-$(date +%Y-%m-%d).log | jq .

# Filter slow requests
grep 'slow_request' /opt/ufcl-api/logs/app-$(date +%Y-%m-%d).log | jq '{path:.path, ms:.ms}'

# Count auth failures in last 24h
grep 'auth_invalid_token\|login_failed' /opt/ufcl-api/logs/app-$(date +%Y-%m-%d).log | wc -l

# Find all 5xx errors
grep '"requests_5xx"' /opt/ufcl-api/logs/app-$(date +%Y-%m-%d).log | jq .

# Server startup events
grep 'server_start' /opt/ufcl-api/logs/app-*.log | tail -5 | jq .
```

### Log events reference

| Event | Level | Meaning |
|---|---|---|
| `server_start` | info | Server started successfully |
| `server_shutdown` | info | Graceful shutdown (SIGTERM/SIGINT) |
| `slow_request` | warn | Request took > 1000ms |
| `request_error` | error | Unhandled route error |
| `uncaught_exception` | error | Fatal unhandled JS error |
| `unhandled_rejection` | error | Unhandled promise rejection |

---

## 5. Database Operations

### Connect to PostgreSQL

```bash
psql -U postgres -d ufcl_production
# Or with password:
PGPASSWORD="your-password" psql -h localhost -U ufcl_user -d ufcl_production
```

### Check active connections

```sql
SELECT count(*), state FROM pg_stat_activity
WHERE datname = 'ufcl_production'
GROUP BY state;
```

### Check table sizes

```sql
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;
```

### Check slow queries

```sql
SELECT query, calls, mean_exec_time::int AS avg_ms,
       total_exec_time::int AS total_ms
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

---

## 6. APK Update Operations

### Check what version is deployed on the server

```bash
cat /opt/ufcl-api/updates/version.json | jq '{version, versionCode, releaseDate}'
```

### Check server endpoints are responding

```bash
curl http://192.168.1.5:3001/version.json | jq .
curl -I http://192.168.1.5:3001/downloads/UFCL-production.apk
# Should return: HTTP/1.1 200 OK, Content-Type: application/vnd.android.package-archive
```

### Manually push a hotfix APK (without GitHub Actions)

See [UPDATE_INFRASTRUCTURE.md](UPDATE_INFRASTRUCTURE.md) rollback procedure.

---

## 7. Alert Thresholds

Monitor these indicators and act when thresholds are crossed:

| Metric | Warning | Critical | Action |
|---|---|---|---|
| API heap_used_mb | > 200 MB | > 400 MB | Restart API; check for memory leaks |
| load_1m | > 2.0 | > 4.0 | Investigate high CPU queries |
| requests_5xx (per hour) | > 5 | > 20 | Check logs for exceptions |
| auth_invalid_token (per hour) | > 50 | > 200 | Possible brute-force; review IPs |
| rate_limit_hits (per hour) | > 100 | > 500 | Review clients; block abusive IPs |
| /api/ready status | non-200 | 503 for > 5 min | PostgreSQL is down |
| avg_ms | > 200 ms | > 500 ms | DB slow queries; check connections |
| Backup age | > 26 h | > 50 h | Run manual backup; check cron |

---

## 8. Routine Daily Checks (5 minutes)

```bash
# 1. Server is up
curl -s http://192.168.1.5:3001/api/health | jq '{ok, status, memory}'

# 2. Database is up
curl -s http://192.168.1.5:3001/api/ready | jq '{ok, db}'

# 3. Recent errors
grep '"level":"error"' /opt/ufcl-api/logs/app-$(date +%Y-%m-%d).log | tail -5

# 4. Last backup succeeded
tail -5 /opt/ufcl-backups/backup.log

# 5. Disk space
df -h / /opt
```

---

## 9. Environment Variables (.env)

| Variable | Required | Description |
|---|---|---|
| `PGHOST` | Yes | PostgreSQL hostname |
| `PGPORT` | Yes | PostgreSQL port (usually 5432) |
| `PGDATABASE` | Yes | Database name |
| `PGUSER` | Yes | Database user |
| `PGPASSWORD` | Yes | Database password |
| `JWT_SECRET` | Yes | JWT signing secret (min 32 chars) |
| `MOBILE_API_PORT` | No | API port (default: 3001) |
| `API_BIND_HOST` | No | Bind address (default: 0.0.0.0) |
| `API_BEHIND_PROXY` | No | Set `true` if nginx fronts the API |
| `METRICS_TOKEN` | No | Bearer token for /api/metrics remote access |
| `LOG_DIR` | No | Log directory (default: mobile-api/logs/) |
| `LOG_KEEP_DAYS` | No | Days to keep daily log files (default: 30) |
| `SLOW_REQUEST_MS` | No | Slow request threshold in ms (default: 1000) |
| `UPDATES_DIR` | No | APK updates folder (default: mobile-api/updates/) |
