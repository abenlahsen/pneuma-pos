# Étape 11 — les dernières listes hors du mixin de ligne

Aucune maquette nouvelle : ces listes prennent le motif de ligne déjà posé (étape 2, repli
8b, états 8c, taille de texte). C'est une migration, pas un redesign.

## Les cinq listes concernées

| Liste | État actuel |
| --- | --- |
| Marques | `<table>` |
| Transporteurs | `<table>` |
| Rôles | `<table>` |
| Service Auto, vue Liste | `<table>` (la vue Atelier est déjà faite) |
| Achats | grille locale `.pur-row`, hors mixin |

Aucune de ces listes n'a le repli tablette, les états partagés (squelette, vide après
filtrage, erreur, ligne verrouillée), ni la taille de texte corrigée.

## Le prompt

> Lis `design_handoff_refonte_2b/PROMPT-etape-11.md`.
>
> Migre les cinq listes du tableau vers le mixin de ligne de `_page-layout.scss`, une par
> commit. Commence par vérifier que la liste n'en a pas déjà été migrée entre-temps.
>
> Pour chacune :
>
> 1. **Grille** : `list-grid-header` et `list-grid-row` avec une grille propre à l'écran
>    (`.brands-grid`, etc.). Supprime le `<table>`, ou `.pur-row` pour Achats.
> 2. **Classes nommées** : `list-cell--identity` sur la cellule principale,
>    `list-cell--amount` sur le montant s'il y en a un, `list-grid-status` sur l'état,
>    `list-cell--actions` sur les actions, `list-cell--drop` sur les colonnes qui tombent
>    sous 1200 px. Le test de lint de l'étape précédente doit passer.
> 3. **Nom cliquable** : un lien `<a>` vers la fiche ou le formulaire, jamais un `<button>`.
> 4. **Actions** : au-delà de deux boutons, `app-row-overflow`. Largeur de colonne calculée
>    sur le contenu réel au-dessus de `$bp-reduce`.
> 5. **États** : squelette de chargement, vide après filtrage si la liste a des filtres,
>    erreur de chargement, cadenas pour les lignes non modifiables.
> 6. **Barre de filtres** : `.filter-bar` et `.filter-select` du mixin, jamais de `<select>`
>    sans classe.
> 7. Retire tout `style` en ligne et toute copie locale de règle que le mixin porte déjà.
>
> Points propres à chaque liste :
>
> - **Achats** : c'est la plus lourde. Garde le regroupement par fournisseur et la colonne
>   Retard de la maquette 8a (`Refonte Achats.dc.html`). Les en-têtes de groupe
>   fournisseur ne sont pas des `list-grid-row` : ils ne doivent pas déclencher le test.
>   Sous 900 px, la fiche empilée porte le reste dû en haut à droite, et le retard en
>   état.
> - **Service Auto, vue Liste** : la plaque est l'identité, pas le client (comme sur la vue
>   Atelier).
> - **Rôles** : le nombre de permissions en sous-ligne. « Administrateur » reste verrouillé
>   (cadenas, infobulle « rôle système »).
> - **Marques, Transporteurs** : listes courtes, sans montant. Sous 900 px, la rangée du
>   haut porte l'identité seule.
>
> Montre-moi Achats à 1440 px, 1024 px et 820 px, puis les quatre autres à 820 px.
