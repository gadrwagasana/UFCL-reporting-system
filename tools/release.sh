#!/usr/bin/env bash
# UFCL Mobile — Release Preparation Script
# Usage: bash tools/release.sh 1.0.0
# Creates archive/v<version>/ with all release artefacts.
# Does NOT push to GitHub — run the git commands printed at the end manually.

set -euo pipefail

VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
  echo "ERROR: Version required.  Usage: bash tools/release.sh 1.0.0" >&2
  exit 1
fi

# Basic semver check
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "ERROR: Version must be X.Y.Z (e.g. 1.0.0), got: $VERSION" >&2
  exit 1
fi

TAG="v${VERSION}"
RELEASE_DIR="archive/${TAG}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

echo ""
echo "══════════════════════════════════════════════════════"
echo "  UFCL Mobile — Release ${TAG}"
echo "  Root:    ${REPO_ROOT}"
echo "  Archive: ${RELEASE_DIR}"
echo "══════════════════════════════════════════════════════"
echo ""

cd "$REPO_ROOT"

# ── 1. Ensure working tree is clean ───────────────────────────────────────────
echo "[1/7] Checking working tree..."
if [[ -n "$(git status --porcelain)" ]]; then
  echo "WARNING: Uncommitted changes detected."
  git status --short
  read -r -p "Continue anyway? (y/N) " CONFIRM
  [[ "$CONFIRM" == "y" || "$CONFIRM" == "Y" ]] || { echo "Aborted."; exit 1; }
fi
echo "      OK"

# ── 2. Create archive directory ───────────────────────────────────────────────
echo "[2/7] Creating archive directory..."
mkdir -p "${RELEASE_DIR}"/{source,db,apk,docs}
echo "      Created: ${RELEASE_DIR}/"

# ── 3. Source archive ─────────────────────────────────────────────────────────
echo "[3/7] Archiving source code..."
SOURCE_ARCHIVE="${RELEASE_DIR}/source/ufcl-mobile-${TAG}-source.tar.gz"
git archive --format=tar.gz --prefix="ufcl-mobile-${TAG}/" HEAD \
  -o "${SOURCE_ARCHIVE}" 2>/dev/null || {
    # Fallback: tar excluding build artefacts
    tar -czf "${SOURCE_ARCHIVE}" \
      --exclude='.git' \
      --exclude='node_modules' \
      --exclude='mobile/node_modules' \
      --exclude='mobile-api/node_modules' \
      --exclude='mobile/android/.gradle' \
      --exclude='mobile/android/app/build' \
      --exclude='archive' \
      --exclude='outputs' \
      -C "${REPO_ROOT}" .
  }
echo "      Source:  ${SOURCE_ARCHIVE}"
ls -lh "${SOURCE_ARCHIVE}"

# ── 4. Database backup ────────────────────────────────────────────────────────
echo "[4/7] Creating database backup..."
if command -v pg_dump &>/dev/null && [[ -f "${REPO_ROOT}/.env" ]]; then
  set -a; source "${REPO_ROOT}/.env"; set +a
  DB_ARCHIVE="${RELEASE_DIR}/db/ufcl-production-${TAG}-${TIMESTAMP}.sql.gz"
  PGPASSWORD="${PGPASSWORD:-}" pg_dump \
    -h "${PGHOST:-localhost}" \
    -p "${PGPORT:-5432}" \
    -U "${PGUSER:-postgres}" \
    -d "${PGDATABASE:-ufcl_production}" \
    --no-owner --no-acl \
    | gzip > "${DB_ARCHIVE}"
  echo "      DB dump: ${DB_ARCHIVE}"
  ls -lh "${DB_ARCHIVE}"
else
  echo "      SKIPPED — pg_dump not found or .env missing."
  echo "      Run this manually on the production server:"
  echo "        PGPASSWORD='...' pg_dump -h localhost -U postgres ufcl_production | gzip > ufcl-${TAG}-db.sql.gz"
  touch "${RELEASE_DIR}/db/COPY_DB_BACKUP_HERE.txt"
fi

# ── 5. APK ────────────────────────────────────────────────────────────────────
echo "[5/7] Locating APK..."
APK_SEARCH_PATHS=(
  "mobile/android/app/build/outputs/apk/release/app-release.apk"
  "outputs/app-release.apk"
  "mobile/app-release.apk"
)
APK_FOUND=""
for p in "${APK_SEARCH_PATHS[@]}"; do
  if [[ -f "$p" ]]; then APK_FOUND="$p"; break; fi
done

if [[ -n "$APK_FOUND" ]]; then
  cp "${APK_FOUND}" "${RELEASE_DIR}/apk/UFCL-mobile-${TAG}.apk"
  echo "      APK:     ${RELEASE_DIR}/apk/UFCL-mobile-${TAG}.apk"
  ls -lh "${RELEASE_DIR}/apk/UFCL-mobile-${TAG}.apk"
else
  echo "      SKIPPED — APK not found in standard locations."
  echo "      Build with: cd mobile/android && ./gradlew assembleRelease"
  echo "      Then copy app-release.apk to ${RELEASE_DIR}/apk/"
  touch "${RELEASE_DIR}/apk/COPY_APK_HERE.txt"
fi

# ── 6. Docs ───────────────────────────────────────────────────────────────────
echo "[6/7] Copying documentation..."
for doc in \
  "RELEASE_NOTES_v${VERSION}.md" \
  "UFCL_UAT_PHASE13.html" \
  "UFCL_UAT_GUIDE.html" \
  "UFCL_USER_MANUAL.html" \
  "UFCL_ADMIN_MANUAL.html" \
  "LAUNCH_CHECKLIST.md" \
  "SERVER_MAINTENANCE.md"; do
  if [[ -f "${REPO_ROOT}/${doc}" ]]; then
    cp "${REPO_ROOT}/${doc}" "${RELEASE_DIR}/docs/"
    echo "      + ${doc}"
  else
    echo "      - MISSING: ${doc}"
  fi
done

# ── 7. Write manifest ─────────────────────────────────────────────────────────
echo "[7/7] Writing release manifest..."
COMMIT_SHA=$(git rev-parse HEAD)
cat > "${RELEASE_DIR}/MANIFEST.txt" << MANIFEST
UFCL Mobile Release ${TAG}
==========================
Date:       $(date -u +"%Y-%m-%d %H:%M:%S UTC")
Git commit: ${COMMIT_SHA}
Tag:        ${TAG}
Version:    ${VERSION}

Contents
--------
source/   — full source code archive (git archive)
db/       — database dump at release time
apk/      — signed production APK
docs/     — user manual, admin manual, UAT guide, release notes

Verification
------------
$(sha256sum "${SOURCE_ARCHIVE}" 2>/dev/null || echo "sha256 of source: (run sha256sum)")
$(sha256sum "${RELEASE_DIR}/apk/UFCL-mobile-${TAG}.apk" 2>/dev/null || echo "sha256 of APK: (copy APK first)")
MANIFEST

echo ""
echo "══════════════════════════════════════════════════════"
echo "  Archive ready: ${RELEASE_DIR}/"
echo ""
ls -lh "${RELEASE_DIR}/"
ls -lh "${RELEASE_DIR}/source/" 2>/dev/null
ls -lh "${RELEASE_DIR}/docs/"   2>/dev/null
echo ""
echo "  Next steps — run manually after reviewing the archive:"
echo ""
echo "    git tag -a ${TAG} -m \"UFCL Mobile ${TAG}\""
echo ""
echo "    # Then, when ready to push:"
echo "    git push origin master"
echo "    git push origin ${TAG}"
echo ""
echo "  GitHub release (after push):"
echo "    gh release create ${TAG} \\"
echo "      \"${RELEASE_DIR}/apk/UFCL-mobile-${TAG}.apk\" \\"
echo "      \"${RELEASE_DIR}/source/ufcl-mobile-${TAG}-source.tar.gz\" \\"
echo "      --title \"UFCL Mobile ${TAG}\" \\"
echo "      --notes-file \"RELEASE_NOTES_v${VERSION}.md\""
echo "══════════════════════════════════════════════════════"
