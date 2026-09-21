# Étape 6 — les écrans de détail

`Refonte Details.dc.html` est dans ce dossier. Deux gabarits.

- **16a** — la fiche client : le relevé passe en colonne principale, le signalétique à droite.
- **16b** — le détail de vente, hors modale ; même gabarit pour le détail d'achat.

Effet de bord voulu : ces deux gabarits absorbent `sale-payment-detail` et
`purchase-payment-detail` (les paiements remontent dans la colonne principale), et
`product-detail` disparaît — il doublait l'éditeur 15a, qui montre déjà tout en lecture.

## 6a — Fiche client

> Lis `design_handoff_refonte_2b/Refonte Details.dc.html`, gabarit 16a.
>
> Refais `client-detail-page` en deux rangées : barre de 60 px, corps en deux colonnes
> `minmax(0,1fr) 400px`. Plus d'onglets, plus de sections repliables.
>
> Quatre changements de fond :
>
> 1. **Le relevé devient la colonne principale.** Les trois sous-sections repliables
>    (factures en cours, écritures comptables, paiements) fusionnent en un registre unique
>    trié par date, avec une colonne de solde progressif — même motif que le registre de
>    Cash Flow. Les quatre boutons de filtre en tête (Tout / En cours / Paiements / Avoirs)
>    remplacent les replis.
> 2. **L'âge de la dette devient un filtre.** La barre segmentée et ses quatre cellules
>    0-30 / 31-60 / 61-90 / +90 existent déjà : rends les cellules cliquables, chacune
>    filtre le registre sur sa tranche.
> 3. **Les quatre cadrans deviennent un chiffre principal et trois de contexte.** Solde dû
>    en grand à gauche ; total acheté, nombre d'opérations et délai réel alignés à droite.
>    Le délai réellement observé est déjà calculé côté backend (`payment_delay`,
>    `observed_sample`) — affiche-le, il n'était visible que dans une note de bas de bloc.
> 4. **Identité, conditions financières et véhicules passent dans la colonne de droite.**
>    Les deux panneaux `info-list` fusionnent en un bloc « Conditions » et un bloc
>    « Coordonnées ». Les véhicules deviennent une liste compacte de trois lignes, pas des
>    cartes.
>
> La modale d'édition écrite en ligne dans ce template (`modal-overlay` brut, vers la ligne
> 487) doit passer par la coque partagée — `app-referential-modal` si elle rentre dans
> 480 px, sinon extrais-la en éditeur 15a sur sa propre route.
>
> Conserve toute la logique existante : permissions, chargement du relevé, `paymentDelay`,
> gestion des véhicules, `pendingDelete`.

## 6b — Détail de vente et d'achat

> Gabarit 16b. `sale-detail` et `purchase-detail` cessent d'être des modales et deviennent
> des pages sur leurs routes (`/sales/:id`, `/purchases/:id`), en trois rangées comme
> l'éditeur produit : barre de titre avec les deux badges d'état, corps en deux colonnes
> `minmax(0,1fr) 400px`.
>
> - **Colonne gauche** : les articles en registre, puis la livraison (ou la réception pour
>   l'achat) en bandeau d'une ligne, puis les paiements — qui remontent ici depuis
>   `sale-payment-detail` / `purchase-payment-detail`. Supprime ces deux composants de
>   modale une fois leur contenu intégré. Pour l'achat, les retours fournisseur viennent
>   sous les paiements.
> - **Colonne droite** : le récapitulatif financier (sous-total, remise, TVA, total, payé,
>   reste dû en encadré rouge), puis la marge — sous permission « voir les marges » — puis
>   un lien vers la fiche client avec son solde total, puis le suivi chronologique.
> - Pour l'achat, le panneau de droite montre le délai contractuel du fournisseur et l'âge
>   du règlement au lieu de la marge.
>
> L'action principale de la barre porte le montant : « Encaisser 48 600 DH », pas
> « Encaisser ».

## 6c — Suppression de `product-detail`

> `product-detail` est une modale qui répète en lecture seule ce que l'éditeur 15a montre
> déjà. Supprime le composant et fais pointer ses appelants vers `/products/:id/edit`.
>
> Vérifie d'abord qu'aucun rôle n'a la permission de voir un produit sans pouvoir l'éditer.
> Si un tel rôle existe, dis-le-moi avant de supprimer : il faudra un mode lecture seule sur
> l'éditeur plutôt qu'une suppression.
