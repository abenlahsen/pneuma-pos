# R8 — Alléger les couleurs

Les maquettes ont été revues : les filets noirs de 2 px et le rouge omniprésent
rendaient l'interface dense à lire sur huit heures d'écran. Trois changements,
à appliquer à tous les écrans déjà intégrés.

## 1. Les filets passent de 2 px à 1 px

Le système d'origine posait `2px solid var(--text)` sur tous les cadres et
séparateurs. À l'échelle d'un écran plein de tableaux, cela fait une grille de
traits noirs qui pèse autant que les données.

| Avant | Après |
|---|---|
| `2px solid var(--text)` | `1px solid var(--neutral-400)` |
| `2px solid var(--accent-700)` | `1px solid var(--accent-300)` |
| `2px solid var(--neutral-300)` | `1px solid var(--neutral-400)` |
| `2px solid var(--neutral-400)` | `1px solid var(--neutral-500)` |

Les bordures de cartes, les en-têtes de tableau, les séparateurs de colonne et
les cadres de file sont tous concernés. Le rail sombre ne change pas : c'est
lui qui donne le repère.

## 2. Le rouge est réservé à l'argent dû

Il servait à tout — impayés, compteur de stock, barres de graphique, valeur
courante. Un signal qui apparaît partout ne signale plus rien.

Le rouge reste sur : les impayés, les montants négatifs, l'action primaire.

Deux tons clairs le remplacent ailleurs :

```scss
/* Ordres à facturer — une action de facturation, pas une alerte */
--tone-blue-border: #a9c0d0;
--tone-blue-bg:     #e8eef3;
--tone-blue-ink:    #1f5068;

/* Stock sous seuil — un réapprovisionnement, pas une dette */
--tone-sand-border: #d8c493;
--tone-sand-bg:     #f6efe0;
--tone-sand-ink:    #7a5a14;
```

Les deux sont dérivés du gris-noir et du rouge de la marque, et tiennent
4,5:1 sur blanc à 11 px. À ajouter aux tokens, pas en dur dans les composants.

## 3. Les barres de données quittent l'encre

Dans le graphique 30 jours et le classement, toutes les barres étaient en
`--neutral-800`. Elles passent en gris-bleu `#c4cdd4` (graphique) et `#a9c0d0`
(classement) ; seule la valeur courante ou le premier du classement reste en
rouge. La ligne de moyenne reste en `--neutral-500`.

## Le prompt

> Applique le patch de densité visuelle décrit dans
> `design_handoff_rail_navigation/R8_ALLEGEMENT_COULEURS.md` à tous les écrans
> intégrés.
>
> **1. Les filets.** Remplace partout les bordures de 2 px par les valeurs du
> tableau § 1 de ce fichier. Les fichiers concernés sont ceux du rail et des
> écrans repris :
>
> ```bash
> grep -rn "2px solid" front/src/app --include=*.scss
> ```
>
> Deux exceptions à ne pas toucher : le rail de navigation
> (`shared/rail-nav/`), qui garde son fond sombre et ses séparateurs actuels,
> et le `:focus-visible { outline: 2px solid var(--accent) }` — l'anneau de
> focus doit rester à 2 px pour être visible.
>
> **2. Les deux tons.** Ajoute les six variables du § 2 au fichier de tokens
> (là où vivent déjà `--accent-*` et `--neutral-*`), puis applique-les :
>
> - file « Ordres à facturer » du dashboard → ton bleu (bordure de carte,
>   fond et encre d'en-tête, badges de compte et de portée) ;
> - file « Produits sous seuil » → ton ocre, **y compris le compteur de
>   stock**, qui était en `--accent-700` alors qu'un stock bas n'est pas une
>   dette.
>
> Le rouge ne reste que sur la file des impayés, les montants négatifs et les
> boutons primaires.
>
> **3. Les barres.** Dans le graphique 30 jours et le classement de la colonne
> latérale du dashboard, passe les barres en `#c4cdd4` et `#a9c0d0`
> respectivement — seule la dernière barre du graphique et le premier du
> classement restent en `var(--accent)`.
>
> **Attention en passant :** si tu trouves un `opacity` sur du texte ou sur un
> badge, retire-le et utilise un pas de rampe plus foncé à la place. Un
> `opacity: 0.75` sur un libellé de 10 px le fait tomber sous le seuil de
> contraste — c'est exactement le défaut que la revue d'origine reproche au
> thème actuel (constat 04).
>
> Vérifie en fin de tâche :
>
> - `grep -rn "2px solid" front/src/app --include=*.scss` ne renvoie plus que
>   le rail et les règles de focus.
> - Aucune couleur des § 2 et 3 n'est en dur dans un composant : tout passe
>   par les tokens.
> - `grep -rn "opacity" front/src/app --include=*.scss` ne renvoie rien sur du
>   texte ou des badges (les états désactivés à 45 % restent légitimes).
> - `npm run build` passe.

## Ce qui ne change pas

La structure, les espacements, la typographie, le rail, les libellés. C'est un
patch de densité visuelle uniquement — si un écran bouge de place, quelque
chose a été fait de trop.
