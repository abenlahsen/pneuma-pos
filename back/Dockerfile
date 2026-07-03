FROM php:8.4-fpm

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    cron \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    libzip-dev \
    zip \
    unzip \
    && docker-php-ext-install pdo_mysql mbstring exif pcntl bcmath gd xml zip \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www

# Copy existing application
COPY . /var/www

# Install dependencies if composer.json exists
RUN if [ -f "composer.json" ]; then composer install --no-interaction --optimize-autoloader; fi

# Set permissions
RUN chown -R www-data:www-data /var/www \
    && chmod -R 775 /var/www/storage 2>/dev/null || true \
    && chmod -R 775 /var/www/bootstrap/cache 2>/dev/null || true

# Laravel scheduler (drives Schedule::command(...) entries, e.g. kpi:snapshot)
COPY docker/cron/pneuma-kpi /etc/cron.d/pneuma-kpi
RUN chmod 0644 /etc/cron.d/pneuma-kpi

# Entrypoint to fix permissions on mounted volumes
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 9000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["php-fpm"]
