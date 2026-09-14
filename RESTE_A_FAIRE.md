# Ce qui reste — relevé du 14/09/2026

Onze des douze tâches sont passées, et bien : le planning atelier a sa fonction
du temps (`positionOf`, testée), le Reporting a ses trois vues, la fiche
produit existe, les chips de vente et la rangée de cadrans sont en place, les
rayons sont à 8 / 12 px, et le double en-tête a disparu des 26 écrans internes.

Cinq restes. Les deux premiers sont fonctionnels, les trois autres cosmétiques.

| # | Reste | Écran |
|---|---|---|
| R1 | La 4ᵉ file manque | Accueil |
| R2 | Le badge déguisé n'est pas corrigé | Ventes, liste |
| R3 | Bouton « Annuler » au lieu de « brouillon » | Nouvelle vente |
| R4 | `<h1>` et cadrans hors motif | Portail client |
| R5 | Vérifications visuelles | 4 écrans |

---

## R1 — Accueil : « Devis sans réponse »

Trois files sur quatre. `low_stock` a été ajoutée correctement — portée
partagée, « Commander » qui pré-remplit l'achat jusqu'au seuil, tests à
l'appui. Mais `quotes` n'existe nulle part : ni dans `WorkQueues`, ni dans
`WorkQueueService`, ni dans le template.

> Ajoute la quatrième file de travail, « Devis sans réponse », sur le modèle
> exact de `low_stock` qui vient d'être livrée.
>
> - Portée : **ses devis uniquement**, permission `view quotes.all` pour la
>   portée agence. Filtrage côté API comme les trois autres.
> - Titre : « Mes devis sans réponse » en portée personnelle, « Devis sans
>   réponse » en portée agence.
> - Badge de portée : « Mes devis » / « Toutes agences ».
> - Action : **« Rappeler »**, bouton secondaire.
> - Ligne : `DEV-0309 · Transport Chaouia` en titre, `Émis 29/08 · 16 jours
>   sans réponse` en sous-ligne, montant à droite.
> - Compteur : compte **et** total, comme les autres — « 4 · 62 400 DH ».
>
> Ajoute-la aussi à `pendingTotal()` et `hasAnyQueue()`, qui ne comptent
> aujourd'hui que trois files, et étends `WorkQueueTest`.

## R2 — Ventes : le badge déguisé

C'était le point 3 du patch P3, et c'est le seul qui n'a pas été fait. Le
`status-select` (ligne ~250) est toujours un `<select>` habillé par des
classes `bg-en-cours` / `bg-livre` / `bg-monte`, sans chevron — donc
visuellement identique aux badges de paiement juste à côté (`badge-danger` /
`badge-warning` / `badge-success`), qui ne sont pas modifiables.

Rien ne distingue ce qu'on peut changer de ce qu'on lit. C'est le constat 09
de la revue d'origine, et il est encore là.

> Applique la règle des badges du `README.md` aux deux colonnes Paiement et
> Statut de `sales-page.component.html`, et à tous les autres écrans de liste
> qui les utilisent.
>
> **État lu** (Paiement) — plat : 11 px / 700 / `0.08em` / majuscules, padding
> `4px 8px`, bordure 2 px, rayon `var(--radius)`. Neutre : bordure
> `var(--neutral-300)`, texte `var(--neutral-800)`. Alerte (non payé, partiel) :
> bordure et texte `var(--accent-700)`.
>
> **État modifiable** (Statut) — mêmes dimensions, bordure
> `2px solid var(--neutral-400)`, texte `var(--text)`, **chevron `▾` de 9 px**
> avec `gap: 7px`, survol `border-color: var(--text)`. Le `<select>` reste
> fonctionnel dessous ; c'est son habillage qui change.
>
> Supprime les classes `badge-success` / `badge-warning` / `badge-danger` et
> `bg-*` au profit de ces deux états :
>
> ```bash
> grep -rn "badge-success\|badge-warning\|badge-danger\|bg-en-cours" front/src/app --include=*.html
> ```
>
> Le chevron est le seul signe de modifiabilité du système. Une règle, aucune
> exception.

## R3 — Nouvelle vente : le second bouton

Le récapitulatif est juste — 340 px, lignes séparées, total sur filet de 2 px.
Mais le bouton secondaire dit « Annuler » là où la maquette `2b` propose
**« Enregistrer en brouillon »**.

La différence n'est pas cosmétique : au comptoir, une vente s'interrompt (le
client va chercher sa carte, le technicien vérifie une dimension). « Annuler »
jette la saisie ; « brouillon » la garde.

> Dans `sale-form.component.html`, remplace le bouton secondaire « Annuler »
> par « Enregistrer en brouillon », qui crée la vente au statut brouillon et
> revient à la liste. Garde une sortie sans enregistrement, mais en lien
> discret plutôt qu'en bouton de même poids que la validation.
>
> Vérifie aussi que les deux libellés sont **alignés à gauche** dans leur
> bouton pleine largeur — c'est la règle du système, pas un centrage.

## R4 — Portail client

Les quatre pages existent, mais elles sont restées sur l'ancien motif : un
`<h1>` en tête (alors que les 26 écrans internes l'ont perdu) et des cadrans
en cartes séparées (`.portal-stat`) au lieu du cadre unique.

Le portail est ce que verront tes clients B2B : c'est le dernier endroit où
laisser deux motifs concurrents.

> Aligne les quatre pages de `features/portal/pages/` sur le reste de
> l'application :
>
> - Supprime les `<h1>` et passe le titre par le service `pageHeader`, comme
>   les écrans internes.
> - Remplace `.portal-stats` / `.portal-stat` par le motif de la rangée de
>   cadrans : un seul cadre `2px solid var(--text)`, rayon `var(--radius-lg)`,
>   cellules égales séparées par `2px solid var(--text)`.
> - `.portal-badge` suit la règle R2 : plat pour un état lu. Rien n'est
>   modifiable côté client.
>
> Le rail client à quatre entrées et `data-brand="client"` sont déjà en place
> — ne les touche pas.

## R5 — Les quatre vérifications

Inchangé depuis le patch P6 : fiche client (`3i`), réglages (`3j`), portail
(`2c`) et tablette (`3l`) ne se jugent pas en lecture de code.

> Pour chacun, compare le rendu réel à sa maquette et liste-moi les écarts
> **sans rien corriger**.
>
> Sur la tablette, teste sur la machine réelle de l'atelier : la barre
> inférieure de 64 px et les tableaux devenus cartes ne se valident pas dans
> un simulateur.

---

## Faux positifs — ne pas corriger

- Les `border-radius: 50%` restants (dix occurrences) sont des avatars et des
  pastilles de couleur. Un cercle n'est pas un coin arrondi.
- Les `border-radius: 2px 2px 0 0` sont les barres de graphique. Correct.
- La `polyline` de Cash Flow est juste : un solde est continu. Seul le CA
  quotidien va en barres.
