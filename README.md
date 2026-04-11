# Pneuma POS

Système de Point de Vente pour magasin de pneus. Interface en français.

**Stack** : Angular 21 + Laravel 13 (PHP 8.4) + MySQL 8

## Fonctionnalites

- Gestion des ventes et achats de pneus (marque, dimensions, prix, quantites)
- Gestion du stock avec import Excel (.xlsx/.xls) et recherche par dimensions
- Suivi des paiements (ventes et achats) avec generation automatique de transactions
- Gestion de la tresorerie (cash flow)
- Gestion des fournisseurs, transporteurs et partenaires (montage/equilibrage)
- Systeme de roles et permissions (ACL) configurable depuis l'interface
- Dashboard avec statistiques et resume des ventes/achats
- Systeme de commissions pour les commerciaux

## Stack Docker (developpement)

| Service      | Technologie          | Port   |
|--------------|----------------------|--------|
| **nginx**    | Nginx Alpine         | `8888` |
| **php**      | PHP 8.4 FPM          | `9000` |
| **mysql**    | MySQL 8.0            | `3307` |
| **angular**  | Node 22 + Angular 21 | `4200` |

## Demarrage rapide (Docker)

```bash
# 1. Cloner le repo
git clone https://github.com/VOTRE_UTILISATEUR/pneuma-pos.git
cd pneuma-pos

# 2. Configurer les variables d'environnement
cp .env.example .env

# 3. Lancer la stack Docker
docker compose up --build

# 4. Executer les migrations et le seed (premiere fois)
docker compose exec php php artisan migrate --seed

# 5. Acceder a l'application
# http://localhost:8888
```

## Compte administrateur initial

Lors du premier `php artisan migrate --seed`, un compte Administrateur est cree a partir des variables d'environnement :

| Variable                  | Role                                                                                  |
|---------------------------|---------------------------------------------------------------------------------------|
| `ADMIN_EMAIL`             | Email du compte (defaut : `admin@pneuma.pos`)                                         |
| `ADMIN_INITIAL_PASSWORD`  | Mot de passe initial. Si vide, le seeder en genere un aleatoire et l'affiche en log.  |

Le compte a le drapeau `must_change_password = true` : le frontend force le changement du mot de passe lors de la premiere connexion. Le mot de passe initial ne doit jamais etre reutilise.

## Deploiement en production (VPS)

### Pre-requis sur le serveur

- PHP 8.4 + extensions : `mbstring`, `xml`, `curl`, `mysql`, `zip`, `gd`, `bcmath`
- PHP-FPM (php8.4-fpm)
- Composer 2
- MySQL 8.0
- Nginx
- Node.js 22 + npm (uniquement si vous buildez le frontend sur le serveur)
- Git

### Option A : Deploiement automatise (recommande)

Le script `deploy/deploy.sh` builde Angular localement (WSL/Linux/Mac) puis deploie tout sur le VPS via SSH/rsync. Node.js n'est **pas** necessaire sur le VPS.

```bash
# 1. Copier et remplir la config de deploiement
cp deploy/deploy.env.example deploy/deploy.env
nano deploy/deploy.env
```

Contenu de `deploy/deploy.env` :

```env
VPS_HOST="votre-ip-ou-domaine"
VPS_USER="root"
VPS_PORT=22

DB_HOST="localhost"
DB_DATABASE="pneuma_pos"
DB_USERNAME="pneuma"
DB_PASSWORD="votre_mot_de_passe"

APP_DIR="/var/www/votre-domaine.com"
DOMAIN="votre-domaine.com"
DOMAIN_WWW="www.votre-domaine.com"

# "sudo" si VPS_USER n'est pas root, sinon laisser vide
VPS_SUDO="sudo"
```

```bash
# 2. Lancer le deploiement depuis WSL/Linux/Mac
bash deploy/deploy.sh
```

Le script effectue automatiquement :
1. Build Angular en local
2. Backup de la BDD et des fichiers sur le VPS
3. Transfert des fichiers via rsync
4. Installation des dependances Composer (sans dev)
5. Migrations + seed des roles/permissions
6. Cache Laravel (config, routes, vues)
7. Configuration Nginx + permissions fichiers
8. Verification du deploiement

### Option B : Deploiement manuel

#### 1. Preparer la base de donnees

```bash
mysql -u root -p
```

```sql
CREATE DATABASE pneuma_pos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'pneuma'@'localhost' IDENTIFIED BY 'votre_mot_de_passe';
GRANT ALL PRIVILEGES ON pneuma_pos.* TO 'pneuma'@'localhost';
FLUSH PRIVILEGES;
```

#### 2. Cloner le projet sur le serveur

```bash
cd /var/www
git clone https://github.com/VOTRE_UTILISATEUR/pneuma-pos.git votre-domaine.com
cd votre-domaine.com
```

#### 3. Installer le backend Laravel

```bash
cd back
cp .env.example .env
nano .env   # Remplir les infos de BDD, APP_URL, etc.

composer install --no-dev --optimize-autoloader
php artisan key:generate
php artisan migrate --seed
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan storage:link
```

Contenu minimal du `.env` backend :

```env
APP_NAME="Pneuma POS"
APP_ENV=production
APP_DEBUG=false
APP_URL=https://www.votre-domaine.com

DB_CONNECTION=mysql
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=pneuma_pos
DB_USERNAME=pneuma
DB_PASSWORD=votre_mot_de_passe

SESSION_DRIVER=file
CACHE_STORE=file
QUEUE_CONNECTION=sync
```

#### 4. Builder le frontend Angular

```bash
# Sur votre machine locale (ou sur le serveur si Node.js est installe)
cd front
npm ci
npx ng build --configuration=production
```

Le build genere les fichiers dans `front/dist/pneuma-pos/browser/`. Copier ce dossier sur le serveur :

```bash
# Depuis votre machine locale
rsync -az front/dist/pneuma-pos/browser/ user@serveur:/var/www/votre-domaine.com/front-dist/
```

#### 5. Configurer Nginx

Creer le fichier `/etc/nginx/sites-available/votre-domaine.conf` :

```nginx
server {
    listen 80;
    server_name votre-domaine.com www.votre-domaine.com;

    root /var/www/votre-domaine.com/back/public;
    index index.php;

    client_max_body_size 20M;

    # API → Laravel (PHP-FPM)
    location /api {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location /sanctum {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass unix:/run/php/php8.4-fpm.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }

    # Angular SPA → fichiers statiques
    location / {
        root /var/www/votre-domaine.com/front-dist;
        try_files $uri $uri/ /index.html;

        location = /index.html {
            add_header Cache-Control "no-cache, no-store, must-revalidate";
        }
    }

    # Cache des assets statiques
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        root /var/www/votre-domaine.com/front-dist;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    location ~ /\. {
        deny all;
    }
}
```

```bash
# Activer le site
ln -s /etc/nginx/sites-available/votre-domaine.conf /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

#### 6. Permissions

```bash
chown -R www-data:www-data /var/www/votre-domaine.com/back /var/www/votre-domaine.com/front-dist
chmod -R 755 /var/www/votre-domaine.com
chmod -R 775 /var/www/votre-domaine.com/back/storage /var/www/votre-domaine.com/back/bootstrap/cache
```

#### 7. SSL avec Certbot

```bash
apt install certbot python3-certbot-nginx -y
certbot --nginx -d votre-domaine.com -d www.votre-domaine.com \
  --email votre@email.com --agree-tos --non-interactive --redirect
```

### Deploiement sur HestiaCP

Si votre VPS utilise HestiaCP, suivez ces etapes :

1. **Creer le domaine** dans le panneau HestiaCP (Web > Add Web Domain)
2. **Activer SSL** via HestiaCP (Let's Encrypt)
3. **Creer la base de donnees** via HestiaCP (DB > Add Database)
4. **Acceder au serveur en SSH** puis :

```bash
# Aller dans le dossier du domaine (structure HestiaCP)
cd /home/VOTRE_USER/web/votre-domaine.com/public_html

# Cloner le projet
git clone https://github.com/VOTRE_UTILISATEUR/pneuma-pos.git .

# Installer le backend
cd back
cp .env.example .env
nano .env   # Configurer la BDD, APP_URL, etc.
composer install --no-dev --optimize-autoloader
php artisan key:generate
php artisan migrate --seed
php artisan config:cache && php artisan route:cache && php artisan view:cache
php artisan storage:link
```

5. **Builder et transferer le frontend** (depuis votre machine locale) :

```bash
cd front && npm ci && npx ng build --configuration=production
rsync -az front/dist/pneuma-pos/browser/ user@serveur:/home/VOTRE_USER/web/votre-domaine.com/public_html/front-dist/
```

6. **Configurer Nginx** : dans HestiaCP, aller dans Web > votre domaine > Nginx Template et utiliser un template custom, ou modifier le fichier de config directement :

```bash
# Le fichier de config Nginx est generalement dans :
nano /home/VOTRE_USER/conf/web/votre-domaine.com/nginx.conf_custom
# OU (selon la version de HestiaCP) :
nano /home/VOTRE_USER/conf/web/votre-domaine.com/nginx.ssl.conf_custom
```

Ajouter le contenu suivant (adapter les chemins) :

```nginx
location /api {
    root /home/VOTRE_USER/web/votre-domaine.com/public_html/back/public;
    try_files $uri $uri/ /index.php?$query_string;
}

location /sanctum {
    root /home/VOTRE_USER/web/votre-domaine.com/public_html/back/public;
    try_files $uri $uri/ /index.php?$query_string;
}

location ~ \.php$ {
    root /home/VOTRE_USER/web/votre-domaine.com/public_html/back/public;
    fastcgi_pass unix:/run/php/php8.4-fpm.sock;
    fastcgi_index index.php;
    fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
    include fastcgi_params;
}

location / {
    root /home/VOTRE_USER/web/votre-domaine.com/public_html/front-dist;
    try_files $uri $uri/ /index.html;
}

location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    root /home/VOTRE_USER/web/votre-domaine.com/public_html/front-dist;
    expires 1y;
    access_log off;
}
```

7. **Permissions** :

```bash
chown -R VOTRE_USER:www-data /home/VOTRE_USER/web/votre-domaine.com/public_html
chmod -R 775 /home/VOTRE_USER/web/votre-domaine.com/public_html/back/storage
chmod -R 775 /home/VOTRE_USER/web/votre-domaine.com/public_html/back/bootstrap/cache
```

## Variables d'environnement (.env racine)

Ces variables configurent la stack Docker de developpement :

| Variable              | Description                     | Defaut        |
|-----------------------|---------------------------------|---------------|
| `MYSQL_DATABASE`      | Nom de la BDD                   | `pneuma_pos`  |
| `MYSQL_USER`          | Utilisateur MySQL               | `pneuma`      |
| `MYSQL_PASSWORD`      | Mot de passe MySQL              | `secret`      |
| `MYSQL_ROOT_PASSWORD` | Mot de passe root MySQL         | `rootsecret`  |
| `NGINX_PORT`          | Port Nginx (acces a l'app)      | `8888`        |
| `ANGULAR_PORT`        | Port Angular dev server         | `4200`        |
| `MYSQL_PORT`          | Port MySQL (acces externe)      | `3307`        |

## Roles et permissions

Le systeme inclut 4 roles par defaut :

| Role            | Description                                        |
|-----------------|----------------------------------------------------|
| **Administrator** | Acces complet a toutes les fonctionnalites        |
| **Manager**       | Gestion des ventes, achats, stock, utilisateurs   |
| **Commercial**    | Gestion des ventes et consultations               |
| **Driver**        | Acces limite (consultations)                      |

Les roles et permissions sont entierement configurables depuis l'interface (menu Roles).

## API

Toutes les routes protegees necessitent le header `Authorization: Bearer {token}`.

| Ressource       | Endpoints                                                      |
|-----------------|----------------------------------------------------------------|
| Auth            | `POST /api/login`, `POST /api/logout`                          |
| Ventes          | `GET\|POST /api/sales`, `GET\|PUT\|DELETE /api/sales/{id}`        |
| Paiements vente | `GET\|POST /api/sales/{id}/payments`                            |
| Achats          | `GET\|POST /api/purchases`, `GET\|PUT\|DELETE /api/purchases/{id}` |
| Paiements achat | `GET\|POST /api/purchases/{id}/payments`                        |
| Tresorerie      | `GET\|POST /api/transactions`, `GET\|PUT\|DELETE /api/transactions/{id}` |
| Stock           | `GET\|POST /api/stocks`, `POST /api/stocks/import`              |
| Produits        | `GET\|POST /api/products`, `PATCH /api/products/{id}/toggle-active` |
| Marques         | `GET\|POST /api/brands`, `PATCH /api/brands/{id}/toggle-active` |
| Fournisseurs    | `GET\|POST /api/suppliers`                                      |
| Transporteurs   | `GET\|POST /api/carriers`                                       |
| Partenaires     | `GET\|POST /api/partners`                                       |
| Utilisateurs    | `GET\|POST /api/users`                                          |
| Roles           | `GET\|POST /api/roles`, `PUT /api/roles/{id}/permissions`       |

Endpoints de resume : `GET /api/sales-summary`, `GET /api/purchases-summary`, `GET /api/transactions-summary`, `GET /api/stocks-summary`

## Commandes utiles

```bash
# --- Docker (developpement) ---
docker compose up --build          # Demarrer avec rebuild
docker compose down                # Arreter
docker compose logs -f             # Voir les logs
docker compose exec php bash       # Shell dans le conteneur PHP

# --- Backend ---
docker compose exec php php artisan migrate --seed       # Migrations + seed
docker compose exec php php artisan migrate:fresh --seed  # Reset complet BDD
docker compose exec php php artisan tinker               # REPL Laravel
docker compose exec php php artisan test                 # Tests PHPUnit

# --- Frontend ---
docker compose exec angular sh     # Shell dans le conteneur Angular
```

## Structure du projet

```
pneuma-pos/
├── docker-compose.yml
├── .env.example                    # Variables Docker
├── docker/nginx/default.conf       # Nginx config (dev)
├── deploy/
│   ├── deploy.sh                   # Script de deploiement automatise
│   ├── deploy.env.example          # Variables de deploiement
│   └── nginx/                      # Config Nginx production
├── back/                           # Laravel 13 (API REST)
│   ├── Dockerfile
│   ├── app/
│   │   ├── Http/Controllers/       # SaleController, PurchaseController, StockController...
│   │   └── Models/                 # Sale, Purchase, Stock, Transaction, Payment...
│   ├── database/
│   │   ├── migrations/
│   │   └── seeders/                # DatabaseSeeder, RolesAndPermissionsSeeder
│   └── routes/api.php              # Toutes les routes API
└── front/                          # Angular 21 (SPA)
    ├── Dockerfile
    └── src/app/
        ├── core/
        │   ├── guards/             # authGuard, guestGuard, permissionGuard
        │   ├── interceptors/       # auth.interceptor.ts (Bearer token)
        │   ├── models/             # Interfaces TypeScript
        │   └── services/           # HTTP services par ressource
        └── features/
            ├── auth/               # Login, Register
            ├── dashboard/          # Tableau de bord
            ├── sales/              # Ventes
            ├── purchases/          # Achats
            ├── cash-flow/          # Tresorerie
            ├── stock/              # Gestion du stock
            ├── products/           # Produits
            ├── brands/             # Marques
            ├── suppliers/          # Fournisseurs
            ├── carriers/           # Transporteurs
            ├── partners/           # Partenaires
            ├── users/              # Gestion des utilisateurs
            └── roles/              # Gestion des roles/permissions
```

## Licence

Projet prive.
