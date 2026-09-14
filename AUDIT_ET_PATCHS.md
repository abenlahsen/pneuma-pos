# Audit maquettes ↔ code local, et patchs

Relevé fait en lisant `front/src/` le 14/09/2026. Un patch par écran
désynchronisé, à donner à Claude Code **un par un, dans l'ordre**. Les deux
premiers sont transversaux : les passer avant tout le reste, sinon chaque
écran repris ensuite hérite du défaut.

## Synthèse

| Écran | Maquette | État local | Patch |
|---|---|---|---|
| Tokens | — | `_tokens.scss` en place, mais `--radius: 0` | **P0** |
| En-tête de page | barre unique | 26 `<h1>` en doublon de la barre | **P1** |
| Rail + panneau | — | `shared/rail/` conforme | — |
| Icônes Lucide | — | `shared/icon/`, 33 tracés | — |
| États vide / charge / erreur | `3b` `3c` `3d` | trois composants partagés, conformes | — |
| Palette `Ctrl K` | `3a` | `shared/command-palette/` | — |
| Connexion | `3k` | `auth-split`, deux moitiés | — |
| Cash Flow | `3g` | courbe `polyline` + colonne `balance_after` | — |
| Réglages | `3j` | `settings-nav` en place | **P6** (vérif) |
| Fiche client | `3i` | `client-detail-page` existe | **P6** (vérif) |
| Portail client | `2c` | 4 pages, rail à 4 entrées | **P6** (vérif) |
| Accueil | `5a` `5b` | 2 files sur 4 | **P2** → `CORRECTIF_TACHE_9.md` |
| Ventes — liste | `2a` | ni KPI, ni chips, `status-select` sans chevron | **P3** |
| Fiche produit | `3e` | **absente** — pas de `product-detail-page` | **P4** |
| Service Auto | `3f` | liste en `auto-fit`, pas de planning | **P5** |
| Reporting | `3h` | mensuel par flèches, pas de Trimestre / Année | **P7** |
| Nouvelle vente | `2b` | `sale-form` d'origine | **P8** |
| Tablette | `3l` | non vérifiable en lecture | **P6** (vérif) |

Ce qui est conforme l'est vraiment : le rail, les trois états, la palette, la
connexion et Cash Flow n'ont pas besoin d'être retouchés. Le filtrage de
portée côté API (`WorkQueueService.php`) est également juste.

---

## P0 — Le rayon

**Une ligne, à faire en premier.** Le commanditaire a tranché 8 px / 12 px ;
le code local est resté sur le zéro Modernist, donc toute l'application a des
angles vifs alors que les maquettes ont des coins arrondis.

> Dans `front/src/app/_tokens.scss`, remplace :
>
> ```scss
> --radius:    0;
> --radius-lg: 0;
> ```
>
> par :
>
> ```scss
> --radius:    8px;
> --radius-lg: 12px;
> ```
>
> Et dans `front/src/app/features/_variables.scss` (déprécié mais encore lu) :
> `$radius: 8px; $radius-sm: 8px; $radius-lg: 12px;`
>
> Puis cherche les rayons encore écrits en dur — il en reste des `999px` sur
> les badges, qui doivent passer à `var(--radius)` :
>
> ```bash
> grep -rn "border-radius:\s*[0-9]" front/src/app --include=*.scss | grep -v _tokens
> ```
>
> Règle : `var(--radius)` pour un badge, un bouton, un champ, une puce ;
> `var(--radius-lg)` pour une carte, un panneau, une modale. Aucune valeur en
> dur.

---

## P1 — Le double en-tête

`app.html` rend une barre supérieure, mais seulement sur les écrans
`isFixedShell()`. Les 26 autres rendent encore leur propre `<h1>` : sur ces
écrans il y a soit deux en-têtes, soit un gros titre que les maquettes n'ont
pas. C'est le défaut le plus visible du lot, et il touche tout.

> Généralise la barre supérieure de `app.html` à tous les écrans internes, et
> retire les en-têtes de page locaux.
>
> Chaque page déclare son titre via le service `pageHeader` — et non plus dans
> son template. Supprime les blocs `.header` / `.page-header` avec `<h1>` et
> `.subtitle` de ces fichiers :
>
> ```bash
> grep -rln "<h1>" front/src/app/features --include=*.html
> ```
>
> Les actions primaires de chaque page (« Nouvelle vente », « Exporter PDF »,
> « Nouvel ordre ») remontent dans la barre, à droite. Les filtres et les
> sélecteurs de période restent dans la page.
>
> Deux exceptions à conserver : la connexion (`3k`, hors coquille) et les
> fiches de détail (`3e` `3i`), où l'en-tête d'objet — vignette 84 px, titre
> 32 px, badges d'état — **est** le motif et remplace le `<h1>` plutôt que de
> s'ajouter à la barre. Le fil d'Ariane de la fiche va dans la barre :
> `Stock / Produits / PN-4412`.
>
> Supprime `isFixedShell()` quand plus aucun écran n'en dépend.

---

## P2 — Accueil

Deux files sur quatre, compteurs sans montant, libellés d'action et de portée
à revoir.

> Applique `design_handoff_rail_navigation/CORRECTIF_TACHE_9.md` en entier.

Le fichier est autoportant : il liste les sept écarts, précise les deux ajouts
non demandés à conserver (la moyenne d'agence sans nom, la mention « en
retard »), et donne les critères de vérification.

---

## P3 — Ventes, liste

C'est le motif « liste » de référence : le reprendre mal condamne les onze
écrans qui s'en déduisent. Trois manques.

> Reprends `front/src/app/features/sales/pages/sales-page.component.*` selon
> `2a` (`design/Direction 1a - PNEU.Ma.dc.html`) et le § « Motif liste » du
> `README.md`.
>
> **1. La rangée de KPI n'existe pas.** Quatre indicateurs dans **un seul
> cadre** `2px solid var(--text)`, rayon `var(--radius-lg)`, fond
> `var(--surface)`, cellules égales séparées par `2px solid var(--text)` :
> CA du jour, marge nette, nombre de ventes, impayés. Étiquette 11 px / 700 /
> `0.1em` / majuscules / `var(--text-muted)` ; valeur 30 px / 800 /
> `letter-spacing: -0.02em` / `tabular-nums` ; suffixe « DH » 15 px / 600.
> Le KPI « Impayés » en `var(--accent-700)` — **jamais** `var(--accent)`, qui
> ne fait que 3,7:1 à cette taille.
>
> **2. Les filtres ne sont pas des chips.** Toutes / En cours / Livrées /
> Impayées : 12 px / 700 / `0.08em` / majuscules, padding `7px 12px`, bordure
> `2px solid var(--neutral-400)`, rayon `var(--radius)`. Sélectionnée : fond
> `var(--text)`, texte `var(--bg)`. « Impayées » est teintée en permanence :
> bordure `var(--accent-300)`, fond `var(--accent-100)`, texte
> `var(--accent-700)`, et porte son compte. Le nombre de résultats et la date
> à droite de la rangée, 13 px / `var(--text-muted)`.
>
> **3. Le `status-select` est toujours un badge déguisé** (ligne ~298 du
> template) : un `<select>` en `appearance: none`, visuellement identique aux
> badges de paiement qui ne sont pas modifiables. Applique la règle du
> système, qui vaut pour toute l'application :
>
> - **état lu** → plat : 11 px / 700 / `0.08em` / majuscules, padding
>   `4px 8px`, bordure 2 px, rayon `var(--radius)`. Neutre : bordure
>   `var(--neutral-300)`, texte `var(--neutral-800)`. Alerte : bordure et
>   texte `var(--accent-700)`.
> - **état modifiable** → mêmes dimensions, bordure
>   `2px solid var(--neutral-400)`, texte `var(--text)`, **chevron `▾` 9 px**
>   avec `gap: 7px`, survol `border-color: var(--text)`.
>
> Les classes `badge-success` / `badge-warning` / `badge-danger` disparaissent
> au profit de ces deux états. Cellules de tableau à **14 px**, pas 13.
>
> Vérifie : plus aucun `border-radius: 999px`, et le chevron apparaît partout
> où une valeur se change au clic.

---

## P4 — Fiche produit

**L'écran n'existe pas.** `products-page` est une liste ; il n'y a pas de
`product-detail-page`, alors que `clients` et `suppliers` ont le leur. C'est
le second gabarit de référence : sans lui, les fiches fournisseur,
transporteur, partenaire et véhicule n'ont pas de modèle.

> Crée `front/src/app/features/products/pages/product-detail-page.component.*`
> selon `3e` (`design/Ecrans 1a - Operations.dc.html`) et le § « Motif fiche »
> du `README.md`.
>
> En-tête d'objet : vignette 84 × 84 px (bordure 2 px, rayon
> `var(--radius-lg)`), kicker « Pneumatique utilitaire », titre 32 px / 800 /
> `-0.025em`, ligne d'identifiants (dimension, référence, code-barres), badges
> d'état à droite (« Actif », « Sous le seuil »).
>
> Onglets : Détail · Mouvements · Tarifs · Fournisseurs, bordure basse
> `2px solid var(--text)`, actif en 700 avec
> `box-shadow: inset 0 -3px 0 var(--accent)`.
>
> Deux colonnes `minmax(0,1fr) 360px`. À gauche : trois KPI (en stock, seuil,
> réservé) puis les caractéristiques en deux colonnes de paires clé/valeur.
> À droite : la carte de marge (pourcentage, barre achat/vente) et
> l'historique douze mois en barres.
>
> **Le détail qui compte** : « 6 en stock » ne veut rien dire sans « 4
> réservées ». Le bandeau en pied de colonne gauche calcule le **disponible**
> (`stock − réservé`) et affiche le délai fournisseur. C'est la seule question
> qu'on pose vraiment devant un client.
>
> Ajoute la route et rends les lignes de `products-page` cliquables.

---

## P5 — Service Auto

Aujourd'hui une liste de cartes en `repeat(auto-fit, minmax(175px, 1fr))`.
La maquette est un planning : c'est le seul écran de l'application qui n'est
pas un tableau, et le seul qui demande un calcul.

> Reprends `front/src/app/features/service-orders/pages/service-orders.component.*`
> selon `3f`. **Lis le § « `3f` — Service Auto : l'échelle de temps » du
> `README.md` avant de coder.**
>
> Un ordre de réparation a une durée, une baie et un technicien : dans une
> liste, on ne voit ni les trous ni les chevauchements, c'est-à-dire ce qu'on
> vient chercher.
>
> Grille `52px repeat(N, minmax(0,1fr))` : axe des heures, puis une colonne
> par baie. Axe de **09:00 à 17:00, huit lignes égales**, 13:00 incluse.
>
> Chaque colonne de baie est `position: relative`, et chaque carte est
> **positionnée en absolu depuis une seule fonction du temps** :
> `top = (début − 09:00) / 8 h`, `height = durée / 8 h`, en pourcentage. Le
> trait de l'heure courante sort de la même formule.
> **N'empile pas les cartes en flux avec des hauteurs écrites à la main** :
> leur position n'encoderait plus l'heure, et il n'y aurait aucune règle de
> placement.
>
> Pause de 13:00 : bande hachurée à 45°, `rgba(32,30,29,.06)`.
>
> Quatre états de carte — en cours (bordure `var(--text)`, point accent +
> libellé `var(--accent-700)`), planifié (bordure `var(--neutral-400)`, plage
> horaire en pied), terminé (fond `var(--surface)`, coche + libellé), libre
> (bordure tiretée, libellé centré).
>
> File d'attente à droite, 300 px, cartes `cursor: grab` : on les fait glisser
> dans une baie pour planifier.
>
> **Demande-moi le nombre réel de baies et leur nommage avant de figer la
> grille** — la maquette en montre quatre, une par technicien, mais c'est une
> hypothèse.

---

## P6 — Les quatre vérifications

Ces écrans existent et semblent conformes en lecture, mais je ne peux pas les
juger sans les voir tourner.

> Pour chacun des quatre écrans ci-dessous, compare le rendu réel à sa
> maquette et liste-moi les écarts **sans rien corriger** ; je trancherai
> ce qui vaut un patch.
>
> 1. **Fiche client** (`3i`, `design/Ecrans 1a - Analyse.dc.html`) —
>    `clients/pages/client-detail-page`. Points à vérifier : l'en-tête d'objet
>    avec vignette d'initiales, les cinq onglets, et surtout la **carte
>    d'encours** — valeur, plafond, barre de dépassement, et son bouton
>    « Enregistrer un règlement » porté par la carte elle-même plutôt qu'un
>    renvoi ailleurs.
> 2. **Réglages** (`3j`) — `settings/pages/company-settings-page`. Le
>    `settings-nav` est là ; vérifie que le formulaire est **borné à 720 px**,
>    que chaque interrupteur porte une ligne expliquant ce qu'il fait, et que
>    le réglage `menu_layout` a bien disparu du formulaire et du modèle front.
> 3. **Portail client** (`2c`) — les quatre pages existent. Vérifie qu'aucune
>    destination interne n'est atteignable ni devinable depuis le rail client,
>    et que `data-brand="client"` est bien posé sur `<html>`.
> 4. **Tablette** (`3l`) — sous 1024 px : le rail passe-t-il en barre
>    inférieure de 64 px à cinq cibles ? Les tableaux de plus de quatre
>    colonnes deviennent-ils des cartes ? Teste sur la tablette réelle de
>    l'atelier, pas seulement dans le simulateur.

---

## P7 — Reporting

L'écran a reçu le graphique en encre de `3h` — mois courant plein, précédent
en gris, échelle commune : c'est juste et à garder. Mais la page est restée
l'ancien « Reporting Mensuel ».

> Reprends `front/src/app/features/reporting/pages/reporting-page.component.*`
> selon `3h` (`design/Ecrans 1a - Analyse.dc.html`).
>
> **1. Il n'y a ni vue Trimestre ni vue Année.** La navigation est un couple
> de flèches mois précédent / suivant. Remplace-la par un sélecteur segmenté
> **Mois / Trimestre / Année** dans la barre supérieure, avec le libellé de
> période à côté (« T3 2026 · toutes agences »). Garde les flèches comme
> navigation *dans* la période choisie.
>
> C'est l'écran qui porte le détail par période que l'accueil ne porte plus :
> les trois vues doivent exister, sinon l'information a disparu de
> l'application.
>
> **2. Les KPI sont en cartes individuelles** avec icône, delta et sections
> titrées. Attendu : une **rangée de cinq** dans un cadre unique, comme le
> motif liste — CA de période, marge brute, panier moyen, rotation de stock,
> impayés. Sans icône : une icône par KPI ajoute du bruit sans ajouter de
> sens. Garde le delta par rapport à la période précédente, en texte.
>
> **3. Un graphique de comparaison par section.** Attendu : **un seul**
> graphique de CA mensuel sur la période, année précédente en gris 300
> derrière, plus deux blocs à droite — la répartition du CA en quatre barres,
> et le top produits de la période.
>
> **4. « Exporter PDF » doit produire la mise en page de l'écran**, pas une
> capture : les graphiques sont en SVG et les tableaux en HTML, l'impression
> les rend nativement.
>
> Règle graphique à tenir : une seule teinte porteuse de sens par graphique.
> Année en cours en encre, précédente en gris 300, et le rouge uniquement pour
> pointer une valeur — le mois record, le taux d'impayés.

---

## P8 — Nouvelle vente

`sale-form` est le formulaire d'origine. À reprendre en dernier : c'est le
plus gros chantier et le moins urgent visuellement, mais celui qui pèse le
plus sur le travail au comptoir.

> Reprends `front/src/app/features/sales/sale-form/` selon `2b`
> (`design/Direction 1a - PNEU.Ma.dc.html`).
>
> Grille `minmax(0,1fr) 340px`. Le rail reste en place pendant la saisie : on
> ne perd jamais le contexte.
>
> Colonne gauche : deux champs sur une rangée (Client avec bouton « Nouveau »,
> Véhicule), puis le tableau des lignes — Article (nom en 600 + référence
> 12 px `var(--text-muted)` en dessous) · Qté 70 px · P.U. 110 px · Rem.
> 70 px · Total 120 px, les quatre dernières alignées à droite et tabulaires.
>
> Colonne droite (340 px, `border-left: 2px solid var(--text)`, fond
> `var(--surface-sunk)`) : récapitulatif à lignes séparées par
> `1px solid var(--neutral-300)`, puis total sur `2px solid var(--text)` avec
> la valeur en 28 px / 800 / tabulaire. Dessous, le mode de règlement en
> quatre chips empilés. En pied, deux boutons pleine largeur — primaire
> « Valider la vente », secondaire « Enregistrer en brouillon ». **Les
> libellés de bouton sont alignés à gauche** quand le bouton est plus large
> que son texte.
>
> Le bandeau d'alerte d'impayé se déclenche sur **l'encours réel du client**,
> pas sur une valeur figée — c'est ce qui le rend utile au comptoir. Bordure
> `2px solid var(--accent-300)`, fond `var(--accent-100)`, texte 13 px /
> `var(--accent-800)`.

---

## Ordre recommandé

P0 et P1 d'abord — ils touchent tous les écrans, et les faire après voudrait
dire repasser sur chaque page. Puis P2 (l'accueil, que tu vois chaque matin),
P3 (les ventes, qui servent de modèle aux onze écrans de liste), P4, P5, P7,
P8. P6 peut se glisser n'importe où : ce sont des vérifications, pas des
corrections.
