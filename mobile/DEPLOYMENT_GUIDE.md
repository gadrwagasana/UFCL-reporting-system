# UFCL Mobile App — IT Administrator Deployment Guide

**Version:** 1.0  
**Applies to:** UFCL Mobile App (Expo 51 / React Native 0.74)  
**Target audience:** UFCL IT Department

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites — Build Machine](#2-prerequisites--build-machine)
3. [First-Time Setup](#3-first-time-setup)
4. [Environment Configuration](#4-environment-configuration)
5. [Signing Key Setup](#5-signing-key-setup)
6. [Building the App](#6-building-the-app)
7. [Installing on Phones](#7-installing-on-phones)
8. [Mobile API — LAN Hosting](#8-mobile-api--lan-hosting)
9. [VPN Access for Remote Users](#9-vpn-access-for-remote-users)
10. [Updating the App](#10-updating-the-app)
11. [Compatibility Verification](#11-compatibility-verification)
12. [Security Architecture](#12-security-architecture)
13. [Maintenance Checklist](#13-maintenance-checklist)
14. [Troubleshooting](#14-troubleshooting)
15. [HTTPS Setup with nginx](#15-https-setup-with-nginx)

---

## 1. Architecture Overview

```
Company LAN (192.168.1.x)
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│   Android Phones            Server PC (192.168.1.5)                 │
│   ┌──────────────┐          ┌─────────────────────────────────────┐  │
│   │ UFCL Mobile  │ HTTPS    │  nginx  :443  (reverse proxy)       │  │
│   │ (APK)        │◄────────►│     ↓  proxy_pass 127.0.0.1:3001   │  │
│   └──────────────┘  JWT     │  Express  :3001  (localhost only)   │  │
│                             │     ↓  require('../../db/...')      │  │
│   Windows PCs               │  PostgreSQL  :5432                  │  │
│   ┌──────────────┐          │  DB: Report_Managements             │  │
│   │ UFCL Desktop │◄────────►│  Desktop App (Electron)             │  │
│   │ (Electron)   │  TCP     └─────────────────────────────────────┘  │
│   └──────────────┘                                                   │
└──────────────────────────────────────────────────────────────────────┘
```

**Production rule:** Express is bound to `127.0.0.1` (set `API_BIND_HOST=127.0.0.1` in `.env`).  
Port 3001 is **not** reachable from the LAN — only nginx can reach it. See Section 15.

**Key facts:**
- Mobile app and Desktop app share the **same PostgreSQL database** — no data duplication
- Mobile API is a **thin REST layer** over the same `db/services/data.js` used by the Desktop app
- All business logic, approval workflows, and workshop restrictions live in `data.js` — **not** in the mobile app
- JWT tokens expire after **8 hours** — users log in once per working day
- The mobile app **never talks directly to PostgreSQL** — only through the Mobile API

---

## 2. Prerequisites — Build Machine

The build machine is the Windows PC used by IT to compile and distribute APKs.

### 2.1 Java Development Kit (JDK 17)

1. Download **JDK 17 LTS** from: https://adoptium.net/temurin/releases/
2. Choose: **Windows x64 — `.msi` installer**
3. Install with default options
4. Verify:
   ```
   java -version
   ```
   Expected output: `openjdk version "17.x.x"`

### 2.2 Android Studio

1. Download from: https://developer.android.com/studio
2. Run the installer — use default options
3. On first launch, the Setup Wizard will install:
   - Android SDK (API 34)
   - Android Build Tools
   - Android Emulator (optional)
4. Estimated disk space: **8–12 GB**

### 2.3 Environment Variables

After installing Android Studio, set these **System Environment Variables**:

| Variable | Value |
|---|---|
| `ANDROID_HOME` | `C:\Users\hp\AppData\Local\Android\Sdk` |
| `JAVA_HOME` | `C:\Program Files\Eclipse Adoptium\jdk-17.x.x` |

Also add to the **PATH** variable:
```
%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\cmdline-tools\latest\bin
%JAVA_HOME%\bin
```

**How to set environment variables on Windows 11:**
1. Press `Win + S` → search "Environment Variables"
2. Click "Edit the system environment variables"
3. Click "Environment Variables…"
4. Under "System variables" — click New for each variable above
5. Click OK → OK → OK
6. **Restart PowerShell** after making changes

### 2.4 Node.js

Node.js v20+ is required (same as the desktop app build machine).

Verify: `node --version` → should show v20.x.x or higher

### 2.5 Verify All Prerequisites

Run this in PowerShell to check everything:
```powershell
java -version
node --version
npm --version
echo $env:ANDROID_HOME
echo $env:JAVA_HOME
```

All four should print valid values with no errors.

---

## 3. First-Time Setup

Run these steps **once** when setting up the build machine for the first time.

### Step 1 — Install dependencies
```
cd "C:\Users\hp\OneDrive\Desktop\UFCL 12\mobile"
npm install --legacy-peer-deps
```

### Step 2 — Generate the native Android project
```
scripts\02_prebuild.bat
```
This creates the `android/` folder. Takes 2–5 minutes.

### Step 3 — Generate the company signing keystore
```
scripts\01_generate_keystore.bat
```
- Creates `release/ufcl-release.jks`
- You will be asked to set **two passwords** — store them in a secure location (password manager or printed paper in a locked cabinet)
- This file is the company's permanent signing identity — **back it up**

### Step 4 — Configure signing
```
cp release\keystore.properties.template release\keystore.properties
```
Edit `release\keystore.properties` and fill in the passwords you set in Step 3.

Then run:
```
scripts\06_configure_signing.bat
```

### Step 5 — Build the first APK
```
scripts\04_build_release_apk.bat
```

---

## 4. Environment Configuration

The app supports three environments. Each has its own `.env.*` file.

| File | Used for | App name on phone |
|---|---|---|
| `.env.development` | Daily development / debugging | UFCL Dev |
| `.env.staging` | UAT / user acceptance testing | UFCL Staging |
| `.env.production` | Company-wide production release | UFCL Production |

### Changing the API Server IP

If the server IP changes (e.g., the server PC is replaced), update `EXPO_PUBLIC_API_URL` in the relevant `.env.*` file:

```
EXPO_PUBLIC_API_URL=http://192.168.1.NEW_IP:3001
```

Then rebuild the APK and redistribute it to all phones. **No code changes required.**

### Environment files are NOT in git

The `.env.*` files are listed in `.gitignore` and will not be committed. Each build machine keeps its own copies. Store them in the IT shared drive alongside the keystore backup.

---

## 5. Signing Key Setup

### Why signing matters

Android requires every APK to be signed with the same key for every update. If you lose the key or use a different key, users must **uninstall and reinstall** the app — losing any locally cached data.

### Key storage requirements

| Item | Where to store |
|---|---|
| `release/ufcl-release.jks` | IT server shared drive (restricted access) + USB backup |
| `release/keystore.properties` | Same location, separate from the .jks file |
| Keystore password | Password manager OR printed paper in locked cabinet |
| Key password | Same as above |

### Verifying the keystore

```
keytool -list -v -keystore release\ufcl-release.jks -alias ufcl-mobile-key
```

You should see:
- Owner: `CN=UFCL Production, O=Uganda Forestry Company Ltd`
- Validity: 25 years from creation date
- Algorithm: RSA, 4096-bit

### Signing block in Gradle

`scripts/06_configure_signing.bat` creates `android/app/signing.gradle` and applies it to `android/app/build.gradle`. It reads passwords from `release/keystore.properties` at build time — **passwords are never hardcoded in source files.**

---

## 6. Building the App

### 6.1 Quick Reference

| What to build | Script | Output |
|---|---|---|
| Debug APK (testing) | `scripts\03_build_debug_apk.bat` | `android/app/build/outputs/apk/debug/app-debug.apk` |
| Release APK (production) | `scripts\04_build_release_apk.bat` | `android/app/build/outputs/apk/release/app-release.apk` |
| Release AAB (future) | `scripts\05_build_release_aab.bat` | `android/app/build/outputs/bundle/release/app-release.aab` |

### 6.2 Full Build Sequence (new version)

```
1. Update version in app.config.js (version and versionCode)
2. Update EXPO_PUBLIC_API_URL in .env.production if IP changed
3. scripts\02_prebuild.bat      ← only if native plugins changed
4. scripts\04_build_release_apk.bat
5. Distribute APK to phones
```

### 6.3 First Build — Expected Duration

| Step | Time |
|---|---|
| `npm install` | 2–5 min |
| `expo prebuild` | 3–8 min |
| First Gradle build (downloads SDK) | 15–25 min |
| Subsequent Gradle builds (cached) | 3–8 min |

---

## 7. Installing on Phones

### 7.1 Enable Unknown Sources on Android

On each company phone (one-time setup):
1. Settings → Apps → Special App Access → Install Unknown Apps
2. Find **Files** (or the file manager) → Allow from this source

### 7.2 Option A — USB Transfer

1. Connect phone to build PC via USB
2. Copy `app-release.apk` to the phone's Downloads folder
3. Open Files app on phone → Downloads → tap `app-release.apk` → Install

### 7.3 Option B — LAN File Share

1. Place `app-release.apk` in a shared network folder (e.g., `\\192.168.1.5\IT\mobile-releases\`)
2. From phone: open a browser → navigate to the file share or a simple HTTP file server
3. Download and install

### 7.4 Option C — Simple HTTP Download (recommended for bulk rollout)

On the build PC, after building:
```powershell
cd "C:\Users\hp\OneDrive\Desktop\UFCL 12\mobile\android\app\build\outputs\apk\release"
python -m http.server 8080
```

On each phone: open browser → `http://192.168.1.5:8080` → tap `app-release.apk` → Install.

Stop the Python server when done: `Ctrl+C`

### 7.5 Updates

When distributing an updated APK:
- Users tap the new APK → Android shows "App already installed — do you want to update?"
- Tap **Update** — all data is preserved
- If the signing key changed → user must uninstall first (data lost)

---

## 8. Mobile API — LAN Hosting

The Mobile API (`mobile-api/server.js`) must be running continuously on the server PC for the mobile app to work.

### 8.1 Run as a Windows Service (Recommended)

Install `node-windows` to run the API as a Windows background service that starts automatically with Windows and restarts on crash.

```powershell
cd "C:\Users\hp\OneDrive\Desktop\UFCL 12"
npm install -g node-windows
node tools\install-mobile-api-service.js
```

Create the service installer at `tools\install-mobile-api-service.js`:

```js
const Service = require('node-windows').Service;
const path    = require('path');

const svc = new Service({
  name:        'UFCL Mobile API',
  description: 'UFCL Mobile REST API on port 3001',
  script:      path.join(__dirname, '..', 'mobile-api', 'server.js'),
  nodeOptions: [],
  env: [
    { name: 'NODE_ENV', value: 'production' },
  ],
});

svc.on('install', () => { svc.start(); console.log('Service installed and started.'); });
svc.install();
```

Then run:
```
node tools\install-mobile-api-service.js
```

To verify the service is running:
```
sc query "UFCL Mobile API"
```

To uninstall the service later:
```js
svc.on('uninstall', () => console.log('Uninstalled'));
svc.uninstall();
```

### 8.2 Windows Firewall Rule

Allow phones on the LAN to reach port 3001:

```powershell
netsh advfirewall firewall add rule `
  name="UFCL Mobile API" `
  dir=in action=allow protocol=TCP localport=3001
```

Run this once in PowerShell as Administrator.

### 8.3 Static IP for the Server PC

Assign the server PC a static IP so phones always find it:

1. Control Panel → Network and Sharing Center → Change adapter settings
2. Right-click your LAN adapter → Properties → IPv4
3. Set:
   - IP address: `192.168.1.5`
   - Subnet mask: `255.255.255.0`
   - Default gateway: `192.168.1.1` (your router)
   - DNS: `8.8.8.8` / `8.8.4.4`

Alternatively, reserve the IP in the router's DHCP settings using the PC's MAC address.

### 8.4 Health Check Endpoint

Verify the API is reachable from any phone:

```
http://192.168.1.5:3001/api/health
```

Expected response: `{"ok":true,"status":"healthy"}`

Test from a phone browser before distributing the APK.

---

## 9. VPN Access for Remote Users

For users working outside the company LAN (remote workshops, field teams), a VPN is needed to reach the API.

### 9.1 Recommended: WireGuard VPN

WireGuard is fast, simple to set up, and works well on Android.

**Server side (on the company server PC or a dedicated router):**

1. Install WireGuard for Windows: https://www.wireguard.com/install/
2. Generate a server keypair:
   ```
   wg genkey | tee server_private.key | wg pubkey > server_public.key
   ```
3. Create server config (`C:\WireGuard\ufcl-vpn.conf`):
   ```ini
   [Interface]
   Address    = 10.10.0.1/24
   ListenPort = 51820
   PrivateKey = <SERVER_PRIVATE_KEY>

   [Peer]
   # Add one [Peer] block per remote user / device
   PublicKey  = <CLIENT_PUBLIC_KEY>
   AllowedIPs = 10.10.0.2/32
   ```
4. Open UDP port 51820 on the router (port-forward to server PC)

**Client side (on Android phones):**

1. Install WireGuard from Play Store
2. IT creates a client config and shares it as a QR code or file:
   ```ini
   [Interface]
   Address    = 10.10.0.2/32
   PrivateKey = <CLIENT_PRIVATE_KEY>
   DNS        = 8.8.8.8

   [Peer]
   PublicKey  = <SERVER_PUBLIC_KEY>
   Endpoint   = <COMPANY_PUBLIC_IP>:51820
   AllowedIPs = 192.168.1.0/24
   ```
3. Update `.env.production` API URL to the LAN IP (no change needed — once connected to VPN, phone reaches 192.168.1.5 directly)

### 9.2 Alternative: Router-based VPN

If your company router supports OpenVPN or WireGuard (many Mikrotik / Ubiquiti routers do), set it up at the router level. All LAN traffic then works over VPN without configuring a server on the PC.

---

## 10. Updating the App

### 10.1 Version Number Policy

Update version in `app.config.js` for every release:

```js
version:     '1.0.1',   // shown to users (semver)
versionCode: 2,          // must increment by 1 each release (integer)
```

`versionCode` is the critical number — Android uses it to decide if an update is newer. **Never reuse a versionCode.**

| Change type | version bump | versionCode |
|---|---|---|
| Bug fix | 1.0.0 → 1.0.1 | +1 |
| New feature (minor) | 1.0.x → 1.1.0 | +1 |
| Major release | 1.x.x → 2.0.0 | +1 |

### 10.2 Update Procedure

```
1. Make code changes
2. Increment version and versionCode in app.config.js
3. Run scripts\04_build_release_apk.bat
4. Notify users via WhatsApp / SMS that an update is available
5. Distribute APK via USB or HTTP (Section 7)
6. Users install — existing data and session are preserved
```

### 10.3 If API changes require a new app version

When a new API endpoint is added and the mobile app must use it:
1. Update `mobile/src/api/endpoints.ts` with the new endpoint
2. Write the screen or hook that calls it
3. Build and distribute a new APK

The API is backwards-compatible — old app versions keep working as long as their endpoints still exist.

---

## 11. Compatibility Verification

### 11.1 Database

The mobile app **never connects directly to PostgreSQL**. All database access goes through the Mobile API → `db/services/data.js` → PostgreSQL.

| Desktop App | Mobile API | Mobile App |
|---|---|---|
| Electron → IPC → `data.js` → PostgreSQL | Express → `data.js` → PostgreSQL | Axios → Express → `data.js` → PostgreSQL |

`data.js` is the single source of truth for all business logic. Changes to the schema must be reflected in `data.js` only — both apps inherit them automatically.

**Verified compatibility:**
- ✅ Same `db/pool.js` connection pool used by both paths
- ✅ Mobile API imports `data.js` at `require('../../db/services/data')` — exact same file
- ✅ No schema changes were made during mobile development
- ✅ All table reads/writes go through the same data functions

### 11.2 Approval Workflows

The CEO approval flow (poles purchase requests) was verified against the existing desktop workflow:

| Action | Desktop IPC | Mobile API | Same data function? |
|---|---|---|---|
| List poles requests | `poles-requests:list` | `GET /api/ceo/poles-requests` | ✅ Yes |
| Approve request | `poles-requests:approve` | `POST /api/ceo/poles-requests/:id/approve` body `{approve:true}` | ✅ Yes |
| Reject request | `poles-requests:reject` | `POST /api/ceo/poles-requests/:id/approve` body `{approve:false, rejectionReason}` | ✅ Yes |

An approval made on mobile is immediately visible on the Desktop app and vice versa.

### 11.3 Workshop Isolation

Workshop restriction is enforced in `data.js` on every query:

```js
// From data.js — unchanged
function isWorkshopRestricted(user) {
  return user.workshop_id != null &&
    !['admin','ceo','operations','logistics'].includes(user.role);
}
```

The mobile app receives `workshopId` in the JWT payload and passes it to every API call. `data.js` enforces the filter server-side. The mobile app UI **cannot bypass** this restriction even if modified.

### 11.4 JWT Authentication

- JWT secret is stored in `.env` on the server — same secret used for Desktop session validation
- Token expiry: 8 hours — same as desktop
- `GET /api/auth/me` validates the token on every app startup (session restore)
- A 401 response automatically clears the token and shows the Login screen

### 11.5 Role Permissions

All write permissions are enforced by the `requireRoles()` middleware in `mobile-api/middleware/authorize.js`. The mobile app UI shows/hides buttons based on role, but **the API rejects unauthorised requests regardless** — the frontend enforcement is only for UX convenience.

### 11.6 Audit Logging

Audit entries are created by `data.js` functions. Since the mobile API calls the same `data.js` functions, all mobile actions appear in the same audit log visible on the Desktop app.

---

## 12. Security Architecture

### 12.1 What the mobile app can and cannot do

| Capability | Mobile App |
|---|---|
| Read data outside own workshop | ❌ Blocked by `data.js` filter |
| Approve requests without CEO role | ❌ Blocked by `requireRoles()` middleware |
| Bypass JWT authentication | ❌ All endpoints require valid Bearer token |
| Modify data without audit trail | ❌ `data.js` always writes to audit log |
| Access the database directly | ❌ App only knows the API URL, not DB credentials |

### 12.2 Network security on the LAN

**Recommended (production): nginx reverse proxy + HTTPS**
- nginx listens on `0.0.0.0:443` (HTTPS) and `0.0.0.0:80` (redirect only)
- Express is bound to `127.0.0.1:3001` — not reachable directly from the LAN
- All traffic is encrypted with TLS; JWT and credentials never travel in plaintext
- See **Section 15** for the full nginx HTTPS setup guide

**Minimum (development / pilot): direct HTTP**
- Set `API_BIND_HOST=0.0.0.0` (default) to allow direct LAN access on port 3001
- Only authenticated requests (valid JWT) can read or write data
- Suitable for initial testing on a trusted LAN only; do not use in production

**General recommendations:**
- Configure the router to isolate guest Wi-Fi from the server VLAN
- Rate limiting is enforced server-side: 10 login attempts per 15 min, 300 req/min per device

### 12.3 Signing key security

- APKs signed with a different key cannot update the installed app
- If a keystore is compromised, a new key must be created and all users must uninstall and reinstall
- Store the keystore and passwords in at least two physically separate locations

---

## 13. Maintenance Checklist

### Before every production APK release

- [ ] Version number updated in `app.config.js` (both `version` and `versionCode`)
- [ ] `versionCode` is exactly 1 higher than the previous release
- [ ] `.env.production` has the correct API URL (`http://192.168.1.5:3001`)
- [ ] API server is running and `/api/health` returns OK
- [ ] Debug APK tested with a test user account on a real Android phone
- [ ] CEO login tested — Overview screen shows data
- [ ] Approval workflow tested — approve a poles request on mobile, verify it shows as approved on Desktop
- [ ] Offline mode tested — disable Wi-Fi, submit a form, re-enable Wi-Fi, verify it syncs
- [ ] Signing keystore backup confirmed at secure location
- [ ] Release APK file named with version: `ufcl-mobile-v1.0.1.apk`

### Monthly IT checks

- [ ] Mobile API Windows Service is running (`sc query "UFCL Mobile API"`)
- [ ] Server PC has static IP (`192.168.1.5`)
- [ ] Firewall rule for port 3001 is in place
- [ ] JWT_SECRET in `.env` is unchanged (changing it logs all users out immediately)
- [ ] Keystore file and backup are intact
- [ ] Node.js version on server is current LTS

### Annual

- [ ] Rotate JWT_SECRET (requires new APK build + all users re-login)
- [ ] Review user account list — deactivate departed staff accounts in the database
- [ ] Check keystore expiry date (`keytool -list -v -keystore release\ufcl-release.jks`)

---

## 14. Troubleshooting

### "Network request failed" on app launch

1. Confirm API server is running: `sc query "UFCL Mobile API"`
2. Test from a browser on the phone: `http://192.168.1.5:3001/api/health`
3. Check firewall: `netsh advfirewall firewall show rule name="UFCL Mobile API"`
4. Verify phone is on the company Wi-Fi, not mobile data

### "Unable to connect to server" on login

Same as above. Also check the API URL in `.env.production` matches the server's actual IP.

### Build fails with "SDK not found"

```
FAILURE: Build failed with an exception.
Could not determine java version from '...'
```

Solution: Verify `ANDROID_HOME` and `JAVA_HOME` environment variables. Restart PowerShell after setting them.

### Gradle download takes very long on first build

Normal — Gradle downloads Android build tools on first run (~500 MB). Subsequent builds use the cache and are much faster.

### "App not installed" when tapping APK

1. Check "Install unknown apps" is enabled for your file manager
2. Check available storage (APK is ~80–120 MB installed)
3. If a debug APK is installed, uninstall it before installing the release APK (different package IDs)

### Keystore password forgotten

There is no recovery. You must:
1. Generate a new keystore (`scripts\01_generate_keystore.bat`)
2. Build a new APK with the new key
3. Have all users **uninstall** the old app and install the new one
4. Users log in again — their server data (in PostgreSQL) is intact

This is why the keystore password must be stored securely.

### Phone shows "Session expired" immediately on open

The JWT has expired (8 hour TTL) or the server clock is out of sync. Users simply log in again. If it happens immediately after login, check that the server PC's system clock is correct.

---

## Appendix A — File Structure Reference

```
mobile/
├── app.config.js              ← Dynamic Expo config (reads .env.*)
├── App.tsx                    ← Root component
├── .env.development           ← Dev API URL (not in git)
├── .env.staging               ← Staging API URL (not in git)
├── .env.production            ← Production API URL (not in git)
├── eas.json                   ← Build profile definitions
├── package.json               ← Dependencies
├── tsconfig.json              ← TypeScript config
├── babel.config.js            ← Babel + path aliases
├── release/
│   ├── ufcl-release.jks              ← Company keystore (NOT in git)
│   ├── keystore.properties           ← Passwords (NOT in git)
│   └── keystore.properties.template  ← Template (in git)
├── scripts/
│   ├── 01_generate_keystore.bat  ← Run once to create keystore
│   ├── 02_prebuild.bat           ← Generate android/ folder
│   ├── 03_build_debug_apk.bat    ← Debug APK
│   ├── 04_build_release_apk.bat  ← Production APK
│   ├── 05_build_release_aab.bat  ← Production AAB
│   └── 06_configure_signing.bat  ← Patch Gradle with signing config
├── android/                   ← Generated by prebuild (not in git)
└── src/
    ├── api/        ← Axios client + endpoints
    ├── components/ ← Reusable UI components
    ├── hooks/      ← React hooks
    ├── navigation/ ← React Navigation (role-based)
    ├── screens/    ← Screen components
    ├── services/   ← Network monitor + sync service
    ├── stores/     ← Zustand state (auth, offline queue)
    ├── theme/      ← Brand colors, typography, spacing
    ├── types/      ← TypeScript interfaces
    └── utils/      ← Formatters, permissions, storage helpers
```

## Appendix B — SDK and Dependency Versions

| Dependency | Version | Purpose |
|---|---|---|
| Expo SDK | 51.0.x | React Native framework |
| React Native | 0.74.x | Mobile UI framework |
| React Navigation | 6.x | Screen navigation |
| TanStack Query | 5.x | API data caching |
| Zustand | 4.x | Local state management |
| Axios | 1.7.x | HTTP client |
| expo-secure-store | 13.x | JWT secure storage |
| AsyncStorage | 1.23.x | Offline queue storage |
| @react-native-community/netinfo | 11.x | Network status |
| date-fns | 3.x | Date formatting |
| Android SDK | API 34 (Android 14) | Build target |
| Minimum Android | API 23 (Android 6.0) | Oldest supported phone |
| JDK | 17 LTS | Build tool |

---

*This document should be stored in the IT department's documentation system and updated with each significant release.*

---

## 15. HTTPS Setup with nginx

This section covers the complete procedure for putting the Mobile API behind an nginx reverse proxy with TLS on the company LAN. After completing this section, all traffic between Android phones and the server will be encrypted.

**Time required:** ~45 minutes on first setup.

---

### 15.1 Install nginx for Windows

1. Download nginx for Windows from [nginx.org/en/download.html](https://nginx.org/en/download.html) — choose the latest **stable** release ZIP.
2. Extract to `C:\nginx` (the folder should contain `nginx.exe`, `conf\`, `html\`, etc.).
3. Test: open PowerShell and run:
   ```powershell
   C:\nginx\nginx.exe -v
   ```
   Expected: `nginx version: nginx/1.26.x`

---

### 15.2 Generate a LAN Certificate with mkcert

`mkcert` creates a local certificate authority (CA) and issues certificates trusted by devices that install the CA root. This is the cleanest approach for a company LAN.

**On the server PC (run once):**

```powershell
# Install mkcert (requires Chocolatey; or download the .exe from mkcert GitHub releases)
choco install mkcert

# Create and install the local CA on this PC
mkcert -install

# Generate a certificate for the server's LAN IP
# Replace 192.168.1.5 with the actual static IP of the server PC
cd C:\nginx\certs          # create this folder if it doesn't exist
mkcert 192.168.1.5
```

This creates two files:
- `C:\nginx\certs\192.168.1.5.pem` — the certificate
- `C:\nginx\certs\192.168.1.5-key.pem` — the private key

**Install the CA root on each Android phone (run once per device):**

1. On the server PC, find the CA root certificate:
   ```powershell
   mkcert -CAROOT
   ```
   The output is a folder path. Inside it, find `rootCA.pem`.

2. Copy `rootCA.pem` to the phone (via USB or internal file share).

3. On the phone: **Settings → Security → Install a certificate → CA certificate** → select `rootCA.pem`.

4. Name it `UFCL Internal CA` when prompted.

After this, the phone will trust any certificate issued by the company CA — including the one for `192.168.1.5`.

> **Note:** mkcert CA certificates are device-specific. If you re-run `mkcert -install` on a new PC, you must re-distribute the new `rootCA.pem` to all phones.

---

### 15.3 Configure nginx

1. Create the directory `C:\nginx\conf\conf.d\` if it does not exist.

2. Copy the nginx config file from the repository:
   ```powershell
   Copy-Item "C:\Users\hp\OneDrive\Desktop\UFCL 12\mobile-api\nginx\ufcl-mobile-api.conf" `
             "C:\nginx\conf\conf.d\ufcl-mobile-api.conf"
   ```

3. Edit `C:\nginx\conf\conf.d\ufcl-mobile-api.conf` and replace `192.168.1.5` with the actual server IP if different.

4. Edit `C:\nginx\conf\nginx.conf` and add `include conf.d/*.conf;` inside the `http {}` block:
   ```nginx
   http {
       include       mime.types;
       default_type  application/octet-stream;
       # ... existing settings ...

       include conf.d/*.conf;   # ← add this line
   }
   ```

5. Test the configuration:
   ```powershell
   C:\nginx\nginx.exe -t
   ```
   Expected: `configuration file C:\nginx/conf/nginx.conf test is successful`

6. Start nginx:
   ```powershell
   C:\nginx\nginx.exe
   ```

---

### 15.4 Configure the Mobile API for Proxy Mode

Add these two variables to the root `.env` file on the server PC:

```env
# Bind Express to localhost only — nginx handles external traffic
API_BIND_HOST=127.0.0.1

# Tell Express to trust the X-Real-IP header from nginx
# so rate limiting counts per-device rather than per-proxy
API_BEHIND_PROXY=true
```

Restart the Mobile API Windows Service after changing `.env`:
```powershell
sc stop  "UFCL Mobile API"
sc start "UFCL Mobile API"
```

---

### 15.5 Update the App's API URL

In `.env.production` (and `.env.staging`), change the URL from HTTP to HTTPS:

```env
EXPO_PUBLIC_API_URL=https://192.168.1.5
```

Note: no port number — nginx listens on the standard HTTPS port 443.

Rebuild and redistribute the APK after this change (`scripts\04_build_release_apk.bat`).

---

### 15.6 Configure the Windows Firewall

Add a rule to allow HTTPS (port 443) and remove the old HTTP rule for port 3001:

```powershell
# Allow HTTPS from LAN
netsh advfirewall firewall add rule `
  name="UFCL Mobile API HTTPS" `
  dir=in action=allow protocol=TCP localport=443

# Remove direct port 3001 access — nginx now handles all external traffic
netsh advfirewall firewall delete rule name="UFCL Mobile API"
```

Run both commands in PowerShell **as Administrator**.

---

### 15.7 Run nginx as a Windows Service (Recommended)

So nginx starts automatically with Windows:

```powershell
# Install NSSM (Non-Sucking Service Manager)
choco install nssm

# Create a Windows service for nginx
nssm install nginx C:\nginx\nginx.exe
nssm set nginx AppDirectory C:\nginx
sc start nginx
```

To stop or restart nginx:
```powershell
sc stop nginx
C:\nginx\nginx.exe -s reload   # reload config without stopping
```

---

### 15.8 Verify the Setup

From a phone that has the CA root installed:

1. Open Chrome → type `https://192.168.1.5/health` → should show `{"ok":true,...}` with a padlock icon.
2. Open the UFCL Mobile App → Login should succeed over HTTPS.
3. On the server, verify Express is not directly reachable:
   ```powershell
   curl http://192.168.1.5:3001/api/health   # should time out or be refused
   curl https://192.168.1.5/api/health       # should return {"ok":true,...}
   ```

---

### 15.9 HTTP-to-HTTPS Redirection

The nginx config (§15.3) already includes the redirect block:

```nginx
server {
    listen 80;
    server_name 192.168.1.5;
    location / { return 301 https://$host$request_uri; }
}
```

Any old app builds that still use `http://` will be redirected automatically. However, React Native on Android blocks HTTP redirects to HTTPS by default — update the APK with the `https://` URL (§15.5) before distributing.

---

### 15.10 Maintenance Checklist Additions

Add to the **Monthly IT Checks** list (Section 13):

- [ ] nginx service is running: `sc query nginx`
- [ ] HTTPS health check returns OK: `curl https://192.168.1.5/health`
- [ ] nginx config test passes: `C:\nginx\nginx.exe -t`
- [ ] Certificate expiry: mkcert certificates are valid for 2 years — check expiry annually with `certutil -dump C:\nginx\certs\192.168.1.5.pem | findstr "NotAfter"`
