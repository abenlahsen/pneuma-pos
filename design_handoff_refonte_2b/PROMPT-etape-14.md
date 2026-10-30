# Étape 14 — les états d'attente

Référence : `Refonte Attente.dc.html` (maquette 21a).

L'état existe déjà dans le code (`submitting()`, `saving()`, `deleting…Id()` dans une
vingtaine de composants), mais il ne se voit presque pas : seul le libellé du bouton
change. Les listes ont trois indicateurs différents (`.spinner`, `.inline-spinner`,
« Chargement… » en texte), et rien ne signale une requête longue.

Fais ces trois sous-étapes dans l'ordre, une par commit.

## 14a — L'indicateur partagé et le suivi des requêtes

> 1. **`shared/spinner`** : un anneau de 14 px en trait de 2 px, qui prend la couleur du
>    texte (`currentColor`), avec une taille de 12 px en option. Il porte `role="status"` et
>    un libellé accessible. Avec `prefers-reduced-motion`, il devient un point fixe.
> 2. **`PendingRequestsService`** et un intercepteur HTTP qui compte les requêtes en cours.
>    Il expose `busy()` (vrai après 300 ms) et `slow()` (vrai après 8 s). Une requête peut
>    être exclue du suivi avec un `HttpContext`, pour les sondages en tâche de fond.
> 3. **Barre haute globale** : 3 px, rouge `#ff2d37`, qui défile sous la barre de titre quand
>    `busy()` est vrai. Elle ne bloque rien.
> 4. **Bandeau « Toujours en cours… »** en bas à droite quand `slow()` est vrai, avec le texte
>    de la maquette. Il disparaît seul à la réponse.
> 5. **Délai maximum** de 30 s par requête dans l'intercepteur. Au-delà, l'erreur part vers
>    l'état d'erreur partagé de 8c. Les envois de fichiers en sont exclus.

## 14b — Les boutons et les lignes

> 1. **Directive `[appBusy]`** à poser sur un bouton. Quand elle vaut vrai : l'anneau prend
>    la place du début du libellé, le bouton garde sa largeur, `aria-busy="true"`, un second
>    clic est ignoré. Le bouton ne se grise pas. Le libellé en cours vient de
>    `appBusyLabel` (« Enregistrement… », « Réception… »…).
> 2. **Remplace les ternaires** du type `{{ submitting() ? 'Enregistrement…' : '…' }}` par
>    cette directive, dans tous les pieds de formulaire et de volet : paiements client,
>    fournisseur, vente, achat et service, réception, retour, paramètres, client rapide,
>    véhicule, et les pages d'intervention et d'achat (`[busy]`). Les autres boutons du même
>    pied se désactivent pendant l'envoi.
> 3. **Actions de ligne** : remplace chaque `<span class="inline-spinner">` par l'anneau à
>    la place de l'icône du bouton cliqué, dans sa couleur. La ligne passe à 62 % d'opacité,
>    et sa sous-ligne affiche « Suppression en cours… » (ou l'action concernée). Concerne
>    marques, transporteurs, catégories, clients, ventes et Cash Flow ; cherche les autres
>    `deleting…Id()`.
> 4. Supprime la classe `.inline-spinner` une fois qu'elle n'est plus utilisée.

## 14c — Les listes qui se rechargent

> 1. Distingue le **premier chargement** (aucune donnée encore) du **rechargement** (filtre,
>    tri, page). Le premier garde le squelette de 8c.
> 2. Au rechargement, les lignes affichées restent en place à 55 % d'opacité, sous un filet
>    de 2 px qui défile sous la barre de filtres, avec « Mise à jour… » et l'anneau de 12 px
>    à droite de cette barre. Mets-le dans le mixin de liste, pas écran par écran.
> 3. Remplace les derniers `<div class="spinner">` (reporting, stock, fournisseurs,
>    catégories de transaction) : par le squelette pour un premier chargement, par cet état
>    pour un rechargement.
>
> Vérification : simule une API lente (un délai de 2 s puis de 10 s dans un intercepteur de
> développement). Montre-moi un paiement en cours d'enregistrement, une suppression de
> ligne, un changement de filtre sur Ventes, et le bandeau après 8 s. Donne-moi la liste
> des composants modifiés, et dis-moi s'il reste des `spinner` ou des ternaires
> « …ement… ».
