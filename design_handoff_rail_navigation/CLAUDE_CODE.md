# Brief pour Claude Code

Ce dossier est un paquet de handoff. Il contient un `README.md` complet (les
seize écrans, les tokens, les comportements, la règle de portée) et un dossier
`angular/` avec du code écrit pour cette application précise.

Copie ce dossier à la racine du dépôt, puis lance Claude Code et donne-lui les
tâches ci-dessous **une par une**, dans l'ordre. Chaque tâche est indépendante
et vérifiable ; ne les enchaîne pas dans un seul prompt.

---

## Amorce — à donner une fois, au début de la session

> Lis `design_handoff_rail_navigation/README.md` en entier, puis
> `design_handoff_rail_navigation/angular/README.md`. Lis aussi
> `front/DESIGN_SYSTEM.md`, `front/src/app/app.scss`,
> `front/src/app/features/_variables.scss`,
> `front/src/app/shared/navbar/navbar.component.*` et
> `front/src/app/features/dashboard/dashboard.component.*` pour comprendre
> l'état actuel.
>
> Ne modifie rien pour l'instant. Résume-moi en dix lignes ce qui va changer,
> et signale-moi toute divergence entre le handoff et le code réel — le
> handoff a été écrit en lisant le dépôt, mais il a pu bouger depuis.

---

## Tâche 1 — Tokens et états

> Applique l'étape 1 de `design_handoff_rail_navigation/angular/README.md`.
>
> Copie `angular/_tokens.scss` en `front/src/app/_tokens.scss` et
> `angular/app.scss` en `front/src/app/app.scss`. Importe les tokens depuis
> `front/src/styles.scss`, remplace l'import Inter par Archivo, et remplace
> les piles de polices en dur par `var(--font)`.
>
> Réduis `front/src/app/features/_variables.scss` au fichier littéral donné
> dans le README de l'étape 1. **N'y mets aucun `var(--…)`** : le code appelle
> `rgba($primary, …)` et Sass ne sait pas manipuler une propriété CSS — la
> compilation casserait. Marque le fichier comme déprécié en commentaire.
>
> Supprime les blocs `--navbar-*` de `navbar.component.scss`.
>
> Vérifie : `npm run build` passe ; aucun écran ne change d'aspect hormis les
> rayons ; l'anneau de focus clavier est rouge partout (plus de bleu système) ;
> en mode sombre les cartes deviennent sombres — le `--app-surface` manquant
> était un bug.
>
> Attention : certaines couleurs sémantiques changent de valeur pour passer le
> seuil de contraste. Cherche les endroits où `$income-color`,
> `$expense-color` ou `$text-light` servaient de **fond** et non de texte, et
> bascule-les sur `--ok-bg` / `--bad-bg` — sinon ils s'assombrissent.

## Tâche 2 — Icônes Lucide

> Applique l'étape 2. Copie `angular/icon.component.ts` en
> `front/src/app/shared/icon/icon.component.ts`.
>
> Trouve toutes les occurrences d'emoji dans les templates et le TypeScript :
>
> ```bash
> grep -rP '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' front/src/app --include=*.html --include=*.ts
> ```
>
> Remplace-les par `<app-icon name="…" />` selon la table de correspondance du
> README de l'étape 2, et retire les préfixes emoji des libellés (notamment
> dans `allNavItems`). Mets à jour la section « Emoji as Icons » de
> `front/DESIGN_SYSTEM.md` — elle devient « Icons — Lucide via `<app-icon>` ».
>
> Une clé absente de `PATHS` rend un SVG vide, sans erreur : liste-moi les
> clés utilisées et les clés définies pour que je compare.

## Tâche 3 — Rail et panneau

> Applique l'étape 3. Copie les trois `angular/rail.component.*` dans
> `front/src/app/shared/rail/` et `angular/app.html` en
> `front/src/app/app.html`.
>
> Dans `front/src/app/app.ts` : remplace `NavbarComponent` par
> `RailComponent`, supprime `menuLayout`, `companySettings` et l'import
> `MenuLayout`. Supprime ensuite `front/src/app/shared/navbar/` en entier.
> Retire le réglage `menu_layout` du formulaire de réglages entreprise et du
> modèle front — il n'a plus d'effet. Laisse la colonne en base.
>
> La section « Interactions et comportement » du README principal est la
> spécification : un seul panneau ouvert à la fois, fermeture à la navigation
> / `Échap` / clic hors zone, état actif qui suit la route même panneau fermé,
> et clic sur une icône de groupe qui **bascule** au lieu de ne faire que
> déplier.
>
> Vérifie : `npm run build` passe ; la zone de contenu ne se redimensionne pas
> à l'ouverture du panneau ; avec un compte restreint, un groupe dont aucun
> enfant n'est autorisé n'apparaît pas. Lance les tests e2e Playwright de
> `e2e/` — ceux qui ciblent le menu vont casser, mets-les à jour plutôt que de
> les désactiver.

## Tâche 4 — Les trois états de tableau

> Crée les trois états manquants — aucun n'existe aujourd'hui — comme
> composants partagés réutilisables, spécifiés sous `3b` `3c` `3d` dans le
> README principal et visibles dans
> `design_handoff_rail_navigation/design/Ecrans 1a - Operations.dc.html` :
>
> - `shared/empty-state/` — dit **pourquoi** c'est vide (quel filtre, quelle
>   période) et propose la sortie, avec une action secondaire et une primaire.
> - `shared/table-skeleton/` — reprend la géométrie exacte du tableau qu'il
>   remplace : même gabarit de colonnes, mêmes hauteurs de ligne. Pas de
>   spinner, la page ne doit pas sauter à l'arrivée des données.
> - `shared/error-banner/` — bandeau `--accent-700` avec le code technique
>   affiché et copiable (`GET /api/sales — 504 · 14:22:07`). Le tableau reste
>   en place, vide : on ne remplace pas l'écran par une page d'erreur.
>
> Branche-les d'abord sur la liste des ventes, puis sur les autres listes.

## Tâche 5 — Reprise des écrans de liste

> Applique le **motif « liste »** du README principal à
> `front/src/app/features/sales/` en premier : rangée de KPI dans un cadre
> unique, filtres en chips, tableau à cellules de 14 px, et la règle des
> badges d'état — chevron sur ce qui est modifiable, plat sur ce qui est lu.
> C'est la correction du `<select>` déguisé en badge.
>
> Une fois les ventes validées, applique le même motif à Achats, Inventaire,
> Marques, Fournisseurs, Transporteurs, Partenaires, Primes, Charges RH,
> Utilisateurs, Rôles et Activité. Ces onze écrans n'ont pas de maquette
> dédiée : le motif **est** leur spécification. Signale-moi tout écran qui
> s'en écarte vraiment plutôt que de forcer le gabarit.
>
> Vérifie sur chaque écran repris : aucune valeur en dur (couleur, taille,
> rayon), tout passe par `var(--…)`.

## Tâche 6 — Écrans de fiche

> Applique le **motif « fiche »** : en-tête d'objet, onglets, deux colonnes
> `minmax(0,1fr) 360px`. Commence par la fiche produit (`3e`) et la fiche
> client (`3i`), qui sont maquettées — ce sont les deux mêmes gabarits remplis
> différemment.
>
> Deux détails qui comptent : sur le produit, « 6 en stock » ne veut rien dire
> sans « 4 réservées », donc le bandeau calcule le **disponible** ; sur le
> client, la carte d'encours porte son bouton au lieu de renvoyer ailleurs.
>
> Puis étends aux fiches fournisseur, transporteur, partenaire, utilisateur et
> véhicule.

## Tâche 7 — Nouvelle vente

> Reprends l'écran de saisie selon `2b` : grille `minmax(0,1fr) 340px`, le
> récapitulatif fixe à droite qui ne défile pas, les lignes en tableau avec la
> référence sous le nom d'article, et le bandeau d'alerte d'impayé client.
>
> L'alerte doit se déclencher sur l'encours réel du client, pas sur une valeur
> figée — c'est ce qui la rend utile au comptoir.

## Tâche 8 — Palette de recherche `Ctrl K`

> Construis `front/src/app/shared/command-palette/` selon la section
> « Palette de recherche » du README principal. Composant autonome : il ne
> doit pas dépendre du rail.
>
> Trois sources dans une seule liste — destinations, ventes, produits — avec
> **les destinations en dernier quand la requête renvoie des données** : au
> comptoir on cherche une vente, pas une page. Vérifie les paramètres réels
> des endpoints dans `back/routes/` avant de coder les appels. Debounce à
> 200 ms, 5 résultats par source, `↑` `↓` `Entrée` `Échap`, raccourcis
> affichés en pied.

## Tâche 9 — Accueil et règle de portée

> **La tâche la plus sensible : elle touche à la confidentialité entre
> collègues. Lis la section « Règle de portée » du README avant de coder.**
>
> Remplace `front/src/app/features/dashboard/` par la liste de travail
> spécifiée sous `5a` / `5b`, visible dans
> `design_handoff_rail_navigation/design/Accueil retenu - PNEU.Ma.dc.html` :
> quatre files (impayés, ordres à facturer, produits sous seuil, devis sans
> réponse), chacune avec son compte, son badge de portée et son action par
> ligne.
>
> Une seule route `/dashboard`, un seul composant : le jeu de files et leur
> portée viennent de `AuthService.hasPermission()`, comme le filtrage de la
> navigation. Pas de second écran, pas de bascule dans les réglages.
>
> Crée les quatre permissions `.all` du tableau de portée, ajoute-les au
> *seeder*, et accorde-les aux rôles gérant et administrateur seulement.
> **Le filtrage se fait côté API, jamais dans le front** : en l'absence de la
> permission `.all`, la requête est filtrée sur `user_id` côté serveur. Si le
> front reçoit les données de tous et les masque à l'affichage, la tâche est
> ratée — une console ouverte suffirait à les lire.
>
> Deux exigences fonctionnelles : « Commander » crée un brouillon d'achat
> pré-rempli et non un formulaire vide ; le classement du gérant porte
> l'impayé de chaque commercial en fin de barre.
>
> Vérifie avec deux comptes réels — un commercial et un gérant — et
> montre-moi la requête SQL générée dans les deux cas.

## Tâche 10 — Service Auto

> Reprends `front/src/app/features/service-orders/` selon `3f`. **Lis la
> section « `3f` — Service Auto : l'échelle de temps » du README avant de
> coder** : c'est le seul écran qui demande un calcul, et le seul endroit où
> une erreur d'approche se voit immédiatement.
>
> Chaque colonne de baie est `position: relative` et chaque carte est
> positionnée en absolu depuis une seule fonction du temps :
> `top = (début − 09:00) / 8 h`, `height = durée / 8 h`. Le trait de l'heure
> courante sort de la même formule. N'empile pas les cartes en flux avec des
> hauteurs écrites à la main — leur position n'encoderait plus l'heure.
>
> Demande-moi le nombre réel de baies et leur nommage avant de figer la
> grille.

## Tâche 11 — Cash Flow, Reporting, Réglages, Connexion

> Les quatre derniers écrans maquettés, dans cet ordre de valeur :
>
> - **Cash Flow** (`3g`) : courbe de solde en SVG, et la colonne « solde après
>   chaque mouvement » — c'est elle qui permet de retrouver le jour où la
>   trésorerie a basculé sans sortir de l'écran. Couleurs sémantiques avec le
>   signe qui double la couleur.
> - **Reporting** (`3h`) : graphiques en encre, une seule teinte porteuse de
>   sens par graphique, année précédente en gris 300. « Exporter PDF » doit
>   produire la mise en page de l'écran et non une capture : les graphiques en
>   SVG et les tableaux en HTML s'impriment nativement.
> - **Réglages entreprise** (`3j`) : navigation latérale de sections,
>   formulaire borné à 720 px, chaque interrupteur avec une ligne expliquant
>   ce qu'il fait réellement. `menu_layout` déjà retiré en tâche 3.
> - **Connexion** (`3k`) : deux moitiés, aplat rouge à droite. Le seul endroit
>   du système où l'accent occupe une surface pleine.

## Tâche 12 — Responsive et espace client B2B

> Deux volets, à faire en dernier.
>
> **Tablette** (`3l`) : sous 1024 px le rail devient une barre inférieure de
> 64 px à cinq cibles, et les tableaux de plus de quatre colonnes deviennent
> des cartes. Teste sur la tablette réelle de l'atelier, pas seulement dans
> le simulateur.
>
> **Espace client B2B** (`2c`) : un second jeu de `RailItem[]` à quatre
> entrées sans enfants (Mes commandes, Devis, Factures, Mon compte), choisi
> selon le rôle, et `data-brand="client"` posé sur `<html>` par
> `ThemeService.applyCompanyTheme()`. La rampe bleue est déjà dans
> `_tokens.scss`.
>
> Contrainte non négociable : aucune destination interne ne doit être
> atteignable ni devinable depuis cet espace. Ce n'est pas le menu interne
> filtré par permission, c'est une liste distincte.

---

## Décision à prendre avant la tâche 1

L'accent. Le paquet est livré sur `#ec3013` (rouge Modernist) ; l'alternative
est `#ff2d37`, le rouge PNEU.Ma actuel. Une seule ligne de `_tokens.scss`
change, la rampe reste valable dans les deux cas :

```scss
--accent: #ff2d37;
```

Les deux teintes sont comparées côte à côte sous `3m` / `3n` dans
`design/Ecrans 1a - Analyse.dc.html`. Dans les deux cas : pas de texte en
petit corps sur `--accent`, utiliser `--accent-700`.

Le rayon, lui, est tranché : 8 px et 12 px, déjà dans `_tokens.scss`.

---

## Pièges vérifiés en maquette

Les quatre premiers sont des défauts que j'ai rencontrés et corrigés en
construisant les écrans. Ils se reproduiront à l'identique en Angular.

1. **`var(--…)` dans `_variables.scss`** casse la compilation Sass
   (`rgba($primary, …)`). Garder des littéraux, traiter le fichier comme
   déprécié.
2. **Coquille qui déborde** : la grille du shell doit porter
   `grid-template-rows: minmax(0, 1fr)`, sinon la piste implicite se
   dimensionne sur le contenu et le tableau pousse la page.
3. **Carte en `flex: 1` avec un tableau** : `min-height: 0` sur la carte, et
   le tableau dans un enfant `overflow: auto`.
4. **Carte avec `overflow: hidden` dans une colonne à hauteur fixe** : elle
   perd son minimum automatique et se fait comprimer en rognant ses lignes.
   Les cartes d'une colonne qui défile portent `flex: none`.
5. **Le pas neutre 600 (`#7d7979`) n'est jamais une couleur de texte** sous
   18 px : 3,4:1 sur le fond clair. Pour un texte secondaire, le pas 700.

---

## Note sur le `CLAUDE.md` du dépôt

Le dépôt en a déjà un à la racine. Après la tâche 1, il vaut d'y ajouter ces
lignes — sinon les prochaines sessions réintroduiront les anciens motifs :

```markdown
- Les tokens vivent dans `front/src/app/_tokens.scss` — une seule source.
  Aucune couleur, taille ou rayon en dur ailleurs ; `features/_variables.scss`
  est déprécié et doit finir vide.
- Le pas neutre 600 n'est jamais une couleur de texte sous 18 px. Texte
  secondaire : pas 700. Fond teinté : pas 100-200, texte : pas 700+.
- Les icônes sont des Lucide via `<app-icon name="…" />`. Plus d'emoji comme
  icônes.
- La navigation est un rail de 64 px + un panneau de section superposé
  (`shared/rail/`). Un seul panneau ouvert à la fois.
- Deux motifs couvrent les écrans : « liste » (KPI + filtres + tableau) et
  « fiche » (en-tête d'objet + onglets + deux colonnes). Ils sont spécifiés
  dans `design_handoff_rail_navigation/README.md`.
- Badges : chevron `▾` sur un état modifiable, plat sur un état lu. Sans
  exception.
- Les portées de données se filtrent côté API, jamais dans le front. Un
  commercial ne voit que ses propres clients (permissions `.all`).
```
