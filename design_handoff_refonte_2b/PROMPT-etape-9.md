# Étape 9 — les neuf modules jamais redessinés

À lancer **après la fin de l'étape 8** : les listes de ce lot doivent hériter du repli
du mixin (8b) et des quatre états partagés (8c), sinon il faudra y revenir.

Ces neuf modules n'ont reçu que la palette et la géométrie (étapes 1 et 5d). Leur
structure est d'origine : `<table>`, `modal-overlay` écrites en ligne, `summary-card`,
`tab-btn`.

- **9a — sans maquette**, par gabarits existants : `users`, `partners`, `accounts`,
  `hr-charges`, `activity-log`, et la liste et le formulaire de `shipment-changes`.
- **9b — trois maquettes** dans `Refonte Consultation.dc.html` : `primes` (18a),
  `kpi-history` (18b), le document imprimé de `shipment-changes` (18c).

Un message par sous-étape.

## 9a — Les six modules par gabarits

> Lis `design_handoff_refonte_2b/PROMPT-etape-9.md`, section 9a. Aucune maquette dans ce
> lot : chaque écran prend un gabarit déjà en place.
>
> | Module | Liste | Formulaire |
> |---|---|---|
> | `users` | mixin de ligne | modale en ligne → coque 15b (`app-referential-modal`) |
> | `partners` | mixin de ligne | modale en ligne → coque 15b |
> | `accounts` | — | `account-form` et `transfer-form` → coque 15b |
> | `hr-charges` | mixin de ligne | `hr-charge-form` porte un tableau de lignes éditable → volet 15d, comme `client-payment` |
> | `activity-log` | `<table class="data-table">` → mixin de ligne | la modale de détail → volet 15d en lecture seule ; le tableau `snapshot-table` avant / après reste un tableau dans le volet |
> | `shipment-changes` | `shipment-change-list` → mixin de ligne | `shipment-change-form` porte un tableau de lignes → volet 15d |
>
> Chaque liste déclare ses colonnes `--drop` pour le repli de 8b et consomme les états
> partagés de 8c (squelette, vide après filtrage, erreur, verrou).
>
> `activity-log` porte déjà un squelette écrit à la main (c'était la base du composant de
> 8c) : vérifie qu'il consomme bien le composant partagé.
>
> Les `@media (max-width: 900px)` hérités de `accounts` et `hr-charges` tombent avec leur
> modale : ne les réécris pas, le mixin et les coques s'en chargent.
>
> Montre-moi `users` et `hr-charges` avant de faire les quatre autres — l'un est le cas
> simple, l'autre le cas à tableau de lignes.

## 9b — Primes (maquette 18a)

> Lis `design_handoff_refonte_2b/Refonte Consultation.dc.html`, section 18a, et
> recrée `primes-page`.
>
> La prime est collective : tant que la boutique n'a pas atteint son seuil, personne ne
> touche rien. L'écran répond donc d'abord à « combien de pneus manque-t-il, et en combien
> de jours ».
>
> 1. **En tête** : réalisé / seuil en grand, l'écart (« il manque 203 pneus »), le rythme
>    nécessaire par jour ouvré restant, le rythme actuel et la date projetée d'atteinte.
>    La jauge : réalisé en plein, projection en hachures, trait vertical au seuil.
> 2. **Le tableau ne se grise plus** quand le seuil n'est pas atteint. La dernière colonne
>    s'appelle « Prime si atteint » et reste en gris ; elle passe en encre et devient
>    « Prime due » une fois le seuil franchi. Supprime `row-disabled` et `prime-zero`.
> 3. **Colonne « Part du collectif »** : barre + pourcentage du total boutique.
> 4. **Panneau de droite** : coût de la prime (au réalisé, à la projection, part de la
>    marge nette), les six derniers mois, et la règle en clair.
>
> Deux données manquent dans la réponse de l'API, et le backend doit les ajouter :
> - les ventes **jour par jour** du mois en cours (ventes + service auto), pour le rythme
>   et la projection ;
> - le **seuil appliqué** et le total de chacun des six mois précédents — un seuil a pu
>   changer, l'historique doit montrer celui qui valait alors.
>
> Les jours ouvrés restants se calculent côté front à partir des jours de fermeture déjà
> connus de `company-settings`. S'ils ne le sont pas, dis-le-moi au lieu d'inventer une
> règle.
>
> Si l'endpoint ne peut pas être étendu tout de suite, fais le reste et masque la
> projection et l'historique derrière un `@if`, sans les simuler.

## 9c — Historique KPI (maquette 18b)

> Section 18b. Recrée `kpi-history-page`.
>
> 1. **La modale disparaît.** L'écran se divise en deux : la liste des jours à gauche
>    (392 px, quatre colonnes : jour, CA, marge nette, pneus), le détail du jour
>    sélectionné à droite. Les autres colonnes de l'ancien tableau passent dans le détail.
> 2. **Navigation** : le jour sélectionné porte un liseré gauche. ↑ ↓ au clavier et deux
>    boutons dans l'en-tête du détail passent au jour voisin. L'identifiant du jour va
>    dans l'URL (`/kpi-history/2026-09-16`), pour pouvoir partager un lien.
> 3. **Plus d'onglets.** Le détail empile : tableau de performance (ce jour / mois à date /
>    année à date), puis une bande de quatre cellules stock et trésorerie, puis le tableau
>    par commercial.
> 4. **Les deux tableaux par commercial fusionnent** : ventes par vendeur, puis une ligne
>    « dont service auto » en total. Le service ventilé par vendeur reste dans Reporting.
> 5. Les dimanches et jours sans instantané s'affichent comme une ligne « Fermé » plus
>    basse, au lieu de disparaître : un trou dans les dates doit se voir.
>
> Les filtres Du / Au deviennent un jeton de période, comme sur Ventes. Garde
> `app-auto-refresh-control`.

## 9d — Demande de modification d'expédition (maquette 18c)

> Section 18c. Recrée le document de `shipment-change-print`.
>
> C'est une lettre au transporteur, envoyée par fax, par photo ou en impression noir et
> blanc. **Aucune couleur d'interface sur la feuille** : l'encre, des gris et le logo.
>
> 1. **Le numéro d'expédition domine** : cadre de 2 px, chasse fixe, 25 px. C'est ce que
>    le transporteur saisit. Vente, date d'expédition et nombre de colis sont à côté, dans
>    le même cadre.
> 2. **Avant / après** : ancienne valeur barrée et grisée, flèche, nouvelle valeur en gras.
> 3. **Case transporteur** : bordure pointillée, et « ☐ Acceptée ☐ Refusée · Date » en
>    bas, pour que le document revienne signé.
> 4. **Deux champs nouveaux** : le nombre de colis (somme des quantités de la vente) et le
>    signataire (l'utilisateur qui a créé la demande, avec son rôle). Tout le reste reprend
>    les champs actuels du composant tels quels.
> 5. **L'aperçu sort de la modale** : il s'ouvre sur `/shipment-changes/:id/print`, avec
>    Télécharger PDF et Imprimer dans la barre, sur le modèle du relevé client. Le PDF
>    reste généré par le même code qu'aujourd'hui.
>
> Vérifie le rendu imprimé en A4 réel, pas seulement à l'écran : le bloc signatures est
> poussé en bas de page et ne doit jamais passer sur une deuxième feuille.
