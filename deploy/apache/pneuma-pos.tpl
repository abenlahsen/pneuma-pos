#=========================================================================#
# Pneuma POS — Apache2 + PHP-FPM Template (HTTP)                         #
# HestiaCP custom template for Laravel API + Angular SPA                  #
#                                                                         #
# Install:                                                                #
#   cp pneuma-pos.tpl pneuma-pos.stpl \                                   #
#     /usr/local/hestia/data/templates/web/apache2/php-fpm/               #
#   Then select "pneuma-pos" as Web Template in HestiaCP panel.           #
#=========================================================================#

<VirtualHost %ip%:%web_port%>

    ServerName %domain_idn%
    %alias_string%
    ServerAdmin %email%
    DocumentRoot %docroot%
    ScriptAlias /cgi-bin/ %home%/%user%/web/%domain%/cgi-bin/
    Alias /vstats/ %home%/%user%/web/%domain%/stats/
    Alias /error/ %home%/%user%/web/%domain%/document_errors/

    CustomLog /var/log/%web_system%/domains/%domain%.bytes bytes
    CustomLog /var/log/%web_system%/domains/%domain%.log combined
    ErrorLog /var/log/%web_system%/domains/%domain%.error.log

    IncludeOptional %home%/%user%/conf/web/%domain%/apache2.forcessl.conf*

    # ──────────────────────────────────────────────
    # Security headers
    # ──────────────────────────────────────────────
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-XSS-Protection "1; mode=block"

    # ──────────────────────────────────────────────
    # API routes → Laravel (back/public/index.php)
    # ──────────────────────────────────────────────
    AliasMatch "^/api(/.*)?$"     "%docroot%/back/public/index.php"
    AliasMatch "^/sanctum(/.*)?$" "%docroot%/back/public/index.php"

    <Directory %docroot%/back/public>
        AllowOverride All
        Options +Includes -Indexes +ExecCGI
        Require all granted
    </Directory>

    # ──────────────────────────────────────────────
    # PHP-FPM handler
    # ──────────────────────────────────────────────
    <FilesMatch \.php$>
        SetHandler "proxy:%backend_lsnr%|fcgi://localhost"
    </FilesMatch>
    SetEnvIf Authorization .+ HTTP_AUTHORIZATION=$0

    # ──────────────────────────────────────────────
    # Angular SPA → front-dist/
    # ──────────────────────────────────────────────
    Alias / %docroot%/front-dist/

    <Directory %docroot%/front-dist>
        Options -Indexes +FollowSymLinks
        AllowOverride None
        Require all granted

        RewriteEngine On
        RewriteBase /
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule ^ index.html [L]
    </Directory>

    # No-cache on index.html so deploys are picked up immediately
    <Files "index.html">
        <If "%{REQUEST_URI} !~ m#^/api#">
            Header set Cache-Control "no-cache, no-store, must-revalidate"
            Header set Pragma "no-cache"
            Header set Expires "0"
        </If>
    </Files>

    # ──────────────────────────────────────────────
    # Cache static assets (1 year)
    # ──────────────────────────────────────────────
    <LocationMatch "\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$">
        Header set Cache-Control "public, max-age=31536000, immutable"
    </LocationMatch>

    # ──────────────────────────────────────────────
    # Block hidden files (.git, .env, etc.)
    # ──────────────────────────────────────────────
    <DirectoryMatch "/\.">
        Require all denied
    </DirectoryMatch>

    # Max upload size
    LimitRequestBody 20971520

    <Directory %home%/%user%/web/%domain%/stats>
        AllowOverride All
    </Directory>

    IncludeOptional %home%/%user%/conf/web/%domain%/%web_system%.conf_*
    IncludeOptional /etc/apache2/conf.d/*.inc

</VirtualHost>
