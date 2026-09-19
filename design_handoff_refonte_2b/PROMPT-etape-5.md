# Étape 5 — les formulaires et les modales

`Refonte Formulaires.dc.html` est dans ce dossier. Trois gabarits qui couvrent ce que les
onze premiers écrans ne couvraient pas.

- **15a** — l'éditeur, pour les objets structurés (produit, client, fournisseur, ordre de service).
- **15b** — la modale de référentiel : marque, transporteur, zone, catégorie, rôle.
- **15c** — la confirmation de suppression, partout, y compris les `confirm()` natifs.

## 5a — Produit

> Lis `design_handoff_refonte_2b/Refonte Formulaires.dc.html`, gabarit 15a.
>
> `product-form` cesse d'être une modale et devient un éditeur plein écran sur sa propre
> route (`/products/:id/edit` et `/products/new`), en trois rangées : barre de 60 px, corps
> en deux colonnes `minmax(0,1fr) 520px`, pied d'actions de 64 px.
>
> Trois changements de fond, au-delà du style :
>
> 1. **La dimension devient un champ unique.** Un seul input qui accepte `2055516`,
>    `205/55R16` ou `205/55R16 91V`, analysé à la frappe et éclaté en cinq cellules de
>    relecture en dessous. Les champs `tire_width`, `tire_height`, `tire_diameter`,
>    `tire_load_index`, `tire_speed_index` du modèle ne changent pas — c'est la saisie qui
>    change. Garde un bouton « Saisir champ par champ » qui révèle les cinq inputs quand
>    l'analyse échoue.
> 2. **Le stock sort du formulaire produit.** Le tableau de lots passe dans la colonne de
>    droite, avec la mention explicite que chaque ligne s'enregistre seule. Le bouton
>    « Enregistrer le produit » ne soumet que la fiche. Le motif obligatoire de changement
>    de quantité devient quatre boutons (Inventaire, Casse, Transfert, Retour) plus un champ
>    de précision libre, au lieu d'un champ texte vide.
> 3. **Le type passe en choix segmenté en tête de colonne gauche.** Les sections
>    « Caractéristiques pneu » et « Étiquetage européen » se composent sous lui au lieu
>    d'apparaître au milieu du formulaire.
>
> Conserve toute la logique de `product-form.component.ts` : permissions
> `create/edit/delete stock`, édition en ligne, historique des mouvements, validations.
>
> Au passage, ce SCSS est à moitié converti : `border-radius: 0` sur certains blocs mais six
> valeurs non nulles restantes, et la palette d'origine intacte (`#edf2f7` en filets,
> `#48bb78`/`#38a169` sur `.btn-add-stock`). Ajoute `@use '../../_variables' as *` et
> remplace toutes les couleurs en dur par les jetons.

## 5b — Les cinq référentiels

> Gabarit 15b. Crée une coque de modale partagée dans `shared/` — largeur 480 px, bordure
> `$text-dark` de 1 px, sur-titre qui nomme le référentiel, pied qui affiche le nombre
> d'objets liés — puis applique-la à `brand-form`, `carrier-form`, `zone-form`,
> `category-form` et `role-form`. Aucune modale ne défile : si un formulaire dépasse, il
> passe au gabarit 15a.

## 5c — Les suppressions

> Gabarit 15c. Crée un composant de confirmation partagé et remplace TOUS les `confirm()`
> natifs de `features/` par lui. Deux règles : « Annuler » est le bouton solide et
> « Supprimer » le bouton bordé ; la conséquence est chiffrée dans le corps du message
> (« 4 pneus sortiront du stock »), jamais après le bouton. Le champ de motif n'apparaît que
> là où le backend l'exige.
>
> Liste-moi les endroits où tu as trouvé un `confirm()` avant de commencer.

## 5d — La passe de géométrie

Une fois 5a–5c en place, sur `features/` entier :

> `border-radius` à 0 partout sauf `50%` et `999px` sur les avatars et pastilles rondes.
> `box-shadow` d'élévation à `none`, en gardant les halos de `:focus` et l'ombre des modales
> — c'est la seule élévation légitime du système. `transform: translateY` retiré des
> `:hover` de bouton. Les `rgba(15, 23, 42, …)` restants remplacés par les jetons. Commence
> par `sale-detail`, `service-order-form` et `payment-panel`, qui en concentrent la moitié,
> et dis-moi combien de valeurs restent après.
