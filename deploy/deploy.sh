#!/bin/bash
set -euo pipefail

# =============================================================
# pneuma-pos — Local Build (WSL Ubuntu-24.04) + VPS Deploy
#
# Run this script from WSL Ubuntu-24.04:
#   bash deploy/deploy.sh
#
# Requirements:
#   LOCAL  : WSL Ubuntu-24.04, rsync, ssh
#   VPS    : php, composer, nginx, php-fpm, mysql (already running)
#            VPS_USER must be root OR have passwordless sudo
#   NO Node.js needed on the VPS.
# =============================================================

# ----------------------------------------------------------------
# Load environment variables from deploy.env
# ----------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

ENV_FILE="$SCRIPT_DIR/deploy.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found."
  echo "  Copy deploy.env.example to deploy.env and fill in your values."
  exit 1
fi
# Restrict permissions on the secrets file. Best-effort: on a real POSIX
# filesystem this persists; on WSL DrvFs it applies to the current mount.
chmod 600 "$ENV_FILE" 2>/dev/null || true
ENV_MODE="$(stat -c %a "$ENV_FILE" 2>/dev/null || stat -f %Lp "$ENV_FILE" 2>/dev/null || echo "?")"
if [ "$ENV_MODE" != "600" ] && [ "$ENV_MODE" != "?" ]; then
  echo "WARNING: $ENV_FILE has mode $ENV_MODE (expected 600)."
  echo "  On multi-user hosts this file should not be world-readable."
fi
# shellcheck source=deploy.env
source "$ENV_FILE"

# Defensive: strip trailing \r from every variable we care about, in case
# deploy.env was saved with Windows (CRLF) line endings. A trailing \r in
# DB_PASSWORD silently breaks mysqldump auth ("Access denied").
for var in VPS_HOST VPS_USER VPS_PORT DB_HOST DB_DATABASE DB_USERNAME DB_PASSWORD \
           APP_DIR DOMAIN DOMAIN_WWW VPS_SUDO SSH_STRICT_HOST_KEY_CHECKING \
           ADMIN_EMAIL ADMIN_INITIAL_PASSWORD; do
  if [ -n "${!var:-}" ]; then
    printf -v "$var" '%s' "${!var%$'\r'}"
  fi
done

# Validate required variables
for var in VPS_HOST VPS_USER DB_DATABASE DB_USERNAME DB_PASSWORD APP_DIR DOMAIN DOMAIN_WWW; do
  if [ -z "${!var:-}" ]; then
    echo "ERROR: $var is not set in deploy.env"
    exit 1
  fi
done

VPS_PORT="${VPS_PORT:-22}"
VPS_SUDO="${VPS_SUDO:-}"

DIST_DIR="$PROJECT_ROOT/front/dist/pneuma-pos/browser"
BACKUP_DIR="$APP_DIR/backups"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
# Host-key checking: default to accept-new (TOFU on first deploy). To harden
# after the first successful deploy, populate ~/.ssh/known_hosts out of band
# with `ssh-keyscan -p $VPS_PORT $VPS_HOST >> ~/.ssh/known_hosts` then set
# SSH_STRICT_HOST_KEY_CHECKING=yes in deploy.env.
SSH_STRICT_HOST_KEY_CHECKING="${SSH_STRICT_HOST_KEY_CHECKING:-accept-new}"
SSH_OPTS="-p $VPS_PORT -o StrictHostKeyChecking=$SSH_STRICT_HOST_KEY_CHECKING -o BatchMode=yes"

echo "============================================================"
echo "  pneuma-pos — Local Build + VPS Deploy"
echo "  VPS  : $VPS_USER@$VPS_HOST:$APP_DIR"
echo "  Build: $DIST_DIR"
echo "============================================================"
echo ""

# ----------------------------------------------------------
# STEP 1 — Ensure Node.js & npm (Ubuntu 24.04 apt packages)
# ----------------------------------------------------------
echo "[1/7] Checking Node.js and npm..."

if ! command -v node &>/dev/null || ! command -v npm &>/dev/null; then
  echo "  Installing nodejs and npm via apt..."
  sudo apt-get update -qq
  sudo apt-get install -y nodejs npm
fi

echo "  node $(node -v) / npm $(npm -v)"

# ----------------------------------------------------------
# STEP 2 — Build Angular frontend locally
# ----------------------------------------------------------
echo ""
echo "[2/7] Building Angular frontend locally..."

cd "$PROJECT_ROOT/front"
echo "  → Cleaning previous build..."
rm -rf "$DIST_DIR" 2>/dev/null || sudo rm -rf "$DIST_DIR"
npm ci
npx ng build --configuration=production

if [ ! -d "$DIST_DIR" ]; then
  echo "ERROR: Build output not found at $DIST_DIR"
  echo "  Check the outputPath in angular.json."
  exit 1
fi

echo "  ✓ Angular build complete → $DIST_DIR"

# ----------------------------------------------------------
# STEP 3 — Backup source files and database on VPS
# ----------------------------------------------------------
echo ""
echo "[3/7] Creating backup on VPS..."

ssh $SSH_OPTS "$VPS_USER@$VPS_HOST" bash << BACKUP_EOF
set -euo pipefail

BACKUP_DIR="$BACKUP_DIR/$TIMESTAMP"
mkdir -p "\$BACKUP_DIR"

# ── Backup database ─────────────────────────────────────────
echo "  → Backing up database..."

DUMP_CMD=\$(command -v mariadb-dump 2>/dev/null || command -v mysqldump)
\$DUMP_CMD --user='$DB_USERNAME' --password='$DB_PASSWORD' --host='$DB_HOST' \
  --single-transaction --routines --triggers \
  "$DB_DATABASE" | gzip > "\$BACKUP_DIR/db_${DB_DATABASE}.sql.gz"
echo "  ✓ Database backup: \$BACKUP_DIR/db_${DB_DATABASE}.sql.gz"

# ── Backup backend source ───────────────────────────────────
if [ -d "$APP_DIR/back" ]; then
  echo "  → Backing up backend source..."
  tar czf "\$BACKUP_DIR/back_source.tar.gz" \
    --exclude="back/vendor" \
    --exclude="back/storage/logs/*.log" \
    --exclude="back/storage/framework/cache/data/*" \
    --exclude="back/storage/framework/views/*" \
    -C "$APP_DIR" back
  echo "  ✓ Backend backup: \$BACKUP_DIR/back_source.tar.gz"
fi

# ── Backup frontend dist ────────────────────────────────────
if [ -d "$APP_DIR/front-dist" ]; then
  echo "  → Backing up frontend dist..."
  tar czf "\$BACKUP_DIR/front_dist.tar.gz" -C "$APP_DIR" front-dist
  echo "  ✓ Frontend backup: \$BACKUP_DIR/front_dist.tar.gz"
fi

# ── All backups are kept ─────────────────────────────────────

echo "  ✓ Backup complete → $BACKUP_DIR/$TIMESTAMP"
BACKUP_EOF

# ----------------------------------------------------------
# STEP 4 — Transfer files to VPS
# ----------------------------------------------------------
echo ""
echo "[4/7] Transferring files to VPS..."

# Ensure remote directories exist
ssh $SSH_OPTS "$VPS_USER@$VPS_HOST" "mkdir -p $APP_DIR/back $APP_DIR/front-dist $APP_DIR/deploy/nginx"

# Backend source (no vendor/, no .env — both handled remotely)
# --delete removes stale files (renamed/deleted locally); excludes are immune to deletion.
echo "  → backend source..."
rsync -az --delete \
  -e "ssh -p $VPS_PORT" \
  --exclude=vendor/ \
  --exclude=.env \
  --exclude=.git/ \
  --exclude='storage/app/' \
  --exclude='storage/logs/' \
  --exclude='bootstrap/cache/' \
  "$PROJECT_ROOT/back/" \
  "$VPS_USER@$VPS_HOST:$APP_DIR/back/"

# Nginx virtual host config
echo "  → nginx config..."
rsync -az \
  -e "ssh -p $VPS_PORT" \
  "$PROJECT_ROOT/deploy/nginx/" \
  "$VPS_USER@$VPS_HOST:$APP_DIR/deploy/nginx/"

# Frontend build output (--delete removes stale files from previous builds)
echo "  → frontend dist..."
rsync -az --delete \
  -e "ssh -p $VPS_PORT" \
  "$DIST_DIR/" \
  "$VPS_USER@$VPS_HOST:$APP_DIR/front-dist/"

echo "  ✓ Transfer complete"

# ----------------------------------------------------------
# STEP 5 — Remote VPS configuration (via SSH)
# ----------------------------------------------------------
echo ""
echo "[5/7] Configuring VPS (remote)..."

# NOTE: Variables below are intentionally expanded by the LOCAL shell
# before being sent over SSH (outer heredoc is unquoted).
# Remote-only variables are escaped with \$.

ssh $SSH_OPTS "$VPS_USER@$VPS_HOST" bash << EOF
set -euo pipefail

# ── Pre-flight ───────────────────────────────────────────────
for cmd in php composer nginx; do
  if ! command -v \$cmd &>/dev/null; then
    echo "ERROR: '\$cmd' not found on the VPS. Install it first."
    exit 1
  fi
done

PHP_FPM_SOCK=\$(find /run/php/ /var/run/php/ -name "*.sock" 2>/dev/null | head -1 || true)
if [ -z "\$PHP_FPM_SOCK" ]; then
  echo "ERROR: PHP-FPM socket not found. Is php-fpm running?"
  exit 1
fi
PHP_FPM_SERVICE=\$(systemctl list-units --type=service --state=running | grep "php.*fpm" | awk '{print \$1}' | head -1)
echo "  ✓ PHP-FPM: \$PHP_FPM_SERVICE (\$PHP_FPM_SOCK)"

# ── Write .env ───────────────────────────────────────────────
echo "  → Writing .env..."

# Preserve APP_KEY across deploys to avoid invalidating user sessions.
EXISTING_KEY=""
if [ -f "$APP_DIR/back/.env" ]; then
  EXISTING_KEY=\$(grep "^APP_KEY=" "$APP_DIR/back/.env" | cut -d= -f2- || true)
fi

cat > "$APP_DIR/back/.env" << ENVEOF
APP_NAME="PNEU.MA POS"
APP_ENV=production
APP_KEY=\$EXISTING_KEY
APP_DEBUG=false
APP_URL=https://$DOMAIN_WWW

APP_LOCALE=fr
APP_FALLBACK_LOCALE=fr

BCRYPT_ROUNDS=12

LOG_CHANNEL=stack
LOG_STACK=single
LOG_LEVEL=warning

DB_CONNECTION=mysql
DB_HOST=$DB_HOST
DB_PORT=3306
DB_DATABASE=$DB_DATABASE
DB_USERNAME=$DB_USERNAME
DB_PASSWORD="$DB_PASSWORD"

SESSION_DRIVER=file
SESSION_LIFETIME=120

FILESYSTEM_DISK=local
QUEUE_CONNECTION=sync
CACHE_STORE=file

ADMIN_EMAIL=${ADMIN_EMAIL:-admin@pneuma.pos}
ADMIN_INITIAL_PASSWORD=${ADMIN_INITIAL_PASSWORD:-}
ENVEOF

# ── Composer ─────────────────────────────────────────────────
echo "  → Installing Composer dependencies..."
cd "$APP_DIR/back"
composer install --no-dev --optimize-autoloader --no-interaction --quiet

# ── APP_KEY (only on first deploy when .env had no key) ──────
if [ -z "\$EXISTING_KEY" ]; then
  echo "  → Generating APP_KEY (first deploy)..."
  php artisan key:generate --force
fi

# ── Migrations ───────────────────────────────────────────────
echo "  → Running migrations..."
php artisan migrate --force

echo "  → Seeding roles & permissions..."
php artisan db:seed --class=RolesAndPermissionsSeeder --force

echo "  → Seeding cities..."
php artisan db:seed --class=CitiesSeeder --force

# ── Laravel cache ─────────────────────────────────────────────
echo "  → Caching config / routes / views..."
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan storage:link 2>/dev/null || true

# ── File permissions ─────────────────────────────────────────
echo "  → Setting permissions..."
$VPS_SUDO chown -R www-data:www-data "$APP_DIR/back" "$APP_DIR/front-dist"
$VPS_SUDO chmod -R 755 "$APP_DIR/back" "$APP_DIR/front-dist"
$VPS_SUDO chmod -R 775 "$APP_DIR/back/storage" "$APP_DIR/back/bootstrap/cache"

# ── Cron scheduler (drives Schedule::command(...) entries, e.g. kpi:snapshot) ──
# Installed as a /etc/cron.d drop-in (not via "crontab -l | grep -v | crontab -")
# because that merge pattern breaks under "set -e": when www-data has no existing
# crontab, "crontab -l" and the following "grep -v" both exit non-zero on empty
# input, which aborts the pipeline under pipefail before the new line is ever
# written — so the scheduler silently never got installed and kpi:snapshot never
# ran, leaving /kpi-history permanently empty.
echo "  → Configuring Laravel scheduler cron (/etc/cron.d/pneuma-kpi)..."
PHP_BIN=\$(command -v php)
$VPS_SUDO tee /etc/cron.d/pneuma-kpi > /dev/null << CRONEOF
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
* * * * * www-data cd $APP_DIR/back && \$PHP_BIN artisan schedule:run >> $APP_DIR/back/storage/logs/scheduler.log 2>&1
CRONEOF
$VPS_SUDO chmod 0644 /etc/cron.d/pneuma-kpi
$VPS_SUDO systemctl enable --now cron 2>/dev/null || $VPS_SUDO service cron start || true
echo "  ✓ Scheduler cron installed (runs every minute as www-data)"

# Create an initial KPI snapshot immediately so /kpi-history isn't empty until
# the next scheduled run (kpi:snapshot captures yesterday's KPIs by default).
echo "  → Creating an initial KPI snapshot..."
$VPS_SUDO -u www-data \$PHP_BIN "$APP_DIR/back/artisan" kpi:snapshot || true

# ── Nginx ─────────────────────────────────────────────────────
echo "  → Configuring Nginx..."
NGINX_SRC="$APP_DIR/deploy/nginx/quel-pneu.ma.conf"
NGINX_DEST="/etc/nginx/sites-available/quel-pneu.ma.conf"

if [ -f "\$NGINX_DEST" ]; then
  echo "  ✓ Nginx config already exists (keeping SSL config intact)"
else
  if [ ! -f "\$NGINX_SRC" ]; then
    echo "WARNING: \$NGINX_SRC not found — skipping Nginx setup."
  else
    $VPS_SUDO cp "\$NGINX_SRC" "\$NGINX_DEST"
    $VPS_SUDO ln -sf "\$NGINX_DEST" /etc/nginx/sites-enabled/quel-pneu.ma.conf
    $VPS_SUDO rm -f /etc/nginx/sites-enabled/default
    $VPS_SUDO nginx -t
    $VPS_SUDO systemctl reload nginx
    echo "  ✓ Nginx configured and reloaded"
  fi
fi

# ── Restart PHP-FPM ──────────────────────────────────────────
$VPS_SUDO systemctl restart "\$PHP_FPM_SERVICE"
echo "  ✓ PHP-FPM restarted"

EOF

# ----------------------------------------------------------
# STEP 6 — Verify deployment
# ----------------------------------------------------------
echo ""
echo "[6/7] Verifying deployment..."

ssh $SSH_OPTS "$VPS_USER@$VPS_HOST" bash << VERIFY_EOF
set -euo pipefail

# Quick health check — API responds
HTTP_CODE=\$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN_WWW/api/login" -X POST -H "Content-Type: application/json" -d '{}' 2>/dev/null || echo "000")
if [ "\$HTTP_CODE" = "000" ]; then
  echo "  ⚠ Could not reach https://$DOMAIN_WWW/api/login"
elif [ "\$HTTP_CODE" -ge 500 ]; then
  echo "  ⚠ API returned HTTP \$HTTP_CODE — check logs"
else
  echo "  ✓ API responding (HTTP \$HTTP_CODE)"
fi

# KPI history scheduler — see the cron.d comment in the deploy step for why
# this used to silently fail to install.
if [ -f /etc/cron.d/pneuma-kpi ]; then
  echo "  ✓ Scheduler cron present (/etc/cron.d/pneuma-kpi)"
else
  echo "  ⚠ /etc/cron.d/pneuma-kpi missing — KPI history will stay empty"
fi
if systemctl is-active --quiet cron; then
  echo "  ✓ cron service active"
else
  echo "  ⚠ cron service not active — KPI history will stay empty"
fi
VERIFY_EOF

# ----------------------------------------------------------
# STEP 7 — Summary
# ----------------------------------------------------------
echo ""
echo "[7/7] Done."
echo ""
echo "  SSL (first time only) — run on the VPS:"
echo "    certbot --nginx -d $DOMAIN -d $DOMAIN_WWW \\"
echo "      --email YOUR_EMAIL --agree-tos --non-interactive --redirect"
echo ""
echo "============================================================"
echo "  ✓ Deployment complete!"
echo "  Site     : https://$DOMAIN_WWW"
echo "  Backend  : $APP_DIR/back/"
echo "  Frontend : $APP_DIR/front-dist/"
echo "  Backup   : $BACKUP_DIR/$TIMESTAMP/"
echo ""
echo "  Useful commands (run on VPS):"
echo "    tail -f $APP_DIR/back/storage/logs/laravel.log"
echo "    tail -f /var/log/nginx/error.log"
echo ""
echo "  To rollback (run on VPS):"
echo "    # Restore database (drop + recreate to remove any new tables):"
echo "    mysql -u $DB_USERNAME -p$DB_PASSWORD -h $DB_HOST -e 'DROP DATABASE \`$DB_DATABASE\`; CREATE DATABASE \`$DB_DATABASE\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;'"
echo "    gunzip < $BACKUP_DIR/$TIMESTAMP/db_${DB_DATABASE}.sql.gz | mysql -u $DB_USERNAME -p$DB_PASSWORD -h $DB_HOST $DB_DATABASE"
echo "    # Restore backend source:"
echo "    tar xzf $BACKUP_DIR/$TIMESTAMP/back_source.tar.gz -C $APP_DIR"
echo "    # Restore frontend:"
echo "    tar xzf $BACKUP_DIR/$TIMESTAMP/front_dist.tar.gz -C $APP_DIR"
echo "============================================================"
