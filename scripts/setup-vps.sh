#!/usr/bin/env bash
# Provision a fresh Ubuntu 22.04+ VPS for DBInterface.
#
# What it does:
#   - apt update + install (curl, git, ufw, nginx, optional mysql, optional certbot)
#   - configure ufw to allow only 22 / 80 / 443
#   - install Node.js 20 from NodeSource
#   - create a non-root deploy user
#   - clone the repo to /opt/dbinterface
#   - generate a strong SESSION_SECRET and write .env
#   - npm ci, build api + web
#   - install systemd unit and nginx site
#   - if DOMAIN is set, run certbot --nginx for Let's Encrypt
#
# Usage (as root or with sudo, on a fresh Ubuntu VPS):
#   curl -fsSL https://raw.githubusercontent.com/ssandeep2197/DBInterface/main/scripts/setup-vps.sh \
#     | sudo DOMAIN=dbi.example.com bash
#
# Or after cloning the repo manually:
#   sudo bash scripts/setup-vps.sh
#
# Env-var overrides (all optional):
#   DOMAIN          (default: empty -> HTTP-only, no certbot)
#   ADMIN_EMAIL     (default: empty -> certbot uses --register-unsafely-without-email)
#   INSTALL_MYSQL   (default: no)  yes|no
#   DEPLOY_USER     (default: dbi)
#   APP_DIR         (default: /opt/dbinterface)
#   REPO_URL        (default: https://github.com/ssandeep2197/DBInterface.git)
#   BRANCH          (default: main)
#   API_PORT        (default: 8082)
#   BLOCK_PRIVATE_HOSTS (default: true) — flip to false to allow connecting to
#                       MySQL on the same VPS (127.0.0.1).

set -euo pipefail

DOMAIN="${DOMAIN:-}"
ADMIN_EMAIL="${ADMIN_EMAIL:-}"
INSTALL_MYSQL="${INSTALL_MYSQL:-no}"
DEPLOY_USER="${DEPLOY_USER:-dbi}"
APP_DIR="${APP_DIR:-/opt/dbinterface}"
REPO_URL="${REPO_URL:-https://github.com/ssandeep2197/DBInterface.git}"
BRANCH="${BRANCH:-main}"
API_PORT="${API_PORT:-8082}"
BLOCK_PRIVATE_HOSTS="${BLOCK_PRIVATE_HOSTS:-true}"

if [[ "$EUID" -ne 0 ]]; then
  echo "ERROR: must run as root or via sudo." >&2
  exit 1
fi

if ! grep -qi ubuntu /etc/os-release; then
  echo "WARNING: this script targets Ubuntu. Continuing anyway..." >&2
fi

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

# ─── 1. base packages ──────────────────────────────────────────────────────────
log "updating apt and installing base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends \
  curl ca-certificates git ufw nginx build-essential

# ─── 2. firewall ──────────────────────────────────────────────────────────────
log "configuring ufw (allow 22, 80, 443)"
ufw allow OpenSSH || true
ufw allow 80/tcp || true
ufw allow 443/tcp || true
yes | ufw enable || true

# ─── 3. Node.js 24 LTS ────────────────────────────────────────────────────────
if ! command -v node >/dev/null 2>&1 || ! node -v | grep -qE '^v24\.'; then
  log "installing Node.js 24 LTS from NodeSource"
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
else
  log "Node.js already installed: $(node -v)"
fi

# ─── 4. optional MySQL ────────────────────────────────────────────────────────
if [[ "$INSTALL_MYSQL" == "yes" ]]; then
  log "installing MySQL server"
  apt-get install -y mysql-server
  systemctl enable --now mysql
  echo "(set a root password with: sudo mysql_secure_installation)"
fi

# ─── 5. deploy user ───────────────────────────────────────────────────────────
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  log "creating deploy user '$DEPLOY_USER'"
  useradd --system --create-home --shell /bin/bash "$DEPLOY_USER"
fi

# Allow the deploy user to restart the api + reload nginx without a password.
SUDOERS_FILE="/etc/sudoers.d/dbinterface-$DEPLOY_USER"
cat >"$SUDOERS_FILE" <<EOF
$DEPLOY_USER ALL=(root) NOPASSWD: /bin/systemctl restart dbinterface-api, /bin/systemctl reload nginx, /usr/sbin/nginx -t
EOF
chmod 440 "$SUDOERS_FILE"

# ─── 6. clone or update repo ──────────────────────────────────────────────────
if [[ -d "$APP_DIR/.git" ]]; then
  log "pulling latest in $APP_DIR"
  sudo -u "$DEPLOY_USER" -H git -C "$APP_DIR" fetch --depth=1 origin "$BRANCH"
  sudo -u "$DEPLOY_USER" -H git -C "$APP_DIR" reset --hard "origin/$BRANCH"
else
  log "cloning $REPO_URL into $APP_DIR"
  mkdir -p "$APP_DIR"
  chown "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"
  sudo -u "$DEPLOY_USER" -H git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

# ─── 7. .env (preserve if it already exists) ──────────────────────────────────
ENV_FILE="$APP_DIR/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  log "generating .env (SESSION_SECRET via openssl)"
  SESSION_SECRET=$(openssl rand -hex 32)
  if [[ -n "$DOMAIN" ]]; then
    CORS_ORIGIN="https://$DOMAIN"
    FORCE_HTTPS=true
  else
    PUBLIC_IP=$(curl -fsSL https://api.ipify.org || echo "")
    CORS_ORIGIN="http://${PUBLIC_IP:-0.0.0.0}"
    FORCE_HTTPS=false
  fi
  cat >"$ENV_FILE" <<EOF
NODE_ENV=production
LOG_LEVEL=info
API_PORT=$API_PORT
SESSION_SECRET=$SESSION_SECRET
SESSION_MAX_AGE_MS=3600000
CORS_ORIGIN=$CORS_ORIGIN
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=300
BLOCK_PRIVATE_HOSTS=$BLOCK_PRIVATE_HOSTS
CROSS_SITE_COOKIES=false
FORCE_HTTPS=$FORCE_HTTPS
EOF
  chown "$DEPLOY_USER:$DEPLOY_USER" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
else
  log ".env already exists, leaving it alone"
fi

# ─── 8. install + build ───────────────────────────────────────────────────────
log "installing dependencies (this can take a minute)"
sudo -u "$DEPLOY_USER" -H bash -c "cd '$APP_DIR' && npm ci --no-audit --no-fund"

log "building api"
sudo -u "$DEPLOY_USER" -H bash -c "cd '$APP_DIR' && npx tsc -p apps/api/tsconfig.app.json && npx tsc-alias -p apps/api/tsconfig.app.json"

log "building web"
sudo -u "$DEPLOY_USER" -H bash -c "cd '$APP_DIR' && npx vite build --config apps/web/vite.config.mts"

# ─── 9. systemd unit ──────────────────────────────────────────────────────────
log "installing systemd unit"
sed \
  -e "s|__USER__|$DEPLOY_USER|g" \
  -e "s|__APP_DIR__|$APP_DIR|g" \
  "$APP_DIR/scripts/dbinterface-api.service.template" \
  >/etc/systemd/system/dbinterface-api.service

systemctl daemon-reload
systemctl enable dbinterface-api
systemctl restart dbinterface-api
sleep 2
systemctl --no-pager status dbinterface-api | head -12 || true

# ─── 10. nginx site ───────────────────────────────────────────────────────────
log "configuring nginx"
SERVER_NAME="${DOMAIN:-_}"
WEB_ROOT="$APP_DIR/dist/apps/web"
sed \
  -e "s|__SERVER_NAME__|$SERVER_NAME|g" \
  -e "s|__WEB_ROOT__|$WEB_ROOT|g" \
  -e "s|__API_PORT__|$API_PORT|g" \
  "$APP_DIR/scripts/nginx-dbinterface.conf.template" \
  >/etc/nginx/sites-available/dbinterface

ln -sf /etc/nginx/sites-available/dbinterface /etc/nginx/sites-enabled/dbinterface
rm -f /etc/nginx/sites-enabled/default

# Make sure nginx can read the static files
chmod o+x "$APP_DIR" || true
chmod -R o+rX "$WEB_ROOT" || true

nginx -t
systemctl reload nginx

# ─── 11. Let's Encrypt (only if DOMAIN supplied) ─────────────────────────────
if [[ -n "$DOMAIN" ]]; then
  log "installing certbot and requesting cert for $DOMAIN"
  apt-get install -y certbot python3-certbot-nginx
  CERTBOT_FLAGS=("--nginx" "-d" "$DOMAIN" "--non-interactive" "--agree-tos" "--redirect")
  if [[ -n "$ADMIN_EMAIL" ]]; then
    CERTBOT_FLAGS+=("-m" "$ADMIN_EMAIL")
  else
    CERTBOT_FLAGS+=("--register-unsafely-without-email")
  fi
  certbot "${CERTBOT_FLAGS[@]}" || {
    echo "WARNING: certbot failed. Site is up over HTTP; rerun: sudo certbot --nginx -d $DOMAIN" >&2
  }
fi

# ─── done ─────────────────────────────────────────────────────────────────────
PUBLIC_IP=$(curl -fsSL https://api.ipify.org 2>/dev/null || echo "<server-ip>")
URL=${DOMAIN:+https://$DOMAIN}
URL=${URL:-http://$PUBLIC_IP}

cat <<EOF

────────────────────────────────────────────────────────────────────────
✓ DBInterface is up at:   $URL
  api health:             $URL/health
  api docs:               $URL/api/docs

  Service:        sudo systemctl status dbinterface-api
  Logs:           sudo journalctl -u dbinterface-api -f
  Nginx logs:     sudo tail -f /var/log/nginx/access.log /var/log/nginx/error.log
  Update flow:    sudo -u $DEPLOY_USER $APP_DIR/scripts/deploy.sh

  Edit env:       sudo -u $DEPLOY_USER nano $APP_DIR/.env
                  then: sudo systemctl restart dbinterface-api
────────────────────────────────────────────────────────────────────────
EOF
