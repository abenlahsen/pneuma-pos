#!/bin/sh
set -e

# Fix permissions on mounted volumes
chown -R www-data:www-data /var/www/storage /var/www/bootstrap/cache 2>/dev/null || true
chmod -R 775 /var/www/storage /var/www/bootstrap/cache 2>/dev/null || true

# Generate app key if missing
if [ -z "$(grep '^APP_KEY=base64:' /var/www/.env 2>/dev/null)" ]; then
    php artisan key:generate --force 2>/dev/null || true
fi

exec "$@"

