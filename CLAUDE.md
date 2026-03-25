# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pneuma POS is a Point of Sale system for a tire shop business. It uses:
- **Backend**: Laravel 13 (PHP 8.3+) REST API with Sanctum token auth
- **Frontend**: Angular 19+ SPA (standalone components, signals-based state)
- **Database**: MySQL 8 (development default: SQLite)
- **Infrastructure**: Docker Compose with Nginx reverse proxy

Default admin credentials: `admin@pneuma.pos` / `password`

## Development Commands

### Docker (recommended)
```bash
docker-compose up --build        # Start all services
docker-compose up                # Start without rebuild
docker-compose down              # Stop services
docker-compose exec php php artisan migrate --seed   # Run migrations + seed
docker-compose exec php php artisan tinker           # Laravel REPL
```

Services run at:
- Frontend (Angular dev): `http://localhost:4200`
- Full app via Nginx: `http://localhost:8080`
- MySQL: `localhost:3307`

### Backend (Laravel)
```bash
cd back
composer install
php artisan migrate --seed       # Setup DB with default admin user
php artisan serve                # Dev server on :8000
php artisan test                 # Run PHPUnit tests
php artisan test --filter=TestName   # Run a single test
./vendor/bin/pint                # Code style fixer (Laravel Pint)
```

### Frontend (Angular)
```bash
cd front
npm install
npm start        # Dev server on :4200 (proxies /api to nginx:80)
npm run build    # Production build → dist/pneuma-pos/browser/
npm test         # Run Karma tests
```

## Architecture

### Backend Structure

**API Routes** (`back/routes/api.php`):
- Public: `POST /api/register`, `POST /api/login`
- Protected (Sanctum): all other routes require `Authorization: Bearer {token}`
- Resources: `sales`, `purchases`, `suppliers`, `personnels`, `carriers`, `partners`, `transactions`
- Nested payment routes: `GET|POST|DELETE /api/sales/{sale}/payments`, same for purchases

**Controllers** (`back/app/Http/Controllers/`): Each resource has index/store/show/update/destroy. `SaleController` and `PurchaseController` also have `summary` and `filters` methods for dashboard aggregations.

**Models** (`back/app/Models/`): Key models are `Sale` (44+ fillable fields for tire product details), `Purchase`, `Transaction` (cash flow), `Payment`/`PurchasePayment` (linked to transactions). Each payment creation auto-creates a corresponding `Transaction` record.

**Authentication**: Sanctum stateless tokens stored client-side. All previous tokens are revoked on new login (single active session).

### Frontend Structure

**Feature modules** (`front/src/app/features/`): Each business domain (sales, purchases, cash-flow, suppliers, personnels, carriers, partners) has a lazy-loaded standalone component plus a `-form/` subcomponent and optional payment panel.

**Core** (`front/src/app/core/`):
- `services/` — HTTP services, one per backend resource
- `models/` — TypeScript interfaces matching backend data shapes
- `guards/` — `authGuard` (redirect to /login) and `guestGuard` (redirect to /dashboard)
- `interceptors/auth.interceptor.ts` — Adds `Bearer` token + `Accept: application/json` to all requests

**State management**: Angular signals only (no NgRx). Components use `signal<T>` for local state and `computed()` for derived values. Auth state lives in `AuthService` with token in `localStorage` under key `auth_token`.

**Routing** (`front/src/app/app.routes.ts`): All feature routes are lazy-loaded via `loadComponent()`. Root (`/`) redirects to `/dashboard`. Purchases route is `/achats`.

### Docker Networking

Nginx is the single entry point. It routes:
- `/api/*` and `/sanctum/*` → PHP-FPM via FastCGI
- `/*` → Angular dev server (port 4200) with WebSocket support for HMR

The Angular dev proxy (`front/proxy.conf.json`) sends `/api` to `http://nginx:80`, so it only works inside Docker. When running `npm start` outside Docker, the Laravel backend must be accessible separately.

## Key Business Domain

This is a tire shop POS. A `Sale` record captures: tire brand/reference/dimensions, quantity, unit price, supplier, commercial (personnel), carrier, partner (mounting/alignment shop), payment status, and many computed pricing fields. `Personnel` have roles (commercials earn commissions). `Partners` have `montage_price` and `alignment_price` fields.
