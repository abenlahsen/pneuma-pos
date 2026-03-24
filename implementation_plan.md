# Deploy pneuma-pos to VPS (www.quel-pneu.ma)

## Overview

Deploy the **pneuma-pos** Laravel + Angular application on a VPS with Nginx, PHP-FPM, and MySQL (already installed). Set up SSL via Let's Encrypt.

**Architecture on VPS:**
```
Client → Nginx (port 443/80)
         ├─ /api, /sanctum → PHP-FPM (Laravel)
         └─ /               → Static Angular files
```

## User Review Required

> [!IMPORTANT]
> Before proceeding, I need you to confirm:
> 1. **MySQL credentials** — what username/password/database should I configure on the VPS? (I'll use `pneuma`/`<strong_password>`/`pneuma_pos` as defaults)
> 2. **PHP version** — please run `php -v` and `php -m` on the VPS and paste the output (I need PHP 8.3+ with `pdo_mysql`, `mbstring`, `xml`, `curl`, `zip` extensions)
> 3. **Node.js** — is Node.js installed on the VPS? (`node -v`) — needed to build Angular. If not, we'll build locally and upload.

## Step-by-Step Plan

### Step 1: Build Angular Frontend Locally

Build the production-optimized Angular static files on your Windows machine.

```bash
cd d:\projects\pneuma-pos\front
npm run build
```

Output goes to `d:\projects\pneuma-pos\front\dist\pneuma-pos\browser\` — these are the static files to upload.

---

### Step 2: Upload Project to VPS

Upload the project to the VPS at `/var/www/pneuma-pos/`:

- `back/` → entire Laravel backend (excluding `vendor/`, `.env`)
- `front/dist/pneuma-pos/browser/` → compiled Angular static files

Two approaches:
- **Option A (Git)**: Clone the repo on the VPS, then copy the built Angular files
- **Option B (SCP/SFTP)**: Upload directly from Windows

---

### Step 3: Create Production Files

#### [NEW] deploy/nginx/quel-pneu.conf
Nginx virtual host config for `www.quel-pneu.ma`:
- Serves Angular static files from `/var/www/pneuma-pos/front-dist/`
- Proxies `/api` and `/sanctum` to PHP-FPM via Laravel's `public/index.php`
- Handles Angular client-side routing (SPA fallback)

#### [NEW] deploy/env.production
Production `.env` template for Laravel with:
- `APP_ENV=production`, `APP_DEBUG=false`
- `APP_URL=https://www.quel-pneu.ma`
- `SANCTUM_STATEFUL_DOMAINS=www.quel-pneu.ma`
- MySQL pointing to `127.0.0.1`

#### [NEW] deploy/deploy.sh
One-command deployment script that:
1. Creates directory structure
2. Installs Composer dependencies
3. Generates app key & runs migrations
4. Sets correct file permissions
5. Installs the Nginx config
6. Installs Certbot and obtains SSL certificate
7. Restarts services

---

### Step 4: SSL with Let's Encrypt

The deploy script will:
1. Install `certbot` and `python3-certbot-nginx`
2. Run `certbot --nginx -d www.quel-pneu.ma -d quel-pneu.ma`
3. Certbot auto-modifies the Nginx config for HTTPS + redirect
4. Auto-renewal is set up via systemd timer

---

## Verification Plan

### Manual Verification (by user on VPS)
1. Run `curl -I https://www.quel-pneu.ma` → should return `200 OK` with Angular HTML
2. Run `curl https://www.quel-pneu.ma/api/login -X POST` → should return JSON (401 or validation error, not 404/502)
3. Open `https://www.quel-pneu.ma` in browser → should see the login page
4. Run `curl -I http://www.quel-pneu.ma` → should redirect to HTTPS (301)
5. Run `sudo certbot certificates` → should show valid cert for `www.quel-pneu.ma`
