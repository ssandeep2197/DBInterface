#!/usr/bin/env bash
# Pull latest, install, build, and restart the api. Run on the VPS as the
# `dbi` deploy user (or whatever DEPLOY_USER setup-vps.sh used).
#
# Usage on the VPS:
#   sudo -u dbi /opt/dbinterface/scripts/deploy.sh

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/dbinterface}"
BRANCH="${BRANCH:-main}"

cd "$APP_DIR"

echo "==> pulling latest from $BRANCH"
git fetch --depth=1 origin "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "==> installing dependencies"
npm ci --no-audit --no-fund

echo "==> building api"
npx tsc -p apps/api/tsconfig.app.json
npx tsc-alias -p apps/api/tsconfig.app.json

echo "==> building web"
npx vite build --config apps/web/vite.config.mts

echo "==> restarting api"
sudo systemctl restart dbinterface-api

echo "==> reloading nginx"
sudo nginx -t && sudo systemctl reload nginx

echo "==> deploy complete"
sudo systemctl status dbinterface-api --no-pager | head -10
