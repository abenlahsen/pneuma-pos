# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pneuma POS is a Point of Sale system for a **tire shop** (pneus). The UI is in **French**. It uses:
- **Backend**: Laravel 13 (PHP 8.4 FPM) REST API with Sanctum token auth
- **Frontend**: Angular 19 SPA (standalone components, signals-based state)
- **Database**: MySQL 8 (tests use in-memory SQLite)
- **Infrastructure**: Docker Compose with Nginx reverse proxy

Initial admin account is seeded from `ADMIN_EMAIL` / `ADMIN_INITIAL_PASSWORD` env vars (see `back/.env.example`). If `ADMIN_INITIAL_PASSWORD` is empty, the seeder generates a random password and prints it once on stdout. The admin is always forced to change their password on first login (`must_change_password = true`).

## Security Guidelines
- Always validate and sanitize user inputs
- Never hardcode secrets, keys, or passwords — use environment variables
- Use parameterized queries for all database operations
- Apply the principle of least privilege
- Flag any code that could introduce XSS, CSRF, or injection vulnerabilities
- Before finishing any task, check if the changes introduced new security risks

## Development Commands

### Docker (recommended)
```bash
cp .env.example .env             # First time setup
docker compose up --build        # Start all services
docker compose up                # Start without rebuild
docker compose down              # Stop services
docker compose exec php php artisan migrate --seed   # Run migrations + seed
docker compose exec php php artisan migrate:fresh --seed  # Reset DB completely
docker compose exec php php artisan tinker           # Laravel REPL
docker compose logs -f           # Tail logs
```

Services (ports configurable via `.env`):
- Full app via Nginx: `http://localhost:8888`
- Angular dev server (direct): `http://localhost:4200`
- MySQL: `localhost:3307`

### Backend (Laravel)
```bash
cd back
composer install
php artisan migrate --seed       # Setup DB with default admin user
php artisan serve                # Dev server on :8000
php artisan test                 # Run PHPUnit tests (uses in-memory SQLite)
php artisan test --filter=TestName   # Run a single test
./vendor/bin/pint                # Code style fixer (Laravel Pint)
```

### Frontend (Angular)
```bash
cd front
npm install
npm start        # Dev server on :4200 (proxies /api to nginx:80 — only works inside Docker)
npm run build    # Production build → dist/pneuma-pos/browser/
npm test         # Run Karma tests
```

## Architecture

### Backend Structure

**API Routes** (`back/routes/api.php`):
- Public: `POST /api/login`
- Protected (Sanctum): all other routes require `Authorization: Bearer {token}`
- Resources: `sales`, `purchases`, `suppliers`, `users`, `carriers`, `partners`, `transactions`, `stocks`
- Summary/filter endpoints: `GET /api/sales-summary`, `GET /api/sales-filters`, `GET /api/purchases-summary`, `GET /api/transactions-summary`, `GET /api/transactions-filters`, `GET /api/stocks-summary`, `GET /api/stocks-filters`
- Nested payment routes: `GET|POST|DELETE /api/sales/{sale}/payments`, same pattern for `purchases/{purchase}/payments`
- Stock import: `POST /api/stocks/import` (Excel .xlsx/.xls upload)

**Controllers** (`back/app/Http/Controllers/`): Each resource has standard CRUD (index/store/show/update/destroy). `SaleController`, `PurchaseController`, `TransactionController`, and `StockController` also have `summary` methods for dashboard aggregations. `StockController` additionally has `filters` and `import` (Excel) endpoints.

**Models** (`back/app/Models/`): Key models are `Sale` (44+ fillable fields for tire product details), `Purchase`, `Transaction` (cash flow), `Payment`/`PurchasePayment` (linked to transactions), `Stock` (tire inventory with dimension parsing). Each payment creation auto-creates a corresponding `Transaction` record.

**Authentication**: Sanctum stateless tokens stored client-side. All previous tokens are revoked on new login (single active session).

**ACL**: Spatie Laravel Permission with roles (Administrator, Commercial, Manager, Driver) and granular permissions per resource (view, create, edit, delete). The `RolesAndPermissionsSeeder` manages all permissions and role assignments. All API routes are protected with `permission:` middleware. Frontend uses `authService.hasPermission()` to conditionally show UI elements and `permissionGuard` on routes.

### Frontend Structure

**Feature modules** (`front/src/app/features/`): Each business domain (sales, purchases, cash-flow, suppliers, users, carriers, partners, stock, roles) has a lazy-loaded standalone component plus a `-form/` subcomponent and optional payment panel.

**Core** (`front/src/app/core/`):
- `services/` — HTTP services, one per backend resource
- `models/` — TypeScript interfaces matching backend data shapes
- `guards/` — `authGuard` (redirect to /login), `guestGuard` (redirect to /dashboard), and `permissionGuard` (ACL-based route protection)
- `interceptors/auth.interceptor.ts` — Adds `Bearer` token + `Accept: application/json` to all requests

**State management**: Angular signals only (no NgRx). Components use `signal<T>` for local state and `computed()` for derived values. Auth state lives in `AuthService` with token in `localStorage` under key `auth_token`.

**Routing** (`front/src/app/app.routes.ts`): All feature routes are lazy-loaded via `loadComponent()`. Root (`/`) redirects to `/dashboard`. Purchases route is `/achats` (French). Wildcard redirects to `/dashboard`.

### Docker Networking

Nginx is the single entry point. It routes:
- `/api/*` and `/sanctum/*` → PHP-FPM via FastCGI
- `/*` → Angular dev server (port 4200) with WebSocket support for HMR

The Angular dev proxy (`front/proxy.conf.json`) sends `/api` to `http://nginx:80`, so it only works inside Docker. When running `npm start` outside Docker, the Laravel backend must be accessible separately.

## Key Business Domain

This is a **tire shop POS** (French: pneus). A `Sale` record captures: tire brand/reference/dimensions, quantity, unit price, supplier, commercial, carrier, partner (mounting/alignment shop), payment status, and many computed pricing fields. `User` records can have roles (commercials earn commissions). `Partners` have `montage_price` and `alignment_price` fields. `Stock` tracks tire inventory with smart dimension search (e.g., "2055516" or "205/55R16") and Excel import capability. French terminology is used throughout the UI (e.g., "achats" = purchases, "fournisseurs" = suppliers, "transporteurs" = carriers).

## Deployment

Production deployment uses `deploy/deploy.sh` (run from WSL Ubuntu-24.04). It builds Angular locally, backs up DB + source on VPS, transfers files via rsync, runs `composer install`, migrations, `RolesAndPermissionsSeeder`, and caches Laravel config/routes/views. See `deploy/deploy.env.example` for configuration.
