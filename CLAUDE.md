# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pneuma POS is a Point of Sale system for a **tire shop** (pneus). The UI is in **French**. It uses:
- **Backend**: Laravel 13 (PHP 8.4 FPM) REST API with Sanctum token auth
- **Frontend**: Angular 21 SPA (standalone components, signals-based state)
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

**API Routes** (`back/routes/api.php` → split into `back/routes/api/`):
- `auth.php` — Public: `POST /api/login`
- `sales.php` — CRUD + payments (`/api/sales/{sale}/payments`)
- `purchases.php` — CRUD + payments (`/api/purchases/{purchase}/payments`)
- `clients.php` — Full client CRUD + `/api/clients/{client}/profile`, `/api/clients/{client}/statement`, `/api/clients/duplicates/check`
- `catalog.php` — CRUD for `suppliers`, `carriers`, `partners`, `brands`, `products`; also registers duplicate client CRUD (registered before `clients.php`, so these routes take precedence for basic CRUD — the extended endpoints come from `clients.php`)
- `stock.php` — CRUD (`/api/stocks`) + `POST /api/stocks/import` (Excel) + `GET /api/stock-movements` (audit trail)
- `accounts.php` — CRUD for accounts + cash-flow transactions + `POST /api/accounts/transfer`
- `admin.php` — CRUD for `users` and `roles`/`permissions` + `GET /api/dashboard-kpi` (Administrator only); `require`s `settings.php`
- `settings.php` — `GET/PUT /api/settings/company` (company profile, logo, theme)
- All protected routes require `Authorization: Bearer {token}` and `permission:` middleware

**Domain Services** (`back/app/Domain/`): Business logic is extracted from controllers into domain service classes. Each module has its own service (e.g., `Domain/Sales/SaleService.php`, `Domain/Clients/ClientService.php`, `Domain/Stock/StockService.php`). Controllers are thin — they delegate to domain services and return API Resources.

**API Resources** (`back/app/Http/Resources/`): Laravel JSON Resources handle response serialization. Grouped by module (e.g., `Resources/Clients/ClientResource.php`, `Resources/Clients/ClientProfileResource.php`). All responses are wrapped in a `{ "data": ... }` envelope by default.

**Controllers** (`back/app/Http/Controllers/`): Thin controllers that inject domain services, validate requests, and return API Resources. Each resource has standard CRUD (index/store/show/update/destroy). Some controllers have additional methods (e.g., `SaleController::summary`, `ClientController::profile`, `StockController::import`).

**Models** (`back/app/Models/`):
- `Sale` — header record (date, pricing totals, client, commercial, carrier, partner, payment status). Line items live in `SaleItem` (HasMany). Linked to `Client` via `client_id`.
- `Purchase` — header record (date, supplier, totals). Line items live in `PurchaseItem` (HasMany).
- `Product` — catalog entry with a `type` field (`tyre` | `part` | `service`). Each type has a dedicated sub-table joined 1:1 by `product_id` as PK: `ProductTyre` (dimensions, EU label), `ProductPart`, `ProductService`. Use `$product->details()` to get the type-specific sub-model.
- `Stock` — inventory lots linked to `Product` via `product_id`. Tire dimensions are on the related `ProductTyre`, not on `Stock` itself. `Stock::parseSearchQuery()` parses shorthand queries like "2055516" or "205/55R16" into width/height/diameter components.
- `StockMovement` — append-only audit trail written whenever stock quantity changes.
- `Transaction` — cash-flow entry linked to an `Account`. Auto-created when a `Payment` or `PurchasePayment` is saved.
- `Payment` / `PurchasePayment` — payment records linked to their parent sale/purchase and to a `Transaction`.
- `Client` — with credit limit, opening balance, payment terms, default payment method, category.
- `CompanySetting` — singleton row; stores company name, address, logo path, favicon, and theme/layout fields.
- `Brand`, `Supplier`, `Carrier`, `Partner`, `User`, `Account` — standard catalog/reference entities.

Each payment creation auto-creates a corresponding `Transaction` record.

**Authentication**: Sanctum stateless tokens stored client-side. All previous tokens are revoked on new login (single active session).

**ACL**: Spatie Laravel Permission with roles (Administrator, Commercial, Manager, Driver) and granular permissions per resource (view, create, edit, delete + special ones like `import stock`, `manage sale-payments`, `transfer accounts`). The `RolesAndPermissionsSeeder` manages all 59 permissions and role assignments across all modules. All API routes are protected with `permission:` middleware. Frontend uses `authService.hasPermission()` to conditionally show UI elements and `permissionGuard` on routes.

### Frontend Structure

**Feature modules** (`front/src/app/features/`): Each business domain has its own feature folder with a co-located structure:
- `pages/` — Page components (lazy-loaded standalone)
- `components/` — Reusable sub-components (e.g., forms)
- `data-access/` — HTTP service for the feature (e.g., `client.service.ts`)
- `models/` — TypeScript interfaces for the feature (e.g., `client.model.ts`)
- Modules: `sales`, `purchases`, `cash-flow`, `clients`, `suppliers`, `users`, `carriers`, `partners`, `stock`, `roles`, `brands`, `products`, `accounts`, `company-settings`

**Core** (`front/src/app/core/`):
- `services/` — Shared services (e.g., `auth.service.ts`). Feature-specific services live in each feature's `data-access/` folder.
- `models/` — Shared interfaces (e.g., `sale.model.ts`, `user.model.ts`). Feature-specific models live in each feature's `models/` folder.
- `guards/` — `authGuard` (redirect to /login), `guestGuard` (redirect to /dashboard), and `permissionGuard` (ACL-based route protection)
- `interceptors/auth.interceptor.ts` — Adds `Bearer` token + `Accept: application/json` to all requests

**State management**: Angular signals only (no NgRx). Components use `signal<T>` for local state and `computed()` for derived values. Auth state lives in `AuthService` with token in `localStorage` under key `auth_token`.

**Zoneless Angular**: The app runs **without zone.js**. All mutable component state must use `signal()` and derived state must use `computed()` — plain class properties will not trigger change detection. Never use plain boolean/object properties for state that affects the template.

**Routing** (`front/src/app/app.routes.ts`): All feature routes are lazy-loaded via `loadComponent()`. Root (`/`) redirects to `/dashboard`. Purchases route is `/achats` (French). Wildcard redirects to `/dashboard`.

**Shared SCSS** (`front/src/app/features/_variables.scss`): Theme tokens (`$primary`, `$border-color`, `$radius`, etc.) imported via `@use '../../_variables' as *` in each page SCSS. Each page component has its own complete SCSS (no global stylesheet) — styles for layout, table, buttons, modal, pagination, and responsive breakpoints are repeated per module to maintain component encapsulation.

**Environments** (`front/src/environments/`): `environment.ts` (dev), `environment.prod.ts` (default production — "PNEU.MA POS"), `environment.eas.ts` (secondary deployment — "EAS POS"). Each exports `{ production, apiUrl, appTitle }`. The document title is set from `environment.appTitle` in `App.ngOnInit()` via `Title` service. `angular.json` has two production configurations: `production` (default) and `production-eas` (uses `fileReplacements` to swap in `environment.eas.ts`).

### Docker Networking

Nginx is the single entry point. It routes:
- `/api/*` and `/sanctum/*` → PHP-FPM via FastCGI
- `/*` → Angular dev server (port 4200) with WebSocket support for HMR

The Angular dev proxy (`front/proxy.conf.json`) sends `/api` to `http://nginx:80`, so it only works inside Docker. When running `npm start` outside Docker, the Laravel backend must be accessible separately.

## Key Business Domain

This is a **tire shop POS** (French: pneus). A `Sale` has header-level fields (commercial, carrier, partner, payment status, pricing totals) and child `SaleItem` rows (each with tire brand/reference/dimensions, quantity, unit price). Sales are optionally linked to a `Client` — the client profile page shows sales history, outstanding balance, and account statement. `Client` records have credit limit, opening balance, payment terms, default payment method, and category. `User` records can have roles (commercials earn commissions). `Partners` have `montage_price` and `alignment_price` fields. `Stock` tracks tire inventory by `Product` lot with smart dimension search (e.g., "2055516" or "205/55R16") and Excel import; dimensions are stored on the `ProductTyre` sub-table. `Brand` and `Product` are catalog entities — products have a `type` (`tyre`, `part`, `service`) with type-specific attributes in sub-tables. `CompanySetting` stores the shop's identity, logo, and UI theme. French terminology is used throughout the UI (e.g., "achats" = purchases, "fournisseurs" = suppliers, "transporteurs" = carriers, "clients" = clients).

## Deployment

Two deploy scripts, both run from WSL Ubuntu-24.04:

- **`deploy/deploy.sh`** — primary VPS. Builds Angular with `--configuration=production`, backs up DB + source, transfers via rsync, runs `composer install`, migrations, `RolesAndPermissionsSeeder`, caches Laravel config/routes/views, configures Nginx, and restarts PHP-FPM. Config: `deploy/deploy.env`.
- **`deploy/deploy2.sh`** — secondary VPS (no web server or PHP-FPM config). Builds Angular with `--configuration=production-eas` (different app title), output to `dist/eas-pos/browser/`. Config: `deploy/deploy2.env`. Supports `--skip-build` to re-deploy an existing build.

**DB backup**: Both scripts use `mariadb-dump` (falls back to `mysqldump`) with credentials passed via `--user`/`--password`/`--host` flags. The `--defaults-extra-file` approach was removed because it fails on MariaDB 11.4 with passwords containing `@` or similar characters.

**Dashboard KPIs** (`DashboardController::kpi`): returns today/month/year sales amounts, tyres sold counts, margins, stock value, unpaid sales/purchases, cash balance, and `sales_by_commercial` (grouped by commercial with `total_sales`, `total_tyres`, `total_margin`). Only visible to Administrator role.

## Design System
Read `front/DESIGN_SYSTEM.md` before making any frontend UI changes.
