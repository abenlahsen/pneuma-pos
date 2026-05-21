# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pneuma POS is a Point of Sale system for a **tire shop** (pneus). The UI is in **French**. It uses:
- **Backend**: Laravel 13 (PHP 8.4 FPM) REST API with Sanctum token auth
- **Frontend**: Angular 21 SPA (standalone components, signals-based state)
- **Database**: MySQL 8 (tests use a dedicated `pneuma_pos_test` MySQL database)
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
docker compose exec -e DB_DATABASE=pneuma_pos_test php php artisan migrate  # Migrate test DB
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
php artisan test                 # Run PHPUnit tests (uses pneuma_pos_test MySQL DB)
php artisan test --filter=TestName   # Run a single test
./vendor/bin/pint                # Code style fixer (Laravel Pint)
```

### Frontend (Angular)
```bash
cd front
npm install
npm start        # Dev server on :4200 (proxies /api to nginx:80 — only works inside Docker)
npm run build    # Production build → dist/pneuma-pos/browser/
npm test         # Run Vitest tests
```

### E2E Tests (Playwright)
```bash
cd e2e
npm install
npm test                    # Run all tests (headless Chromium)
npm run test:headed         # Run with visible browser
npm run test:ui             # Playwright UI mode
npm run report              # Open last HTML report
npx playwright test --grep "Comptes"  # Run specific tests by name
```

Config (`e2e/playwright.config.ts`): `timeout: 30_000` per test, `expect: { timeout: 8_000 }` per assertion, `workers: 1` (sequential). Base URL defaults to `http://localhost:8888`; override with `E2E_BASE_URL` env var.

**Auth flow**: `global-setup.ts` logs in as admin and saves the browser session (localStorage token) to `e2e/.auth/state.json`. All tests reuse this state via `storageState`. Sanctum uses single-session tokens — every new login revokes previous tokens. The `auth.spec.ts` login test revokes the global-setup token; its `afterAll` re-logs in and refreshes `.auth/state.json` so subsequent test files can make API calls.

**Writing reliable tests**:
- Use `test.describe.serial` for suites that create → modify → delete data.
- Add `beforeAll` API cleanup to delete leftover test entities from previous runs: read the stored token from `.auth/state.json`, call `GET /api/entity?search=TEST_NAME&per_page=100`, then `DELETE /api/entity/{id}` for exact name matches.
- Angular zoneless: summary cards render numbers inside `<span *ngIf="!loadingSummary()">`. Wait with `await expect(locator).toContainText(/\d+/)` before reading `textContent()` — never `parseInt()` raw textContent directly.
- For reactive-form inputs (`formControlName`), prefer `page.getByPlaceholder(...)` over `page.locator('#id')` — reactive forms don't always emit a `name` attribute.
- Scope `Annuler`/`Fermer` button clicks inside `.modal-overlay` to avoid matching filter-reset buttons with the same label.
- Close modals explicitly at the end of serial tests that open but don't submit forms (otherwise the next `beforeEach` navigation may not reset SPA state cleanly).

## Architecture

### Backend Structure

**API Routes** (`back/routes/api.php` → split into `back/routes/api/`):
- `auth.php` — Public: `POST /api/login`
- `sales.php` — CRUD + payments (`/api/sales/{sale}/payments`) + `GET /api/sales/export` (Excel export with active filters, route declared before `sales/{sale}` to avoid conflict)
- `purchases.php` — CRUD + payments (`/api/purchases/{purchase}/payments`) + `GET /api/purchases/export` (Excel export with active filters, route declared before `purchases/{purchase}`)
- `clients.php` — Full client CRUD + `/api/clients/{client}/profile`, `/api/clients/{client}/statement`, `/api/clients/duplicates/check`
- `catalog.php` — CRUD for `suppliers`, `carriers`, `partners`, `brands`, `products`; also registers duplicate client CRUD (registered before `clients.php`, so these routes take precedence for basic CRUD — the extended endpoints come from `clients.php`); `GET /api/cities` (returns ordered list of city names, no permission required)
- `stock.php` — CRUD (`/api/stocks`) + `POST /api/stocks/import` (Excel import) + `GET /api/stocks/export` (Excel export of available stock) + `GET /api/stock-movements` (audit trail)
- `accounts.php` — CRUD for accounts + cash-flow transactions + `POST /api/accounts/transfer`
- `service_orders.php` — CRUD (`/api/service-orders`) + payments (`/api/service-orders/{id}/payments`) + item sync (`/api/service-orders/{id}/items/sync`) + `GET /api/service-orders-summary` + `GET /api/service-orders-filters`
- `admin.php` — CRUD for `users` and `roles`/`permissions` + `GET /api/dashboard-kpi` (Administrator only); `require`s `settings.php`
- `settings.php` — `GET/PUT /api/settings/company` (company profile, logo, theme)
- All protected routes require `Authorization: Bearer {token}` and `permission:` middleware

**Domain Services** (`back/app/Domain/`): Business logic is extracted from controllers into domain service classes. Each module has its own service (e.g., `Domain/Sales/SaleService.php`, `Domain/Clients/ClientService.php`, `Domain/Stock/StockService.php`, `Domain/ServiceOrders/ServiceOrderService.php`, `Domain/ServiceOrders/ServicePaymentService.php`). Controllers are thin — they delegate to domain services and return API Resources.

**API Resources** (`back/app/Http/Resources/`): Laravel JSON Resources handle response serialization. Grouped by module (e.g., `Resources/Clients/ClientResource.php`, `Resources/Clients/ClientProfileResource.php`). Response envelope convention: **list endpoints** return `{ "data": [...], "meta": {...}, "total": N, ... }` (manual wrapping via `['data' => Resource::collection(...)->resolve()]`); **single-item endpoints** (show/store/update) return a **flat object** (no `data` wrapper) via `(new Resource($model))->resolve()`. Angular services type single-item responses as the model directly (e.g., `http.get<ServiceOrder>(url)`).

**Controllers** (`back/app/Http/Controllers/`): Thin controllers that inject domain services, validate requests, and return API Resources. Each resource has standard CRUD (index/store/show/update/destroy). Some controllers have additional methods (e.g., `SaleController::summary`, `ClientController::profile`, `StockController::import`).

**Models** (`back/app/Models/`):
- `Sale` — header record (date, pricing totals, client, commercial, carrier, partner, payment status). Line items live in `SaleItem` (HasMany). Linked to `Client` via `client_id`.
- `Purchase` — header record (date, supplier, totals). Line items live in `PurchaseItem` (HasMany).
- `Product` — catalog entry with a `type` field (`tyre` | `part` | `service`). Each type has a dedicated sub-table joined 1:1 by `product_id` as PK: `ProductTyre` (dimensions, EU label), `ProductPart`, `ProductService`. Use `$product->details()` to get the type-specific sub-model.
- `Stock` — inventory lots linked to `Product` via `product_id`. Tire dimensions are on the related `ProductTyre`, not on `Stock` itself. `Stock::parseSearchQuery()` parses shorthand queries like "2055516" or "205/55R16" into width/height/diameter components.
- `StockMovement` — append-only audit trail written whenever stock quantity changes.
- `Transaction` — cash-flow entry linked to an `Account`. Auto-created when a `Payment`, `PurchasePayment`, or `ServicePayment` is saved. Has two scopes: `pending()` (Chèque/Effet with `date > today`) and `settled()` (everything else). The `TransactionService` accepts a `status` filter param (`pending` | `settled`) to split the list. Editing or deleting a transaction that is linked to a fully-paid sale (`payment_status = 'PAYÉ'`) or purchase (`payment_status = 'PAYE'`) is blocked by `TransactionService::guardLinkedToCompleted()` — the user must modify the sale/purchase payment status first. `partner_id` is a nullable FK to `partners` — set manually by the user on cash-flow transactions (not auto-populated from sale/purchase payments).
- `Payment` / `PurchasePayment` — payment records linked to their parent sale/purchase and to a `Transaction`. Deleting a payment also deletes its linked `Transaction`.
- `ServiceOrder` — header record (date, vehicle, mileage, totals, discount, status, payment_status, client_id, commercial_id). Line items live in `ServiceItem` (HasMany). Payments via `ServicePayment` (HasMany).
- `ServiceItem` — line item for a service order. Two item types: `service` (service_type, description, labor_cost, quantity — `line_total = qty * labor_cost`; parts_cost is always 0) and `part` (product_id, product_name, product_reference, unit_price, quantity — `line_total = qty * unit_price`). Auto-calculates line_total on save via `booted()` hook and triggers parent `recalculateTotals()`.
- `ServicePayment` — payment linked to a `ServiceOrder` and optionally to a `Transaction` for cash-flow integration.
- `ProductService` — service catalog sub-table (joined 1:1 with `Product` where type='service'); fields: category, duration_minutes, selling_price.
- `City` — reference table of Moroccan cities (`id`, `name`), no timestamps. Seeded with 64+ cities via `CitiesSeeder`. Used as FK target for `clients.city_id`, `partners.city_id`, `company_settings.city_id`.
- `Client` — with credit limit, opening balance, payment terms, default payment method, category. The `city` field is a **virtual accessor/mutator** backed by `city_id` FK → `cities.id`: reads return the city name string, writes accept a city name string and resolve it to `city_id`. The API surface is unchanged (always a string), but the DB column is a FK. Eager-load `cityRelation` to avoid N+1. Filter by city uses `where('city_id', City::where('name', ...)->value('id'))`.
- `CompanySetting` — singleton row; stores company name, legal name, full address (address, city, state, postal_code, country), contact (phone, email), legal identifiers (rc, ice, tax_id/IF, cnss, patente), logo path, favicon, and theme/layout fields. The `city` field uses the same FK accessor/mutator pattern as `Client`.
- `Partner` — standard catalog entity. The `city` field uses the same FK accessor/mutator pattern as `Client`.
- `Brand`, `Supplier`, `Carrier`, `User`, `Account` — standard catalog/reference entities.

Each payment creation (Payment, PurchasePayment, ServicePayment) auto-creates a corresponding `Transaction` record.

**Authentication**: Sanctum stateless tokens stored client-side. All previous tokens are revoked on new login (single active session).

**ACL**: Spatie Laravel Permission with roles (Administrator, Commercial, Manager, Driver) and granular permissions per resource (view, create, edit, delete + special ones like `import stock`, `manage sale-payments`, `transfer accounts`, `manage service-payments`). The `RolesAndPermissionsSeeder` manages all permissions and role assignments across all modules. All API routes are protected with `permission:` middleware. Frontend uses `authService.hasPermission()` to conditionally show UI elements and `permissionGuard` on routes.

### Frontend Structure

**Feature modules** (`front/src/app/features/`): Each business domain has its own feature folder with a co-located structure:
- `pages/` — Page components (lazy-loaded standalone)
- `components/` — Reusable sub-components (e.g., forms)
- `data-access/` — HTTP service for the feature (e.g., `client.service.ts`)
- `models/` — TypeScript interfaces for the feature (e.g., `client.model.ts`)
- Modules: `sales`, `purchases`, `cash-flow`, `clients`, `suppliers`, `users`, `carriers`, `partners`, `stock`, `roles`, `brands`, `products`, `accounts`, `settings`, `service-orders`

**Shared** (`front/src/app/shared/`): Cross-feature reusable components — `auto-refresh-control` (per-page configurable auto-refresh toggle), `navbar` (top navigation bar), `document-print` (A4 PDF preview modal for sales, purchases, and service orders).

**Core** (`front/src/app/core/`):
- `services/` — Shared services (e.g., `auth.service.ts`, `print.service.ts`, `city.service.ts`). `CityService` fetches `GET /api/cities` once per session via `shareReplay(1)` and returns an `Observable<string[]>`. Inject it wherever a city dropdown is needed. Feature-specific services live in each feature's `data-access/` folder.
- `models/` — Shared interfaces (e.g., `sale.model.ts`, `user.model.ts`). Feature-specific models live in each feature's `models/` folder.
- `guards/` — `authGuard` (redirect to /login), `guestGuard` (redirect to /dashboard), and `permissionGuard` (ACL-based route protection)
- `interceptors/auth.interceptor.ts` — Adds `Bearer` token + `Accept: application/json` to all requests

**State management**: Angular signals only (no NgRx). Components use `signal<T>` for local state and `computed()` for derived values. Auth state lives in `AuthService` with token in `localStorage` under key `auth_token`.

**Zoneless Angular**: The app runs **without zone.js**. All mutable component state must use `signal()` and derived state must use `computed()` — plain class properties will not trigger change detection. Never use plain boolean/object properties for state that affects the template.

**Routing** (`front/src/app/app.routes.ts`): All feature routes are lazy-loaded via `loadComponent()`. Root (`/`) redirects to `/dashboard`. Purchases route is `/achats` (French). Wildcard redirects to `/dashboard`.

**Instant modal open pattern** (Service Auto): The page uses `loadingEdit = signal(false)` and `loadingDetail = signal(false)`. When opening edit or detail, the modal shell opens immediately while the API call runs in the background. The form component (`<app-service-order-form>`) is inside `*ngIf="!loadingEdit()"` so its `ngOnInit` only runs after data is available. Detail components have no `ngOnInit` and read `@Input()` via getters, so they can be shown immediately with partial data and re-rendered when full data arrives.

**Payment panels**: All three modules (Sales, Purchases, Service Auto) use a unified **side-panel** layout (`panel-overlay` + `payment-panel` classes, design tokens from `_variables.scss`). Panels auto-close when the remaining balance reaches 0 — implemented via an `onComplete` callback passed to `loadPayments()`. Available payment methods across all modules: `Espèces`, `Chèque`, `Virement`, `Effet`, `Carte bancaire`.

**Detail/consultation modals**: All three modules' detail components (`sale-detail`, `purchase-detail`, `service-order-detail`) expose `@Input() canEdit = false` and `@Output() edit`. The parent page passes `[canEdit]="authService.hasPermission('edit X')"` and `(edit)="editFromDetail()"`. The `editFromDetail()` method closes the detail modal then immediately opens the edit form.

**Print / PDF generation**: The `document-print` shared component renders an A4 document preview in a modal overlay. It accepts a `PrintDocument` input (type-safe interface defined in `document-print.component.ts`) and emits a `closed` event. Clicking "Télécharger PDF" calls `PrintService.downloadPdf()`, which lazy-imports `html2canvas` + `jsPDF` to capture the `#printZone` DOM element and produce a multi-page A4 PDF. `PrintService` caches the company settings observable via `shareReplay(1)` so settings are fetched only once per session. The `DocumentType` union (`'sale' | 'purchase' | 'service_order'`) controls the document title: "BON DE VENTE", "BON D'ACHAT", "FICHE D'INTERVENTION". Each detail component has an `openPrint()` method that maps its domain object to `PrintDocument` and sets a `printDoc` signal — the template renders `<app-document-print>` only when `printDoc()` is non-null.

**Shared SCSS** (`front/src/app/features/_variables.scss`): Theme tokens (`$primary`, `$border-color`, `$radius`, etc.) imported via `@use '../../_variables' as *` in each page SCSS. Each page component has its own complete SCSS (no global stylesheet) — styles for layout, table, buttons, modal, pagination, and responsive breakpoints are repeated per module to maintain component encapsulation.

**Environments** (`front/src/environments/`): `environment.ts` (dev), `environment.prod.ts` (default production — "PNEU.MA POS"), `environment.eas.ts` (secondary deployment — "EAS POS"). Each exports `{ production, apiUrl, appTitle }`. The document title is set from `environment.appTitle` in `App.ngOnInit()` via `Title` service. `angular.json` has two production configurations: `production` (default) and `production-eas` (uses `fileReplacements` to swap in `environment.eas.ts`).

### Docker Networking

Nginx is the single entry point. It routes:
- `/api/*` and `/sanctum/*` → PHP-FPM via FastCGI
- `/*` → Angular dev server (port 4200) with WebSocket support for HMR

The Angular dev proxy (`front/proxy.conf.json`) sends `/api` to `http://nginx:80`, so it only works inside Docker. When running `npm start` outside Docker, the Laravel backend must be accessible separately.

## Key Business Domain

This is a **tire shop POS** (French: pneus). A `Sale` has header-level fields (commercial, carrier, partner, payment status, pricing totals) and child `SaleItem` rows (each with tire brand/reference/dimensions, quantity, unit price). Sales are optionally linked to a `Client` — the client profile page shows sales history, outstanding balance, and account statement. `Client` records have credit limit, opening balance, payment terms, default payment method, and category. `User` records can have roles (commercials earn commissions). `Partners` have `montage_price` and `alignment_price` fields. `Stock` tracks tire inventory by `Product` lot with smart dimension search (e.g., "2055516" or "205/55R16") and Excel import; dimensions are stored on the `ProductTyre` sub-table. `Brand` and `Product` are catalog entities — products have a `type` (`tyre`, `part`, `service`) with type-specific attributes in sub-tables. `CompanySetting` stores the shop's identity, logo, and UI theme. French terminology is used throughout the UI (e.g., "achats" = purchases, "fournisseurs" = suppliers, "transporteurs" = carriers, "clients" = clients).

**City field pattern** (`clients`, `partners`, `company_settings`): The `city` varchar column has been replaced by a `city_id` FK → `cities.id` on all three tables. Each model uses an Eloquent `Attribute` accessor/mutator so the API continues to accept and return `city` as a plain string — the FK resolution is transparent. The relationship method is named `cityRelation()` (not `city()`, which is reserved for the accessor). Always eager-load `->with('cityRelation')` or `->with('linkedClient.cityRelation')` to avoid N+1. Filter by city with `City::where('name', $value)->value('id')` then `where('city_id', $cityId)`. Search by city with `whereHas('cityRelation', fn($q) => $q->where('name', 'like', "%{$search}%"))`. City dropdowns in all forms are populated from `CityService` (`GET /api/cities`).

**Excel exports**: `GET /api/sales/export` and `GET /api/purchases/export` stream XLSX files using PhpSpreadsheet. Both accept the same filter params as the list endpoint (minus `page`/`per_page`). Use `$sheet->fromArray($rows, null, 'A1', true)` — `setCellValueByColumnAndRow()` was removed in PhpSpreadsheet 2.x. The Angular side uses `responseType: 'blob'` + `URL.createObjectURL` for the download.

The **Service Auto** module manages automotive service orders (repairs, oil changes, etc.). A `ServiceOrder` links to a `Client` (optional), has a vehicle + mileage, and contains multiple `ServiceItem` rows of two types: `service` lines (prestation: labor_cost × quantity) and `part` lines (pièce: unit_price × quantity, linked to a `Product`). Parts cost on service lines is always 0 — parts are tracked via dedicated part lines. Order-level discount and net_amount are auto-calculated. Status values: `EN COURS` | `TERMINÉE` | `ANNULÉE`. Payment status: `NON PAYE` | `PARTIEL` | `PAYE`. Payments are tracked via `ServicePayment` which optionally creates a `Transaction` for cash-flow integration. The frontend feature is at `/service-orders` (French UI uses "Service Auto", "Prestations", "Ordre de service").

**Sales statuses** (DB values, don't change): `EN COURS` | `LIVRE` | `MONTE` | `TERMINEE` | `ANNULE`. Display labels use feminine French: "Livrée", "Annulée", "Terminée". `TERMINEE` is the "finished/collected" terminal state added alongside `LIVRE`.

**Cash Flow module** (`/cash-flow`, `GET /api/transactions`): displays all transactions with two distinct sections:
- **Transactions à venir** (collapsible card, amber/orange accent) — pending Chèque/Effet with a future date. Loaded separately via `status=pending&per_page=500`. Shows an "Échéance" date column and a "Méthode" badge. Count and total pending amounts (income/expense) shown in the section header.
- **Transactions réalisées** (main paginated table) — all settled transactions, loaded via `status=settled`.

Both sections are loaded in parallel on every `loadData()` call. The summary endpoint (no `status` param) returns `pending_income` and `pending_expense` totals across all filters.

Filters available (order in UI): Rechercher (description LIKE), Type, Compte, Catégorie, Personne, Partenaire, Du, Au, Montant min, Montant max. All filters apply to both the settled and pending requests. The `TransactionService::buildFilteredQuery()` supports: `type`, `category`, `account_id`, `person`, `partner_id`, `date_from`, `date_to`, `search`, `amount_min`, `amount_max`, `status`. The Partenaire filter uses `partner_id` (FK) — the filter dropdown is fed by `GET /api/transactions-filters` which returns partners as `{id, name}` objects.

**Transaction auto-creation**: each payment recorded against a sale, purchase, or service order automatically creates a `Transaction`. Sale payments → type `income`, category `Produit`. Purchase payments → type `expense`, category `Achat`, `person` = supplier name. The `partner_id` field is **not** auto-populated — it is set manually by the user on standalone cash-flow transactions. Deleting a payment cascades to delete its linked transaction. Editing/deleting a transaction linked to a fully-paid sale or purchase is blocked by the backend guard (422 error).

## Deployment

Two deploy scripts, both run from WSL Ubuntu-24.04:

- **`deploy/deploy.sh`** — primary VPS. Builds Angular with `--configuration=production`, backs up DB + source, transfers via rsync, runs `composer install`, migrations, `RolesAndPermissionsSeeder`, caches Laravel config/routes/views, configures Nginx, and restarts PHP-FPM. Config: `deploy/deploy.env`.
- **`deploy/deploy2.sh`** — secondary VPS (no web server or PHP-FPM config). Builds Angular with `--configuration=production-eas` (different app title), output to `dist/eas-pos/browser/`. Config: `deploy/deploy2.env`. Supports `--skip-build` to re-deploy an existing build.

**DB backup**: Both scripts use `mariadb-dump` (falls back to `mysqldump`) with credentials passed via `--user`/`--password`/`--host` flags. The `--defaults-extra-file` approach was removed because it fails on MariaDB 11.4 with passwords containing `@` or similar characters.

**Dashboard KPIs** (`DashboardController::kpi`): returns today/month/year sales amounts, tyres sold counts, margins, stock value, unpaid sales/purchases, cash balance, and `sales_by_commercial` (grouped by commercial with `total_sales`, `total_tyres`, `total_margin`). Only visible to Administrator role. The "Pneus vendus" KPI (`tyres_today`, `tyres_this_month`, `tyres_en_cours`) counts only `sale_items` joined to `products` where `products.type = 'tyre'` — parts and services are excluded.

## Design System
Read `front/DESIGN_SYSTEM.md` before making any frontend UI changes.
