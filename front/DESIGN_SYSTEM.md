# Pneuma POS — Design System Reference

> This file is the authoritative design reference for all frontend work.
> Read it fully before making any UI changes.

---

## Project Context

**Pneuma POS** is a French-language Point of Sale app for a **tire shop** (commerce de pneus).
Angular 21 SPA, standalone components, signals-based state. UI is 100% in French.

---

## CONTENT FUNDAMENTALS

### Language & Tone
- All UI text is in **French** — labels, buttons, messages, placeholders
- Tone: **professional, terse, functional** — this is a business tool, not a consumer app
- Copy is direct and action-oriented: "Nouvelle Vente", "Se connecter", "Réinitialiser"
- No marketing fluff; every word earns its place
- Users are addressed as **vous** (formal)

### Casing Rules
| Context | Rule | Example |
|---|---|---|
| Page titles | Title Case | "Tableau de bord KPI" |
| Button labels | Sentence case | "Nouvelle vente" |
| Table headers | ALL CAPS + letter-spacing | "DATE", "CLIENT", "STATUT" |
| KPI labels | UPPERCASE + letter-spaced | "CA Aujourd'hui", "Marge Nette" |
| Section group titles | UPPERCASE | "📅 Aujourd'hui" |

### Numbers & Currency
- Currency: **DH** (Moroccan Dirham), always suffixed — `1 234.56 DH`
- Angular pipe: `| number:'1.2-2'` — always 2 decimal places
- Always use `font-variant-numeric: tabular-nums` on financial figures
- Dates: `dd/MM/yyyy` (French format) — Angular pipe: `| date:'dd/MM/yyyy'`

### Emoji as Icons
No icon library is used. Emoji are the icon system throughout — keep this consistent.

| Emoji | Usage |
|---|---|
| 🏷️ | Ventes |
| 📦 | Achats / Stock |
| 💰 | Cash Flow / Revenue |
| 🏢 | Fournisseurs |
| 👥 | Utilisateurs |
| 🛞 | Pneus / Produits |
| 📋 | Inventaire |
| 🏭 | Marques |
| 🔐 | Rôles |
| 💳 | Paiements |
| 👁️ | Voir (detail) |
| ✏️ | Modifier |
| 🗑️ | Supprimer |
| 🔍 | Rechercher |
| 📈 | Marge / Tendance |
| ⏳ | Impayés / En attente |
| ⚠️ | Avertissement |

---

## DESIGN TOKENS

### Colors

```scss
// Brand
$primary:       #ff2d37;   // Red — CTAs, active nav, avatars, accents
$primary-dark:  #cc0a13;   // Hover / gradient end
$primary-light: rgba(255, 45, 55, 0.10);  // Tinted bg for icons

// Semantic
$success:       #48bb78;   // Positive margins, PAYÉ status
$success-dark:  #276749;   // Text on light success bg
$danger:        #f56565;   // Negative values, errors
$danger-dark:   #e53e3e;   // Stronger danger text
$warning:       #ed8936;   // EN COURS status
$warning-dark:  #c05621;   // Text on warning bg

// Neutrals
$gray-50:   #f7fafc;   // Page background
$gray-100:  #edf2f7;   // Card borders, table header bg
$gray-200:  #e2e8f0;   // Input borders, dividers
$gray-400:  #a0aec0;   // Placeholder, subtle text
$gray-500:  #718096;   // Muted text, table headers
$gray-700:  #4a5568;   // Label text
$gray-800:  #2d3748;   // Body text (primary)
$gray-950:  #0f172a;   // Darkest text

// Surfaces
$bg-body:   #f7fafc;   // Page background
$bg-card:   #ffffff;   // Card / modal background
$navbar-bg: #1f2937;   // Navigation bar

// CSS Custom Properties (defined in app.scss :root)
// --app-primary, --app-background, --app-surface, --app-text,
// --app-text-muted, --app-border, --app-shadow
```

### Typography

```scss
// Font
$font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
// Always: -webkit-font-smoothing: antialiased

// Scale
$font-size-xs:   0.75rem;   // 12px — badges, micro labels
$font-size-sm:   0.875rem;  // 14px — body small, table cells
$font-size-base: 1rem;      // 16px — body default
$font-size-lg:   1.125rem;  // 18px
$font-size-xl:   1.25rem;   // 20px — H3, section titles
$font-size-2xl:  1.5rem;    // 24px — H2
$font-size-4xl:  1.8rem;    // ~29px — H1 page titles

// Weights: 400 (body), 500 (medium), 600 (semibold), 700 (bold)
// KPI values: 1.75rem, weight 700, tabular-nums
// Nav links: 0.82rem, weight 500
// Table headers: 0.75rem–0.875rem, weight 700, uppercase + letter-spacing
```

### Spacing

```scss
$space-1: 0.25rem;   //  4px
$space-2: 0.5rem;    //  8px
$space-3: 0.75rem;   // 12px
$space-4: 1rem;      // 16px
$space-6: 1.5rem;    // 24px — standard card padding, column gap
$space-8: 2rem;      // 32px — section gap
$space-12: 3rem;     // 48px
```

### Border Radii

```scss
$radius-xs:     4px;    // Tiny chips
$radius-sm:     8px;    // Buttons, inputs, icon buttons
$radius-md:     12px;   // Cards, modals, table containers
$radius-lg:     16px;   // KPI cards
$radius-full:   999px;  // Badges, pills, status selects
$radius-circle: 50%;    // Avatars
```

### Shadows

```scss
$shadow-sm:     0 1px 3px rgba(0, 0, 0, 0.08);         // Default card
$shadow-md:     0 4px 12px rgba(0, 0, 0, 0.08);         // Elevated card
$shadow-lg:     0 10px 25px rgba(15, 23, 42, 0.08);     // App shell
$shadow-xl:     0 20px 60px rgba(0, 0, 0, 0.15);        // Login card
$shadow-navbar: 0 2px 10px rgba(15, 23, 42, 0.16);      // Sticky navbar
```

---

## COMPONENTS

### Buttons

```scss
// Primary — red, used for main CTAs
.btn-primary {
  background: $primary;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: $radius-sm;  // 8px
  font-weight: 500;
  &:hover { filter: brightness(0.95); }
}

// Primary gradient — login / emphasis
.btn-primary-gradient {
  background: linear-gradient(135deg, #ff2d37 0%, #cc0a13 100%);
  &:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(255,45,55,0.4); }
}

// Secondary — white with border
.btn-secondary {
  background: white;
  border: 1px solid $gray-200;
  color: $gray-800;
  &:hover { background: $bg-body; }
}

// Icon button — square, emoji icon
.btn-icon {
  width: 2rem; height: 2rem;
  border: 1px solid $border-color;
  background: white;
  border-radius: $radius-sm;
  display: inline-flex; align-items: center; justify-content: center;
  &:hover { background: $bg-body; }
}

// Logout (navbar context — dark bg)
.btn-logout {
  background: transparent;
  color: #f8fafc;
  border: 1px solid rgba(255,255,255,0.18);
  padding: 0.3rem 0.75rem;
  border-radius: 6px;
  font-size: 0.8rem;
}
```

### Badges & Status

```scss
// Base badge — pill shape
.badge {
  padding: 0.25rem 0.5rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}

// Variants
.badge-success { background: rgba(#48bb78, 0.10); color: #276749; }  // PAYÉ
.badge-warning { background: rgba(#ed8936, 0.10); color: #c05621; }  // PARTIEL
.badge-danger  { background: rgba(#f56565, 0.10); color: #e53e3e; }  // NON PAYÉ

// Sale status (inline <select> styled as pill)
.status-select { appearance: none; border-radius: 999px; font-size: 0.75rem; font-weight: 600; border: 1px solid transparent; }
.bg-en-cours   { background: rgba(#ed8936, 0.10); color: #c05621; }
.bg-livre      { background: rgba(#276749, 0.15); color: #276749; }
.bg-monte      { background: rgba(#48bb78, 0.15); color: #2f855a; }
```

### Form Inputs

```scss
.form-control {
  padding: 0.5rem 0.75rem;        // or 0.7rem 1rem for login
  border: 1px solid $border-color; // or 2px for login
  border-radius: $radius-sm;       // 8px
  font-size: 0.875rem;
  &:focus {
    outline: none;
    border-color: $primary;
    box-shadow: 0 0 0 3px rgba($primary, 0.10);
  }
  &.invalid { border-color: $danger-dark; }
}
```

### Cards

```scss
// Standard card
.card {
  background: $bg-card;
  border-radius: $radius-md;       // 12px
  border: 1px solid #edf2f7;
  box-shadow: $shadow-sm;
}

// KPI card — larger radius, gradient variants, hover lift
.kpi-card {
  border-radius: $radius-lg;       // 16px
  padding: 1.5rem;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  &:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.08); }
  &.highlight-red  { border-color: #feb2b2; background: linear-gradient(135deg,#fff5f5 0%,#fff 100%); }
  &.highlight-blue { border-color: #bee3f8; background: linear-gradient(135deg,#ebf8ff 0%,#fff 100%); }
  .kpi-icon  { width:48px; height:48px; border-radius:12px; background:#f7fafc; }
  .kpi-label { font-size:0.85rem; color:$text-muted; text-transform:uppercase; font-weight:600; letter-spacing:0.05em; }
  .kpi-val   { font-size:1.75rem; font-weight:700; font-variant-numeric:tabular-nums; }
  .kpi-badge { position:absolute; top:1.5rem; right:1.5rem; background:#edf2f7; border-radius:20px; font-size:0.75rem; font-weight:600; }
}

// Quick-link card
.quick-link-card {
  border-radius: $radius-md;
  border: 1px solid transparent;
  transition: all 0.2s;
  &:hover { transform: translateY(-2px); border-color: $primary; box-shadow: 0 8px 20px rgba(0,0,0,0.10); }
  .ql-arrow { transition: transform 0.2s; }
  &:hover .ql-arrow { transform: translateX(3px); color: $primary; }
}
```

### Tables

```scss
.table {
  width: 100%; border-collapse: collapse;
  th {
    background: $bg-body;
    color: $text-muted;
    text-transform: uppercase;
    font-size: 0.75rem–0.875rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    padding: 0.5rem 0.75rem;
    border-bottom: 2px solid $border-color;
    &.sortable { cursor: pointer; &:hover { color: $text-dark; background: #e5e7eb; } }
  }
  td {
    padding: 0.5rem 0.75rem;
    font-size: 0.8125rem;
    border-bottom: 1px solid $border-color;
    white-space: nowrap;
  }
  tbody tr:hover td { background: rgba($bg-body, 0.5); }
}

// Section title accent (left red border)
.section-title {
  border-left: 4px solid $primary;
  padding-left: 0.75rem;
  font-size: 1.25rem;
  font-weight: 700;
  color: $text-dark;
}
```

### Navbar

```scss
.navbar {
  background: #1f2937;
  height: 56px;
  padding: 0 1.5rem;
  box-shadow: 0 2px 10px rgba(15,23,42,0.16);
  position: sticky; top: 0; z-index: 1000;
}
.navbar-links a {
  color: rgba(248,250,252,0.88);
  font-size: 0.82rem; font-weight: 500;
  padding: 0.4rem 0.7rem; border-radius: 6px;
  &:hover { background: rgba(255,255,255,0.10); }
  &.active { background: $primary; color: white; font-weight: 600; }
}
// Responsive: hamburger menu below 1024px
```

### Modals

```scss
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
}
.modal-container {
  background: white;
  border-radius: $radius-md;   // 12px
  width: 95vw; max-width: 1400px; max-height: 90vh;
  box-shadow: $shadow-md;
}
.modal-header { padding: 1.5rem; border-bottom: 1px solid $border-color; }
.modal-body   { padding: 1.5rem; overflow-y: auto; }
```

---

## RESPONSIVE BREAKPOINTS

```scss
@media (max-width: 1024px) {
  // Navbar: show hamburger, hide links by default
  // App shell: switch from grid (sidebar + content) to block
}

@media (max-width: 768px) {
  // Main content padding: 1rem 0.75rem
  // KPI grid: 2 columns
  // Summary cards: 2 columns
  // Table: replace with stacked card list
  // Page header: stack vertically, full-width CTA button
  // Filters grid: 2 columns, search spans full width
}

@media (max-width: 480px) {
  // Summary cards: 1 column
  // Filters: 1 column
}
```

---

## DARK MODE

Activated via `[data-theme-resolved='dark']` on `:root`.

```scss
:root[data-theme-resolved='dark'] {
  --app-background: #0f172a;
  --app-text:       #f8fafc;
  --app-text-muted: #cbd5e1;
  --app-border:     rgba(148, 163, 184, 0.24);
  --app-surface:    #1e293b;
  --app-shadow:     0 16px 40px rgba(2, 6, 23, 0.45);
}
```

---

## FILE LOCATIONS

| Token / style | File |
|---|---|
| CSS custom properties (`:root`) | `front/src/app/app.scss` |
| SCSS variables | `front/src/app/features/_variables.scss` |
| Global reset + print styles | `front/src/styles.scss` |
| Navbar styles | `front/src/app/shared/navbar/navbar.component.scss` |
| Dashboard styles | `front/src/app/features/dashboard/dashboard.component.scss` |
| Sales page styles | `front/src/app/features/sales/pages/sales-page.component.scss` |
| Sales variables | `front/src/app/features/sales/variables.scss` |
| Login styles | `front/src/app/features/auth/login/login.component.scss` |
