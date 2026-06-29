# UFCL Mobile — Update Infrastructure

Enterprise APK distribution through the company server at 192.168.1.5.

---

## Architecture

```
Developer
    │
    ▼ git push master (mobile/ changes)
GitHub
    │
    ▼ GitHub Actions (ubuntu-latest)
    │   1. Build signed APK (com.ufcl.mobile)
    │   2. Compute SHA-256 + MD5 checksums
    │   3. Generate version.json (GitHub CDN apkUrl)
    │   4. Generate version-server.json (company server apkUrl)
    │   5. Create GitHub Release (archive + fallback)
    │   6. SCP deploy to 192.168.1.5
    │       └─ UFCL-production.apk  →  /updates/UFCL-production.apk
    │       └─ apk.sha256            →  /updates/apk.sha256
    │       └─ apk.md5               →  /updates/apk.md5
    │       └─ version-server.json  →  /updates/version.json
    │
    ▼ Company Server (192.168.1.5:3001)
    │   Express serves:
    │     GET /version.json                      → version metadata
    │     GET /downloads/UFCL-production.apk     → APK binary (Range-resumable)
    │     GET /downloads/apk.sha256              → SHA-256 checksum
    │     GET /downloads/apk.md5                 → MD5 checksum
    │
    ▼ UFCL Mobile App (on device)
        • Checks /version.json on startup (3 s delay)
        • Checks every 4 hours while running
        • Checks when returning from background (if away ≥ 10 min)
        • Compares server versionCode with installed versionCode
        • Shows update dialog if newer version is available
        • Downloads APK with progress bar (auto-resumes on interruption)
        • Verifies MD5 before installing
        • Hands off to Android package installer
```

---

## Server Folder Structure

```
/opt/ufcl-api/               ← or wherever mobile-api is deployed
├── server.js
├── routes/
│   ├── updates.js           ← serves /version.json and /downloads/*
│   └── ...
└── updates/                 ← populated by GitHub Actions deploy step
    ├── version.json         ← current version metadata (company server URLs)
    ├── UFCL-production.apk  ← latest signed release APK
    ├── apk.sha256           ← SHA-256 of the APK (for manual IT verification)
    └── apk.md5              ← MD5 of the APK (used by mobile app)
```

---

## version.json Format

```json
{
  "version":     "1.0.2",
  "versionCode": 87,
  "releaseDate": "2026-06-29",
  "mandatory":   false,
  "apkUrl":      "http://192.168.1.5:3001/downloads/UFCL-production.apk",
  "sha256":      "e3b0c44298fc1c149afbf4c8996fb924...",
  "md5":         "d41d8cd98f00b204e9800998ecf8427e",
  "notes": [
    "Bug fixes in harvest module",
    "Performance improvements"
  ]
}
```

### Fields

| Field | Type | Description |
|---|---|---|
| `version` | string | Human-readable version (e.g. "1.0.2") |
| `versionCode` | number | Monotonically increasing integer — compared against installed build |
| `releaseDate` | string | ISO date of release |
| `mandatory` | boolean | If true: user cannot dismiss the update dialog |
| `apkUrl` | string | Direct download URL for the APK |
| `sha256` | string | SHA-256 of the APK — for IT manual verification |
| `md5` | string | MD5 of the APK — used by the mobile app for automated integrity check |
| `notes` | string[] | What's new items displayed in the update dialog |

---

## One-Time Server Setup

Run these commands once on the company server (192.168.1.5):

```bash
# 1. Create the updates folder next to the mobile-api directory
mkdir -p /opt/ufcl-api/updates

# 2. Create a dedicated deployment SSH user (principle of least privilege)
sudo adduser --system --no-create-home --shell /usr/sbin/nologin ufcl-deploy
sudo mkdir -p /home/ufcl-deploy/.ssh
sudo touch /home/ufcl-deploy/.ssh/authorized_keys
sudo chown -R ufcl-deploy:ufcl-deploy /home/ufcl-deploy/.ssh
sudo chmod 700 /home/ufcl-deploy/.ssh
sudo chmod 600 /home/ufcl-deploy/.ssh/authorized_keys

# 3. Allow the deploy user to write only to /updates/
sudo chown -R ufcl-deploy:ufcl-deploy /opt/ufcl-api/updates
sudo chmod 755 /opt/ufcl-api/updates

# 4. Generate an SSH key pair on your developer PC
ssh-keygen -t ed25519 -C "ufcl-github-deploy" -f ~/.ssh/ufcl_deploy_key

# 5. Copy the public key to the server
cat ~/.ssh/ufcl_deploy_key.pub | ssh adminuser@192.168.1.5 \
  "sudo tee -a /home/ufcl-deploy/.ssh/authorized_keys"

# 6. Set UPDATES_DIR in the mobile-api .env (optional — defaults to ./updates)
echo "UPDATES_DIR=/opt/ufcl-api/updates" >> /opt/ufcl-api/.env

# 7. Restart mobile-api to pick up the .env change
pm2 restart mobile-api   # or: systemctl restart ufcl-mobile-api
```

---

## GitHub Secrets Required

Add these in: GitHub repo → Settings → Secrets and variables → Actions

| Secret name | Value |
|---|---|
| `KEYSTORE_BASE64` | `base64 -w 0 mobile/release/ufcl-release.jks` (run on Linux/WSL) |
| `KEYSTORE_PASSWORD` | `UFCL#2026!Timber$Secure88` |
| `KEY_PASSWORD` | `UFCL#2026!Timber$Secure88` |
| `KEY_ALIAS` | `ufcl-mobile-key` |
| `DEPLOY_SSH_KEY` | Contents of `~/.ssh/ufcl_deploy_key` (private key, including header/footer) |
| `DEPLOY_USER` | `ufcl-deploy` |
| `DEPLOY_PATH` | `/opt/ufcl-api/updates` |

---

## How to Publish a New APK

### Normal release (automatic)

1. Make code changes in `mobile/`
2. Update version in `mobile/package.json` (e.g. `"version": "1.0.2"`)
3. Commit and push to `master`
4. GitHub Actions builds, signs, publishes, and deploys automatically
5. All devices receive the update prompt within minutes

### Manual / out-of-band release

Trigger the workflow manually from GitHub:

1. Go to: GitHub repo → Actions → "Mobile — Build & Release APK"
2. Click "Run workflow"
3. Fill in:
   - **Version name**: e.g. `1.0.3`
   - **Mandatory**: `true` if all devices must update immediately
   - **Release notes**: `Fixed login timeout,Improved harvest sync`
4. Click "Run workflow"

### Mandatory update

Set `mandatory: true` in the manual trigger.  
Devices will show the update dialog **without a "Later" button** and the Android back button is disabled. Users cannot use the app until they install the update.

---

## Rollback Procedure

To roll back all devices to a previous APK:

### Step 1 — Get the old APK

```bash
# Option A: from the GitHub Releases archive
# Download UFCL-production-1.0.0.apk from the GitHub Release page

# Option B: from a local backup
ls /opt/ufcl-api/updates/backups/
```

### Step 2 — Deploy the old APK manually on the server

```bash
cd /opt/ufcl-api/updates

# Back up current files first
cp UFCL-production.apk UFCL-production-BACKUP-$(date +%Y%m%d).apk
cp version.json version-BACKUP-$(date +%Y%m%d).json

# Copy the old APK into place
cp /path/to/UFCL-production-1.0.0.apk UFCL-production.apk

# Recompute checksums
sha256sum UFCL-production.apk | awk '{print $1}' > apk.sha256
md5sum    UFCL-production.apk | awk '{print $1}' > apk.md5

# Update version.json to point back to the old version
# IMPORTANT: versionCode must be HIGHER than what is installed on devices
# so they see it as an "update". Use a high number like 9999 to force rollback.
cat > version.json << 'EOF'
{
  "version":     "1.0.0-rollback",
  "versionCode": 9999,
  "releaseDate": "2026-06-29",
  "mandatory":   true,
  "apkUrl":      "http://192.168.1.5:3001/downloads/UFCL-production.apk",
  "sha256":      "<paste sha256 output>",
  "md5":         "<paste md5 output>",
  "notes":       ["Emergency rollback to version 1.0.0"]
}
EOF
```

### Step 3 — Verify

```bash
curl http://192.168.1.5:3001/version.json
```

Devices will receive the rollback update on their next check (within 4 hours or on next foreground).

---

## Checksum Verification (IT Manual Check)

After deploying an APK, verify its integrity:

```bash
# On the server
sha256sum /opt/ufcl-api/updates/UFCL-production.apk
# Must match the contents of apk.sha256

# Cross-check against GitHub Release
cat /opt/ufcl-api/updates/apk.sha256

# On Windows (PowerShell) — verify a downloaded APK before installing
Get-FileHash UFCL-production.apk -Algorithm SHA256
```

The MD5 in `apk.md5` is computed automatically by the mobile app after each download before installation. If MD5 mismatches, the app aborts and shows "File integrity check failed" — contact IT.

---

## Troubleshooting

### Update dialog never appears on devices

1. Check server is reachable: `curl http://192.168.1.5:3001/version.json`
2. Check `versionCode` in `version.json` is greater than what's installed
3. Check the installed app's `versionCode` (check `android/app/build.gradle` or the GitHub release that was installed)
4. Confirm the device is on the company Wi-Fi (update server is LAN-only)

### GitHub Actions deploy step fails

1. Verify `DEPLOY_SSH_KEY` secret contains the full private key including `-----BEGIN/END-----` lines
2. Verify the deploy user can SSH: `ssh -i ~/.ssh/ufcl_deploy_key ufcl-deploy@192.168.1.5`
3. Verify `DEPLOY_PATH` exists on server and is writable by the deploy user
4. Check the workflow logs in GitHub → Actions → latest run

### "Integrity check failed" on device

The downloaded APK's MD5 does not match `apk.md5`. Causes:
- Network corruption during download — device should retry
- APK was replaced on server after MD5 was computed — redeploy correctly
- Server disk corruption — restore from GitHub Release archive

### APK builds but devices can't install ("App not installed")

- Ensure `mandatory` flag is set correctly in version.json
- Confirm the APK is signed with the same keystore as the installed version
- The installed dev APK (`com.ufcl.mobile.dev`) and production APK (`com.ufcl.mobile`) are different package IDs — users must uninstall the dev build first

### "Install unknown apps" blocked by device policy

Devices need to allow the UFCL Mobile app to install packages:
- Settings → Apps → UFCL Mobile → Install unknown apps → Allow

---

## Security Notes

- The `/version.json` and `/downloads/*` endpoints are public (no JWT) — intentionally, so devices can check for updates before login. Rate-limited to 30 req/hour per device IP.
- The APK is signed with the release keystore; Android verifies this signature before installation.
- MD5 protects against accidental download corruption, not adversarial injection (the LAN is trusted).
- The deploy SSH key grants write access only to `/opt/ufcl-api/updates/` — no other server access.
- The keystore password is stored as a GitHub secret and never appears in logs.
- GitHub Actions workflow uses `secrets.GITHUB_TOKEN` (auto-generated per run) for creating releases.
