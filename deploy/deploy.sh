#!/bin/bash
set -euo pipefail

# =============================================================
# pneuma-pos VPS Deployment Script
# Target: /var/www/quel-pneu.ma
# Domain: www.quel-pneu.ma
# =============================================================

APP_DIR="/var/www/quel-pneu.ma"
DOMAIN="quel-pneu.ma"
DOMAIN_WWW="www.quel-pneu.ma"

echo "================================================"
echo "  pneuma-pos — Production Deployment"
echo "  Target: $APP_DIR"
echo "  Domain: $DOMAIN_WWW"
echo "================================================"
echo ""

# ----------------------------------------------------------
# 0. Pre-flight checks
# ----------------------------------------------------------
echo "[0/7] Pre-flight checks..."

if [ "$EUID" -ne 0 ]; then
  echo "ERROR: Please run as root (sudo bash deploy.sh)"
  exit 1
fi

# Check required tools
for cmd in php composer nginx mysql; do
  if ! command -v $cmd &> /dev/null; then
    echo "ERROR: '$cmd' is not installed. Please install it first."
    exit 1
  fi
done

# Detect PHP-FPM socket
PHP_FPM_SOCK=$(find /run/php/ -name "*.sock" 2>/dev/null | head -1)
if [ -z "$PHP_FPM_SOCK" ]; then
  PHP_FPM_SOCK=$(find /var/run/php/ -name "*.sock" 2>/dev/null | head -1)
fi
if [ -z "$PHP_FPM_SOCK" ]; then
  echo "ERROR: Cannot find PHP-FPM socket. Is php-fpm running?"
  exit 1
fi
echo "  ✓ PHP-FPM socket found: $PHP_FPM_SOCK"

# Get PHP-FPM service name
PHP_FPM_SERVICE=$(systemctl list-units --type=service --state=running | grep "php.*fpm" | awk '{print $1}' | head -1)
echo "  ✓ PHP-FPM service: $PHP_FPM_SERVICE"

# ----------------------------------------------------------
# 2. Directory structure & Node.js setup
# ----------------------------------------------------------
echo ""
echo "[2/8] Setting up directory structure..."

mkdir -p "$APP_DIR"

# Check that back/ and front/ exist (user must have uploaded them)
if [ ! -d "$APP_DIR/back" ]; then
  echo "ERROR: $APP_DIR/back/ not found!"
  echo "  Upload your Laravel backend to $APP_DIR/back/ first."
  exit 1
fi

if [ ! -d "$APP_DIR/front" ]; then
  echo "ERROR: $APP_DIR/front/ not found!"
  echo "  Upload your Angular source to $APP_DIR/front/ first."
  exit 1
fi

echo "  ✓ Directory structure verified"

# Install Node.js 22 LTS if not present or too old
NODE_REQUIRED=18
INSTALL_NODE=false

if ! command -v node &> /dev/null; then
  INSTALL_NODE=true
else
  NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VER" -lt "$NODE_REQUIRED" ]; then
    echo "  ⚠ Node.js v$(node -v) is too old (need v${NODE_REQUIRED}+)"
    INSTALL_NODE=true
  fi
fi

if [ "$INSTALL_NODE" = true ]; then
  echo "  Installing Node.js 22 LTS..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt install -y nodejs
  echo "  ✓ Node.js $(node -v) installed"
else
  echo "  ✓ Node.js $(node -v) is ready"
fi

# ----------------------------------------------------------
# 2b. Build Angular frontend on VPS
# ----------------------------------------------------------
echo ""
echo "[2b/8] Building Angular frontend..."

cd "$APP_DIR/front"
npm ci --prefer-offline
npx ng build --configuration=production

# Copy build output to front-dist/
rm -rf "$APP_DIR/front-dist"
cp -r "$APP_DIR/front/dist/pneuma-pos/browser" "$APP_DIR/front-dist"

echo "  ✓ Angular production build complete"

# ----------------------------------------------------------
# 3. Laravel setup
# ----------------------------------------------------------
echo ""
echo "[3/7] Configuring Laravel backend..."

cd "$APP_DIR/back"

# Copy production .env
if [ -f "$APP_DIR/deploy/env.production" ]; then
  cp "$APP_DIR/deploy/env.production" .env
else
  cp .env.example .env 2>/dev/null || true
fi

# Replace DB password placeholder
sed -i "s/__DB_PASSWORD__/$DB_PASSWORD/g" .env

# Install Composer dependencies (production)
composer install --no-dev --optimize-autoloader --no-interaction

# Generate app key if not set
php artisan key:generate --force

# Run migrations
php artisan migrate --force

# Cache configuration for performance
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Create storage link
php artisan storage:link 2>/dev/null || true

# Set permissions
chown -R www-data:www-data "$APP_DIR/back"
chmod -R 755 "$APP_DIR/back"
chmod -R 775 "$APP_DIR/back/storage" "$APP_DIR/back/bootstrap/cache"

echo "  ✓ Laravel configured and optimized"

# ----------------------------------------------------------
# 4. Angular permissions
# ----------------------------------------------------------
echo ""
echo "[4/7] Setting Angular static file permissions..."

chown -R www-data:www-data "$APP_DIR/front-dist"
chmod -R 755 "$APP_DIR/front-dist"

echo "  ✓ Angular files ready"

# ----------------------------------------------------------
# 5. Nginx configuration
# ----------------------------------------------------------
echo ""
echo "[5/7] Configuring Nginx..."

# Update the PHP-FPM socket path in the config
NGINX_CONF="$APP_DIR/deploy/nginx/quel-pneu.conf"
if [ ! -f "$NGINX_CONF" ]; then
  echo "ERROR: $NGINX_CONF not found!"
  exit 1
fi

# Replace socket path if different from default
sed -i "s|unix:/run/php/php-fpm.sock|unix:$PHP_FPM_SOCK|g" "$NGINX_CONF"

# Install the config
cp "$NGINX_CONF" /etc/nginx/sites-available/quel-pneu.conf
ln -sf /etc/nginx/sites-available/quel-pneu.conf /etc/nginx/sites-enabled/quel-pneu.conf

# Remove default site if it exists
rm -f /etc/nginx/sites-enabled/default

# Test and reload
nginx -t
systemctl reload nginx

echo "  ✓ Nginx configured and reloaded"
echo "  → http://$DOMAIN_WWW should now be accessible"

# ----------------------------------------------------------
# 6. SSL with Let's Encrypt
# ----------------------------------------------------------
echo ""
echo "[6/7] Setting up SSL certificate..."
read -p "  Install SSL certificate now? (y/n): " INSTALL_SSL

if [ "$INSTALL_SSL" = "y" ] || [ "$INSTALL_SSL" = "Y" ]; then
  # Install certbot if not present
  if ! command -v certbot &> /dev/null; then
    apt update
    apt install -y certbot python3-certbot-nginx
  fi

  read -p "  Enter your email for Let's Encrypt notifications: " LE_EMAIL

  certbot --nginx \
    -d "$DOMAIN" \
    -d "$DOMAIN_WWW" \
    --email "$LE_EMAIL" \
    --agree-tos \
    --non-interactive \
    --redirect

  echo "  ✓ SSL certificate installed and HTTPS redirect enabled"
  echo "  ✓ Auto-renewal is configured via systemd"
else
  echo "  ⏭ Skipping SSL — run manually later:"
  echo "    certbot --nginx -d $DOMAIN -d $DOMAIN_WWW"
fi

# ----------------------------------------------------------
# 7. Final verification
# ----------------------------------------------------------
echo ""
echo "[7/7] Verification..."

# Restart PHP-FPM to pick up any changes
systemctl restart "$PHP_FPM_SERVICE"

echo ""
echo "================================================"
echo "  ✅ Deployment Complete!"
echo "================================================"
echo ""
echo "  🌐 Site: https://$DOMAIN_WWW"
echo "  📁 Backend: $APP_DIR/back/"
echo "  📁 Frontend: $APP_DIR/front-dist/"
echo ""
echo "  Quick checks:"
echo "    curl -I https://$DOMAIN_WWW"
echo "    curl https://$DOMAIN_WWW/api/login -X POST"
echo ""
echo "  Logs:"
echo "    tail -f $APP_DIR/back/storage/logs/laravel.log"
echo "    tail -f /var/log/nginx/error.log"
echo ""
