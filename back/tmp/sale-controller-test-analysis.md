# SaleControllerTest dependency analysis

Source test: `back/tests/Feature/SaleControllerTest.php`

## What the test actually exercises

### Auth and permissions
- Every endpoint under test is behind `auth:sanctum`.
- The test authenticates with `User::createToken(...)`, so the sqlite bootstrap must support Sanctum personal access tokens.
- Route permissions required by tested endpoints:
  - `view sales` for:
    - `GET /api/sales`
    - `GET /api/sales/{sale}`
    - `GET /api/sales-filters`
  - `create sales` for:
    - `POST /api/sales`
  - `delete sales` for:
    - `DELETE /api/sales/{sale}`
- The test setup also creates but does not directly use:
  - `edit sales`
- The authenticated test user is assigned the `Administrator` role, and that role is synced with all created permissions.
- `filters()` uses `User::role(['Commercial', 'Manager', 'Administrator'])`, so Spatie permission pivot tables are also runtime dependencies for that endpoint.

### Tested SaleController behaviors

#### `index()`
The test depends on these behaviors:
- unauthenticated request returns `401`
- returns Laravel paginator JSON with:
  - top-level `total`
  - top-level `data`
- orders by `id desc` by default
- eager loads `commercial`
- returns `commercial: null` when `commercial_id` is null
- filter by `commercial_id`
- filter by `search` against sale `client`
- filter by date range via `date_from` / `date_to`

Controller-side additional runtime behavior not asserted directly but still present:
- eager loads:
  - `commercial`
  - `carrier`
  - `partner`
  - `items.linkedProduct.brand`
  - `items.linkedProduct.tyre`
  - `items.linkedProduct.part`
  - `items.linkedProduct.service`
  - `items.stock`
  - `creator`
  - `updater`
- search also checks:
  - `sales.comments`
  - `products.profile`
  - `products.reference`
  - related `brands.name`
- optional filters also supported in controller:
  - `brand`
  - `city`
  - `payment_method`
  - `status`
  - `payment_status`
  - `client`
  - `partner`
  - sorting via `sort_by` / `sort_direction`

#### `show()`
The test depends on:
- route model binding for `Sale`
- eager-loaded `commercial`
- `commercial` object when `commercial_id` is set
- `commercial: null` when not set

Controller-side additional runtime eager loads same as `index()`.

#### `filters()`
The test depends on:
- response keys:
  - `brands`
  - `clients`
  - `cities`
  - `statuses`
  - `payment_statuses`
  - `partners`
  - `commercials`
- `commercials` includes users having any of roles:
  - `Commercial`
  - `Manager`
  - `Administrator`
- `commercials` ordered by `users.name` ascending
- The admin test user is included because it has `Administrator` role.
- Commercial users are included only after `assignRole(...)`.

Controller-side exact data sources:
- `brands`:
  - from `brands.name`
  - only brands whose `id` appears in `products.brand_id`
  - only for `products.id` referenced by `sale_items.product_id`
- `clients`:
  - distinct non-null `sales.client`
- `cities`:
  - distinct non-null `sales.city`
- `statuses`:
  - distinct non-null `sales.status`
- `payment_statuses`:
  - distinct non-null `sales.payment_status`
- `partners`:
  - all `partners.name`, sorted
- `commercials`:
  - `users` filtered through Spatie role scope

#### `store()`
The test depends on:
- request validation in `StoreSaleRequest`
- successful creation path for stock-tracked item
- response status `201`
- response JSON includes:
  - `client`
  - `total_quantity`
  - `total_sale` cast/formatted as decimal string (`"400.00"`)
- sale row created in `sales`
- item row created in `sale_items`

Controller-side runtime dependencies during store:
- validates:
  - `items.*.product_id` exists in `products`
  - `items.*.stock_id` exists in `stocks` if present
  - `commercial_id` exists in `users`
  - optional `carrier_id` exists in `carriers`
  - optional `partner_id` exists in `partners`
- checks `stocks.quantity >= requested quantity`
- creates `sales` row with recalculated totals
- creates `sale_items` rows
- decrements `stocks.quantity`
- records stock movement via `StockMovementService::recordSaleOut(...)`, which inserts into `stock_movements`
- returns `$sale->load(['items.linkedProduct.brand', 'items.linkedProduct.tyre', 'items.linkedProduct.part', 'items.linkedProduct.service', 'items.stock'])`

Important implication for sqlite bootstrap:
- Even though the test only asserts `sales` and `sale_items`, the request will fail unless `stock_movements` exists.
- Because the response loads product subtype relations, Eloquent may query:
  - `product_tyres`
  - `product_parts`
  - `product_services`
- Since the created product type is `tyre`, `linkedProduct.tyre` is especially likely to be queried.
- The test creates a product with `tire_width`, `tire_height`, `tire_diameter`, but `Product::$fillable` does not include them; they are not required for this sale test to pass because the assertions never inspect them.

#### `destroy()`
The test depends on:
- successful deletion response `204`
- sale removed from `sales`

Controller-side runtime dependencies during destroy:
- accesses `$sale->items`
- if sale status is not `ANNULE`, restores stock quantities for any item with `stock_id`
- records stock movements via `recordSaleIn(...)` into `stock_movements`
- accesses `$sale->payments()`
- plucks `transaction_id`
- deletes related `payments`
- may delete rows from `transactions`
- finally deletes the sale

Important implication:
- Even if no payments exist, the `payments` table must exist because destroy always queries it.
- `transactions` table is only needed if payment rows with non-null `transaction_id` are present; for this specific test path it is not strictly necessary if there are no payments, but including it makes bootstrap safer.

## Models referenced directly or indirectly

### Directly referenced in the test file
- `App\Models\Sale`
- `App\Models\User`
- `Spatie\Permission\Models\Permission`
- `Spatie\Permission\Models\Role`
- `App\Models\Brand`
- `App\Models\Product`
- `App\Models\Stock`

### Indirectly required by controller / model relations / validation
- `App\Http\Controllers\SaleController`
- `App\Http\Requests\StoreSaleRequest`
- `App\Models\SaleItem`
- `App\Models\Partner`
- `App\Models\Payment`
- `App\Models\Transaction`
- `App\Models\StockMovement`
- `App\Services\StockMovementService`

### Indirectly referenced via eager-loaded relations
- `App\Models\Carrier`
- `App\Models\ProductTyre`
- `App\Models\ProductPart`
- `App\Models\ProductService`

### Auth / permission infrastructure involved
- `Laravel\Sanctum\PersonalAccessToken` table usage
- Spatie permission tables:
  - roles
  - permissions
  - model_has_roles
  - model_has_permissions
  - role_has_permissions

## Concrete minimal sqlite table checklist

Below is the practical minimal schema needed to refactor this test away from `RefreshDatabase` and full migrations.

### 1) `users`
Required for:
- factory user creation
- auth
- `commercial_id`
- creator/updater/commercial relations
- Spatie role pivots

Minimum columns:
- `id`
- `name`
- `email`
- `email_verified_at` nullable
- `password`
- `remember_token` nullable
- `phone` nullable
- `commission_rate` nullable
- `must_change_password` default false
- `created_at` nullable
- `updated_at` nullable

### 2) `personal_access_tokens`
Required for Sanctum bearer token auth.

Minimum columns:
- `id`
- `tokenable_type`
- `tokenable_id`
- `name`
- `token`
- `abilities` nullable
- `last_used_at` nullable
- `expires_at` nullable
- `created_at` nullable
- `updated_at` nullable

### 3) `permissions`
Required by test setup and permission middleware.

Minimum columns:
- `id`
- `name`
- `guard_name`
- `created_at` nullable
- `updated_at` nullable

### 4) `roles`
Required by test setup and `User::role(...)`.

Minimum columns:
- `id`
- `name`
- `guard_name`
- `created_at` nullable
- `updated_at` nullable

### 5) `role_has_permissions`
Required by `syncPermissions(...)`.

Minimum columns:
- `permission_id`
- `role_id`

### 6) `model_has_roles`
Required by `assignRole(...)` and `User::role(...)`.

Minimum columns:
- `role_id`
- `model_type`
- `model_id`

### 7) `model_has_permissions`
Not used directly in this test path, but standard Spatie bootstrap should include it.

Minimum columns:
- `permission_id`
- `model_type`
- `model_id`

### 8) `sales`
Core table for nearly all test cases.

Minimum columns actually needed by test/controller:
- `id`
- `date` nullable
- `with_invoice` nullable/default false
- `total_quantity` default 0
- `total_purchase` default 0
- `total_sale` default 0
- `margin` default 0
- `city` nullable
- `carrier_id` nullable
- `tracking_number` nullable
- `partner_id` nullable
- `service` nullable
- `service_fee` nullable/default 0
- `client` nullable
- `client_phone` nullable
- `payment_method` nullable
- `commercial_id` nullable
- `status` nullable
- `payment_status` nullable
- `delivery_date` nullable
- `comments` nullable
- `created_by` nullable
- `updated_by` nullable
- `created_at` nullable
- `updated_at` nullable

### 9) `sale_items`
Required for store, destroy, index/show eager loads, and filters brands query.

Minimum columns:
- `id`
- `sale_id`
- `product_id`
- `stock_id` nullable
- `quantity`
- `purchase_price` default 0
- `selling_price` default 0
- `discount` default 0
- `total_purchase` default 0
- `total_sale` default 0
- `margin` default 0
- `created_at` nullable
- `updated_at` nullable

### 10) `brands`
Required by:
- explicit creation in store test
- filters `brands`
- eager load `items.linkedProduct.brand`

Minimum columns:
- `id`
- `name`
- `logo` nullable
- `is_active` default true
- `created_at` nullable
- `updated_at` nullable

### 11) `products`
Required by:
- store request validation
- sale item relation
- search filter and brand filter logic
- filter brands subquery
- eager loaded linkedProduct

Minimum columns:
- `id`
- `profile` nullable
- `reference` nullable
- `type`
- `brand_id` nullable
- `description` nullable
- `unit` nullable
- `is_active` default true
- `created_at` nullable
- `updated_at` nullable

Notes:
- For this test file, product dimension columns are not required.
- If desired for compatibility with current test data, harmless nullable extras could be added:
  - `tire_width`
  - `tire_height`
  - `tire_diameter`

### 12) `stocks`
Required by:
- store request validation
- stock quantity check
- stock decrement on store
- stock increment on destroy
- eager load `items.stock`

Minimum columns:
- `id`
- `product_id`
- `made_in` nullable
- `dot` nullable
- `depot` nullable
- `zone` nullable
- `quantity` default 0
- `purchase_price` default 0
- `user_id` nullable
- `created_at` nullable
- `updated_at` nullable

### 13) `stock_movements`
Required because store/destroy always call `StockMovementService`.

Minimum columns:
- `id`
- `stock_id`
- `product_id` nullable
- `type`
- `quantity_before` default 0
- `quantity_after` default 0
- `delta` default 0
- `reference_type` nullable
- `reference_id` nullable
- `reason` nullable
- `user_id` nullable
- `created_at` nullable
- `updated_at` nullable

### 14) `partners`
Required because:
- `filters()` always plucks from partners
- store validation has optional `partner_id exists:partners,id`
- `show/index` eager load partner

Minimum columns:
- `id`
- `name`
- `city` nullable
- `phone` nullable
- `mobile` nullable
- `address` nullable
- `montage_price` nullable
- `alignment_price` nullable
- `user_id` nullable
- `created_at` nullable
- `updated_at` nullable

### 15) `payments`
Required because `destroy()` always queries `$sale->payments()`.

Minimum columns:
- `id`
- `sale_id`
- `transaction_id` nullable
- `amount` nullable/default 0
- `date` nullable
- `method` nullable
- `reference` nullable
- `notes` nullable
- `user_id` nullable
- `created_at` nullable
- `updated_at` nullable

### 16) `transactions` (recommended)
Only strictly needed if destroy path may encounter payments with `transaction_id`, but safe to include.

Minimum columns:
- `id`
- `date` nullable
- `amount` nullable/default 0
- `type` nullable
- `category` nullable
- `method` nullable
- `description` nullable
- `person` nullable
- `partner` nullable
- `user_id` nullable
- `account_id` nullable
- `transfer_id` nullable
- `created_at` nullable
- `updated_at` nullable

### 17) `carriers` (recommended)
Not directly exercised, but:
- `show/index` eager load `carrier`
- store validation references `carriers,id`

Minimum columns:
- `id`
- `name` nullable
- `created_at` nullable
- `updated_at` nullable

### 18) `product_tyres` (recommended)
Likely needed because store/show/index response loads `linkedProduct.tyre`.

Minimum columns:
- `id`
- `product_id`
- `created_at` nullable
- `updated_at` nullable

### 19) `product_parts` (recommended safety)
Loaded by sale responses.

Minimum columns:
- `id`
- `product_id`
- `created_at` nullable
- `updated_at` nullable

### 20) `product_services` (recommended safety)
Loaded by sale responses.

Minimum columns:
- `id`
- `product_id`
- `created_at` nullable
- `updated_at` nullable

## Relationships the localized bootstrap must support

- `sales.commercial_id -> users.id`
- `sales.created_by -> users.id`
- `sales.updated_by -> users.id`
- `sales.partner_id -> partners.id` nullable
- `sales.carrier_id -> carriers.id` nullable
- `sale_items.sale_id -> sales.id`
- `sale_items.product_id -> products.id`
- `sale_items.stock_id -> stocks.id` nullable
- `products.brand_id -> brands.id`
- `stocks.product_id -> products.id`
- `stocks.user_id -> users.id`
- `stock_movements.stock_id -> stocks.id`
- `stock_movements.product_id -> products.id` nullable
- `stock_movements.user_id -> users.id` nullable
- `payments.sale_id -> sales.id`
- `payments.transaction_id -> transactions.id` nullable
- `payments.user_id -> users.id` nullable
- `partners.user_id -> users.id` nullable
- `product_tyres.product_id -> products.id`
- `product_parts.product_id -> products.id`
- `product_services.product_id -> products.id`
- Spatie:
  - `role_has_permissions.role_id -> roles.id`
  - `role_has_permissions.permission_id -> permissions.id`
  - `model_has_roles.role_id -> roles.id`
  - `model_has_permissions.permission_id -> permissions.id`

## Minimal seed/setup checklist for the refactored test

1. Create sqlite-local tables listed above if absent.
2. Configure Spatie permission cache reset if needed.
3. Create permissions:
   - `view sales`
   - `create sales`
   - `edit sales`
   - `delete sales`
4. Create roles:
   - `Commercial`
   - `Manager`
   - `Administrator`
5. Sync all created permissions to `Administrator`.
6. Create test user via factory-compatible table schema.
7. Assign `Administrator` role to test user.
8. Use Sanctum token auth headers.
9. For store test:
   - create brand
   - create product
   - create stock
   - ensure matching `product_tyres` row is available if relation loading errors without table presence
10. For destroy test:
   - ensure `payments` table exists even if empty
   - ensure `stock_movements` exists because destroy records movement when sale status is not `ANNULE`

## Short practical recommendation

For the eventual SaleControllerTest sqlite bootstrap, the truly essential tables are:

- `users`
- `personal_access_tokens`
- `permissions`
- `roles`
- `role_has_permissions`
- `model_has_roles`
- `model_has_permissions`
- `sales`
- `sale_items`
- `brands`
- `products`
- `stocks`
- `stock_movements`
- `partners`
- `payments`

And strongly recommended safety tables to prevent eager-load / validation failures:

- `transactions`
- `carriers`
- `product_tyres`
- `product_parts`
- `product_services`