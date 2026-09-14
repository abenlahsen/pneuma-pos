# Handoff : refonte de la navigation et du thème de pneuma-pos

## Vue d'ensemble

Refonte de la navigation de **pneuma-pos** (Angular 21, standalone components,
signals, UI 100 % en français), unification de son thème, et redessin de
seize écrans.

Le menu actuel porte 27 destinations sur un seul niveau d'accordéon, dans une
colonne de 280 px ou une barre horizontale qui déborde dès 1400 px. Les
libellés de groupe sont des `<button>` qui n'ouvrent aucune page. Il n'y a pas
de recherche, et l'arrivée des clients B2B n'a pas de place dans cette
structure — un client externe verrait le menu interne filtré par permission,
avec ses intitulés internes comme squelette de lecture.

La direction retenue remplace cela par un **rail de 64 px toujours visible**
et un **panneau de section superposé** de 252 px. Cinq icônes naviguent
directement (les pages quotidiennes), quatre ouvrent un panneau. La largeur de
la zone de travail ne change jamais. Une palette de recherche `Ctrl K` devient
le chemin principal vers les 22 destinations rares.

En parallèle, les trois sources de tokens concurrentes du projet
(`features/_variables.scss`, le `:root` de `app.scss`, les `--navbar-*` du
navbar) fusionnent en un seul fichier, ce qui corrige quatre défauts mesurés :
contrastes sous le seuil, `--app-surface` non redéfini en mode sombre, absence
de `:focus-visible`, et sept rayons pour trois usages.

## Décisions déjà prises par le commanditaire

| Décision | Valeur retenue | Où |
|---|---|---|
| Direction de navigation | Rail + panneau de section | — |
| Rayon | **8 px / 12 px** | `--radius`, `--radius-lg` |
| Accueil | File de travail, **portée selon le rôle** | voir § Accueil |
| Portée des impayés | **Un commercial ne voit que ses clients** | voir § Règle de portée |
| Seuils de stock | **Fiables** — la file s'affiche sans réserve | voir § Accueil |
| Accent | **non tranché** : `#ec3013` livré, `#ff2d37` en alternative | `--accent` |

L'accent est la seule valeur ouverte, et une seule ligne la change. Ne pas
bloquer l'intégration dessus : les deux teintes partagent la même rampe.

## À propos des fichiers de design

Les fichiers `*.dc.html` du dossier `design/` sont des **références de design
en HTML** — des prototypes qui montrent l'aspect et le comportement voulus.
Ils ne sont pas du code à copier : ce sont des maquettes autonomes qui
s'ouvrent dans un navigateur. Ouvrez-les pour lire les valeurs exactes quand
cette spécification ne suffit pas.

Le dossier `angular/` est différent : il contient du **code Angular écrit pour
cette application précise**, aligné sur ses conventions (composants
standalone, API `input()`/`signal()`/`computed()`, flux de contrôle
`@if`/`@for`, SCSS par composant). Il est à intégrer, en vérifiant les chemins
d'import et le nom des services au moment de la copie.

Autrement dit : implémenter le design, en partant du code fourni, dans
l'environnement Angular existant — jamais servir le HTML tel quel.

## Fidélité

**Haute fidélité.** Couleurs, typographie, espacements, tailles de cible et
états d'interaction sont arrêtés et listés plus bas. Les maquettes doivent
être reproduites au pixel, avec les tokens de `angular/_tokens.scss` comme
unique source de valeurs.

---

## Coquille applicative

Commune à tous les écrans.

- Grille CSS : `grid-template-columns: var(--rail-w) minmax(0, 1fr)` —
  `64px` puis le reste. **Et `grid-template-rows: minmax(0, 1fr)`** : sans
  cette seconde ligne, la piste implicite se dimensionne sur le contenu et la
  page pousse au lieu de faire défiler ses tableaux.
- **Rail** : colonne 1, `position: sticky`, `height: 100vh`, fond
  `--rail-bg` (`#2d2b2b`), `z-index: 900`.
  - Marque : hauteur 56 px, logo `max-height: 28px`, bordure basse
    `1px solid var(--neutral-700)`.
  - Icônes : cible **48 px de haut sur 64 px de large** (au-delà du minimum
    tactile de 44 px, pour l'atelier sur tablette), `gap: 2px`, icône Lucide
    20 px sur `currentColor`, `border-radius: var(--radius)`.
    - repos `color: var(--neutral-500)`, fond transparent
    - survol `background: var(--neutral-800)`, `color: var(--neutral-100)`
    - panneau ouvert : mêmes valeurs que le survol
    - actif `background: var(--accent)`, `color: #fff`
    - focus clavier `outline: 2px solid var(--accent); outline-offset: -2px`
  - Séparateur après la 5ᵉ icône : `32 × 1 px`, `var(--neutral-600)`, marge
    verticale 8 px. Il sépare les pages quotidiennes des sections.
  - Pied : avatar 30 × 30 px, fond `--accent`, initiales blanches 12 px / 700,
    zone de 56 px, bordure haute `1px solid var(--neutral-700)`.
- **Panneau de section** : `position: fixed`, `left: var(--rail-w)`,
  largeur `252px`, pleine hauteur, `z-index: 890`, fond `--surface`, bord
  droit `2px solid var(--text)`, ombre `--shadow-lg`. Précédé d'un voile
  invisible (`inset: 0 0 0 64px`, `z-index: 880`) qui capte le clic hors zone.
  - En-tête 56 px, fond `--surface-sunk`, bordure basse `2px solid var(--text)`,
    titre 12 px / 700 / `0.12em` / majuscules.
  - Entrées : 14 px, padding `11px 16px`, bordure gauche 3 px transparente.
    Survol : fond `--neutral-100`, bordure gauche `--neutral-400`.
    Active : poids 600, fond `--accent-100`, bordure gauche `--accent`.
- **Barre supérieure** : hauteur 56 px, bordure basse `2px solid var(--text)`,
  titre 13 px / 700 / `0.12em` / majuscules, champ de recherche
  `max-width: 420px` bordé `2px solid var(--neutral-400)` avec badge
  `CTRL K` 11 px, puis action primaire à droite.
- **Contenu** : padding 20 px, `min-width: 0` **et `min-height: 0`** sur toute
  la chaîne. Les deux pièges rencontrés en maquette, à ne pas reproduire :
  - une carte en `flex: 1` qui contient un tableau doit porter
    `min-height: 0`, et le tableau vivre dans un enfant `overflow: auto` —
    sinon le tableau impose sa hauteur et déborde la coquille ;
  - une carte avec `overflow: hidden` **perd** son minimum automatique : dans
    une colonne à hauteur fixe elle se fait comprimer et rogne ses lignes. Les
    cartes d'une colonne qui défile doivent porter `flex: none`.

**Responsive**

- ≥ 1025 px : rail vertical collé, panneau superposé à gauche.
- ≤ 1024 px : le rail devient une **barre inférieure** de 64 px
  (`position: fixed; bottom: 0`, `flex-direction: row`), cinq cibles de 64 px
  minimum, marque et séparateur masqués ; le contenu réserve
  `padding-bottom: 64px`. Le panneau devient une feuille pleine largeur
  au-dessus de la barre (`bottom: 64px`, `border-top: 2px`).
- Les tableaux de plus de quatre colonnes deviennent des **cartes** :
  référence et montant sur la première ligne, client et véhicule sur la
  deuxième, états en pied. Cibles à 32 px minimum. Voir `3l` dans
  `design/Ecrans 1a - Analyse.dc.html`.

---

## Écrans

Seize écrans sont dessinés. Les identifiants (`2a`, `3e`, `5b`…) sont les
badges visibles dans les fichiers de `design/` — citez-les dans les commits.

### Motifs réutilisables

Deux gabarits couvrent la quasi-totalité de l'application. Les respecter évite
de redessiner les onze écrans non maquettés.

**Motif « liste »** — Ventes, Achats, Inventaire, Marques, Fournisseurs,
Transporteurs, Partenaires, Primes, Charges RH, Utilisateurs, Rôles, Activité.

1. Rangée de KPI dans un seul cadre `2px solid var(--text)`, rayon 12 px, fond
   blanc, cellules égales séparées par `2px solid var(--text)`, padding
   `16px 18px`. Étiquette 11 px / 700 / `0.1em` / majuscules /
   `--text-muted` ; valeur 30 px / 800 / `-0.02em` / `tabular-nums` ; suffixe
   de devise 15 px / 600. Un KPI négatif passe en `--accent-700`, **jamais**
   en `--accent` (3,7:1 est insuffisant à cette taille).
2. Rangée de filtres en chips 12 px / 700 / `0.08em` / majuscules, padding
   `7px 12px`, bordure `2px solid var(--neutral-400)`, rayon 8 px.
   Sélectionnée : fond `--text`, texte `--bg`. Un filtre d'alerte est teinté :
   bordure `--accent-300`, fond `--accent-100`, texte `--accent-700`.
   Compte de résultats à droite, 13 px / `--text-muted`.
3. Tableau dans un cadre `2px solid var(--text)`, rayon 12 px, fond blanc.
   En-têtes 11 px / 700 / `0.1em` / majuscules, fond `--surface-sunk`, bordure
   basse `2px solid var(--text)`, padding `11px 14px`. Cellules **14 px**
   (et non 13 px comme aujourd'hui), padding `12px 14px`, bordure basse
   `1px solid var(--divider)`, survol de ligne `--neutral-100`.

**Motif « fiche »** — produit, client, fournisseur, transporteur, partenaire,
utilisateur, véhicule, ordre de réparation.

1. En-tête d'objet : vignette 84 × 84 px (bordure 2 px, rayon 12 px), kicker
   11 px / 700 / majuscules, titre 32 px / 800 / `-0.025em`, ligne
   d'identifiants 14 px, badges d'état alignés à droite.
2. Rangée d'onglets, bordure basse `2px solid var(--text)`, onglet actif en
   700 avec `box-shadow: inset 0 -3px 0 var(--accent)`.
3. Deux colonnes `minmax(0,1fr) 360px` : le détail à gauche, les chiffres et
   l'historique à droite en cartes.

Voir `3e` (produit) et `3i` (client) dans `design/` : ce sont les deux mêmes
gabarits, remplis différemment.

### Badges d'état — la règle à appliquer partout

C'est la correction d'un défaut du code actuel : le statut de vente est un
`<select>` en `appearance: none` sans chevron, visuellement identique aux
badges de paiement qui ne sont pas modifiables.

- **État lu** — plat : 11 px / 700 / `0.08em` / majuscules, padding `4px 8px`,
  bordure 2 px, rayon 8 px. Neutre : bordure `--neutral-300`, texte
  `--neutral-800`. Alerte : bordure et texte `--accent-700`.
- **État modifiable** — mêmes dimensions, bordure `2px solid var(--neutral-400)`,
  texte `--text`, **chevron `▾` 9 px** avec `gap: 7px`, survol
  `border-color: var(--text)`.

Le chevron est le seul signe de modifiabilité du système. Une seule règle,
appliquée sans exception.

### Les écrans, un par un

| Id | Écran | Fichier de design | Ce qu'il apporte de spécifique |
|---|---|---|---|
| `2a` | Ventes — liste | `Direction 1a` | Le motif « liste » de référence ; panneau Stock ouvert |
| `2b` | Nouvelle vente | `Direction 1a` | Saisie au comptoir : lignes, récapitulatif fixe 340 px, alerte d'impayé client |
| `2c` | Espace client B2B | `Direction 1a` | Rail à 4 icônes, aucun panneau ; `data-brand="client"` |
| `3a` | Palette `Ctrl K` | `Ecrans 1a · Opérations` | Trois sources, raccourcis en pied |
| `3b` | Tableau vide | `Ecrans 1a · Opérations` | Dit *pourquoi* c'est vide et propose la sortie |
| `3c` | Chargement | `Ecrans 1a · Opérations` | Squelette à la géométrie exacte du tableau, pas de spinner |
| `3d` | Erreur | `Ecrans 1a · Opérations` | Bandeau + code technique copiable, le tableau reste en place |
| `3e` | Fiche produit | `Ecrans 1a · Opérations` | Le motif « fiche » de référence ; disponible = stock − réservé |
| `3f` | Service Auto | `Ecrans 1a · Opérations` | Planning par baie — voir ci-dessous |
| `3g` | Cash Flow | `Ecrans 1a · Opérations` | Courbe de solde, colonne « solde après mouvement » |
| `3h` | Reporting | `Ecrans 1a · Analyse` | Graphiques en encre, une seule teinte porteuse de sens |
| `3i` | Fiche client | `Ecrans 1a · Analyse` | Carte d'encours avec plafond et action |
| `3j` | Paramètres entreprise | `Ecrans 1a · Analyse` | Formulaire borné à 720 px ; `menu_layout` retiré |
| `3k` | Connexion | `Ecrans 1a · Analyse` | Le seul aplat rouge plein du système |
| `3l` | Tablette | `Ecrans 1a · Analyse` | Barre inférieure, tableau devenu cartes |
| `5a` `5b` | Accueil | `Accueil retenu` | Files de travail, deux portées — voir ci-dessous |

### `3f` — Service Auto : l'échelle de temps

Le seul écran qui n'est pas un tableau, et le seul qui demande un calcul.

Les ordres de réparation ont une durée, une baie et un technicien : dans une
liste triée par date, on ne voit ni les trous ni les chevauchements, c'est-à-dire
précisément ce qu'on vient chercher.

- Grille `52px repeat(4, minmax(0,1fr))` : axe des heures puis une colonne par
  baie. Axe de **09:00 à 17:00, soit 8 lignes égales**, 13:00 inclus.
- Chaque colonne de baie est `position: relative`, et chaque carte est
  **positionnée en absolu depuis une seule fonction du temps** :
  `top = (début − 09:00) / 8 h`, `height = durée / 8 h`, en pourcentage.
  Le trait de l'heure courante sort de la même formule.
  **Ne pas empiler les cartes en flux avec des hauteurs écrites à la main** :
  leur position n'encoderait plus l'heure, et le développement n'aurait aucune
  règle de placement.
- La pause de 13:00 est une bande hachurée à 45°, `rgba(32,30,29,.06)`.
- Quatre états de carte : en cours (bordure `--text`, point accent + libellé
  `--accent-700`), planifié (bordure `--neutral-400`, plage horaire en pied),
  terminé (fond `--surface`, coche + libellé), libre (bordure tiretée,
  libellé centré).
- File d'attente à droite, 300 px, cartes `cursor: grab` : on les fait
  glisser dans une baie pour planifier.
- Le nombre de baies (4, une par technicien) est à caler sur la réalité de
  l'atelier avant de coder : c'est structurant pour la grille.

### `5a` / `5b` — Accueil

Le tableau de bord actuel empile jour, mois et année, chacun avec six
indicateurs et deux tableaux par commercial, plus quatre indicateurs de bilan :
environ vingt-deux chiffres et quatre tableaux au même poids, dont rien n'est
cliquable.

Il est remplacé par une **liste de travail** : quatre files, chacune avec son
compte, son badge de portée et son action par ligne.

1. **Impayés à relancer** — bordure et en-tête `--accent-700`, fond d'en-tête
   `--accent-100`. Action « Relancer » (commercial) ou « Assigner » (gérant).
2. **Ordres terminés à facturer** — action « Facturer », bouton primaire.
3. **Produits sous seuil** — action « Commander ». Les seuils étant fiables,
   la file s'affiche sans réserve et sans propriétaire : c'est une information
   d'agence, badge « Agence · partagé ».
4. **Devis sans réponse** — action « Rappeler ».

Colonne latérale : les chiffres du jour, 300 px pour le commercial, 340 px
pour le gérant (qui gagne la tendance 30 jours et le classement nominatif).

**Une seule route `/dashboard` et un seul composant.** Le jeu de files et leur
portée viennent de `AuthService.hasPermission()`, exactement comme le filtrage
de la navigation. Ni second écran à maintenir, ni bascule dans les réglages.

Deux exigences fonctionnelles :

- « Commander » crée un **brouillon d'achat pré-rempli**, pas un formulaire
  vide — sinon la file signale sans faire gagner de temps.
- Le classement du gérant porte l'impayé de chacun en fin de barre : un CA
  élevé avec un impayé élevé n'est pas une performance.

### Règle de portée

Décidée par le commanditaire : **un commercial ne voit que ses propres
impayés.**

| File | Portée commercial | Portée gérant | Permission à créer |
|---|---|---|---|
| Impayés | Ses clients uniquement | Tous, avec attribution | `view unpaid.all` |
| Ordres à facturer | Ses clients uniquement | Toutes agences, avec attribution | `view service-orders.all` |
| Produits sous seuil | Agence — partagé, non filtré | Identique au commercial | — (aucune) |
| Devis sans réponse | Ses devis uniquement | Toutes agences, avec attribution | `view quotes.all` |
| Chiffres latéraux | Ses totaux + moyenne agence | Totaux consolidés + classement nominatif | `view reporting.all` |

Les permissions actuelles sont binaires (`view sales`, `view clients`…) :
elles disent si on accède à l'écran, pas jusqu'où. Il faut une seconde
dimension — quatre permissions en `.all`, ajoutées au *seeder* et accordées
aux rôles gérant et administrateur seulement.

**Défaut sûr** : en l'absence de la permission `.all`, la requête est filtrée
sur `user_id`. **Le filtrage se fait côté API, jamais dans le front** — sinon
les données des collègues transitent sur le réseau et une console ouverte
suffit à les lire.

---

## Interactions et comportement

**Rail**

- Icône avec `route` → navigation directe, fermeture du panneau éventuel.
- Icône avec `children` → **bascule** du panneau (`openPanel.update()`).
  Correctif du clic mort actuel : aujourd'hui le `<button>` de groupe ne fait
  que déplier.
- Un seul panneau ouvert à la fois. L'accordéon additif actuel
  (`expandedGroups: Set<string>`, jamais vidé) est supprimé.
- Fermeture sur : navigation (`NavigationEnd`), `Échap`
  (`@HostListener('document:keydown.escape')`), clic sur le voile.
- L'état actif suit la route, y compris pour un groupe replié et y compris
  quand on arrive par la recherche (`activeGroup()` compare `router.url` au
  préfixe des routes enfants).
- Transitions : `background 0.12s, color 0.12s`. **Aucun mouvement
  décoratif** — pas de `translateY` au survol, pas de transition de 300 ms.
  C'est un outil de saisie ; le survol indique la cible.

**Filtrage par permission** — repris à l'identique : un groupe dont aucun
enfant n'est autorisé disparaît du rail. Ne pas le rendre vide.

**Palette de recherche `Ctrl K`**

- Ouverture par `Ctrl/⌘ K` et par le champ de la barre supérieure.
- Trois sources dans une seule liste : destinations (`allItems` aplati, filtré
  par permission) · ventes (`GET /api/sales?search=` sur référence et client) ·
  produits (`GET /api/products?search=` sur référence).
- **Les destinations passent en dernier quand la requête renvoie des
  données** : au comptoir on cherche une vente, pas une page.
- 5 résultats par source au maximum, requêtes débouncées à 200 ms.
- `↑` `↓` pour parcourir sans sortir de la liste, `Entrée` pour ouvrir,
  `⌘ Entrée` pour ouvrir dans un onglet, `Échap` pour fermer. Les raccourcis
  sont affichés en pied de la palette.
- Question ouverte : faut-il indexer les immatriculations de véhicule ? C'est
  ce que l'équipe dicte le plus souvent au téléphone, mais cela suppose un
  index côté API.

**États manquants** — aucun n'existe aujourd'hui, les trois sont à créer
(`3b`, `3c`, `3d`) et doivent sortir des tokens sémantiques.

---

## État applicatif

`RailComponent`, en signals :

| Nom | Type | Rôle |
|---|---|---|
| `openPanel` | `signal<string \| null>` | Libellé du groupe ouvert, ou `null` |
| `currentUrl` | `signal<string>` | Alimenté par `NavigationEnd` |
| `companySettings` | `signal<CompanySettings \| null>` | Logo, nom, thème |
| `items` | `computed<RailItem[]>` | `allItems` filtré par permission |
| `panelItem` | `computed<RailItem \| null>` | Le groupe correspondant à `openPanel` |
| `activeGroup` | `computed<string \| null>` | Groupe contenant la route courante |
| `userName`, `userRole`, `initials` | `computed<string>` | Bloc utilisateur |

Données : `SettingsService.getCompanySettings()` au montage, `AuthService.user()`
et `AuthService.hasPermission()` — tous inchangés.

**Supprimé** : `MenuLayout` et le réglage `menu_layout`. La disposition n'est
plus configurable. Retirer le champ du formulaire de réglages entreprise et du
modèle front ; la colonne peut rester en base.

---

## Tokens de design

Source unique : `angular/_tokens.scss`. Aucune valeur en dur ailleurs.

**Rôles** — `--bg #f3f2f2` · `--surface #ffffff` · `--surface-sunk #eae9e9` ·
`--text #201e1d` · `--text-muted #605d5d` · `--divider #bab6b6` ·
`--accent #ec3013`

**Rampe accent** — 100 `#fff2ef` · 200 `#ffe0d9` · 300 `#ffc4b8` ·
400 `#ff9783` · 500 `#ff563c` · 600 `#dd2b0f` · 700 `#ae1800` ·
800 `#7c1405` · 900 `#4d170e`

**Rampe neutre** — 100 `#f8f4f4` · 200 `#eae7e7` · 300 `#d7d3d3` ·
400 `#bab6b6` · 500 `#9b9797` · 600 `#7d7979` · 700 `#605d5d` ·
800 `#444141` · 900 `#2d2b2b`

**Règle de contraste** : fond depuis le pas 100–200, **texte depuis le pas
700+**. Les valeurs remplacées échouaient sur blanc : `#a0aec0` 2,3:1 ·
`#48bb78` 2,4:1 · `#f56565` 3,1:1 · blanc sur `#ff2d37` 3,7:1.
Corollaire : **le pas 600 (`#7d7979`) ne sert jamais de couleur de texte**
sous 18 px — 3,4:1 sur le fond clair. Pour un texte secondaire, le pas 700.
Le pas 600 reste réservé aux bordures, séparateurs et remplissages de
graphique.

**Sémantique** — `--ok-bg #eef8f1` / `--ok-text #1b6b3a` ·
`--warn-bg #fdf3e7` / `--warn-text #8a4b06` ·
`--bad-bg` = `--accent-100` / `--bad-text` = `--accent-700`.
Le signe (+ / −) double toujours la couleur, pour que la lecture tienne en
noir et blanc à l'impression et pour les daltoniens.

**Typographie** — Archivo (`--font`), six pas et pas un de plus :
label 13 px / 700 / `0.1em` majuscules · cellule 14 px · corps 16 px ·
h3 20 px · h2 26 px · h1 34 px. Les cinq tailles actuelles entassées entre 12
et 14 px disparaissent. `font-variant-numeric: tabular-nums` sur tout chiffre
financier. Devise toujours suffixée : `1 234.56 DH`. Dates `dd/MM/yyyy`.

**Espacement** — 4 · 8 · 12 · 16 · 24 · 32 px

**Rayon** — `--radius: 8px`, `--radius-lg: 12px`. Remplace sept valeurs
(4, 6, 8, 12, 16, 20, 999 px). Les badges et chips passent de 999 px à 8 px.

**Élévation** — deux niveaux seulement :
`--shadow-sm: 0 1px 2px rgba(45,43,43,.14)` ·
`--shadow-lg: 0 12px 32px rgba(45,43,43,.22)`

**Chrome** — `--rail-w: 64px` · `--panel-w: 252px` · `--topbar-h: 56px`

**Mode sombre** (`:root[data-theme-resolved='dark']`) : seuls les rôles sont
redéfinis, jamais les rampes. `--surface: #201e1d` **est la ligne qui
manquait** — sans elle, toute carte, tout modal et tout menu restait une
plaque blanche sur fond nuit.

**États globaux, définis une fois** :
`:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px }` ·
`::selection { background: var(--accent-200) }` ·
`[disabled] { opacity: .45 }`

---

## Assets

- **Icônes** : [Lucide](https://lucide.dev), inline en SVG sur `currentColor`,
  `viewBox="0 0 24 24"`, `stroke-width="2"`. Les 33 tracés nécessaires sont
  dans `angular/icon.component.ts` et couvrent les 17 emoji documentés. Aucune
  dépendance npm.
- **Logo** : `src/assets/logo.png` existant, ou `logo_url` des réglages
  entreprise. Inchangé.
- **Police** : Archivo, via Google Fonts, poids 400/500/600/700/800. Remplace
  Inter.
- Aucune image ni illustration nouvelle.

---

## Fichiers

### `angular/` — à intégrer

| Fichier | Destination (relative à `front/`) | Étape |
|---|---|---|
| `_tokens.scss` | `src/app/_tokens.scss` | 1 |
| `app.scss` | `src/app/app.scss` | 1 |
| `icon.component.ts` | `src/app/shared/icon/icon.component.ts` | 2 |
| `rail.component.ts` | `src/app/shared/rail/rail.component.ts` | 3 |
| `rail.component.html` | `src/app/shared/rail/rail.component.html` | 3 |
| `rail.component.scss` | `src/app/shared/rail/rail.component.scss` | 3 |
| `app.html` | `src/app/app.html` | 3 |

`angular/README.md` détaille les étapes 1 à 5, avec la table de correspondance
emoji → icône, les commandes de recherche et les pièges de compilation Sass.

### `design/` — références, à consulter

| Fichier | Contenu |
|---|---|
| `Direction 1a - PNEU.Ma.dc.html` | `2a` `2b` `2c` + spécification du rail |
| `Ecrans 1a - Operations.dc.html` | `3a` `3b` `3c` `3d` `3e` `3f` `3g` |
| `Ecrans 1a - Analyse.dc.html` | `3h` `3i` `3j` `3k` `3l` + les deux rouges comparés |
| `Accueil - PNEU.Ma.dc.html` | `4a` `4b` `4c` — les trois directions d'accueil, dont deux écartées |
| `Accueil retenu - PNEU.Ma.dc.html` | `5a` `5b` — la version retenue, deux portées |
| `Revue Theme PNEU.Ma.dc.html` | La revue en dix constats, et les trois directions de navigation dont deux écartées |

`Rail.dc.html`, `support.js` et `_ds/` sont leurs dépendances — ne pas les
déplacer.

### `CLAUDE_CODE.md`

Le brief à donner à Claude Code, découpé en tâches indépendantes, avec les
critères de vérification de chacune.
