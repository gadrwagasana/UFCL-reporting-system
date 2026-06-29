#!/usr/bin/env bash
# UFCL — Generate self-signed TLS certificate for LAN use
# ─────────────────────────────────────────────────────────────────────────────
# Usage: sudo bash tools/ssl-setup.sh
#
# Generates a 10-year self-signed certificate for 192.168.1.5.
# Because Let's Encrypt requires a public domain, self-signed is the right
# choice for a private LAN.  Install server.crt on each Android device once
# (Settings → Security → Install Certificate) to suppress browser warnings.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SERVER_IP="192.168.1.5"
CERT_DIR="/etc/ssl/ufcl"
DAYS=3650   # 10 years

echo "[ssl] Creating certificate directory: $CERT_DIR"
mkdir -p "$CERT_DIR"

echo "[ssl] Generating 2048-bit RSA private key and self-signed certificate..."
openssl req -x509 -nodes \
  -days    "$DAYS" \
  -newkey  rsa:2048 \
  -keyout  "$CERT_DIR/server.key" \
  -out     "$CERT_DIR/server.crt" \
  -subj    "/C=ZW/ST=Harare/L=Harare/O=UFCL/OU=IT/CN=${SERVER_IP}" \
  -addext  "subjectAltName=IP:${SERVER_IP}"

chmod 600 "$CERT_DIR/server.key"
chmod 644 "$CERT_DIR/server.crt"

echo ""
echo "[ssl] Certificate written to:"
echo "        Cert : $CERT_DIR/server.crt"
echo "        Key  : $CERT_DIR/server.key"
echo ""
echo "[ssl] Certificate details:"
openssl x509 -in "$CERT_DIR/server.crt" -noout -subject -dates
echo ""
echo "[ssl] Next steps:"
echo "  1. Reload nginx:   sudo nginx -t && sudo systemctl reload nginx"
echo ""
echo "  2. Install server.crt on each Android device:"
echo "     a. Copy $CERT_DIR/server.crt to the device (USB or shared folder)"
echo "     b. Settings → Security → Encryption & credentials → Install a certificate"
echo "     c. Choose 'CA certificate' and select the file"
echo "     d. Accept the prompt — the device now trusts UFCL HTTPS"
echo ""
echo "  3. Update the mobile app API URL to https://192.168.1.5"
echo "     Set EXPO_PUBLIC_API_URL=https://192.168.1.5 in .env.production"
