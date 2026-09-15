# R2 — La règle des badges, partout

Dernier reste du handoff. C'est le constat 09 de la revue d'origine, et le
seul qui n'a pas encore été traité.

## Le problème

Le statut de vente est un `<select>` en `appearance: none` habillé par des
classes de fond (`bg-en-cours`, `bg-livre`, `bg-monte`), **sans chevron**.
Juste à côté, la colonne Paiement affiche un `badge-danger` /
`badge-warning` / `badge-success` qui a exactement la même silhouette — mais
qui n'est pas modifiable.

Rien ne distingue ce qu'on peut changer de ce qu'on lit. Un commercial clique
sur le paiement en attendant qu'il s'ouvre, et ne pense pas à cliquer sur le
statut.

## La règle

Deux états, et rien d'autre dans toute l'application.

**État lu** — plat, sans chevron :

```scss
font-size: 11px;
font-weight: 700;
letter-spacing: 0.08em;
text-transform: uppercase;
padding: 4px 8px;
border: 2px solid var(--neutral-300);
border-radius: var(--radius);
color: var(--neutral-800);
```

En alerte (non payé, partiel, annulé), la même chose avec bordure **et** texte
en `var(--accent-700)` — jamais `var(--accent)`, qui ne fait que 3,7:1 à cette
taille.

**État modifiable** — mêmes dimensions, plus le chevron :

```scss
border: 2px solid var(--neutral-400);
color: var(--text);
/* chevron ▾ de 9px, gap: 7px */
&:hover { border-color: var(--text); }
```

Le `<select>` reste fonctionnel dessous : c'est son habillage qui change, pas
son comportement. Le chevron est le seul signe de modifiabilité du système.

## Le prompt

> Applique la règle des badges du
> `design_handoff_rail_navigation/README.md` (§ « Badges d'état ») à toute
> l'application. Deux composants partagés d'abord, puis les écrans.
>
> **1. Crée `shared/state-badge/`** avec deux composants, ou un seul et une
> entrée `editable` :
>
> - `<app-state-badge [tone]="'neutral' | 'alert'">` — état lu, plat.
> - `<app-state-select [options]="…" [(value)]="…">` — état modifiable :
>   le `<select>` habillé, avec le chevron `▾` de 9 px et `gap: 7px`.
>
> Les valeurs exactes sont dans la section « La règle » de ce fichier. Sors
> tout de `var(--…)`, rien en dur.
>
> **2. Remplace les `status-select` par `<app-state-select>`** dans les trois
> écrans qui en ont un :
>
> - `features/sales/pages/sales-page.component.html` (~ligne 250)
> - `features/purchases/pages/purchases-page.component.html` (~ligne 231)
> - `features/service-orders/pages/service-orders.component.html` (~ligne 207)
> - `features/shipment-changes/components/shipment-change-list/` (~ligne 40)
>
> Supprime les classes `bg-en-cours` / `bg-livre` / `bg-monte` /
> `bg-terminee` / `bg-annule` et leurs règles SCSS : la couleur ne porte plus
> le statut, le libellé le porte.
>
> **3. Remplace les `badge-*` par `<app-state-badge>`.** Ils se sont propagés
> dans une quinzaine de fichiers, dont quatre composants partagés qui sont la
> vraie source :
>
> - `sales/payment-panel/`
> - `sales/components/sale-payment-detail/`
> - `purchases/components/purchase-payment-detail/`
> - `purchases/purchase-payments/`
> - `service-orders/service-payment-panel/`
>
> Commence par ces cinq — ils couvrent la moitié des occurrences. Puis les
> écrans : ventes, achats, produits, marques, primes, fiches client,
> fournisseur, vente et achat.
>
> ```bash
> grep -rn "badge-success\|badge-warning\|badge-danger\|badge-muted\|badge-secondary" front/src/app --include=*.html
> ```
>
> Correspondances : `badge-success` et `badge-muted` → `tone="neutral"` ;
> `badge-warning` et `badge-danger` → `tone="alert"`. Le vert disparaît : un
> état normal n'a pas besoin d'être signalé, seul l'anormal l'est. C'est ce
> qui fait ressortir les cinq impayés d'une liste de trente-sept ventes.
>
> **4. Deux exceptions à laisser tranquilles** : le badge « multi » des
> détails de paiement (c'est une annotation, pas un état) et le
> `portal-badge` du portail client, déjà plat et conforme.
>
> Vérifie en fin de tâche :
>
> - `grep -rn "badge-success\|bg-en-cours" front/src/app --include=*.html`
>   ne renvoie plus rien.
> - Sur la liste des ventes, le chevron apparaît sur la colonne Statut et pas
>   sur la colonne Paiement.
> - Plus aucun `border-radius: 999px` ni couleur en dur dans les badges.
> - `npm run build` passe, et les tests des écrans touchés aussi.
