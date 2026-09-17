# Handoff : refonte du design de Pneuma POS

## Vue d'ensemble

Refonte visuelle et structurelle de **Pneuma POS** (point de vente pour magasin de pneus,
interface en français, Angular 21 + Laravel). Onze écrans redessinés, plus une fiche de
système, les règles de repli tablette et les quatre états manquants.

L'objectif exprimé par le commanditaire : l'application est trop dense, la hiérarchie
visuelle est faible, les tableaux et les montants sont difficiles à lire, les formulaires
de saisie sont trop longs, le rendu tablette est mauvais et le style vieillit. Ampleur
demandée : **nouvelle direction complète**, en repartant du thème réellement en production.

## À propos des fichiers de design

Les fichiers `.dc.html` de ce dossier sont des **références de design en HTML** :
des prototypes qui montrent l'apparence et le comportement visés. **Ce n'est pas du code
à copier en production.**

La tâche consiste à **recréer ces écrans dans le codebase Angular existant**, avec ses
patterns établis : composants standalone, signals, SCSS par composant, mixin partagé
`_page-layout.scss`. Aucune dépendance nouvelle n'est nécessaire — sauf le jeu d'icônes
(voir *Assets*).

## Fidélité

**Haute fidélité (hifi).** Couleurs, tailles, graisses, hauteurs de contrôle, largeurs de
colonne et espacements sont définitifs et donnés en valeurs exactes ci-dessous. Les copies
d'écran doivent être reproduites au pixel près, en utilisant les composants Angular
existants là où ils conviennent.

Les **données** affichées sont fictives mais réalistes (clients, dimensions de pneus,
montants en DH, noms de commerciaux). Ne pas les reprendre : elles illustrent la densité
réelle attendue.

## Point de départ : le thème réellement en production

Vérification faite dans le codebase avant de dessiner :

- `src/styles.scss` **n'importe pas** `_tokens.scss`
- `src/app/app.html` monte `<app-navbar>`, pas `<app-rail>`
- `src/app/features/_variables.scss` définit `$primary: #ff2d37`
- `src/app/app.scss` définit `--app-primary: #ff2d37`, `--app-accent: #1e293b`

Conclusion : **le rail 64 px et la palette Archivo/#ec3013 du dossier
`design_handoff_rail_navigation/` ne sont pas en production.** Ce handoff part donc du
thème vivant — Inter, `#ff2d37`, menu vertical sombre 280 px — et le remplace.

Le dossier `design_handoff_rail_navigation/` contient néanmoins une implémentation de rail
utilisable comme base technique : garder sa mécanique, remplacer ses tokens par ceux
ci-dessous.

---

## Jetons de design

### Couleurs

Dix-huit valeurs, une par rôle. Elles remplacent le contenu de
`src/app/features/_variables.scss` et le bloc `:root` de `src/app/app.scss`.

| Valeur | Rôle | Remplace |
| --- | --- | --- |
| `#081627` | Rail de navigation (fond) | — |
| `#0c1e33` | Encre : texte principal, filets forts, boutons neutres | `--app-accent: #1e293b` |
| `#41546e` | Texte secondaire | `$text-secondary` |
| `#4a5c75` | Libellés, unités, sous-lignes — **gris le plus clair admis sur blanc (4,5:1)** | `$text-muted` |
| `#adc2da` | Bords de champ et de bouton | `$border-color` |
| `#cfdcec` | Filets de séparation | — |
| `#e7eef8` | Filets de ligne, fonds de jauge | — |
| `#e6edf7` | Fond d'application | `$bg-color` |
| `#f4f8fd` | Barre haute, en-têtes de colonne, volet latéral | `$bg-subtle` |
| `#ffffff` | Surface de contenu | `$surface` |
| `#ff2d37` | **Marque** : action principale, une seule par écran | `$primary` (inchangé) |
| `#c2181f` | Argent dû, retard, texte d'alerte | `$primary-dark: #cc0a13` |
| `#8f1218` | Texte d'alerte sur fond rosé | — |
| `#15616d` | Encaissé, payé, entrée d'argent | `$income-color: #48bb78` |
| `#2f4fb8` | À facturer (Service Auto) | — |
| `#8a5a00` | Seuil, attente, risque légal | `$warning-color` |
| `#fdeff1` | Fond de ligne en retard | — |
| `#fdf6e6` | Fond d'avertissement | — |
| `#e6ebfd` | Fond de colonne « à facturer » | — |
| `#d4a017` | Bord d'avertissement, jauge sous seuil | — |

**Règle centrale : une couleur = un sens.** Le rouge ne signifie que « argent dû » ou
« action principale ». Les sept variantes de badge actuelles (`badge-success`,
`badge-warning`, `badge-info`, `badge-primary`, `badge-secondary`, `badge-danger`,
`badge-method`) se réduisent à quatre sens : dû, encaissé, en attente, neutre.

Sur fond sombre (`#081627`), le texte inactif est `rgba(230,237,247,.66)`, les libellés
`rgba(230,237,247,.6)`, les séparateurs `rgba(230,237,247,.2)`.

### Typographie

Famille inchangée : `'Inter', -apple-system, 'Segoe UI', sans-serif`, avec
`-webkit-font-smoothing: antialiased`.

| Usage | Taille | Graisse | Interlettrage | Autre |
| --- | --- | --- | --- | --- |
| Chiffre de tête (solde, CA) | 30 px | 700 | −.03em | `line-height: 1` |
| Cadran de bande | 25 px | 700 | −.03em | `line-height: 1` |
| Titre d'écran | 19 px | 700 | −.02em | |
| Montant de ligne | 15–17 px | 700 | — | tabulaire |
| Plaque, identifiant | 15 px | 700 | — | tabulaire |
| Ligne principale (nom) | 14–14,5 px | 600 | — | |
| Corps, valeur de tableau | 13 px | 400–600 | — | |
| Sous-ligne (ville, tél., commercial) | 11,5 px | 400 | — | **plancher de taille** |
| En-tête de colonne | 9,5 px | 700 | .13em | `text-transform: uppercase` |
| État de paiement | 11,5 px | 700 | .04em | majuscules |
| Étiquette neutre | 9,5 px | 700 | .06em | majuscules, bord 1 px |

**Règle : tout montant et toute quantité portent `font-variant-numeric: tabular-nums`.**
C'est ce qui rend une colonne de chiffres comparable d'un coup d'œil. Aucun texte sous
11,5 px sauf les capitales d'en-tête à 9,5 px.

### Espacement et géométrie

- Rayon de bordure : **0 partout.** Aucune exception. (Remplace les `border-radius: 8px`
  à `14px` actuels.)
- Ombres : **aucune.** Les `box-shadow` de carte de `_page-layout.scss` disparaissent ;
  la séparation se fait par filet de 1 px.
- Filets : 1 px `#e7eef8` entre lignes, 1 px `#cfdcec` entre blocs, 1 px `#0c1e33` sous
  un en-tête de colonne ou au-dessus d'un pied de total.
- Padding de ligne : `0 18px` à `0 22px` selon la largeur d'écran.
- Padding de bloc : `12px 16px` à `16px 22px`.
- Gap de grille de ligne : `10px` à `14px`.

### Hauteurs de contrôle

| Contexte | Hauteur |
| --- | --- |
| Champ de formulaire | 44–46 px |
| Bouton de barre haute | 36 px |
| Bouton de ligne, champ de ticket | 32–38 px |
| Filtre, segment, jeton | 30–32 px |
| Bouton icône de ligne | 30–32 px (36 px sous 1200 px, 38 px sous 900 px) |
| Pagination | 30 px |
| Ligne de liste | 58 px (62 px sous 1200 px) |
| Ligne enfant | 44 px |
| Barre haute | 60 px (56 px sous 1200 px) |
| Rail | 72 px de large, entrées de 54 px (64/48 sous 1200 px) |

Champ actif : bord `#0c1e33` 1 px (ou 2 px pour une recherche principale). Jamais d'ombre
ni de halo.

---

## Le motif de ligne

C'est la décision structurante : elle fait passer les listes de 13–17 colonnes à 8–9 et
supprime le défilement horizontal.

**Implémentation : grille CSS, pas `<table>`.** Les colonnes restent alignées entre
en-tête, lignes et lignes enfants, et un enfant s'insère sans casser la structure.

```scss
// Gabarit type (écran Ventes)
.row {
  display: grid;
  grid-template-columns: 52px 84px minmax(0, 1fr) 78px 118px 118px 98px 112px 120px;
  align-items: center;
  gap: 12px;
  min-height: 58px;
  padding: 0 18px;
  border-bottom: 1px solid #e7eef8;
}
```

Cinq règles, valables sur les onze écrans :

1. **Grille CSS**, une seule déclaration `grid-template-columns` partagée par l'en-tête et
   toutes les lignes du même écran. Si la largeur d'une piste change, elle change partout.
2. **58 px de hauteur de ligne**, 44 px pour une ligne enfant. Cible tactile tenue sur
   tablette.
3. **Ce qui qualifie sans être triable descend en sous-ligne à 11,5 px** `#4a5c75`.
   Pour Ventes : téléphone, ville, partenaire, créateur, horodatages.
4. **Montants et quantités à droite, tabulaires.** Dates et textes à gauche.
5. **Un liseré gauche de 3 px** (`border-left: 3px solid #c2181f; margin-left: -3px`)
   marque la ligne qui demande une action. Une seule couleur par ligne.

Une ligne enfant (lot de stock, retour fournisseur, paiement affecté) se marque par
`padding-left: 14px; border-left: 2px solid #cfdcec` sur sa cellule d'objet, fond `#f4f8fd`.

---

## Gabarits d'écran

### A. Écran de liste — Ventes, Achats, Stock, Clients

```
barre haute 60px  ·  logo · recherche · date · secondaire · PRINCIPAL · avatar
------------------------------------------------------------------
bande de 4 à 5 cadrans, filets verticaux, dernier cadran = alerte ou sélection
------------------------------------------------------------------ 1px #0c1e33
barre de filtres : jetons actifs retirables + bouton « Filtres N »
------------------------------------------------------------------ 1px #cfdcec
en-tête de colonnes 9,5px majuscules
------------------------------------------------------------------ 1px #0c1e33
lignes 58px
...
------------------------------------------------------------------ 1px #0c1e33
pied : compte, TOTAL DE LA SÉLECTION FILTRÉE, pagination
```

Le pied porte le total de la sélection filtrée, pas seulement le compte d'entrées.

### B. Écran de travail — Nouvelle vente, Fiche client, Cash Flow

Deux volets : contenu principal à gauche (`minmax(0,1fr)`), volet secondaire fixe à droite
(300 à 520 px selon l'écran, `background: #f4f8fd`, `border-left: 1px solid #cfdcec`).

Le volet de droite porte ce qu'on consulte sans quitter ce qu'on fait : ticket en cours,
contexte de crédit, soldes de comptes, chiffres du jour. Le total et l'action principale
sont épinglés en bas, sur fond `#0c1e33`.

### C. Écran de flux — Accueil, Service Auto

Colonnes de statut (`grid-template-columns: repeat(3, minmax(0,1fr))`), chacune avec son
en-tête chiffré : compte + montant en jeu. Utilisable seulement quand les statuts sont peu
nombreux et ordonnés (Service Auto en a trois).

---

## Les onze écrans

### 1. `Etat actuel.dc.html` — référence, à ne pas implémenter

Recréation fidèle de l'Accueil et des Ventes **tels qu'ils sont aujourd'hui**, depuis
`navbar.component.*`, `app.scss`, `dashboard.component.*`, `sales-page.component.*` et
`_variables.scss`. Sert de point de comparaison.

### 2. `Refonte Accueil.dc.html` — quatre directions

Quatre options sur l'écran d'Accueil, par ordre chronologique inverse dans le fichier :

- **2b (retenue)** — rail sombre 72 px + barre haute claire `#f4f8fd`, contenu en registre,
  palette froide. **C'est la direction appliquée à tous les écrans suivants.**
- **2a** — même structure, palette chaude (encre `#221d1b`, papier `#f6f3f0`, pétrole
  `#0f6b68`, ocre `#8f5510`). Écartée.
- **1a / 1b / 1c** — premières explorations : menu conservé et rangé, file de travail,
  registre dense. Historique.

Contenu de 2b : bande de 4 cadrans (CA, marge nette, encaissé, impayés — le dernier sur
fond `#0c1e33`), liste « à traiter » groupée par nature (impayés clients, achats à régler,
ordres à facturer, produits sous seuil), volet droit avec chiffres du mois, histogramme
30 jours et classement des commerciaux.

Remplace : 24 cadrans sans hiérarchie ni action, et 9 cartes de raccourcis redondantes
avec le menu.

### 3. `Refonte Ventes.dc.html`

Grille : `52px 84px minmax(0,1fr) 78px 118px 118px 98px 112px 120px`.

Trois décisions :

- **15 filtres → une barre à jetons.** Les filtres actifs sont des jetons retirables
  (`Septembre 2026 ✕`), le reste derrière « Filtres 3 ». Aujourd'hui les quinze champs
  occupent 190 px de haut en permanence.
- **17 colonnes → 9.** N°, date, client, qté, total, marge, paiement, statut, actions.
  Le reste en sous-ligne. Plus de défilement horizontal. Sélecteur « Colonnes 9/17 ».
- **8 cadrans → 4 + total de sélection** qui suit les filtres.

Détails repris du code : une vente verrouillée (`isSaleLocked`) affiche un cadenas
désactivé au lieu de voir ses boutons disparaître — la colonne garde sa largeur. Le
pourcentage de marge ne se colore que sous le seuil (`marginClass`), au lieu des trois
couleurs systématiques.

### 4. `Refonte Nouvelle vente.dc.html`

Écran plein, deux volets (`minmax(0,1fr) 520px`), remplace la modale à cinq sections.

- **Gauche** : recherche (la dimension se frappe telle quelle, `2055516`), puis les lots
  avec stock, PU achat, PU vente et marge. On choisit **une ligne de stock**, pas un produit
  puis un lot — le champ `stock_id` séparé disparaît.
- **Droite** : ticket permanent. Qté, PU vente et remise éditables sur la ligne ; le PU
  d'achat vient du lot, en lecture seule. **L'ajout passe de 8 champs à 3.**
- **Contexte crédit remonté** : les quatre métriques du compte client (solde, projeté,
  limite, dernière vente) et l'avertissement de dépassement sont au-dessus du ticket.
- **Logistique repliée** : seuls commercial et partenaire (les deux champs `required`)
  sont visibles ; transport, n° de suivi, service, statut, date de livraison et
  commentaires derrière « Déplier les 6 champs ».
- Pied : « Enregistrer en brouillon » / « Valider et encaisser » — ce dernier enchaîne sur
  le paiement au lieu de renvoyer à la liste.

### 5. `Refonte Stock.dc.html`

Grille : `22px 108px minmax(0,1fr) 168px 98px 104px 110px 92px`.

- **Une ligne par référence**, lots dépliables en dessous. Aujourd'hui une ligne par lot :
  la même référence revient autant de fois qu'elle a de dépôts, zones et DOT.
- **17 colonnes → 8.** La dimension mène (clé d'entrée réelle) ; IC, IV, saison, RFT, XL
  et marquage descendent en sous-ligne.
- **Répartition par dépôt + jauge de seuil** par ligne. Le seuil n'était visible que sur
  l'Accueil.
- Cas rendus lisibles : stock entier dans un autre dépôt → bouton « Transférer » au lieu
  d'un « absent » ; lot épuisé conservé sous sa référence pour l'historique.

### 6. `Refonte Client.dc.html`

Deux volets (`minmax(0,1fr) 340px`).

- **Le relevé devient la colonne vertébrale.** Les trois onglets actuels (factures en
  cours, écritures comptables, paiements) fusionnent en un fil chronologique unique
  débit / crédit / solde progressif, qui accueille aussi avoirs et acomptes. C'est ce
  qu'on imprime et qu'on envoie.
- **Bande de vieillissement** 0-30 / 31-60 / 61-90 / +90 jours + crédit restant, à la
  place du seul total impayé.
- **Panneaux statiques à droite**, repliables : coordonnées, paramètres financiers,
  véhicules, habitudes d'achat.
- Chiffre ajouté : **délai de paiement réel** (54 j) face au contractuel (30 j).

### 7. `Refonte Service Auto.dc.html`

Gabarit C. Les trois statuts de `status.constants.ts` (`EN COURS`, `TERMINE`, `ANNULE`)
deviennent trois colonnes chiffrées : « Sur les ponts », « Terminé, à facturer »
(`#2f4fb8`), « Facturé ».

- **La plaque mène chaque fiche** — c'est l'identifiant utilisé à l'oral dans l'atelier.
- Deux situations invisibles dans un tri par date : terminé non facturé (19 700 DH, le plus
  ancien depuis 12 j) et intervention bloquée par une pièce manquante (3 j sur un pont,
  liseré ocre).
- Basculement **Atelier / Liste** dans la barre haute ; la vue liste garde le tableau pour
  recherche et export.
- **Question ouverte** : `ANNULE` n'a pas de colonne. À trancher (filtre ? archive ?).

### 8. `Refonte Achats.dc.html`

Grille : `76px minmax(0,1fr) 84px 112px 118px 112px 142px`.

- **Groupés par fournisseur**, avec en-tête de groupe portant le délai contractuel (60 j,
  90 j, 45 j) et une action « Régler le fournisseur » couvrant plusieurs achats.
- **Seuil de risque légal (> 90 j) visible ligne par ligne.** L'Accueil le signalait déjà
  (« 2 à risque légal · 126 j ») mais l'écran Achats ne le montrait pas.
- **Réception et règlement = deux jeux de filtres** distincts, au lieu de deux colonnes de
  badges parmi treize.
- **Retours fournisseurs** affichés en ligne enfant sous leur achat, avec montant remboursé.
- **À confirmer** : 90 jours est-il le bon seuil légal pour votre contexte ?

### 9. `Refonte Cash Flow.dc.html`

Deux volets (`minmax(0,1fr) 340px`).

- **Projection à six semaines devant le solde passé** : barres hebdomadaires alimentées par
  les échéances déjà dans le système (achats à régler, impayés clients **au délai réel
  observé**, charges récurrentes). Fait apparaître un point bas à 21 850 DH.
- **Registre unique** : échéances à venir et transactions passées dans le même fil, coupé
  par une ligne « Aujourd'hui » sur fond `#0c1e33`, avec solde progressif.
- **Comptes = lignes avec leur solde** (caisse, banque, chèques en circulation, disponible).
  Aujourd'hui « Compte » est une colonne, donc le solde par compte n'est jamais lisible.
- Bloc « En jeu » : dû aux fournisseurs, impayés clients, position nette.

### 10. `Refonte Reporting.dc.html`

Deux colonnes égales. Cet écran était déjà le mieux construit (il compare au mois
précédent) ; le changement est de forme.

- **Tableau mois / mois précédent / variation** à la place des groupes de cadrans.
- Les cinq tableaux empilés passent en deux colonnes qui tiennent sur une hauteur d'écran
  et s'impriment.
- **La couleur ne marque que les écarts à expliquer** : marge nette −5,8 % malgré
  +7,3 % de CA, impayés +25,1 %.
- Deux encadrés de bas de colonne nomment l'écart sans l'interpréter.

### 11. `Refonte Connexion.dc.html`

Deux variantes : **11a** pleine page en deux volets (ancre `#081627` + chiffres de
l'agence), **11b** centrée 560 px pour tablette d'atelier.

Deux ajouts à valider : « garder ma session sur ce poste » (poste de comptoir partagé —
décision de sécurité) et un lien vers le portail client.

L'écran `change-password` suit le gabarit de 11b, trois champs.

**Note d'implémentation** : dans un conteneur flex en colonne, le logo doit porter
`align-self: flex-start` — sinon `align-items: stretch` l'étire en largeur et le déforme
(ratio réel 246×100).

### 12. `Portail Client B2B.dc.html` — conception nouvelle

**Aucun portail n'existe dans le code** (aucune occurrence de `portal`, `portail` ou `b2b`).
C'est une conception, pas une refonte.

Palette 2b mais **pas de rail** : un client ouvre le portail deux fois par mois, il ne
mémorise pas une navigation d'icônes. Trois onglets nommés : Commander, Mes commandes,
Mon compte.

- **12a — Commander** : recherche par dimension, résultats avec **disponibilité** (disponible
  / sous 24 h / stock limité / sur commande) et prix de vente client. Panier à droite,
  sous-total HT, TVA 20 %, total TTC, bandeau de crédit, choix retrait / livraison.
- **12b — Mon compte** : solde dû, limite, crédit restant, délai accordé ; relevé identique
  à la fiche client **filtré** (ni commercial, ni marge, ni partenaire) ; commandes avec
  avancement en quatre étapes (envoyée, confirmée, préparée, livrée).

**Ce qu'il ne doit jamais afficher** : prix d'achat, marge, quantité exacte de stock,
nom du commercial, partenaire.

**La commande n'est pas une vente** : elle arrive côté agence comme une demande à confirmer.
Le vendeur garde la main sur le prix, le lot et le crédit.

**Trois décisions commerciales à trancher** (pas graphiques) :
1. Disponibilité en niveaux ou en quantité exacte ? (niveaux supposés, pour ne pas exposer
   le stock à un professionnel parfois concurrent)
2. Le dépassement de crédit bloque l'envoi ou avertit seulement ? (avertit, supposé)
3. « Payer en ligne » suppose un prestataire de paiement — sinon le bouton devient
   « Déclarer un virement ».

### 13. `Systeme de design.dc.html`

La fiche de référence : les 18 couleurs et leur sens, l'échelle typographique, les
contrôles et leurs hauteurs, le motif de ligne en cinq règles, les trois gabarits, et le
mapping vers les fichiers du codebase.

### 14. `Tablette et etats.dc.html`

Règles de repli et états manquants — détaillés ci-dessous.

---

## Comportement responsive

**Deux seuils suffisent.** Les composants ne changent pas ; c'est la grille de ligne qui se
réorganise.

### Sous 1200 px — on réduit (`14a`, dessiné à 1024 px)

- Rail : 72 → **64 px**, entrées 54 → **48 px**, libellés supprimés (l'icône garde son
  `title`)
- Barre haute : 60 → **56 px**
- Cadrans : 5 → **3**
- Colonnes de liste : 9 → **5** (date, client, total, paiement, actions)
- Boutons icône : 30 → **36 px** ; lignes 58 → **62 px**
- Au-delà de deux actions par ligne : menu **⋯**

### Sous 900 px — on change de forme (`14b`, dessiné à 820 px)

- Rail remplacé par une **barre basse 64 px à cinq entrées** (Accueil, Ventes, Stock,
  Service, Nouveau) ; les quatre autres destinations passent dans **☰**
- **La ligne devient une fiche** de deux rangées : nom + méta à gauche, montant à droite,
  puis état + deux boutons de 38 px
- Recherche réduite à une icône qui déplie un champ pleine largeur
- Cadrans : 2 maximum

## Les quatre états manquants (`14c`)

1. **Chargement** — squelette aux **bonnes largeurs de colonne** (barres `#e7eef8` et
   `#f4f8fd`), pas le `spinner` centré actuel qui fait sauter la page à l'arrivée des
   données.
2. **Liste vide après filtrage** — nomme les filtres responsables et propose de les
   retirer un par un ou tous. Remplace « Aucune vente trouvée. », qui laisse chercher
   pourquoi.
3. **Erreur de chargement** — dit ce qui a échoué, **ce qui est préservé** (« Vos filtres
   sont conservés »), quand ça réessaie, et garde le détail technique accessible sans
   l'afficher.
4. **Permission refusée / ligne verrouillée** — **cadenas désactivé** qui garde la colonne
   d'actions à largeur constante. Deux causes (statut verrouillé via `isSaleLocked`, ou
   rôle sans permission via `hasPermission`), même traitement visuel, l'infobulle dit
   laquelle.

## Où poser tout cela dans le code

| Fichier | Ce qui change |
| --- | --- |
| `src/app/features/_variables.scss` | Les 18 valeurs de la palette remplacent `$primary`, `$income-color`, `$expense-color`, `$warning-color` et les gris. Seul fichier à éditer pour la palette. |
| `src/app/features/_page-layout.scss` | Le motif de ligne remplace le mixin de tableau : grille CSS au lieu de `<table>`, `border-radius: 0`, plus d'ombres. **Les 25 écrans qui incluent ce mixin suivent sans être touchés un par un.** |
| `src/app/app.scss` · `app.html` | Barre haute 60 px + rail 72 px remplacent le menu vertical 280 px. `menuLayout` et la variante horizontale disparaissent : une seule disposition. |
| `src/app/shared/navbar/` → `shared/rail/` | Neuf destinations conservées ; icônes au lieu d'emoji ; sous-menus en survol au lieu de replier la page. Base technique disponible dans `design_handoff_rail_navigation/`. |
| `src/app/shared/state-badge/` | Sept tons → quatre sens. Pastille → texte. Étiquette à bord fin pour les qualificatifs neutres. |
| `src/app/shared/icon/icon.component.ts` | Les emoji de menu, de cadran et de bouton (🏠 🏷️ 🔧 📦 💰 🛞 👁️ ✏️ 🗑️ 💳) passent par ce composant, en Lucide à 1,6–1,7 px de trait. **Changement le plus visible au coût le plus faible.** |
| `src/app/features/sales/sale-form/` | Modale → écran plein deux volets. `stock_id` fusionné dans la sélection de lot. Section logistique repliée par défaut. |

### Ordre d'application suggéré

Du moins risqué au plus structurant :

1. `_variables.scss` + icônes Lucide — effet immédiat, aucun changement de structure
2. `_page-layout.scss` — refait les 25 listes d'un coup
3. Barre haute + rail — remplace `navbar`, supprime `menuLayout`
4. Les écrans qui changent de forme : Nouvelle vente, Service Auto, Cash Flow
5. Le portail B2B — nouveau périmètre, à cadrer séparément

## Gestion d'état

Aucun besoin nouveau côté modèle. Les écrans redessinés introduisent quatre états
d'interface :

- `filtersExpanded: signal<boolean>` — panneau de filtres replié par défaut ; les filtres
  actifs restent visibles en jetons
- `visibleColumns: signal<Set<string>>` — sélecteur « Colonnes 9/17 », persisté par
  utilisateur et par écran
- `expandedRows: signal<Set<number>>` — lignes dépliées (lots de stock, retours)
- `viewMode: signal<'board' | 'list'>` — Service Auto uniquement

Trois agrégats à calculer côté serveur (ils n'existent pas aujourd'hui) :

- **Total de la sélection filtrée** (pied de liste) — même filtres que la requête courante
- **Âge de la dette** par tranche 0-30 / 31-60 / 61-90 / +90 j (fiche client, Achats)
- **Projection de trésorerie hebdomadaire** (Cash Flow) — échéances d'achats + impayés au
  délai réel observé + charges récurrentes

## Assets

- **Logo** : `assets/logo.png`, copié depuis `front/public/logo.png` (246×100, PNG
  transparent). Utilisé tel quel, `height` fixe et `width: auto`, `align-self: flex-start`
  dans un flex en colonne.
- **Icônes** : [Lucide](https://lucide.dev), trait 1,6–1,7 px, `stroke-linecap: square`
  pour la navigation et les objets, `round` pour les alertes et les signes. Les SVG des
  prototypes sont inline et peuvent être reprises telles quelles dans
  `icon.component.ts`. Elles remplacent tous les emoji de l'interface.
- **Police** : Inter (Google Fonts), poids 400/500/600/700/800 — déjà chargée par
  `src/styles.scss`.
- Aucune image de contenu, aucune photographie.

## Fichiers de ce dossier

| Fichier | Contenu |
| --- | --- |
| `Etat actuel.dc.html` | L'existant recréé depuis le code (référence de comparaison) |
| `Refonte Accueil.dc.html` | Accueil — 4 directions, **2b retenue** |
| `Refonte Ventes.dc.html` | Liste des ventes |
| `Refonte Nouvelle vente.dc.html` | Saisie de vente |
| `Refonte Stock.dc.html` | Stock groupé par référence |
| `Refonte Client.dc.html` | Fiche client + relevé de compte |
| `Refonte Service Auto.dc.html` | Vue atelier |
| `Refonte Achats.dc.html` | Achats groupés par fournisseur |
| `Refonte Cash Flow.dc.html` | Trésorerie et projection |
| `Refonte Reporting.dc.html` | Bilan mensuel |
| `Refonte Connexion.dc.html` | Connexion, 2 variantes |
| `Portail Client B2B.dc.html` | Portail client (conception nouvelle) |
| `Systeme de design.dc.html` | Fiche de référence du système |
| `Tablette et etats.dc.html` | Repli tablette + 4 états manquants |
| `assets/logo.png` | Logo, copié du dépôt |
| `support.js` | Runtime des prototypes — **ne pas porter** |

Ouvrir n'importe quel `.dc.html` dans un navigateur pour le consulter. Les fichiers portent
des identifiants visibles (`2b`, `3a`, `14c`…) qui servent de référence en discussion.

## Questions ouvertes

1. **Service Auto** : où va le statut `ANNULE` ? Il n'a pas de colonne dans la vue atelier.
2. **Achats** : 90 jours est-il le bon seuil de risque légal ?
3. **Portail** : disponibilité en niveaux ou quantité exacte ? crédit bloquant ou
   avertissant ? prestataire de paiement en ligne ?
4. **Connexion** : « garder ma session » est-il acceptable sur un poste de comptoir partagé ?
5. **Colonnes masquées** : le sélecteur « Colonnes 9/17 » doit-il être persisté par
   utilisateur, par rôle, ou fixe ?
