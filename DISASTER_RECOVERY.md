# UFCL Disaster Recovery Playbook

**Recovery Time Objective (RTO): < 2 hours**  
**Recovery Point Objective (RPO): < 24 hours (daily backup)**

Always work through scenarios in this order: Verify → Stop → Restore → Verify → Resume

---

## Scenario 1 — Server Failure (hardware / OS unresponsive)

**Symptoms:** 192.168.1.5 does not respond to ping. All mobile users offline.

### Steps

```
[ ] 1. Confirm failure — ping 192.168.1.5 from two different machines
[ ] 2. Check physical machine: power, console output, RAID status
[ ] 3. Attempt SSH login
[ ] 4. If no console access: reboot or request datacenter intervention
[ ] 5. After boot, verify services:
        ping 192.168.1.5
        ssh admin@192.168.1.5
        systemctl status postgresql
        pm2 status
[ ] 6. If PostgreSQL did not auto-start:
        systemctl start postgresql
        pg_isready -h localhost
[ ] 7. If mobile-api did not auto-start:
        pm2 resurrect        # uses pm2 saved process list
        # or:
        pm2 start /opt/ufcl-api/mobile-api/server.js --name mobile-api
[ ] 8. Health check:
        curl http://192.168.1.5:3001/api/ready
[ ] 9. Notify users when service is restored
```

**Time estimate: 15–45 minutes** (hardware boot + service start)

---

## Scenario 2 — PostgreSQL Corruption or Crash

**Symptoms:** `/api/ready` returns 503. PostgreSQL logs show fatal errors. Database unresponsive.

### Step A — Try recovery

```bash
# Check PostgreSQL status
systemctl status postgresql
journalctl -u postgresql --since "1 hour ago"

# Attempt restart
systemctl restart postgresql
pg_isready -h localhost -p 5432

# Check PostgreSQL logs
tail -100 /var/log/postgresql/postgresql-*.log
```

### Step B — If PostgreSQL won't start (corrupted data files)

```bash
# Stop API first
pm2 stop mobile-api

# Try crash recovery
sudo -u postgres pg_ctl -D /var/lib/postgresql/14/main -l /tmp/pg_recovery.log start
tail -50 /tmp/pg_recovery.log

# If still failing, restore from backup (see BACKUP_AND_RESTORE.md — Section A)
BACKUP_FILE=$(ls -t /opt/ufcl-backups/daily/db-*.sql.gz | head -1)
echo "Restoring from: $BACKUP_FILE"

sudo -u postgres createdb ufcl_production
zcat "$BACKUP_FILE" | psql -U postgres -d ufcl_production

# Restart API
pm2 start mobile-api
curl http://localhost:3001/api/ready
```

**Time estimate: 30–90 minutes** (depends on DB size; restore ≈ 5–15 min)

---

## Scenario 3 — Lost Release Keystore

**Symptoms:** Need to build a new APK but `mobile/release/ufcl-release.jks` is missing.

> ⚠️ If the keystore is truly lost, APK signatures cannot be re-created.  
> Android devices will refuse to install an APK signed with a different key over an existing installation.  
> Users must uninstall the current app and install fresh.

### Prevention (do this now, before disaster)

```bash
# 1. Create an encrypted backup of the keystore
openssl enc -aes-256-cbc -pbkdf2 -in mobile/release/ufcl-release.jks \
  -out mobile/release/ufcl-release.jks.enc \
  -pass pass:"your-master-passphrase"

# 2. Store the encrypted file in:
#    - Company password manager
#    - Physical USB drive (locked cabinet)
#    - Encrypted cloud storage
#    - GitHub secret (KEYSTORE_BASE64) — already done in Phase 9

# 3. Document the passwords:
#    Keystore password:  UFCL#2026!Timber$Secure88
#    Key alias:          ufcl-mobile-key
#    Key password:       UFCL#2026!Timber$Secure88
```

### Recovery if keystore is in GitHub Secrets

The keystore is stored as `KEYSTORE_BASE64` GitHub secret. To recover it locally:

```bash
# Option 1: retrieve from GitHub Actions run artifact
# Go to: GitHub → Actions → any successful run → Download artifact (ufcl-release.jks)

# Option 2: decode from the secret value (requires GitHub Admin access)
# GitHub → Settings → Secrets → KEYSTORE_BASE64 → copy value
echo "<paste base64 value>" | base64 --decode > mobile/release/ufcl-release.jks
```

### If keystore is permanently lost

```bash
# 1. Generate a new keystore
keytool -genkey -v \
  -keystore mobile/release/ufcl-release.jks \
  -alias ufcl-mobile-key \
  -keyalg RSA -keysize 2048 \
  -validity 10000 \
  -storepass "UFCL#2026!Timber$Secure88" \
  -keypass  "UFCL#2026!Timber$Secure88" \
  -dname "CN=UFCL Mobile, OU=IT, O=UFCL, L=Harare, ST=Harare, C=ZW"

# 2. Update KEYSTORE_BASE64 GitHub secret
base64 -w 0 mobile/release/ufcl-release.jks | pbcopy  # macOS
base64 -w 0 mobile/release/ufcl-release.jks | xclip   # Linux

# 3. Push new APK (GitHub Actions builds and deploys automatically)

# 4. Notify all users: they must uninstall UFCL Mobile before installing the new APK
#    (Android blocks re-installation when the signing key changes)
```

**Time estimate: 2–4 hours** (new build + user communication)

---

## Scenario 4 — GitHub Unavailable

**Symptoms:** Cannot push code, GitHub Actions not running, Release downloads failing.

### Short-term (< 4 hours)

GitHub outages are rare and self-resolve. Check https://githubstatus.com

- The **last deployed APK** remains on the company server at 192.168.1.5
- Mobile devices already connected to the LAN continue to receive updates from the company server
- ERP desktop application continues working (it does not depend on GitHub)
- Mobile API on 192.168.1.5 continues working (it does not depend on GitHub)

### Extended outage

```bash
# If you need to deploy an APK without GitHub Actions, do it manually:

# 1. Build locally
cd mobile/android
APP_ENV=production APP_PACKAGE_ID=com.ufcl.mobile \
  ./gradlew assembleRelease

# 2. Deploy manually to server
SRC="app/build/outputs/apk/release/app-release.apk"
VER=$(node -p "require('../package.json').version")
SHA256=$(sha256sum $SRC | awk '{print $1}')
MD5=$(md5sum $SRC | awk '{print $1}')

scp $SRC ufcl-deploy@192.168.1.5:/opt/ufcl-api/updates/UFCL-production.apk
echo $SHA256 | ssh ufcl-deploy@192.168.1.5 'cat > /opt/ufcl-api/updates/apk.sha256'
echo $MD5    | ssh ufcl-deploy@192.168.1.5 'cat > /opt/ufcl-api/updates/apk.md5'

# 3. Update version.json on server
ssh ufcl-deploy@192.168.1.5 node -e "
  const fs = require('fs'), path = require('path');
  const p = '/opt/ufcl-api/updates/version.json';
  const meta = { version: '$VER', versionCode: $(git rev-list --count HEAD),
    releaseDate: '$(date +%Y-%m-%d)', mandatory: false,
    apkUrl: 'http://192.168.1.5:3001/downloads/UFCL-production.apk',
    sha256: '$SHA256', md5: '$MD5', notes: ['Manual deployment'] };
  fs.writeFileSync(p, JSON.stringify(meta, null, 2));
  console.log('Updated:', meta.version);
"
```

**Time estimate: 30–60 minutes** (manual build + deploy)

---

## Scenario 5 — VPN Unavailable

**Symptoms:** Remote/field users cannot connect. On-site users on the LAN continue working normally.

### Assessment

1. **Office LAN users**: Not affected. The API runs on 192.168.1.5 within the LAN.
2. **Remote VPN users**: Cannot reach 192.168.1.5 until VPN is restored.

### Actions

```bash
# On the server — check if it's the VPN adapter or the internet
ip addr show           # check all interfaces
ping 8.8.8.8           # internet OK?
systemctl status openvpn  # if using OpenVPN

# Restart OpenVPN
sudo systemctl restart openvpn@server
```

### If VPN cannot be restored within 2 hours

Remote workers must come on-site or work with their locally cached data (the mobile app stores the last 30 days of submitted records locally via the offline queue).

**Time estimate: Variable** — VPN issues usually resolve within 30 minutes.

---

## Scenario 6 — Update Server Failure

**Symptoms:** Devices do not receive APK updates. `/version.json` endpoint returns error.

### Diagnose

```bash
# Test from server
curl http://localhost:3001/version.json
curl http://localhost:3001/api/health

# Check updates folder
ls -lh /opt/ufcl-api/updates/

# Check API is running
pm2 status
```

### Fix: missing updates folder or files

```bash
mkdir -p /opt/ufcl-api/updates

# Restore from backup
tar -xzf /opt/ufcl-backups/daily/updates-$(date +%Y-%m-%d).tar.gz \
    -C /opt/ufcl-api/

# Verify
curl http://localhost:3001/version.json | jq .
```

### Fix: API process crashed

```bash
pm2 resurrect
# or
pm2 start /opt/ufcl-api/mobile-api/server.js --name mobile-api
curl http://localhost:3001/api/ready
```

> **Note:** Update failure is non-critical — mobile devices continue working with their current version. Users just won't receive updates until the server is fixed. No business operations are blocked.

**Time estimate: 5–30 minutes**

---

## Scenario 7 — Failed Deployment (APK Deploy Broke the Server)

**Symptoms:** After a GitHub Actions deployment, `/api/ready` returns errors, or devices report checksum failures.

### Roll back the APK

```bash
# List recent backups to pick the previous good version
ls -lt /opt/ufcl-backups/daily/updates-*.tar.gz | head -5

# Restore the previous updates archive
PREV_BACKUP="/opt/ufcl-backups/daily/updates-2026-06-28.tar.gz"
tar -xzf "$PREV_BACKUP" -C /opt/ufcl-api/

# Verify
curl http://localhost:3001/version.json | jq '{version, versionCode}'
```

### Roll back the API server code

```bash
cd /opt/ufcl-api

# Show recent commits
git log --oneline -10

# Roll back to the last known-good commit
git stash          # save any local changes
git checkout <commit-hash>

# Restart API
pm2 restart mobile-api
curl http://localhost:3001/api/ready
```

**Time estimate: 10–20 minutes**

---

## Scenario 8 — APK Rollback (Bad Update Pushed to Devices)

**Symptoms:** Users report the app crashes after updating. Need to push an older APK to all devices.

See the rollback procedure in [UPDATE_INFRASTRUCTURE.md](UPDATE_INFRASTRUCTURE.md).

Key point: Set a `versionCode` higher than the bad build so devices see it as an update and download it. Set `mandatory: true` to force immediate installation.

**Time estimate: 15–30 minutes** (rollback + device update time)

---

## Recovery Checklist After Any Incident

```
[ ] Services restored (pm2 status, systemctl status)
[ ] Health check passing (curl /api/ready)
[ ] Test login from a mobile device
[ ] Test login from the desktop ERP
[ ] Check error logs for new exceptions
[ ] Run manual backup of current state
[ ] Document: what failed, what was done, how long it took
[ ] Update this document if a new scenario was encountered
[ ] Notify affected users that service is restored
```
