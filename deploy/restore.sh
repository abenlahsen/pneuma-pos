#!/bin/bash
set -euo pipefail

# =============================================================
# pneuma-pos — Restore from backup
#
# Run this script from WSL Ubuntu-24.04:
#   bash deploy/restore.sh
#
# Lists available backups on the VPS and lets you choose which
# one to restore (database, backend source, frontend dist).
# =============================================================

# ----------------------------------------------------------------
# Load environment variables from deploy.env
# ----------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

ENV_FILE="$SCRIPT_DIR/deploy.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found."
  echo "  Copy deploy.env.example to deploy.env and fill in your values."
  exit 1
fi
# shellcheck source=deploy.env
source "$ENV_FILE"

for var in VPS_HOST VPS_USER DB_DATABASE DB_USERNAME DB_PASSWORD APP_DIR; do
  if [ -z "${!var:-}" ]; then
    echo "ERROR: $var is not set in deploy.env"
    exit 1
  fi
done

VPS_PORT="${VPS_PORT:-22}"
VPS_SUDO="${VPS_SUDO:-}"
BACKUP_DIR="$APP_DIR/backups"
SSH_STRICT_HOST_KEY_CHECKING="${SSH_STRICT_HOST_KEY_CHECKING:-accept-new}"
SSH_OPTS="-p $VPS_PORT -o StrictHostKeyChecking=$SSH_STRICT_HOST_KEY_CHECKING -o BatchMode=yes"

echo "============================================================"
echo "  pneuma-pos — Restore from backup"
echo "  VPS : $VPS_USER@$VPS_HOST"
echo "============================================================"
echo ""

# ----------------------------------------------------------
# STEP 1 — List available backups
# ----------------------------------------------------------
echo "Fetching available backups..."
echo ""

BACKUPS=$(ssh $SSH_OPTS "$VPS_USER@$VPS_HOST" bash << 'LISTEOF'
BACKUP_DIR="PLACEHOLDER_BACKUP_DIR"
if [ ! -d "$BACKUP_DIR" ]; then
  echo "NO_BACKUPS"
  exit 0
fi

cd "$BACKUP_DIR"
DIRS=$(ls -1dt */ 2>/dev/null | sed 's/\///')
if [ -z "$DIRS" ]; then
  echo "NO_BACKUPS"
  exit 0
fi

echo "$DIRS"
LISTEOF
)

# Replace placeholder with actual value
BACKUPS=$(ssh $SSH_OPTS "$VPS_USER@$VPS_HOST" bash << EOF
if [ ! -d "$BACKUP_DIR" ]; then
  echo "NO_BACKUPS"
  exit 0
fi

cd "$BACKUP_DIR"
DIRS=\$(ls -1dt */ 2>/dev/null | sed 's/\///')
if [ -z "\$DIRS" ]; then
  echo "NO_BACKUPS"
  exit 0
fi

# For each backup, show what files it contains and their sizes
while IFS= read -r dir; do
  FILES=""
  DB_SIZE="-"
  BACK_SIZE="-"
  FRONT_SIZE="-"

  if [ -f "$BACKUP_DIR/\$dir/db_${DB_DATABASE}.sql.gz" ]; then
    DB_SIZE=\$(du -h "$BACKUP_DIR/\$dir/db_${DB_DATABASE}.sql.gz" | cut -f1)
  fi
  if [ -f "$BACKUP_DIR/\$dir/back_source.tar.gz" ]; then
    BACK_SIZE=\$(du -h "$BACKUP_DIR/\$dir/back_source.tar.gz" | cut -f1)
  fi
  if [ -f "$BACKUP_DIR/\$dir/front_dist.tar.gz" ]; then
    FRONT_SIZE=\$(du -h "$BACKUP_DIR/\$dir/front_dist.tar.gz" | cut -f1)
  fi

  echo "\$dir|DB:\$DB_SIZE|Back:\$BACK_SIZE|Front:\$FRONT_SIZE"
done <<< "\$DIRS"
EOF
)

if [ "$BACKUPS" = "NO_BACKUPS" ]; then
  echo "  No backups found at $BACKUP_DIR on the VPS."
  exit 1
fi

# Parse and display backups
echo "  Available backups:"
echo "  ────────────────────────────────────────────────────────"
i=1
declare -a BACKUP_LIST
while IFS= read -r line; do
  TIMESTAMP=$(echo "$line" | cut -d'|' -f1)
  DB_INFO=$(echo "$line" | cut -d'|' -f2)
  BACK_INFO=$(echo "$line" | cut -d'|' -f3)
  FRONT_INFO=$(echo "$line" | cut -d'|' -f4)

  # Format timestamp for readability: 20260401_115500 → 2026-04-01 11:55:00
  DISPLAY_DATE=$(echo "$TIMESTAMP" | sed 's/\([0-9]\{4\}\)\([0-9]\{2\}\)\([0-9]\{2\}\)_\([0-9]\{2\}\)\([0-9]\{2\}\)\([0-9]\{2\}\)/\1-\2-\3 \4:\5:\6/')

  printf "  %2d) %s   %s  %s  %s\n" "$i" "$DISPLAY_DATE" "$DB_INFO" "$BACK_INFO" "$FRONT_INFO"
  BACKUP_LIST+=("$TIMESTAMP")
  i=$((i + 1))
done <<< "$BACKUPS"

echo "  ────────────────────────────────────────────────────────"
echo ""

# ----------------------------------------------------------
# STEP 2 — Choose backup
# ----------------------------------------------------------
read -rp "  Select backup number [1-$((i - 1))]: " CHOICE

if ! [[ "$CHOICE" =~ ^[0-9]+$ ]] || [ "$CHOICE" -lt 1 ] || [ "$CHOICE" -gt $((i - 1)) ]; then
  echo "  Invalid selection."
  exit 1
fi

SELECTED="${BACKUP_LIST[$((CHOICE - 1))]}"
SELECTED_DIR="$BACKUP_DIR/$SELECTED"

DISPLAY_SELECTED=$(echo "$SELECTED" | sed 's/\([0-9]\{4\}\)\([0-9]\{2\}\)\([0-9]\{2\}\)_\([0-9]\{2\}\)\([0-9]\{2\}\)\([0-9]\{2\}\)/\1-\2-\3 \4:\5:\6/')
echo ""
echo "  Selected: $DISPLAY_SELECTED"
echo ""

# ----------------------------------------------------------
# STEP 3 — Choose what to restore
# ----------------------------------------------------------
echo "  What do you want to restore?"
echo "    1) Everything (database + backend + frontend)"
echo "    2) Database only"
echo "    3) Backend source only"
echo "    4) Frontend dist only"
echo "    5) Database + backend (no frontend)"
echo ""
read -rp "  Choice [1-5]: " RESTORE_CHOICE

RESTORE_DB=false
RESTORE_BACK=false
RESTORE_FRONT=false

case "$RESTORE_CHOICE" in
  1) RESTORE_DB=true; RESTORE_BACK=true; RESTORE_FRONT=true ;;
  2) RESTORE_DB=true ;;
  3) RESTORE_BACK=true ;;
  4) RESTORE_FRONT=true ;;
  5) RESTORE_DB=true; RESTORE_BACK=true ;;
  *) echo "  Invalid selection."; exit 1 ;;
esac

# ----------------------------------------------------------
# STEP 4 — Confirm
# ----------------------------------------------------------
echo ""
echo "  ⚠  You are about to restore the following on PRODUCTION:"
$RESTORE_DB && echo "    • Database: $DB_DATABASE"
$RESTORE_BACK && echo "    • Backend source: $APP_DIR/back/"
$RESTORE_FRONT && echo "    • Frontend dist: $APP_DIR/front-dist/"
echo "    From backup: $DISPLAY_SELECTED"
echo ""
read -rp "  Are you sure? Type 'yes' to confirm: " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "  Aborted."
  exit 0
fi

# ----------------------------------------------------------
# STEP 5 — Restore
# ----------------------------------------------------------
echo ""
echo "  Restoring..."

ssh $SSH_OPTS "$VPS_USER@$VPS_HOST" bash << EOF
set -euo pipefail

SELECTED_DIR="$SELECTED_DIR"
RESTORE_DB=$RESTORE_DB
RESTORE_BACK=$RESTORE_BACK
RESTORE_FRONT=$RESTORE_FRONT

# ── Restore database ────────────────────────────────────────
if [ "\$RESTORE_DB" = "true" ]; then
  DB_DUMP="\$SELECTED_DIR/db_${DB_DATABASE}.sql.gz"
  if [ ! -f "\$DB_DUMP" ]; then
    echo "  ✗ Database dump not found: \$DB_DUMP"
  else
    echo "  → Restoring database $DB_DATABASE..."
    gunzip < "\$DB_DUMP" | mysql -h "$DB_HOST" -u "$DB_USERNAME" -p'$DB_PASSWORD' "$DB_DATABASE"
    echo "  ✓ Database restored"
  fi
fi

# ── Restore backend ────────────────────────────────────────
if [ "\$RESTORE_BACK" = "true" ]; then
  BACK_ARCHIVE="\$SELECTED_DIR/back_source.tar.gz"
  if [ ! -f "\$BACK_ARCHIVE" ]; then
    echo "  ✗ Backend archive not found: \$BACK_ARCHIVE"
  else
    echo "  → Restoring backend source..."
    tar xzf "\$BACK_ARCHIVE" -C "$APP_DIR"
    echo "  → Running composer install..."
    cd "$APP_DIR/back"
    composer install --no-dev --optimize-autoloader --no-interaction --quiet
    echo "  → Clearing Laravel caches..."
    php artisan config:cache
    php artisan route:cache
    php artisan view:cache
    echo "  → Setting permissions..."
    $VPS_SUDO chown -R www-data:www-data "$APP_DIR/back"
    $VPS_SUDO chmod -R 755 "$APP_DIR/back"
    $VPS_SUDO chmod -R 775 "$APP_DIR/back/storage" "$APP_DIR/back/bootstrap/cache"
    echo "  ✓ Backend restored"
  fi
fi

# ── Restore frontend ───────────────────────────────────────
if [ "\$RESTORE_FRONT" = "true" ]; then
  FRONT_ARCHIVE="\$SELECTED_DIR/front_dist.tar.gz"
  if [ ! -f "\$FRONT_ARCHIVE" ]; then
    echo "  ✗ Frontend archive not found: \$FRONT_ARCHIVE"
  else
    echo "  → Restoring frontend dist..."
    tar xzf "\$FRONT_ARCHIVE" -C "$APP_DIR"
    $VPS_SUDO chown -R www-data:www-data "$APP_DIR/front-dist"
    $VPS_SUDO chmod -R 755 "$APP_DIR/front-dist"
    echo "  ✓ Frontend restored"
  fi
fi

# ── Restart PHP-FPM ────────────────────────────────────────
PHP_FPM_SERVICE=\$(systemctl list-units --type=service --state=running | grep "php.*fpm" | awk '{print \$1}' | head -1)
if [ -n "\$PHP_FPM_SERVICE" ]; then
  $VPS_SUDO systemctl restart "\$PHP_FPM_SERVICE"
  echo "  ✓ PHP-FPM restarted"
fi

EOF

# ----------------------------------------------------------
# STEP 6 — Summary
# ----------------------------------------------------------
echo ""
echo "============================================================"
echo "  ✓ Restore complete!"
echo "  Backup used: $DISPLAY_SELECTED"
$RESTORE_DB && echo "  • Database restored"
$RESTORE_BACK && echo "  • Backend restored"
$RESTORE_FRONT && echo "  • Frontend restored"
echo ""
echo "  Verify: https://${DOMAIN_WWW:-$DOMAIN}"
echo "============================================================"
