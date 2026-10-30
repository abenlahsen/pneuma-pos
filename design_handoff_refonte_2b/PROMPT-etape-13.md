# Étape 13 — la fonctionnalité portail client B2B, de bout en bout

Référence : `Portail Client B2B.dc.html` (maquettes 12a et 12b), et `Refonte Details.dc.html`
(16a, la fiche client, dont le relevé du portail est une version filtrée).

Le portail n'existe nulle part dans le code. Ce n'est pas un écran de plus : c'est un
**second public**, avec son authentification, son périmètre de données, et un circuit de
commande qui arrive côté agence. Cette étape couvre les quatre morceaux :

1. l'ouverture d'un accès client, côté agence ;
2. le portail lui-même, côté client ;
3. le traitement des commandes portail, côté agence ;
4. la sécurité et les tests qui garantissent que le client ne voit que ce qui le regarde.

Une sous-étape par commit, dans l'ordre. **Ne commence pas le front avant que 13.1 et
13.2 soient validés.**

---

## 13.0 — Décisions posées (à me confirmer avant de coder)

Trois choix commerciaux ont été retenus par défaut. Rappelle-les-moi en une ligne chacun
et attends mon « ok » :

| Sujet | Choix par défaut | Conséquence |
| --- | --- | --- |
| Disponibilité | **En niveaux** : Disponible, Stock limité, Sous 24 h, Sur commande · N j | Le client ne voit jamais une quantité exacte. Seuils réglables. |
| Crédit | **Avertit, ne bloque pas** jusqu'à la limite ; **bloque au-delà** | Sous la limite : bandeau ocre. Au-delà : envoi impossible, message « contactez votre commercial ». |
| Paiement | **Pas de paiement en ligne** | « Payer en ligne » devient « Déclarer un virement » : le client saisit montant, date, référence, justificatif ; l'agence rapproche. |

Le prestataire de paiement pourra s'ajouter plus tard sans toucher au reste : isole la
déclaration de virement derrière une interface `PaymentIntent` pour qu'un second mode s'y
branche.

---

## 13.1 — Backend : l'identité client

> Un client n'est pas un `User`. Ne mélange pas les deux tables ni les deux gardes.
>
> 1. **Table `client_portal_accounts`** : `client_id`, `email` (unique), `password`,
>    `status` (invité, actif, suspendu), `invited_at`, `activated_at`, `last_login_at`,
>    `invited_by` (user). Plusieurs comptes par client sont possibles (un garage a
>    souvent un gérant et un comptable) ; prévois le champ `name` du contact.
> 2. **Garde d'authentification séparée** (`portal`), avec son propre préfixe d'API
>    `/api/portal/*` et ses propres jetons. Un jeton portail ne doit jamais ouvrir une
>    route `/api/*` de l'agence, et inversement. Écris le test dans les deux sens.
> 3. **Invitation** : l'agence crée l'accès, un lien d'activation valable 72 h est envoyé
>    par email ; le client choisit son mot de passe. Réutilise les règles de mot de passe
>    de `change-password`. Lien de réinitialisation sur le même principe.
> 4. **Suspension** : un compte suspendu ne se connecte plus et ses jetons sont révoqués.
>    Un client archivé ou supprimé suspend tous ses comptes.
> 5. **Limitation** : tentatives de connexion limitées (5 par 15 min par email + IP).
>
> Permissions agence à créer dans le seeder : `manage portal access` (Administrator,
> Manager), `process portal orders` (Administrator, Manager, Commercial).

## 13.2 — Backend : le périmètre du client

> Toutes les routes `/api/portal/*` résolvent le client **depuis le jeton**, jamais
> depuis un paramètre. Aucune route n'accepte de `client_id`.
>
> 1. **Catalogue** `GET /api/portal/catalog?q=` — recherche par dimension tolérante
>    (`2055516`, `205/55R16`, `205 55 16`), marque, saison, indice de charge. Réutilise
>    l'analyse de dimension de l'étape 5a. Renvoie : désignation, dimension, indices,
>    saison, **prix du client** (tarif négocié ou remise habituelle appliqués côté
>    serveur), niveau de disponibilité. **Ne renvoie jamais** : prix d'achat, marge,
>    quantité exacte, dépôt, lot, DOT, fournisseur.
> 2. **Niveau de disponibilité** calculé côté serveur à partir du stock disponible
>    (hors quantités attendues de l'étape 12) : seuils réglables dans Paramètres
>    (par défaut : ≥ 8 Disponible, 1 à 7 Stock limité, 0 avec achat attendu Sous 24 h ou
>    délai de l'achat, 0 sans achat Sur commande avec le délai fournisseur).
> 3. **Compte** `GET /api/portal/account` — solde dû, limite, crédit restant, délai
>    accordé, échéance la plus proche. `GET /api/portal/statement` — le relevé de 16a,
>    **filtré** : pas de commercial, pas de marge, pas de partenaire, pas de note interne.
>    Mêmes écritures, même solde progressif : un désaccord se règle sur la même colonne.
> 4. **Documents** : téléchargement du PDF de facture et de bon de livraison (gabarit de
>    l'étape 10), limité aux documents du client.
> 5. **Tests de cloisonnement**, obligatoires : un client A ne peut lire ni le catalogue
>    avec les prix de B, ni une facture, une commande ou une écriture de B, même en
>    devinant l'identifiant. Chaque route portail a son test « autre client → 404 ».
>    Un test vérifie qu'aucune réponse portail ne contient les clés `purchase_price`,
>    `margin`, `quantity` de stock, `user_id` de commercial.

## 13.3 — Backend : la commande portail

> Une commande portail **n'est pas une vente**. C'est une demande que l'agence confirme.
>
> 1. **Table `portal_orders`** + `portal_order_items` : client, compte portail émetteur,
>    lignes (produit, quantité, prix unitaire affiché au moment de l'envoi), mode de
>    livraison (retrait au dépôt / livraison à l'adresse), référence interne du client,
>    commentaire, statut, horodatages de chaque étape.
> 2. **Statuts** : `envoyee` → `confirmee` → `preparee` → `livree`, plus `refusee` (avec
>    motif, visible du client) et `annulee` (par le client, tant qu'elle est `envoyee`).
> 3. **Envoi** : contrôle du crédit selon 13.0. Le prix est **recalculé côté serveur** ;
>    celui envoyé par le front n'est qu'indicatif. Numéro `CMD-AAAA-NNNN`.
> 4. **Confirmation par l'agence** : la commande devient une **vente** normale, créée par
>    le commercial du client, avec les lots choisis par l'agence (le client n'en choisit
>    aucun). L'agence peut ajuster quantités et prix avant de confirmer ; le client voit
>    alors la commande « confirmée avec modifications » et le détail des écarts.
>    La vente garde le lien vers sa commande portail.
> 5. **Préparée / livrée** suivent le statut de la vente liée ; pas de double saisie.
> 6. **Notifications** : email au client à chaque changement de statut ; côté agence,
>    compteur sur l'Accueil et notification au commercial du client à l'envoi.

## 13.4 — Backend : la déclaration de virement

> `POST /api/portal/payment-declarations` : montant, date, référence, factures visées
> (facultatif), justificatif (PDF ou image, 5 Mo max). Statut `declaree` → `rapprochee`
> ou `rejetee` (motif visible). Le rapprochement côté agence **crée** l'encaissement
> normal (volet 15d de l'étape 6) ; la déclaration ne touche jamais le solde seule.
> Le relevé portail affiche les déclarations en attente sur une ligne grise « déclaré,
> en cours de vérification », sans modifier le solde.

---

## 13.5 — Front agence : ouvrir un accès

> Sur la fiche client (16a), dans la colonne de droite, un bloc **Accès portail** :
>
> - aucun compte : « Inviter un contact » (nom, email) → envoi de l'invitation ;
> - comptes existants : une ligne par contact avec son état (invité le…, actif, dernière
>   connexion, suspendu), et les actions renvoyer l'invitation, suspendre, réactiver.
>
> Sous la permission `manage portal access`. La suspension passe par la confirmation
> partagée de l'étape 5c. Dans la liste Clients, un filtre « Accès portail actif ».

## 13.6 — Front portail : l'application client

> Une **coque séparée** sous `/portail`, chargée paresseusement, sans le rail ni la barre
> de l'agence (maquette 12a). Ses composants réutilisent les jetons, le mixin de ligne,
> les états partagés de l'étape 8c et les seuils de repli de l'étape 8, mais n'importent
> **rien** de `features/` agence : si un composant est partagé, il passe dans `shared/`.
>
> Écrans :
>
> 1. **Connexion portail** — gabarit 11b, titre « Espace professionnel », lien retour vers
>    la connexion équipe. Activation et réinitialisation sur le même gabarit.
> 2. **Commander** (12a) — recherche centrale, filtres marque / saison / indice /
>    « disponible seulement », grille Référence · Disponibilité · Prix unitaire ·
>    Quantité. Panier en colonne droite : lignes, remise visible par ligne, sous-total,
>    TVA, total TTC, bandeau de crédit (ocre sous la limite, rouge et bouton désactivé
>    au-delà), livraison, référence interne, « Envoyer la commande » et la phrase
>    « transmise à l'agence pour confirmation ». Le panier survit à un rechargement
>    (stockage local, par compte).
> 3. **Mes commandes** — liste avec l'avancement en quatre segments ; détail d'une
>    commande avec ses lignes, les écarts si confirmée avec modifications, le motif si
>    refusée, « Annuler » tant qu'elle est envoyée, et « Commander à nouveau ».
> 4. **Mon compte** (12b) — solde dû, limite, crédit restant, délai ; relevé avec solde
>    progressif ; téléchargement du relevé et des factures ; « Déclarer un virement »
>    (volet 15d) ; colonne droite : commandes récentes, coordonnées avec « Demander une
>    modification » (crée une note sur la fiche client, ne modifie rien), contact du
>    commercial.
>
> Sous 900 px : les onglets passent en barre basse à trois entrées, le panier devient un
> bouton flottant qui ouvre un volet plein écran. C'est l'usage le plus probable : un
> garagiste qui commande depuis son téléphone à l'atelier.

## 13.7 — Front agence : traiter les commandes

> 1. **Accueil** : une nouvelle section « Commandes portail à confirmer » dans la file
>    « À traiter », avec compteur et montant, triée par ancienneté.
> 2. **Écran de traitement** `/commandes-portail/:id` — gabarit de la saisie de vente :
>    les lignes du client à gauche avec, pour chacune, le stock réel et le choix du lot
>    (comme dans la saisie de vente), prix et quantité modifiables ; le client, son
>    solde et son crédit à droite. Actions : « Confirmer et créer la vente » (rouge),
>    « Refuser » (motif obligatoire, visible du client).
> 3. **Liste** `/commandes-portail` sur le mixin de ligne : numéro, client, date, total,
>    statut, âge ; filtre par statut.
> 4. **Déclarations de virement** : une file dans Cash Flow, « À rapprocher », qui ouvre
>    l'encaissement pré-rempli ; « Rejeter » avec motif.
> 5. La fiche de vente (16b) affiche « Issue de la commande portail CMD-… » quand c'est
>    le cas.

---

## Vérification

> Montre-moi, dans cet ordre :
>
> 1. l'invitation d'un contact depuis la fiche client, puis l'activation du compte ;
> 2. une recherche `2055516` sur le portail, avec les quatre niveaux de disponibilité ;
> 3. un envoi de commande sous la limite (bandeau ocre) et une tentative au-delà (bloquée) ;
> 4. la confirmation côté agence avec une quantité modifiée, puis ce que le client voit ;
> 5. une déclaration de virement, son rapprochement, et le relevé des deux côtés ;
> 6. le portail à 390 px.
>
> Donne-moi le résultat des tests de cloisonnement de 13.2 à part : nombre de routes
> portail, nombre de routes couvertes par un test « autre client ». Les deux chiffres
> doivent être égaux.
>
> Liste ce que tu as dû décider seul.
