# Pneuma POS — Refactoring Plan and Target Architecture

## 1. Objective

Refactor the current `pneuma-pos` application into a cleaner, more maintainable, and scalable architecture **without a full rewrite** and **without breaking current business behavior**.

This plan is designed for the current stack:

- **Frontend**: Angular 21
- **Backend**: Laravel 13 / PHP 8.4
- **Database**: MySQL 8
- **Auth**: Sanctum
- **Authorization**: Roles and permissions
- **Main business domains**:
  - authentication
  - dashboard
  - accounts
  - cash flow / transactions
  - sales
  - purchases
  - payments
  - stock
  - products
  - brands
  - suppliers
  - carriers
  - partners
  - users
  - roles / permissions

---

## 2. Refactoring principles

The refactor must follow these rules:

1. **No big-bang rewrite**
   - Refactor incrementally.
   - Keep the application runnable during the process.

2. **Business safety first**
   - High-risk modules such as sales, purchases, payments, stock mutations, and transactions must be handled later and carefully.

3. **Module-first organization**
   - Each business domain should own its frontend and backend code.

4. **Thin controllers and thin route pages**
   - Controllers should orchestrate.
   - Angular route-level components should coordinate UI behavior, not contain all business and API logic.

5. **Clear separation of concerns**
   - Validation, serialization, persistence, business rules, and UI rendering must not be mixed.

6. **Standardize before scaling**
   - Define conventions first.
   - Validate the pattern on one pilot module.
   - Roll out to the rest of the codebase after the pilot is successful.

---

## 3. Current architecture assessment

## 3.1 Frontend observations

Current Angular structure already contains useful foundations:

```text
front/src/app/
  core/
  features/
  shared/
```

Current strengths:

- route lazy-loading is already used through `loadComponent`
- auth and permission guards already exist
- features are already separated into business folders
- shared navbar exists
- models and services are already centralized and reusable

Current issues to address:

- `core/services/` contains domain-specific services that should be feature-owned
- `core/models/` contains many business models and is becoming a global dump
- `app.routes.ts` is flat and centralized
- many feature folders likely mix:
  - page logic
  - form logic
  - modal/dialog logic
  - API communication
  - data mapping
  - presentation concerns
- repeated CRUD patterns probably exist across brands, carriers, partners, suppliers, users, and roles
- some folders contain inconsistent naming or duplicate-style files

---

## 3.2 Backend observations

Current Laravel backend is functional and feature-complete, but architecture is becoming centralized.

Current strengths:

- REST-style API already exists
- Sanctum-based auth is already integrated
- roles and permissions are already in place
- domain models exist for core entities
- migrations already cover the business model in detail

Current issues to address:

- `back/routes/api.php` is large and acting as a central registration monolith
- controllers are likely responsible for too much orchestration and business logic
- repeated patterns exist across CRUD endpoints
- request validation may be inconsistent between modules
- query/filter/summary logic is likely embedded inside controllers
- output serialization is not clearly separated everywhere
- domain boundaries are not explicit enough for long-term maintenance

---

## 4. Refactoring goals

At the end of the refactor, the project should have:

- clear domain ownership
- smaller and more readable files
- reduced duplication across modules
- better frontend feature encapsulation
- better backend separation between HTTP layer and domain logic
- better testability
- easier onboarding for future developers
- safer future feature additions

---

## 5. Target frontend architecture

## 5.1 Desired structure

```text
front/src/app/
  app/
    app.routes.ts
    app.config.ts

  core/
    auth/
    guards/
    interceptors/
    http/
    config/
    layout/

  shared/
    ui/
    directives/
    pipes/
    utils/
    types/

  features/
    dashboard/
      pages/
      components/
      data-access/
      models/

    accounts/
      pages/
      components/
      data-access/
      models/

    brands/
      pages/
      components/
      data-access/
      models/

    carriers/
      pages/
      components/
      data-access/
      models/

    partners/
      pages/
      components/
      data-access/
      models/

    products/
      pages/
      components/
      data-access/
      models/

    purchases/
      pages/
      components/
      data-access/
      models/
      store/

    sales/
      pages/
      components/
      data-access/
      models/
      store/

    stock/
      pages/
      components/
      data-access/
      models/
```

---

## 5.2 Frontend ownership rules

### `core/`
Keep only application-wide singleton concerns in `core/`, for example:

- auth state and session management
- route guards
- global interceptors
- app-wide configuration
- layout shell concerns
- base HTTP utilities if truly generic

### `shared/`
Keep only reusable, non-domain-specific assets in `shared/`, for example:

- generic table/list UI
- buttons, dialogs, form wrappers
- pipes and directives
- utility functions
- shared type helpers

### `features/<domain>/`
Each feature must own:

- pages
- reusable feature-specific components
- API services for that feature
- feature-specific models / types
- optional local state handling

### Specific migration rule
Move feature-specific services out of `core/services` into feature-owned `data-access/`.

Examples:

- `core/services/brand.service.ts` → `features/brands/data-access/brand.service.ts`
- `core/services/product.service.ts` → `features/products/data-access/product.service.ts`
- `core/services/sale.service.ts` → `features/sales/data-access/sale.service.ts`

Move feature-specific models out of `core/models` into feature-owned `models/` where appropriate.

Examples:

- `core/models/brand.model.ts` → `features/brands/models/brand.model.ts`
- `core/models/product.model.ts` → `features/products/models/product.model.ts`

Only truly global models should remain in `core/` or `shared/types/`.

---

## 5.3 Frontend routing target

The current `app.routes.ts` is functional but flat. The target is to keep route definitions readable and group route metadata more consistently.

Two acceptable target styles:

### Option A — grouped main route file
Keep one route file, but organize imports and group by domain.

### Option B — feature route fragments
Create route fragments owned by features and compose them in the root route file.

Example:

```text
front/src/app/app.routes.ts
front/src/app/features/auth/auth.routes.ts
front/src/app/features/sales/sales.routes.ts
front/src/app/features/purchases/purchases.routes.ts
```

Preferred direction for this codebase:
- start with **Option A** for minimal disruption
- move to **Option B** once feature folders are stabilized

---

## 6. Target backend architecture

## 6.1 Desired structure

```text
back/app/
  Domain/
    Auth/
    Accounts/
    Brands/
    Carriers/
    Partners/
    Products/
    Purchases/
    Sales/
    Stock/
    Transactions/
    Users/
    Roles/

  Http/
    Controllers/
      Api/
        Auth/
        Accounts/
        Brands/
        Carriers/
        Partners/
        Products/
        Purchases/
        Sales/
        Stock/
        Transactions/
        Users/
        Roles/

    Requests/
      Auth/
      Accounts/
      Brands/
      Carriers/
      Partners/
      Products/
      Purchases/
      Sales/
      Stock/
      Transactions/
      Users/
      Roles/

    Resources/
      Auth/
      Accounts/
      Brands/
      Carriers/
      Partners/
      Products/
      Purchases/
      Sales/
      Stock/
      Transactions/
      Users/
      Roles/

  Support/
    Filters/
    Pagination/
    Helpers/
    Exceptions/
```

---

## 6.2 Backend ownership rules

### Controllers
Controllers should:

- receive the HTTP request
- authorize access
- delegate to action/service/query classes
- return API resources or JSON responses

Controllers should **not** contain large business workflows.

### Requests
Use Form Requests consistently for:

- create validation
- update validation
- specialized command validation such as import, transfer, payment creation, etc.

### Resources
Use Laravel API Resources consistently for:

- item responses
- collection responses
- normalized API output structure

### Domain / Services / Actions
Business rules should move into domain-level classes:

- create sale
- update sale
- create purchase
- create payment
- transfer between accounts
- import stock
- toggle active entities
- generate transaction records
- adjust stock movements

### Query / Filter classes
Extract complex listing/filter/summary logic from controllers into dedicated query/filter classes when necessary.

---

## 6.3 Backend routes target

Current:
- one large `back/routes/api.php`

Target:
```text
back/routes/api.php
back/routes/api/auth.php
back/routes/api/accounts.php
back/routes/api/catalog.php
back/routes/api/sales.php
back/routes/api/purchases.php
back/routes/api/stock.php
back/routes/api/admin.php
```

### Suggested grouping
- `auth.php`
  - login, logout, user, change-password

- `accounts.php`
  - accounts
  - transfers
  - transactions / cash flow if kept together

- `catalog.php`
  - brands
  - products
  - suppliers
  - carriers
  - partners

- `sales.php`
  - sales
  - sale payments

- `purchases.php`
  - purchases
  - purchase payments

- `stock.php`
  - stock
  - stock movements
  - stock import

- `admin.php`
  - users
  - roles
  - permissions
  - dashboard KPI if kept admin-only

Then keep `routes/api.php` as the composition root only.

---

## 7. Recommended execution order

This is the safest order for this project.

### Phase 0 — Audit and blueprint
Purpose:
- define the target
- document rules
- identify risk areas before moving files

Tasks:
- inventory modules and major files
- identify oversized files and repeated patterns
- identify feature ownership problems
- identify critical business flows
- define coding and folder conventions
- validate the target architecture

Deliverables:
- architecture document
- module migration checklist
- agreed pilot module

---

### Phase 1 — Foundation refactor
Purpose:
- prepare the structure without changing business behavior

Frontend tasks:
- define feature folder conventions
- create `pages/`, `components/`, `data-access/`, `models/` structure
- define routing organization standard
- classify current `core` code into:
  - keep in core
  - move to feature
  - move to shared

Backend tasks:
- split route files by domain
- define controller/request/resource conventions
- introduce initial `Domain/` structure
- prepare common support folders for filters/helpers

Deliverables:
- clearer folder boundaries
- smaller route files
- written conventions for future refactors

---

### Phase 2 — Pilot module refactor
Purpose:
- validate the architecture on one safe module

Recommended pilot modules:
- `brands`
- `suppliers`
- `partners`
- `carriers`

Preferred first module:
- **brands**

Why:
- medium-small scope
- low business risk
- enough CRUD behavior to validate the pattern

Tasks for the pilot module:

Frontend:
- move service into `features/brands/data-access`
- move brand model into `features/brands/models`
- separate route/page component from brand form component if needed
- clean imports and references
- align naming and feature ownership

Backend:
- isolate routes into the correct route file
- introduce/create Form Requests if missing
- introduce Resource classes if missing
- slim the controller
- extract business operations into a service/action if needed

Deliverables:
- one feature fully aligned with the target architecture
- repeatable pattern for other CRUD modules

---

### Phase 3 — Low-complexity CRUD modules
Purpose:
- roll out the validated pattern to simple domains

Recommended order:
1. brands
2. carriers
3. partners
4. suppliers
5. users
6. roles
7. accounts

Tasks:
- move frontend services and models to feature ownership
- standardize form/list/detail component structure
- standardize backend requests/resources/controllers
- reduce duplicated CRUD boilerplate
- normalize import paths and naming

Deliverables:
- consistent low-complexity module structure
- reduced duplication
- easier maintainability

---

### Phase 4 — Catalog and stock modules
Purpose:
- handle medium-complexity logic

Modules:
- products
- stock
- stock movements

Tasks:
- extract filtering/query logic
- separate import logic from standard CRUD
- isolate stock movement logic
- simplify frontend page orchestration
- ensure product/stock rules are clearly organized

Deliverables:
- better separation for catalog and inventory logic
- improved maintainability for stock-sensitive operations

---

### Phase 5 — Transactional modules
Purpose:
- refactor the business-critical workflows

Modules:
- sales
- purchases
- sale payments
- purchase payments
- cash flow / transactions

Tasks:
- map side effects explicitly
- extract business workflows into actions/services
- reduce controller complexity
- separate frontend route pages from payment/detail/form panels
- normalize API resources and validation
- make stock, payment, and transaction flows easier to reason about

Special care required for:
- stock mutation side effects
- transaction generation
- balance recalculation
- commissions
- reporting summaries

Deliverables:
- cleaner critical business flows
- improved testability
- reduced risk of accidental regressions in future changes

---

### Phase 6 — Cross-cutting cleanup
Purpose:
- remove structural debt after module refactors

Tasks:
- remove dead files
- remove duplicated or abandoned code
- normalize naming conventions
- normalize API response shape
- normalize error handling
- normalize Angular typing and imports
- centralize only proven shared utilities

Deliverables:
- lower maintenance cost
- cleaner repository
- reduced accidental complexity

---

### Phase 7 — Tests and verification
Purpose:
- secure critical flows after refactoring

Backend test priorities:
- auth
- create/update sale
- create/update purchase
- create payment
- stock import
- role/permission access
- account transfers

Frontend test priorities:
- auth guard behavior
- permission guard behavior
- route access
- critical forms
- service contract behavior
- high-value page flows

Deliverables:
- regression protection
- confidence to continue future refactors safely

---

### Phase 8 — Documentation and handoff
Purpose:
- make the new architecture understandable and sustainable

Tasks:
- update `README.md`
- document architecture conventions
- document how to add a new module
- document backend layering:
  - Request
  - Controller
  - Service/Action
  - Resource
- document frontend layering:
  - page
  - component
  - data-access
  - model

Deliverables:
- maintainable technical documentation
- easier onboarding for new developers

---

## 8. Risk map

## High-risk areas
These areas require extra care and should not be refactored first:

- sales creation/update
- purchase creation/update
- payment flows
- stock updates and stock movements
- automatic transaction generation
- dashboard summaries if tightly coupled to existing queries
- roles/permissions enforcement

## Risk reduction strategy
- keep API contracts stable during early phases
- refactor internals first, behavior later
- use one pilot module before scaling
- verify each migrated module before moving on
- add tests for critical workflows before large transactional refactors

---

## 9. Definition of done

The refactor is considered successful when:

- frontend code is owned by feature/domain instead of central dumping folders
- backend route files are split and easier to navigate
- validation, serialization, and business logic are clearly separated
- controller/component responsibilities are reduced
- duplicated CRUD patterns are minimized
- critical workflows are covered by tests
- documentation reflects the new architecture

---

## 10. First milestone recommendation

The best first concrete milestone is:

1. finalize this refactoring plan
2. split Laravel route registration by domain
3. create the target frontend feature ownership conventions
4. refactor **`brands`** as the pilot module
5. validate the pattern before touching more critical domains

This provides a meaningful architectural improvement with low business risk.

---

## 11. Immediate actionable backlog

### Milestone 1 — Architecture foundations
- [ ] Split `back/routes/api.php` into domain route files
- [ ] Create the initial backend `Domain/` and `Http/Resources/` structure
- [ ] Define which Angular `core/services` stay in core and which move to features
- [ ] Define which Angular `core/models` stay global and which move to features
- [ ] Normalize route organization strategy for Angular

### Milestone 2 — Pilot module (`brands`)
- [ ] Move brand frontend service to `features/brands/data-access`
- [ ] Move brand model to `features/brands/models`
- [ ] Refactor brand page/component structure if needed
- [ ] Isolate brand routes on backend
- [ ] Add or normalize Brand Form Requests
- [ ] Add or normalize Brand API Resource
- [ ] Slim down Brand controller

### Milestone 3 — Rollout
- [ ] Apply the same pattern to carriers
- [ ] Apply the same pattern to partners
- [ ] Apply the same pattern to suppliers
- [ ] Apply the same pattern to users/roles/accounts

### Milestone 4 — Critical business modules
- [ ] Refactor products and stock
- [ ] Refactor sales and payments
- [ ] Refactor purchases and purchase payments
- [ ] Refactor cash flow / transactions

### Milestone 5 — Quality
- [ ] Add/strengthen backend tests
- [ ] Add/strengthen frontend tests
- [ ] Remove dead code and inconsistencies
- [ ] Update README and architecture docs

---

## 12. Notes for implementation

### Recommended strategy
- work in small pull requests / commits
- avoid mixing architectural movement with business rule changes
- validate after each module
- keep naming conventions consistent
- prefer extraction and relocation over rewriting logic from scratch

### Suggested commit sequence
1. `docs: add refactoring architecture plan`
2. `refactor(api): split route registration by domain`
3. `refactor(front): define feature-owned data-access and models`
4. `refactor(brands): migrate brands module to target architecture`
5. `refactor(crud): migrate low-complexity modules`
6. `refactor(stock): isolate product and stock domain logic`
7. `refactor(sales): extract transactional workflows`
8. `test: add regression coverage for critical flows`
9. `docs: update architecture and onboarding guide`

---

This document should be used as the implementation roadmap for the refactoring effort.
