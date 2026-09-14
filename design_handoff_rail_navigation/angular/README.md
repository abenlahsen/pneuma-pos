# Intégration de la direction 1a dans pneuma-pos

Cinq étapes, de la moins risquée à la plus structurante. Les étapes 1 et 2
sont indépendantes du rail : elles valent même si vous changez d'avis.

Tous les chemins sont relatifs à `front/`.

---

## Étape 1 — Les tokens et les états

**Invisible pour l'équipe.** Aucun écran ne change d'aspect.

1. Copier `_tokens.scss` → `src/app/_tokens.scss`.
2. Dans `src/styles.scss`, en tête de fichier :

   ```scss
   @use './app/_tokens.scss';
   ```

   et remplacer l'import Inter par Archivo :

   ```scss
   @import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&display=swap');
   ```

   puis, dans `html, body` et dans la règle `input, select, textarea, button`,
   remplacer la pile `'Inter', …` par `var(--font)`.

3. Copier `app.scss` → `src/app/app.scss` (le bloc `:root` y a disparu ;
   il vit maintenant dans `_tokens.scss`).

4. **`src/app/features/_variables.scss` : ne pas y mettre `var(--…)`.**
   Le code existant appelle `rgba($primary, 0.10)`, et `rgba()` de Sass ne
   sait pas manipuler une propriété CSS. Garder donc des littéraux, alignés
   sur les nouveaux tokens, et considérer le fichier comme déprécié :

   ```scss
   // DÉPRÉCIÉ — nouveaux styles : utiliser var(--…) de _tokens.scss.
   // Valeurs maintenues en littéral parce que rgba()/darken() de Sass
   // ne fonctionnent pas sur une propriété CSS.
   $primary:       #ec3013;
   $primary-dark:  #dd2b0f;
   $income-color:  #1b6b3a;   // était #48bb78 — 2,4:1, sous le seuil
   $expense-color: #ae1800;   // était #f56565 — 3,1:1
   $warning-color: #8a4b06;   // était #ed8936
   $text-dark:     #201e1d;
   $text-muted:    #605d5d;
   $text-light:    #7d7979;   // était #a0aec0 — 2,3:1
   $bg-body:       #f3f2f2;
   $bg-card:       #ffffff;
   $border-color:  #bab6b6;
   $border-subtle: #d7d3d3;
   $radius:        8px;
   $radius-sm:     8px;
   $radius-lg:     12px;
   ```

   Au fil des reprises d'écran, remplacer chaque `$var` par son `var(--…)`
   et supprimer l'entrée. Le fichier doit finir vide.

5. Supprimer les blocs `--navbar-*` du navbar (étape 3 les retire avec lui).

**Vérification :** naviguer au clavier — l'anneau de focus doit être rouge
partout, plus jamais bleu. Basculer en mode sombre : les cartes doivent
devenir sombres (c'était le bug `--app-surface`).

---

## Étape 2 — Les icônes

**Visible, sans réapprentissage.**

1. Copier `icon.component.ts` → `src/app/shared/icon/icon.component.ts`.
2. Retirer les emoji des libellés partout où ils préfixent du texte, et
   poser `<app-icon name="…" />` à la place. Les clés de `PATHS` reprennent
   une à une les 17 emoji de `DESIGN_SYSTEM.md` :

   | Emoji | `name` | Emoji | `name` |
   |---|---|---|---|
   | 🏠 | `home` | 🏦 | `finance` |
   | 🏷️ | `sales` | 🎯 | `bonus` |
   | 🔧 | `service` | 🧾 | `payroll` |
   | 📦 | `purchases` | 📊 📈 | `reporting` `kpi` |
   | 💰 | `cash` | 👥 | `users` |
   | 🛞 | `stock` | 🔐 | `roles` |
   | 📋 | `inventory` | 📋 | `activity` |
   | 🏭 | `brands` | ⚙️ | `settings` |
   | 🤝 | `parties` `partner` | 🔍 | `search` |
   | 🧑‍💼 | `client` | 👁️ ✏️ 🗑️ | `view` `edit` `delete` |
   | 🏢 | `supplier` | ⚠️ ⏳ | `warning` `pending` |
   | 🚚 | `carrier` | 💳 | `invoice` |

3. Mettre à jour `DESIGN_SYSTEM.md` : la section « Emoji as Icons » devient
   « Icons — Lucide via `<app-icon>` ». Sinon la doc et le code divergent.

**Recherche utile pour trouver les occurrences :**

```bash
grep -rP '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' src/app --include=*.html --include=*.ts
```

---

## Étape 3 — Le rail et le panneau

**Le changement de fond.**

1. Copier dans `src/app/shared/rail/` :
   `rail.component.ts`, `rail.component.html`, `rail.component.scss`.
2. Copier `app.html` → `src/app/app.html`.
3. Dans `src/app/app.ts` : remplacer l'import `NavbarComponent` par
   `RailComponent`, et supprimer `menuLayout` / `companySettings` /
   l'import `MenuLayout` — la disposition n'est plus un réglage.
4. Supprimer `src/app/shared/navbar/` (les trois fichiers + le spec).
5. Dans les réglages entreprise, retirer le champ `menu_layout` du
   formulaire et du modèle. Le backend peut garder la colonne.

**Ce qui est repris à l'identique :** la liste des destinations, les clés de
permission, `hasPermission()`. **Ce qui disparaît :** `expandedGroups` et
l'accordéon additif — un seul panneau ouvert à la fois, fermé à la
navigation, sur `Échap` et au clic hors zone.

**Vérification :** avec un compte restreint, un groupe dont aucun enfant
n'est autorisé ne doit pas apparaître dans le rail.

---

## Étape 4 — La recherche `Ctrl K`

**Développement neuf.** Peut être livré après le rail sans le bloquer.

Composant autonome `src/app/shared/command-palette/`, trois sources dans une
seule liste :

- les destinations — `RailComponent.allItems` aplati, filtré par permission ;
- les ventes — `GET /api/sales?search=` sur la référence et le client ;
- les produits — `GET /api/products?search=` sur la référence.

Ouverture par `Ctrl/⌘ K` et par le champ de la barre supérieure. C'est ce
qui rend acceptable que Rôles, Charges RH ou Activité ne soient plus à deux
clics de souris.

---

## Étape 5 — L'espace client B2B

**Au lancement client.** Aucun composant à dupliquer.

1. Un second jeu de `RailItem[]` à quatre entrées — Mes commandes, Devis,
   Factures, Mon compte — choisi selon le rôle de l'utilisateur.
2. `ThemeService.applyCompanyTheme()` pose `data-brand="client"` sur
   `<html>` ; `_tokens.scss` contient déjà la rampe correspondante.
3. Les groupes n'ont pas d'enfants : aucun panneau ne s'ouvre, et rien de la
   structure interne n'est visible.

---

## Choisir l'accent

`_tokens.scss` est livré sur l'accent Modernist `#ec3013`. Pour garder le
rouge PNEU.Ma, remplacer la seule ligne `--accent` :

```scss
--accent: #ff2d37;
```

La rampe reste valable — `#ff2d37` tombe entre les pas 400 et 500. Ne pas
utiliser `--accent` pour du texte en petit corps : `#ff2d37` sur blanc donne
3,7:1. Pour du texte, `--accent-700`.

Pour conserver le zéro Modernist plutôt que les coins arrondis retenus :

```scss
--radius: 0;
--radius-lg: 0;
```

---

## Fichiers de ce dossier

| Fichier | Destination | Étape |
|---|---|---|
| `_tokens.scss` | `src/app/_tokens.scss` | 1 |
| `app.scss` | `src/app/app.scss` | 1 |
| `icon.component.ts` | `src/app/shared/icon/icon.component.ts` | 2 |
| `rail.component.ts` | `src/app/shared/rail/rail.component.ts` | 3 |
| `rail.component.html` | `src/app/shared/rail/rail.component.html` | 3 |
| `rail.component.scss` | `src/app/shared/rail/rail.component.scss` | 3 |
| `app.html` | `src/app/app.html` | 3 |
