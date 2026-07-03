# UFCL Mobile ERP — Deployment Runbook v1.0.0

**Document type:** Operational runbook — follow line by line during deployment  
**Target release:** v1.0.0-rc1 → v1.0.0  
**Applies to:** Production server running mobile-api + PostgreSQL + nginx  
**Estimated duration:** 30–45 minutes (excluding QA smoke test)

---

## Release Process — Where This Document Fits

This runbook is **Phase 3** of a four-phase release process. Do not open this document until Phases 0–2 are complete.

| Phase | Name | Owner | Entry gate |
|-------|------|-------|------------|
| **0** | Deployment Readiness Meeting | Product Owner | All four outcomes achieved (see below) |
| **1** | QA Execution | QA Lead | Phase 0 complete |
| **2** | Release Approval | Product Owner + QA Lead | QA matrix signed off, no blocking defects |
| **3** | Deployment ← **this document** | Deployment Engineer | Phase 2 sign-off obtained |

### Phase 0 — Deployment Readiness Meeting (30–45 min)

A short coordination meeting with all release stakeholders before QA begins. The meeting has exactly four outcomes. If any are not achieved, the release stays in planning.

- [ ] **Deployment window agreed** — date, start time, maximum duration (recommended: ≤ 2 hours)
- [ ] **OPERATIONS_CONTACTS.md completed** — all named roles confirmed available for the window
- [ ] **Roles assigned** — Deployment Engineer, QA Lead, Product Owner, Rollback Authority each accepted
- [ ] **Go/no-go to begin RC validation** — all stakeholders confirm readiness to enter Phase 1

Record outcomes here:

| Field | Value |
|-------|-------|
| Meeting date | |
| Deployment window | Date: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Start: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Max duration: 2 hours |
| Deployment Engineer | |
| QA Lead | |
| Product Owner | |
| Rollback Authority | |
| Go/no-go decision | ☐ Go — proceed to Phase 1 &nbsp;&nbsp; ☐ No-go — reason: |

---

> **Before executing Steps 1–15 below:** confirm Phase 0–2 are complete and that you are the named Deployment Engineer for this window. See `OPERATIONS_CONTACTS.md` for all role contacts.

---

## Pre-Deployment Checklist

Complete all items before opening an SSH session. Do not begin Step 1 until every box is ticked.

- [ ] QA matrix Stage 1–6 executed and signed off
- [ ] Release notes (`RELEASE_NOTES_v1.0.0-rc1.html`) reviewed and approved
- [ ] Release APK/AAB built and verified on a clean test device
- [ ] Maintenance window communicated to all users (minimum 30 minutes notice)
- [ ] On-call contact available for the duration of deployment
- [ ] Rollback decision authority identified (who decides if we roll back?)

---

## Step 1 — Enable Maintenance Mode

If the application serves a web dashboard or status page, redirect traffic now.

```bash
# Redirect all mobile API traffic to a maintenance response
sudo nano /etc/nginx/sites-available/ufcl-mobile-api
```

Add or uncomment the maintenance block:

```nginx
# Maintenance mode — uncomment during deployment
# return 503 '{"error":"System maintenance in progress. Please try again shortly."}';
# add_header Content-Type application/json;
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

**Decision point:** If nginx reload fails, stop here and investigate before proceeding.

---

## Step 2 — Capture Pre-Deployment State

Record current service state for rollback reference.

```bash
# Current PM2 state
pm2 status

# Current git state
cd /path/to/ufcl-mobile-api
git log --oneline -5

# Current database size (reference for backup verification)
psql -U ufcl -d ufcl_db -c "SELECT pg_size_pretty(pg_database_size('ufcl_db'));"

# Note the active connections (should be low during maintenance window)
psql -U ufcl -d ufcl_db -c "SELECT count(*) FROM pg_stat_activity WHERE datname='ufcl_db';"
```

Record all outputs in the deployment log. Fill in below:

| Item | Value |
|------|-------|
| Previous git tag | |
| Database size | |
| Active connections at start | |
| PM2 uptime before stop | |

---

## Step 3 — Back Up the PostgreSQL Database

**This step is mandatory. Do not skip it under any circumstances.**

```bash
# Create timestamped backup
BACKUP_FILE="/var/backups/ufcl/ufcl_db_pre_$(date +%Y%m%d_%H%M%S).dump"
mkdir -p /var/backups/ufcl

pg_dump -U ufcl -Fc -d ufcl_db -f "$BACKUP_FILE"
echo "Backup written to: $BACKUP_FILE"
```

---

## Step 4 — Verify Backup Integrity

Do not proceed until the backup file is confirmed valid.

```bash
# Check file exists and is non-empty
ls -lh "$BACKUP_FILE"

# Verify the dump is readable (pg_restore --list reads the table of contents without restoring)
pg_restore --list "$BACKUP_FILE" | head -20

# Confirm row counts on critical tables as a sanity check
psql -U ufcl -d ufcl_db -c "
  SELECT
    (SELECT count(*) FROM users)           AS users,
    (SELECT count(*) FROM sales_orders)    AS sales_orders,
    (SELECT count(*) FROM stock_movements) AS stock_movements,
    (SELECT count(*) FROM audit_log)       AS audit_log;
"
```

Record the counts below. You will verify them again after migration.

| Table | Row count before |
|-------|-----------------|
| users | |
| sales_orders | |
| stock_movements | |
| audit_log | |

**Decision point:** If `pg_restore --list` fails or the file is smaller than expected, the backup is corrupt. Stop here and re-run Step 3.

---

## Step 5 — Stop Application Services

```bash
# Graceful stop — PM2 sends SIGINT and waits for in-flight requests to complete
pm2 stop mobile-api

# Confirm stopped
pm2 status

# Verify no lingering node processes on the API port
lsof -i :3001   # adjust port to match your configuration
```

**Decision point:** If the process does not stop within 60 seconds, use `pm2 kill` and investigate before continuing.

---

## Step 6 — Pull the Release Tag

```bash
cd /path/to/ufcl-mobile-api

# Fetch all tags from origin
git fetch --tags origin

# Check out the release candidate tag
git checkout v1.0.0-rc1

# Confirm you are on the correct commit
git log --oneline -1
git describe --tags
```

Expected output: `v1.0.0-rc1` or the full annotated tag string.

**Decision point:** If `git describe` shows a different tag, do not proceed. Verify the tag exists on the remote with `git tag -l | grep rc1`.

---

## Step 7 — Install Dependencies

```bash
cd /path/to/ufcl-mobile-api

npm ci --omit=dev
```

`npm ci` (clean install) is preferred over `npm install` during deployments — it installs exactly what is in `package-lock.json` and fails if the lock file is out of sync.

**Decision point:** If `npm ci` fails due to a lock file mismatch, investigate before continuing. Do not run `npm install` without understanding why the lock file differs.

---

## Step 8 — Run Database Migrations

```bash
cd /path/to/ufcl-12   # root of the project (contains db/ directory)

npm run migrate
```

Expected output: Lines indicating each migration that ran, ending with a success message. If no new migrations are pending, the command should exit cleanly with "No pending migrations" or similar.

---

## Step 9 — Verify Migration Integrity

Confirm the schema changes applied correctly and existing data is intact.

```bash
psql -U ufcl -d ufcl_db -c "SELECT * FROM migrations ORDER BY run_at DESC LIMIT 10;"
```

Confirm the following tables now exist (required for Machine and Workshop modules):

```bash
psql -U ufcl -d ufcl_db -c "
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('machines','machine_logs','machine_fuel','machine_kpi',
                       'wk_items','wk_stock','wk_consumption')
  ORDER BY table_name;
"
```

Expected: 7 rows returned.

Re-run the row count check from Step 4 and confirm existing data was not affected:

```bash
psql -U ufcl -d ufcl_db -c "
  SELECT
    (SELECT count(*) FROM users)           AS users,
    (SELECT count(*) FROM sales_orders)    AS sales_orders,
    (SELECT count(*) FROM stock_movements) AS stock_movements,
    (SELECT count(*) FROM audit_log)       AS audit_log;
"
```

| Table | Count before (Step 4) | Count after | Match? |
|-------|----------------------|-------------|--------|
| users | | | |
| sales_orders | | | |
| stock_movements | | | |
| audit_log | | | |

**Decision point:** If any row count decreased, stop immediately. This indicates a migration has modified or dropped existing data. Do not proceed — execute the rollback procedure.

---

## Step 10 — Start Application Services

```bash
pm2 start mobile-api

# Wait 5 seconds for startup, then confirm
sleep 5
pm2 status
pm2 logs mobile-api --lines 20 --nostream
```

Expected: Process shows `online`, no error lines in logs.

Verify the API responds:

```bash
curl -s https://your-server/api/health
# Expected: {"status":"ok"} or similar
```

**Decision point:** If the API returns an error or the process crashes repeatedly (check `pm2 status` for restart count > 0), execute the rollback procedure.

---

## Step 11 — Verify nginx and SSL

```bash
# Confirm nginx config is valid
sudo nginx -t

# Reload if you made changes in Step 1 (maintenance mode)
sudo systemctl reload nginx

# Verify SSL certificate validity
echo | openssl s_client -connect your-server:443 -servername your-server 2>/dev/null \
  | openssl x509 -noout -dates
```

Confirm the certificate `notAfter` date is more than 30 days from today.

Remove the maintenance block if you added it in Step 1, then reload:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## Step 12 — Execute Critical Workflow Smoke Test

This is a reduced subset of QA Stage 4 (end-to-end workflows). Perform on a real device connected to the production server, not a simulator.

| Test | Role | Expected result | Pass |
|------|------|-----------------|------|
| Login succeeds | admin | Dashboard loads | ☐ |
| Login succeeds | harvesting-leader | HarvestList loads | ☐ |
| Create a material request (offline queue test — disable Wi-Fi, submit, re-enable) | supervisor | Request appears after reconnect | ☐ |
| Sales order list loads | sales | List renders with data | ☐ |
| Weekly Cost report loads | finance | Cost table renders | ☐ |
| EPM Home loads | ceo | Company score hero visible | ☐ |
| Sage CSV export | finance | Share sheet opens with .csv | ☐ |
| Admin → Users list | admin | User cards render | ☐ |
| Automation Center health card | admin | Status visible | ☐ |

**Decision point:** If any critical workflow fails, assess severity:
- **Login failure / API unreachable:** Roll back immediately.
- **Single module failure:** Evaluate whether it is a known limitation (see KL-01–06). If not a known issue, roll back.
- **Export/reporting failure only:** May be acceptable to continue if core operations are unaffected — escalate to rollback decision authority.

---

## Step 13 — Distribute the Release APK

Once the server-side deployment is confirmed healthy, distribute the APK to devices.

```bash
# Confirm the APK was built from the correct tag
# Check build metadata or re-verify the device install in Step 12 was from this build
```

Distribution checklist:
- [ ] APK file confirmed built from `v1.0.0-rc1` tag
- [ ] APK installed and tested on at least one Android device (clean install, not update-over-previous)
- [ ] APK attached to the GitHub release as a downloadable asset
- [ ] Distributed to all field devices via agreed distribution method (direct APK or MDM)

---

## Step 14 — Monitor for the First 60 Minutes

Do not close the deployment window until 60 minutes of clean operation is confirmed.

```bash
# Tail PM2 logs in real time
pm2 logs mobile-api

# In a second terminal — watch error rate
watch -n 30 'pm2 status && echo "---" && tail -5 ~/.pm2/logs/mobile-api-error.log'
```

Things to watch for:
- Repeated `ERROR` or `FATAL` lines in the log
- PM2 restart count climbing (indicates crash loop)
- Unusually slow response times (check nginx access log)
- User reports of login failures or data not loading

If all is quiet after 60 minutes, tag the deployment log as complete and notify stakeholders.

---

## Step 15 — Create the GitHub Release

Once rc1 is confirmed stable:

```bash
# Tag is already on the commit from Step 6 — push if not already done
git push origin v1.0.0-rc1

# Create GitHub release via CLI (gh)
gh release create v1.0.0-rc1 \
  --title "UFCL Mobile ERP v1.0.0-rc1" \
  --notes-file RELEASE_NOTES_v1.0.0-rc1.html \
  path/to/ufcl-mobile-rc1.apk
```

Or create the release manually on GitHub and attach the APK asset.

---

## Rollback Procedure

Execute this procedure if Step 10 or Step 12 reveals a blocking failure.

**Rollback decision authority:** ____________________________

### R1 — Stop the failed service

```bash
pm2 stop mobile-api
```

### R2 — Restore the database backup

```bash
# Drop and recreate the database, then restore
psql -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='ufcl_db';"
psql -U postgres -c "DROP DATABASE ufcl_db;"
psql -U postgres -c "CREATE DATABASE ufcl_db OWNER ufcl;"
pg_restore -U ufcl -d ufcl_db "$BACKUP_FILE"
```

### R3 — Check out the previous release

```bash
cd /path/to/ufcl-mobile-api
git checkout v0.20-stable   # or the previously deployed tag recorded in Step 2
npm ci --omit=dev
```

### R4 — Restart services

```bash
pm2 start mobile-api
sleep 5
pm2 status
curl -s https://your-server/api/health
```

### R5 — Verify rollback

Repeat the login and critical workflow tests from Step 12. Confirm data integrity matches the row counts from Step 4.

### R6 — Communicate

Notify all stakeholders that the deployment was rolled back, the reason, and the expected timeline for the next attempt.

---

## Deployment Log

| Field | Value |
|-------|-------|
| Deployment date | |
| Operator | |
| Tag deployed | v1.0.0-rc1 |
| Backup file | |
| Migration result | ☐ Clean &nbsp; ☐ Errors |
| Smoke test result | ☐ Pass &nbsp; ☐ Fail |
| Rollback executed | ☐ No &nbsp; ☐ Yes — reason: |
| Time to complete | |
| Sign-off | |

---

*Document: DEPLOYMENT_RUNBOOK_v1.0.0.md · Companion documents: QA_MATRIX_v0.20.html · RELEASE_NOTES_v1.0.0-rc1.html · OPERATIONS_CONTACTS.md · CHANGELOG.md*
