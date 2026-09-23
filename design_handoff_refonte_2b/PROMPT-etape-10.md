# Étape 10 — l'imprimé de vente, d'achat et d'intervention

Référence : `Refonte Imprime Vente.dc.html`, maquette 19a (facture de vente en A4) et le
texte à droite de la feuille, qui décrit les trois autres documents.

**À faire après le commit du lot en cours.**

Un seul composant, `shared/document-print`, imprime les factures, les bons de livraison,
les achats et les fiches d'intervention. Il reçoit déjà une structure commune (titre,
numéro, tiers, lignes, totaux, transport, notes). La refonte garde cette structure et lui
applique la grammaire de la lettre d'expédition (18c) : encre seule, un chiffre dominant,
mentions légales en pied de page.

## Différence essentielle avec la lettre : ce document peut faire plusieurs pages

La lettre tient toujours sur une feuille, d'où sa hauteur fixe et son `overflow: hidden`.
**Ne reprends pas ce mécanisme ici** : une facture de 40 lignes doit passer sur deux ou
trois pages, rien ne doit être coupé ni bloqué.

- La feuille suit la hauteur de son contenu.
- L'en-tête du tableau se répète en haut de chaque page (`display: table-header-group`, ou
  l'équivalent pour la grille), et une ligne n'est jamais coupée entre deux pages
  (`break-inside: avoid`).
- Le bloc totaux, le montant en lettres et les signatures forment un seul ensemble qui ne
  se coupe pas. S'il ne tient pas sur la page en cours, il passe entier sur la suivante.
- Les mentions légales sont en pied de chaque page.
- Vérifie le PDF de `downloadPdf()` (html2canvas) : lui aussi doit paginer sans couper une
  ligne. Si ce n'est pas possible avec l'outil actuel, dis-le-moi avant de le remplacer.

Garde la page nommée pour les règles `@page` : cette fois-ci, `document-print` doit avoir
la sienne (A4, marges de 15 mm), sans toucher à celle de la lettre.

## 10a — La facture de vente (maquette 19a)

> Lis `design_handoff_refonte_2b/PROMPT-etape-10.md`, puis la maquette 19a de
> `Refonte Imprime Vente.dc.html`. Recrée `document-print` pour le type facture de vente.
>
> 1. **En-tête** : logo, avec l'émetteur en une ligne dessous (raison sociale, adresse,
>    téléphone, email). À droite : type du document en capitales, numéro à 22 px, lieu et
>    date, n° de vente. Un filet de 2 px sépare l'en-tête du reste.
> 2. **Client et net à payer** : le client à gauche (nom, adresse, téléphone, ICE s'il est
>    connu). À droite, un cadre de 2 px porte le net à payer à 27 px et, en dessous,
>    l'état du paiement en capitales (« PAYÉ », « PARTIEL · RESTE DÛ … », « NON PAYÉ »).
>    Le badge coloré actuel disparaît.
> 3. **Tableau** : sans cellules, avec un filet de 1 px par ligne et un filet à l'encre sous
>    l'en-tête et sous la dernière ligne. La dimension et le DOT passent en sous-ligne sous
>    la désignation. Garde la colonne Remise conditionnelle (`hasDiscounts()`).
> 4. **Sous le tableau, deux colonnes** : à gauche, transport et paiement (transporteur,
>    n° de suivi en chasse fixe, date de livraison, mode de paiement) sans titre de
>    section ; à droite, les totaux (Total HT, TVA, Net à payer, Déjà payé, Reste dû).
>    Affiche la remise globale seulement si `discount_global > 0`, et ne la compte jamais
>    une seconde fois quand les lignes portent déjà leur propre remise.
> 5. **Montant en toutes lettres** : « Arrêtée la présente facture à la somme de … toutes
>    taxes comprises. » Écris une fonction `montantEnLettres(n)` en français, dirhams et
>    centimes, avec ses tests : 0, 1, 21, 71, 80, 81, 100, 200, 1 000, 1 001, 17 556,48,
>    1 000 000. Les règles d'accord (quatre-vingts, deux cents, mille invariable) doivent
>    être justes : c'est un document comptable.
> 6. **Signatures** : « Cachet et signature », avec le nom et la fonction du vendeur, et
>    « Reçu par le client » en pointillé, avec « Nom, date et signature ».
> 7. **Aucune couleur d'interface sur la feuille** : l'encre, des gris et le logo.
>
> L'aperçu sort de sa modale, comme la lettre : route `/documents/:type/:id/print`, avec
> Imprimer et Télécharger PDF dans la barre. Les écrans qui ouvraient la modale y
> naviguent.
>
> Vérifie avec une vente de 3 lignes et une de 40 lignes, en impression et en PDF.

## 10b — Les trois autres documents

> Même gabarit, trois variantes, sans nouveau composant :
>
> - **Bon de livraison** : sans prix ni totaux ni montant en lettres. Le cadre de tête
>   porte le nombre de colis au lieu du net à payer. La case « Reçu par le client » reste :
>   c'est elle qui fait preuve de livraison.
> - **Achat** : le tiers est le fournisseur, le cadre de tête porte le total dû au
>   fournisseur. Pas de case « Reçu par le client » : elle devient « Réceptionné par », avec
>   le nom de celui qui a reçu la marchandise.
> - **Fiche d'intervention** : véhicule et kilométrage sous le client, la plaque en chasse
>   fixe. Les prestations et les pièces restent dans le même tableau, avec la sous-ligne
>   « Prestation » ou « Pièce ».
>
> Liste-moi d'abord tous les types que `getDocumentTitle()` sait produire aujourd'hui. S'il
> y en a d'autres que ces quatre, dis-moi lesquels avant de les traiter.
