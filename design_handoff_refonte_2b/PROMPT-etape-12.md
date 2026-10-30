# Étape 12 — intervention, saisie d'achat, retour fournisseur

Référence : `Refonte Intervention et Achat.dc.html` (maquettes 20a, 20b, 20c).

Ce sont les trois surfaces restées dans leur modale d'origine. Elles ne créent pas de
nouveau gabarit : 20a et 20b reprennent l'écran plein de la saisie de vente et de la fiche
produit (barre de titre, colonnes, pied d'actions), et 20c reprend le volet 15d de
l'encaissement client.

Une sous-étape par commit, dans l'ordre. Commence par les vérifications backend.

## 12.0 — Trois vérifications avant de coder

> Réponds-moi sur ces trois points avant de toucher au front :
>
> 1. **Brouillon d'achat.** Le modèle `Purchase` a-t-il un statut brouillon, ou un moyen
>    d'enregistrer un achat sans faire entrer le stock ? Si non, le bouton « Garder en
>    brouillon » de 20b disparaît. N'ajoute pas de statut sans mon accord.
> 2. **Retour imputé sur le dû.** Un retour fournisseur sans remboursement réduit-il
>    aujourd'hui le solde dû au fournisseur ? Si non, dis-moi ce qu'il faudrait pour que
>    « Déduire du dû » (20c) le fasse.
> 3. **Dernier prix d'achat.** Peut-on obtenir le dernier prix d'achat d'un produit, et
>    chez quel fournisseur ? 20b s'en sert pour signaler une hausse pendant la saisie.

## 12a — L'intervention en un écran

> Maquette 20a. La fiche (`service-order-detail`, une modale) et le formulaire (modale
> dans `service-orders.component.html`, vers la ligne 378) fusionnent en un seul écran
> éditable, sur les routes `/service-auto/nouveau` et `/service-auto/:id`.
>
> - **Barre de titre** : plaque en premier (17 px), véhicule, puis n° d'intervention,
>   heure d'ouverture et mécanicien en sous-ligne. À droite de la barre, un indicateur
>   d'état en trois étapes : en cours, terminée, facturée.
> - **Grille de lignes unique** pour les prestations et les pièces : icône de type,
>   désignation et sous-ligne, Qté, Coût, Prix, Total, retrait. La colonne Coût porte le
>   prix d'achat de la pièce, ou 0 pour une prestation. Supprime les deux dispositions
>   séparées et le libellé « PV / main-d'œuvre » qui change.
> - **Stock** : une pièce dont la quantité dépasse le stock prend un fond ocre sur sa
>   ligne, avec « 1 en stock pour 2 demandées » en sous-ligne. Le pied affiche alors
>   « Commander la pièce ».
> - **Ajout** : une dernière ligne de recherche en pointillés, plus les puces
>   « Fréquentes » (garde `quickServiceChips`).
> - **Colonne de droite** : client et véhicule (kilométrage éditable, dernière visite en
>   dessous), suivi (mécanicien, remise, notes), totaux, marge (sous la permission
>   `view margins`), paiements.
> - **Pied** : l'action principale suit l'état. « Terminer l'intervention » (rouge) en
>   cours, « Facturer » (bleu d'encre `#2f4fb8`) une fois terminée, « Encaisser » une fois
>   facturée ; l'encaissement ouvre le volet 15d. « Annuler l'intervention » passe au
>   statut `ANNULE` avec la confirmation partagée de l'étape 5c.
> - **Statut `ANNULE`** : l'intervention sort des trois colonnes de la vue Atelier et
>   reste dans la vue Liste, masquée par défaut derrière un filtre « Annulées ».
>
> Conserve toute la logique de `service-order-form.component.ts` : recherche de pièces,
> catalogue de prestations, calculs, validation. Seule la présentation change.
>
> Les boutons « Ouvrir », « Terminer » et « Facturer » des cartes de la vue Atelier
> mènent vers cette route. `service-payment-panel` passe dans le volet 15d.

## 12b — La saisie d'achat en écran plein

> Maquette 20b. `purchase-form` quitte la modale de `purchases-page.component.html` (vers
> la ligne 298) pour les routes `/achats/nouveau` et `/achats/:id/modifier`. Supprime la
> redirection `/achats?edit=<id>` posée à l'étape 6 et fais pointer « Modifier » de la
> fiche d'achat vers la nouvelle route.
>
> Trois colonnes, comme la saisie de vente :
>
> - **Gauche, 400 px** : recherche par dimension, marque ou référence, en tolérant
>   `2055516` comme sur la vente. Les produits déjà achetés chez le fournisseur
>   sélectionné remontent en premier, les autres suivent sous « Autres fournisseurs ». Un
>   lien permet de créer un produit sans quitter l'achat.
> - **Centre** : les lignes. Produit et sous-ligne, Dépôt de réception, Qté, PU achat,
>   Total HT, retrait.
>   - La colonne « Stock » actuelle devient « Dépôt de réception ».
>   - La sous-ligne affiche le prix de vente courant et la marge laissée par le prix
>     d'achat saisi.
>   - Si le prix saisi dépasse le dernier prix d'achat connu (12.0, point 3), le champ
>     prend un bord ocre et une bande « Prix supérieur de 2,2 % au dernier achat » s'affiche
>     sous la ligne.
> - **Droite, 360 px** : fournisseur (déjà dû, délai contractuel, et le total dû après cet
>   achat), documents (choix segmenté « Avec facture / BL seul », n° de BL, n° de facture,
>   réception « Attendue / Reçue »), totaux avec l'échéance calculée sur le délai, et
>   règlement (« À crédit / Payé maintenant »).
>
> Les champs Statut et Statut paiement disparaissent en tant que listes déroulantes :
> leurs valeurs viennent des deux choix segmentés.
>
> **Pied** : « Enregistrer l'achat » (rouge). « Garder en brouillon » uniquement si 12.0,
> point 1, le permet. Le stock n'entre que si la réception est « Reçue ». « Payé
> maintenant » ouvre le volet 15d de paiement après l'enregistrement.

## 12c — Le retour fournisseur en volet 15d

> Maquette 20c. `purchase-return` quitte `modal-overlay` et passe dans le volet 15d, par
> dessus la fiche d'achat routée.
>
> - **Grille à quatre colonnes** : Article (achetée, déjà retournée et prix unitaire en
>   sous-ligne), Retournable, À retourner, Montant. « À retourner » est un compteur − / +
>   borné entre 0 et la quantité retournable ; un compteur à 0 est grisé.
> - **Date et motif** côte à côte. Le motif devient une liste déroulante : défaut de
>   fabrication, erreur de livraison, invendu. Si le backend stocke un texte libre, garde
>   une option « Autre » avec un champ texte.
> - **Contrepartie** : la case à cocher « Remboursement » devient un choix segmenté,
>   « Déduire du dû » par défaut, ou « Remboursement reçu ». Sous « Déduire du dû », une
>   phrase donne le dû avant et après. « Remboursement reçu » affiche les champs actuels :
>   montant, compte crédité, date, méthode. « Déduire du dû » dépend de la réponse à 12.0,
>   point 2.
> - **Pied** : total retourné (nombre et montant), « Annuler » et « Enregistrer le
>   retour ».

## Vérification

> Montre-moi l'intervention dans ses trois états et avec une pièce en rupture, la saisie
> d'achat avec une hausse de prix signalée, et le retour dans ses deux contreparties.
> Vérifie aussi 20a et 20b à 1024 px : sous `$bp-reduce`, la colonne de droite passe sous
> la grille de lignes. Dis-moi ce que tu as dû décider seul.
