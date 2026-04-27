#!/bin/bash
set -euo pipefail

# =============================================================
# eas-pos — Secondary VPS deploy (no web server config)
#
# Run this script from WSL Ubuntu-24.04:
#   bash deploy/deploy2.sh               # full: build + deploy
#   bash deploy/deploy2.sh --skip-build  # deploy existing build as-is
#
# Differences vs deploy.sh:
#   - No Nginx / Apache configuration
#   - No PHP-FPM restart
#   - Only: backup → build → rsync → composer → migrate → cache
#
# Requirements:
#   LOCAL : WSL Ubuntu-24.04, rsync, ssh, node/npm (node/npm skipped
#           with --skip-build)
#   VPS   : php, composer, mysql client, a web server already
#           configured (by you) pointing to $APP_DIR/back/public
#           and $APP_DIR/front-dist
# =============================================================

SKIP_BUILD=0
for arg in "$@"; do
  case "$arg" in
    --skip-build|-s) SKIP_BUILD=1 ;;
    -h|--help)
      sed -n '4,22p' "$0"
      exit 0
      ;;
    *)
      echo "ERROR: unknown argument: $arg"
      echo "Usage: $0 [--skip-build]"
      exit 1
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

ENV_FILE="$SCRIPT_DIR/deploy2.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found."
  echo "  Copy deploy2.env.example to deploy2.env and fill in your values."
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
# shellcheck source=deploy2.env
source "$ENV_FILE"

# Defensive: strip trailing \r from every variable we care about, in case
# deploy2.env was saved with Windows (CRLF) line endings. A trailing \r in
# DB_PASSWORD silently breaks mysqldump auth ("Access denied").
for var in VPS_HOST VPS_USER VPS_PORT DB_HOST DB_DATABASE DB_USERNAME DB_PASSWORD \
           APP_DIR APP_URL APP_NAME WWW_OWNER VPS_SUDO SSH_STRICT_HOST_KEY_CHECKING \
           ADMIN_EMAIL ADMIN_INITIAL_PASSWORD; do
  if [ -n "${!var:-}" ]; then
    printf -v "$var" '%s' "${!var%$'\r'}"
  fi
done

for var in VPS_HOST VPS_USER DB_DATABASE DB_USERNAME DB_PASSWORD APP_DIR APP_URL APP_NAME; do
  if [ -z "${!var:-}" ]; then
    echo "ERROR: $var is not set in deploy2.env"
    exit 1
  fi
done

VPS_PORT="${VPS_PORT:-22}"
VPS_SUDO="${VPS_SUDO:-}"
WWW_OWNER="${WWW_OWNER:-www-data:www-data}"

DIST_DIR="$PROJECT_ROOT/front/dist/eas-pos/browser"
BACKUP_DIR="$APP_DIR/backups"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
# Host-key checking: default to accept-new (TOFU on first deploy). To harden
# after the first successful deploy, populate ~/.ssh/known_hosts out of band
# with `ssh-keyscan -p $VPS_PORT $VPS_HOST >> ~/.ssh/known_hosts` then set
# SSH_STRICT_HOST_KEY_CHECKING=yes in deploy2.env.
SSH_STRICT_HOST_KEY_CHECKING="${SSH_STRICT_HOST_KEY_CHECKING:-accept-new}"
SSH_OPTS="-p $VPS_PORT -o StrictHostKeyChecking=$SSH_STRICT_HOST_KEY_CHECKING -o BatchMode=yes"

echo "============================================================"
echo "  eas-pos — Secondary VPS deploy"
echo "  VPS  : $VPS_USER@$VPS_HOST:$APP_DIR"
echo "  URL  : $APP_URL"
echo "  Build: $DIST_DIR"
echo "============================================================"
echo ""

# ----------------------------------------------------------
# STEP 1 — Ensure Node.js & npm (skipped with --skip-build)
# ----------------------------------------------------------
if [ "$SKIP_BUILD" -eq 0 ]; then
  echo "[1/5] Checking Node.js and npm..."

  if ! command -v node &>/dev/null || ! command -v npm &>/dev/null; then
    echo "  Installing nodejs and npm via apt..."
    sudo apt-get update -qq
    sudo apt-get install -y nodejs npm
  fi

  echo "  node $(node -v) / npm $(npm -v)"
else
  echo "[1/5] Skipping Node.js check (--skip-build)"
fi

# ----------------------------------------------------------
# STEP 2 — Build Angular frontend locally (or use existing build)
# ----------------------------------------------------------
echo ""
if [ "$SKIP_BUILD" -eq 0 ]; then
  echo "[2/5] Building Angular frontend locally..."

  cd "$PROJECT_ROOT/front"
  echo "  → Cleaning previous build..."
  rm -rf "$(dirname "$DIST_DIR")" 2>/dev/null || sudo rm -rf "$(dirname "$DIST_DIR")"
  npm ci
  # Pass --output-path so this build goes to dist/eas-pos instead of the
  # angular.json default (dist/pneuma-pos) used by deploy.sh.
  npx ng build --configuration=production-eas --output-path="$(dirname "$DIST_DIR")"

  if [ ! -d "$DIST_DIR" ]; then
    echo "ERROR: Build output not found at $DIST_DIR"
    exit 1
  fi

  echo "  ✓ Angular build complete → $DIST_DIR"
else
  echo "[2/5] Skipping Angular build (--skip-build) — using existing build"
  if [ ! -d "$DIST_DIR" ]; then
    echo "ERROR: Existing build not found at $DIST_DIR"
    echo "  Run without --skip-build first to produce a build, or"
    echo "  verify DIST_DIR points to an already-built folder."
    exit 1
  fi
  echo "  ✓ Using existing build → $DIST_DIR"
fi

# ----------------------------------------------------------
# STEP 3 — Backup source files and database on VPS
# ----------------------------------------------------------
echo ""
echo "[3/5] Creating backup on VPS..."

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

# ── Cleanup old backups (keep last 5) ───────────────────────
echo "  → Cleaning up old backups (keeping last 5)..."
cd "$BACKUP_DIR"
ls -1dt */ 2>/dev/null | tail -n +6 | xargs rm -rf 2>/dev/null || true

echo "  ✓ Backup complete → $BACKUP_DIR/$TIMESTAMP"
BACKUP_EOF

# ----------------------------------------------------------
# STEP 4 — Transfer files to VPS
# ----------------------------------------------------------
echo ""
echo "[4/5] Transferring files to VPS..."

ssh $SSH_OPTS "$VPS_USER@$VPS_HOST" "mkdir -p $APP_DIR/back $APP_DIR/front-dist"

# Backend source (no vendor/, no .env — both handled remotely)
echo "  → backend source..."
rsync -az \
  -e "ssh -p $VPS_PORT" \
  --exclude=vendor/ \
  --exclude=.env \
  --exclude=.git/ \
  --exclude='storage/logs/*.log' \
  --exclude='bootstrap/cache/' \
  "$PROJECT_ROOT/back/" \
  "$VPS_USER@$VPS_HOST:$APP_DIR/back/"

# Frontend build output (--delete removes stale files from previous builds)
echo "  → frontend dist..."
rsync -az --delete \
  -e "ssh -p $VPS_PORT" \
  "$DIST_DIR/" \
  "$VPS_USER@$VPS_HOST:$APP_DIR/front-dist/"

echo "  ✓ Transfer complete"

# ----------------------------------------------------------
# STEP 5 — Remote Laravel install + migrations
# ----------------------------------------------------------
echo ""
echo "[5/5] Installing Laravel dependencies and running migrations..."

# NOTE: Outer heredoc is unquoted so local $VARS are expanded before send;
# remote-only variables use \$.

ssh $SSH_OPTS "$VPS_USER@$VPS_HOST" bash << EOF
set -euo pipefail

for cmd in php composer; do
  if ! command -v \$cmd &>/dev/null; then
    echo "ERROR: '\$cmd' not found on the VPS. Install it first."
    exit 1
  fi
done

# ── Write .env ───────────────────────────────────────────────
echo "  → Writing .env..."

# Preserve APP_KEY across deploys to avoid invalidating user sessions.
EXISTING_KEY=""
if [ -f "$APP_DIR/back/.env" ]; then
  EXISTING_KEY=\$(grep "^APP_KEY=" "$APP_DIR/back/.env" | cut -d= -f2- || true)
fi

cat > "$APP_DIR/back/.env" << ENVEOF
APP_NAME="$APP_NAME"
APP_ENV=production
APP_KEY=\$EXISTING_KEY
APP_DEBUG=false
APP_URL=$APP_URL

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

# ── APP_KEY (only on first deploy) ───────────────────────────
if [ -z "\$EXISTING_KEY" ]; then
  echo "  → Generating APP_KEY (first deploy)..."
  php artisan key:generate --force
fi

# ── Migrations ───────────────────────────────────────────────
echo "  → Running migrations..."
php artisan migrate --force

echo "  → Seeding roles & permissions..."
php artisan db:seed --class=RolesAndPermissionsSeeder --force

# ── Laravel cache ─────────────────────────────────────────────
echo "  → Caching config / routes / views..."
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan storage:link 2>/dev/null || true

# ── File permissions ─────────────────────────────────────────
echo "  → Setting ownership ($WWW_OWNER) and permissions on $APP_DIR..."
$VPS_SUDO chown -R $WWW_OWNER "$APP_DIR"
$VPS_SUDO find "$APP_DIR" -type d -exec chmod 755 {} \;
$VPS_SUDO find "$APP_DIR" -type f -exec chmod 644 {} \;
$VPS_SUDO chmod -R 775 "$APP_DIR/back/storage" "$APP_DIR/back/bootstrap/cache"

EOF

# ----------------------------------------------------------
# Summary
# ----------------------------------------------------------
echo ""
echo "============================================================"
echo "  ✓ Deployment complete!"
echo "  URL      : $APP_URL"
echo "  Backend  : $APP_DIR/back/"
echo "  Frontend : $APP_DIR/front-dist/"
echo "  Backup   : $BACKUP_DIR/$TIMESTAMP/"
echo ""
echo "  Note: this script does NOT touch Nginx/Apache or PHP-FPM."
echo "  If PHP opcache is enabled, you may need to reload php-fpm"
echo "  manually so the new bytecode is picked up, e.g.:"
echo "    sudo systemctl reload php8.3-fpm"
echo ""
echo "  To rollback (run on VPS):"
echo "    # Restore database (drop + recreate to remove any new tables):"
echo "    mysql -u $DB_USERNAME -p$DB_PASSWORD -h $DB_HOST -e 'DROP DATABASE \`$DB_DATABASE\`; CREATE DATABASE \`$DB_DATABASE\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;'"
echo "    gunzip < $BACKUP_DIR/$TIMESTAMP/db_${DB_DATABASE}.sql.gz | mysql -u $DB_USERNAME -p$DB_PASSWORD -h $DB_HOST $DB_DATABASE"
echo "    tar xzf $BACKUP_DIR/$TIMESTAMP/back_source.tar.gz -C $APP_DIR"
echo "    tar xzf $BACKUP_DIR/$TIMESTAMP/front_dist.tar.gz  -C $APP_DIR"
echo "============================================================"
