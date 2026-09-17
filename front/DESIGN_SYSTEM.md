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

### Icons
Emoji are no longer used as icons anywhere (refonte 2b, étape 1). Icons are
Lucide-style inline SVGs rendered via `<app-icon name="…" [size]="14" />`
(`front/src/app/shared/icon/icon.component.ts` — `PATHS` holds the SVG bodies,
`stroke-linecap` is `square` for navigation/objects and `round` for
alerts/signs). Sort indicators use the dedicated
`<app-sort-icon [active]="…" [dir]="…" />` (`shared/icon/sort-icon.component.ts`)
instead of a ternary.

| Icon name | Usage |
|---|---|
| `tag` | Ventes |
| `package` | Achats / Stock / Produits |
| `banknote` | Cash Flow / Finance |
| `building` | Fournisseurs |
| `users` | Utilisateurs |
| `building-2` | Marques |
| `lock` | Rôles |
| `credit-card` | Paiements |
| `view` | Voir (detail) |
| `edit` | Modifier |
| `trash` | Supprimer |
| `search` | Rechercher |
| `trending-up` | Marge / Tendance |
| `clock` | Impayés / En attente |
| `alert-triangle` | Avertissement |

---

## DESIGN TOKENS

### Colors

```scss
// Marque (refonte 2b)
$primary:          #ff2d37;   // action principale, une seule par écran
$primary-dark:     #c2181f;   // argent dû, retard, texte d'alerte

// Encre
$text-dark:        #0c1e33;   // texte principal, filets forts
$text-secondary:   #41546e;   // texte secondaire
$text-muted:       #4a5c75;   // libellés, sous-lignes (plancher contraste 4,5:1)

// Surfaces
$bg-body:          #e6edf7;   // fond d'application
$bg-card:          #ffffff;   // surface de contenu
$bg-subtle:        #f4f8fd;   // barre haute, en-têtes de colonne, volet latéral
$rail-bg:          #081627;   // réservé au rail de navigation (étape 3)

// Filets
$border-color:     #adc2da;   // bords de champ et de bouton
$border-strong:    #cfdcec;   // séparation de blocs
$border-subtle:    #e7eef8;   // filets de ligne, fonds de jauge

// Sens (une couleur = un sens)
$income-color:     #15616d;   // encaissé, payé, entrée d'argent
$expense-color:    #c2181f;   // argent dû, sortie
$invoice-color:    #2f4fb8;   // à facturer (Service Auto)
$warning-color:    #8a5a00;   // seuil, attente, risque légal
$warning-border:   #d4a017;   // bord d'alerte, jauge sous seuil
$alert-ink:        #8f1218;   // texte d'alerte sur fond rosé

// CSS Custom Properties (defined in styles.scss :root — NOT app.scss, see below)
// --app-primary, --app-accent, --app-background, --app-surface, --app-text,
// --app-text-muted, --app-border, --app-shadow (none)
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

**0 partout, sans exception** (refonte 2b). Enforced globally via
`*, *::before, *::after { border-radius: 0 !important; }` in `styles.scss` —
a transitory rule until `_page-layout.scss` and the individual screens drop
their own hardcoded radii (étapes 2 et 4). `$radius`/`$radius-sm`/`$radius-lg`
in `_variables.scss` are all `0`.

### Shadows

**None.** `$shadow-sm`/`$shadow-md` in `_variables.scss` are `none`;
`--app-shadow` in `styles.scss` is `none` in both light and dark. Separation
between elements comes from 1px rules (`$border-color`, `$border-subtle`),
not elevation. The `box-shadow` used by `:focus-visible` rings is
**not** touched — it's not an elevation shadow and stays for accessibility.

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

// Déconnexion (menu déroulant sous l'avatar de la barre haute, fond clair)
.topbar-logout {
  background: none;
  color: #c2181f;
  font-size: 0.8125rem;
  font-weight: 600;
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

### Rail + barre haute (refonte 2b, étape 3)

Remplace l'ancien navbar horizontal/vertical (`menuLayout`, disparu). Deux
composants distincts, montés côte à côte dans `app.html` :

```scss
// Rail — 72px, sombre, fixe à gauche
.rail {
  width: 72px;
  background: #081627;
}
.rail-item {
  width: 56px; height: 54px;
  color: rgba(230,237,247,.66);
  font-size: 8.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
  &.active { background: #ff2d37; color: #fff; }
}
// Un item avec enfants ouvre un volet superposé (.rail-flyout) à droite du
// rail au lieu d'un dropdown horizontal — un seul volet ouvert à la fois.

// Barre haute — 60px, claire, pleine largeur au-dessus du rail
.topbar {
  height: 60px;
  background: #f4f8fd;
  border-bottom: 1px solid #cfdcec;
}
```

La case de recherche de la barre haute est un placeholder visuel (`⌘K`) —
aucune palette de commandes n'est encore branchée dessus.

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
| CSS custom properties (`:root`) | `front/src/styles.scss` (NOT `app.scss` — a `:root` rule written inside a component's stylesheet is scoped away by Angular's view encapsulation and never matches `<html>`) |
| SCSS variables | `front/src/app/features/_variables.scss` |
| Global reset + print styles | `front/src/styles.scss` |
| Rail (navigation) styles | `front/src/app/shared/rail/rail.component.scss` |
| Barre haute styles | `front/src/app/shared/topbar/topbar.component.scss` |
| Dashboard styles | `front/src/app/features/dashboard/dashboard.component.scss` |
| Sales page styles | `front/src/app/features/sales/pages/sales-page.component.scss` |
| Sales variables | `front/src/app/features/sales/variables.scss` |
| Login styles | `front/src/app/features/auth/login/login.component.scss` |
