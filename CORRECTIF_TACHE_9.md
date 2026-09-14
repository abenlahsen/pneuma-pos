# Correctif — tâche 9 (Accueil)

L'implémentation livrée est structurellement juste : deux files fonctionnent,
la portée est filtrée côté API dans `WorkQueueService.php` (le point critique),
et le classement porte l'impayé en fin de barre.

Deux ajouts non demandés sont bons et doivent être conservés tels quels :

- le bloc **« Moyenne agence · au-dessus / en dessous »**, qui situe le
  commercial sans nommer personne, et qui disparaît en portée agence pour ne
  pas laisser déduire le chiffre d'un collègue ;
- la mention **« en retard »** sur les lignes au-delà du délai.

Sept écarts avec la maquette `5a` / `5b`
(`design/Accueil retenu - PNEU.Ma.dc.html`). Le premier est fonctionnel, les
six autres sont visuels.

---

## 1. Deux files sur quatre — le principal

`unpaid` et `to_invoice` existent. **Manquent : « Produits sous seuil » et
« Devis sans réponse ».** `WorkQueueService` n'expose que deux files, et
`pendingTotal()` / `hasAnyQueue()` ne comptent que ces deux-là — les deux
nouvelles doivent y être ajoutées aussi.

À ajouter dans `WorkQueueService` et dans le composant :

| File | Portée | Permission | Action |
|---|---|---|---|
| Produits sous seuil | Agence — **non filtré**, pas de propriétaire | — aucune | « Commander » |
| Devis sans réponse | Ses devis uniquement | `view quotes.all` | « Rappeler » |

La file stock est la seule sans portée personnelle : c'est une information
d'agence, le premier qui la voit commande. Elle porte le badge
« Agence · partagé ».

**« Commander » crée un brouillon d'achat pré-rempli**, pas un formulaire
vide — sinon la file signale sans faire gagner de temps.

---

## 2. Les compteurs n'ont pas leur montant

Aujourd'hui : `{{ unpaid.count }}` → « 5 ».
Attendu : **« 5 · 96 300 DH »** — le compte *et* la somme, dans le même badge.

C'est ce qui permet d'arbitrer entre les files sans les ouvrir. Le payload ne
porte que `count` : ajouter un `total` à côté (même règle de portée que les
lignes, pour la même raison), et l'afficher dans `.queue-count`. La file stock
est la seule sans montant : « 6 ».

---

## 3. Libellés d'action

| File | Commercial | Gérant (portée `all`) |
|---|---|---|
| Impayés | **Relancer** | **Assigner** |
| Ordres | Facturer | Facturer |

Le bouton actuel dit « Encaisser ». Le gérant ne fait pas le travail, il le
distribue : le libellé doit basculer sur la portée.

Bouton secondaire pour « Relancer » / « Assigner » / « Rappeler » /
« Commander », primaire pour « Facturer » seulement.

---

## 4. Badges de portée

Actuellement `scopeLabel()` rend « Toute l'agence » ou « Mes lignes » pour
toutes les files. Les libellés attendus sont spécifiques à chaque file :

| File | Portée `own` | Portée `all` |
|---|---|---|
| Impayés | Mes clients | Toutes agences |
| Ordres | Mes clients | Toutes agences |
| Produits sous seuil | Agence · partagé | Agence · partagé |
| Devis | Mes devis | Toutes agences |

« Mes lignes » est vague : le possessif doit dire *de quoi* on est
propriétaire. La signature de `scopeLabel()` doit donc prendre la file en plus
de la portée. Même exigence dans les titres : « Mes impayés », « Mes devis »
en portée personnelle, sans possessif en portée agence.

---

## 5. L'en-tête de page

L'implémentation pose un `<h1>Bonjour, X</h1>` avec un sous-titre en dessous —
soit deux lignes et un gros titre que la maquette n'a pas.

Attendu : **une seule ligne dans la barre supérieure de la coquille**, à côté
du titre « ACCUEIL » —
`Bonjour Omar — 11 éléments à traiter`, en 13 px, le compte en gras. La date
et l'action primaire à droite. Rien au-dessus des files : la page commence par
la première file.

---

## 6. La colonne latérale

Trois écarts :

- Les chiffres du jour sont en **cartes empilées** (`.figure-card`). Attendu :
  une **liste de lignes** séparées par `1px solid var(--neutral-300)`, libellé
  à gauche en 13 px, valeur à droite en 15 px / 700 / tabulaire. Pas de cadre
  par chiffre. La maquette en liste cinq : CA, ventes, marge nette, ordres
  ouverts, devis ouverts — aujourd'hui deux cartes seulement.
- La tendance est une `polyline` (via `buildBalanceCurve`). Attendu :
  **30 barres verticales** (`flex: 1`, `gap: 3px`,
  `border-radius: 2px 2px 0 0`), la dernière en `--accent`, avec le trait de
  moyenne en surimpression à sa hauteur réelle et la légende
  « Moyenne 47 300 DH / jour » dessous. Une courbe lissée cache les jours
  creux, que trente barres montrent — et la courbe de trésorerie, elle, garde
  sa `polyline` : un solde est continu, un CA quotidien est discret.
- Le classement n'a pas son **rang numéroté** (1–4, 12 px / 700 /
  `--neutral-700`, largeur fixe 14 px) devant chaque nom.

En portée personnelle, la colonne se termine par le bloc « Mon mois » : la
valeur, une **barre de progression vers l'objectif**, et la phrase de repaire
déjà en place (« Moyenne agence … au-dessus »). Seule la barre manque.

---

## 7. Les pièges de mise en page

Deux défauts qui apparaîtront dès que les quatre files seront là :

- La colonne des files est à hauteur fixe et défile. Ses cartes doivent porter
  **`flex: none`** : une carte en `overflow: hidden` perd son minimum
  automatique et se fait comprimer en rognant ses lignes.
- La grille de la coquille doit porter **`grid-template-rows: minmax(0, 1fr)`**,
  sinon la piste implicite se dimensionne sur le contenu et la page pousse au
  lieu de faire défiler.

---

## Vérification

1. Les quatre files apparaissent, chacune avec compte + montant.
2. Deux comptes réels, un commercial et un gérant : les libellés d'action et
   les badges de portée changent, et la requête SQL du commercial est filtrée
   sur `user_id` (montre-la).
3. La colonne des files défile sans qu'aucune carte ne rogne ses lignes.
4. « Commander » ouvre un brouillon d'achat pré-rempli.
5. Aucune valeur en dur : couleurs, tailles et rayons passent par `var(--…)`.
6. Les tests `WorkQueueTest` et `WorkQueueFiguresTest` passent, étendus aux
   deux nouvelles files.
