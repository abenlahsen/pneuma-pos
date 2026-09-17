# Comment lancer l'implémentation avec Claude Code

## 1. Mettre le dossier dans le dépôt

Décompressez `design_handoff_refonte_2b/` à la racine de `pneuma-pos/`, à côté de
`front/` et `back/`. Committez-le : Claude Code doit pouvoir lire les prototypes.

```
pneuma-pos/
├── front/
├── back/
└── design_handoff_refonte_2b/
    ├── README.md
    ├── PROMPT.md            ← ce fichier
    ├── Refonte Ventes.dc.html
    └── …
```

## 2. Ouvrir Claude Code à la racine de `pneuma-pos/`

Pas dans `front/` : certaines décisions touchent le backend (les trois agrégats de la
section « Gestion d'état » du README).

## 3. Le premier message

Ne demandez pas tout d'un coup. La première étape est `_variables.scss` + les icônes :
effet visible immédiat, aucun changement de structure, facile à annuler.

> Lis `design_handoff_refonte_2b/README.md` en entier avant de coder.
>
> C'est une refonte du design de cette application Angular. Les fichiers `.dc.html` du
> dossier sont des prototypes de référence en HTML — pas du code à copier. Ta tâche est de
> les recréer dans le codebase existant (composants standalone, signals, SCSS par
> composant).
>
> Commence par l'étape 1 de l'ordre d'application uniquement :
>
> 1. Remplace la palette dans `front/src/app/features/_variables.scss` et le bloc `:root`
>    de `front/src/app/app.scss` par les 18 valeurs de la section « Couleurs » du README.
>    Garde les noms de variables SCSS existants pour ne rien casser.
> 2. Passe `border-radius` à 0 et supprime les `box-shadow` de carte.
> 3. Remplace les emoji d'interface par des icônes Lucide via
>    `front/src/app/shared/icon/icon.component.ts` — les SVG sont inline dans les
>    prototypes, réutilise-les. Commence par la navbar, les cadrans et les boutons
>    d'action de ligne.
>
> Ne touche pas encore à `_page-layout.scss`, au rail, ni aux écrans. Montre-moi le diff
> avant de committer.

## 4. Les étapes suivantes, une par message

**Étape 2 — le motif de ligne** (c'est celle qui a le plus d'effet) :

> Étape 2 : réécris le mixin de `front/src/app/features/_page-layout.scss` selon la section
> « Le motif de ligne » du README — grille CSS au lieu de `<table>`, 58 px de hauteur de
> ligne, sous-ligne à 11,5 px, montants tabulaires à droite, liseré gauche de 3 px pour les
> lignes qui demandent une action.
>
> Applique-le d'abord à `sales-page.component` seul, en suivant
> `design_handoff_refonte_2b/Refonte Ventes.dc.html` : 17 colonnes → 9, filtres repliés en
> jetons, 8 cadrans → 4 + total de sélection. Vérifie que les 24 autres écrans de liste qui
> incluent le mixin ne sont pas cassés.

**Étape 3 — la navigation** :

> Étape 3 : remplace `shared/navbar/` par un rail de 72 px + barre haute de 60 px, selon
> l'option 2b de `Refonte Accueil.dc.html`. Supprime `menuLayout` et la variante
> horizontale de `app.html` / `app.scss`. Le dossier `design_handoff_rail_navigation/`
> contient une base technique utilisable — garde sa mécanique, remplace ses tokens par
> ceux du nouveau README.

**Étape 4 — les écrans qui changent de forme**, un par message :

> Recrée l'écran de saisie de vente selon `Refonte Nouvelle vente.dc.html` : écran plein
> deux volets au lieu de la modale, catalogue à gauche et ticket à droite, `stock_id`
> fusionné dans la sélection de lot, section logistique repliée. Conserve la logique
> existante de `sale-form.component.ts` (calculs de marge, validation, quick-create client).

Puis Service Auto (vue atelier), puis Cash Flow (projection — celle-ci demande un
endpoint backend, voir « Gestion d'état »).

## 5. Ce qu'il faut lui dire de ne pas faire

Ajoutez ces consignes à votre `CLAUDE.md` à la racine, elles éviteront des allers-retours :

```markdown
## Refonte du design (design_handoff_refonte_2b/)

- Les `.dc.html` sont des références visuelles, jamais du code à copier.
- Aucun `border-radius`, aucune `box-shadow` : la séparation se fait par filet de 1 px.
- Tout montant et toute quantité portent `font-variant-numeric: tabular-nums`.
- Aucun texte sous 11,5 px, sauf les capitales d'en-tête à 9,5 px.
- Une couleur = un sens. Le rouge #ff2d37 est réservé à l'action principale (une par
  écran) ; #c2181f à l'argent dû.
- Les listes utilisent une grille CSS, pas `<table>`.
- Pas d'emoji dans l'interface : icônes Lucide via icon.component.ts.
- Ne pas réintroduire les tokens de design_handoff_rail_navigation/ (Archivo, #ec3013) :
  ils sont remplacés.
```

## 6. Les cinq décisions à trancher avant certaines étapes

Le README les liste en fin de document. Trois bloquent du code :

- **Service Auto** — où va le statut `ANNULE` ? (bloque l'étape Service Auto)
- **Achats** — 90 jours est-il le bon seuil de risque légal ? (bloque le calcul d'âge)
- **Portail B2B** — disponibilité en niveaux ou quantité exacte, crédit bloquant ou
  avertissant, prestataire de paiement ? (bloque tout le portail)

Les deux autres (session persistante, persistance du sélecteur de colonnes) peuvent être
tranchées en cours de route.
