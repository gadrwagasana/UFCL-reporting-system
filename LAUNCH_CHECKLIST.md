# UFCL Mobile v1.0.0 — Production Launch Checklist

Complete every item in order. Do not proceed to the next section until the current one is verified.

---

## A. Server Preparation

```
[ ] 1. Server is running Ubuntu 20.04 LTS or later
[ ] 2. PostgreSQL 14+ installed and running (pg_isready -h localhost)
[ ] 3. Node.js 22 installed via nvm (node --version)
[ ] 4. Nginx installed (nginx -v)
[ ] 5. UFW installed (ufw --version)
```

---

## B. Application Deployment

```
[ ] 6.  Clone repo to /opt/ufcl-api
        git clone https://github.com/gadrwagasana/UFCL-reporting-system.git /opt/ufcl-api

[ ] 7.  Install API dependencies
        cd /opt/ufcl-api/mobile-api && npm install --production

[ ] 8.  Create /opt/ufcl-api/.env with all required variables:
        PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD
        JWT_SECRET (min 32 characters — use: openssl rand -hex 32)
        MOBILE_API_PORT=3001
        API_BIND_HOST=127.0.0.1
        API_BEHIND_PROXY=true
        METRICS_TOKEN (separate strong secret for dashboard access)
        LOG_DIR=/opt/ufcl-api/logs

[ ] 9.  Run database migration
        cd /opt/ufcl-api && node db/migrate.js

[ ] 10. Verify migration succeeded (check all tables exist)
        psql -U postgres -d ufcl_production -c "\dt" | wc -l
```

---

## C. Security Hardening

```
[ ] 11. Generate TLS certificate
        sudo bash /opt/ufcl-api/tools/ssl-setup.sh

[ ] 12. Deploy Nginx config
        sudo cp /opt/ufcl-api/tools/nginx.conf /etc/nginx/sites-available/ufcl-mobile
        sudo ln -sf /etc/nginx/sites-available/ufcl-mobile /etc/nginx/sites-enabled/
        sudo nginx -t && sudo systemctl reload nginx

[ ] 13. Configure firewall
        sudo bash /opt/ufcl-api/tools/firewall-setup.sh

[ ] 14. Verify Express is NOT reachable directly from LAN
        # From another machine on the LAN:
        curl http://192.168.1.5:3001/api/health   # must time out or be refused

[ ] 15. Verify HTTPS works
        curl -k https://192.168.1.5/api/health    # -k to skip cert check until installed on device
```

---

## D. Process Management

```
[ ] 16. Start API with PM2
        cd /opt/ufcl-api/mobile-api
        pm2 start ecosystem.config.js --env production

[ ] 17. Save PM2 process list and enable startup
        pm2 save
        pm2 startup   # follow the output command

[ ] 18. Verify process is running
        pm2 status
        pm2 logs mobile-api --lines 20
```

---

## E. Backup Infrastructure

```
[ ] 19. Create backup directories
        mkdir -p /opt/ufcl-backups/{daily,weekly,monthly}

[ ] 20. Install cron jobs
        sudo bash /opt/ufcl-api/tools/cron-setup.sh

[ ] 21. Verify cron was installed
        crontab -l | grep backup

[ ] 22. Run a manual backup to confirm it works
        PGPASSWORD="your-password" bash /opt/ufcl-api/tools/backup.sh

[ ] 23. Verify backup files created
        ls -lh /opt/ufcl-backups/daily/

[ ] 24. Install logrotate config
        sudo cp /opt/ufcl-api/tools/logrotate.conf /etc/logrotate.d/ufcl
        sudo logrotate --debug /etc/logrotate.d/ufcl
```

---

## F. Health Verification

```
[ ] 25. API liveness
        curl -k https://192.168.1.5/api/health | jq '{ok, status, uptime}'

[ ] 26. Database readiness
        curl -k https://192.168.1.5/api/ready  | jq '{ok, db}'

[ ] 27. Metrics accessible with token
        curl -k -H "Authorization: Bearer $METRICS_TOKEN" \
             https://192.168.1.5/api/metrics | jq '{ok, active_sessions, requests_total}'

[ ] 28. Monitoring dashboard loads
        Open: https://192.168.1.5/dashboard.html
        Enter server URL and METRICS_TOKEN — metrics should display
```

---

## G. APK Build and Distribution

```
[ ] 29. Trigger GitHub Actions release workflow (or build manually)
        git tag v1.0.0 && git push origin v1.0.0

[ ] 30. Verify APK deployed to update server
        curl -k https://192.168.1.5/version.json | jq '{version, versionCode}'

[ ] 31. Verify APK download works
        curl -kI https://192.168.1.5/downloads/UFCL-production.apk
        # Expect: HTTP/2 200, Content-Type: application/vnd.android.package-archive

[ ] 32. Install TLS certificate on each Android test device
        See instructions from: sudo bash tools/ssl-setup.sh

[ ] 33. Install UFCL-production.apk on at least two Android devices
        Verify: app installs, splash screen loads, login works
```

---

## H. UAT Sign-Off

```
[ ] 34. IT completes pre-test setup in UFCL_UAT_PHASE13.html (Section: IT Setup)
[ ] 35. All departments complete their workflows in UFCL_UAT_PHASE13.html
[ ] 36. Every department row shows PASS in the Master Sign-Off table
[ ] 37. Workshop isolation test (Harvest Supervisor) confirmed no cross-workshop data
[ ] 38. IT team co-signs the Master Sign-Off
[ ] 39. Zero open CRITICAL or MAJOR bugs in the Phase 13 bug log
[ ] 40. Any CONDITIONAL verdicts have agreed workarounds documented in writing
```

---

## I. Go-Live

```
[ ] 41. All checklist items above are complete
[ ] 42. APK distributed to all production devices via QR code or USB
[ ] 43. All users briefed on login credentials (first login from IT)
[ ] 44. UFCL_USER_MANUAL.html distributed to all department heads (print or share PDF)
[ ] 45. UFCL_ADMIN_MANUAL.html accessible to IT officer
[ ] 46. IT contact number shared with all department heads
[ ] 47. Backup verified to have run successfully at least once

──── AUTHORISATION ────────────────────────────────────────────
IT Lead:      ________________________________  Date: __________
CEO / Admin:  ________________________________  Date: __________

         UFCL Mobile v1.0.0 is LIVE
───────────────────────────────────────────────────────────────
```

---

## Post-Launch (first week)

```
[ ] Monitor /api/metrics daily via the dashboard
[ ] Review error logs each morning: grep '"level":"error"' /opt/ufcl-api/logs/app-$(date +%Y-%m-%d).log | jq .
[ ] Confirm daily backup ran: tail -5 /opt/ufcl-backups/backup.log
[ ] Check disk usage: df -h / /opt
[ ] Respond to any user-reported issues within 24 hours
```
