# Étape 8 — repli tablette et mobile, et les quatre états

Référence : `Tablette et etats.dc.html` dans ce dossier (gabarits 14a, 14b, 14c).

Rien de systématique n'a été fait sur ces deux sujets. Sept fichiers portent un
`@media (max-width: 900px)`, mais ce sont des retombées d'écrans refaits pour d'autres
raisons : le rail ne se replie pas, il n'y a pas de barre basse, la grille de ligne ne
devient jamais une fiche, et seul `activity-log` porte un squelette de chargement.

Fais les trois sous-étapes dans l'ordre : 8a pose les fondations partagées, 8b et 8c les
consomment.

## 8a — Les deux seuils, dans le shell

> Lis `design_handoff_refonte_2b/Tablette et etats.dc.html`, gabarits 14a et 14b.
>
> Deux seuils pour toute l'application, déclarés une fois en variables SCSS partagées et
> utilisés partout — pas de valeur en dur dans les composants :
>
> - **sous 1200 px** — on réduit : le rail perd ses libellés et passe de 72 à 64 px, les
>   icônes restent ; la barre haute passe de 60 à 56 px ; les cibles tactiles passent à
>   36 px et les lignes de liste à 62 px.
> - **sous 900 px** — on change de forme : le rail disparaît, remplacé par une barre basse
>   de 64 px à cinq entrées (Accueil, Ventes, Stock, Service, Nouveau) ; les autres
>   destinations passent derrière un bouton ☰ dans la barre haute, qui ouvre le rail en
>   volet.
>
> Applique-les dans `app.html` / `app.scss` et le composant de rail. Ne touche pas encore
> aux écrans.
>
> Les sept `@media (max-width: 900px)` déjà présents dans `features/` ont été écrits au cas
> par cas : liste-les-moi et dis-moi lesquels entrent en conflit avec les seuils partagés,
> sans les corriger tout de suite.

## 8b — La grille de ligne se replie

> Le repli des listes vit dans le mixin de `_page-layout.scss`, pas écran par écran — c'est
> ce qui permet de traiter les 25 listes d'un coup.
>
> - **sous 1200 px** : la grille garde sa forme, avec moins de colonnes. Chaque écran
>   déclare quelles colonnes tombent ; celles qui tombent rejoignent la sous-ligne sous le
>   libellé principal. Sur Ventes, ce sont n° de vente, quantité, marge et statut de
>   livraison — le gabarit 14a le montre. Au-delà de deux boutons, les actions passent
>   derrière un menu `⋯`.
> - **sous 900 px** : la ligne cesse d'être une grille et devient une fiche de deux rangées
>   — libellé et sous-ligne à gauche, montant à droite sur la première ; état à gauche et
>   boutons à 38 px à droite sur la seconde. Le gabarit 14b le montre.
>
> Les bandes de cadrans suivent : cinq cellules deviennent trois sous 1200 px, deux sous
> 900 px. Garde toujours celle qui porte l'impayé ou le montant dû.
>
> Vérifie sur Ventes, Achats, Stock et Clients, qui ont les grilles les plus larges.

## 8c — Les quatre états, partagés

> Gabarit 14c. Quatre composants dans `shared/`, pas quatre traitements par écran.
> `activity-log` porte déjà un squelette de chargement écrit à la main : extrais-le comme
> base du premier composant, puis fais-le consommer le composant partagé.
>
> 1. **Squelette de chargement** — des barres grises aux largeurs de colonne réelles de la
>    liste, pas un `spinner` centré : la structure ne doit pas sauter quand les données
>    arrivent. Il prend la définition de colonnes de la liste en entrée.
> 2. **Vide après filtrage** — nomme les filtres actifs responsables et propose de les
>    retirer, un bouton par filtre plus un « Tout effacer ». À distinguer du vide réel
>    (aucune donnée du tout), qui garde un message simple.
> 3. **Erreur de chargement** — dit ce qui a échoué, que les filtres sont conservés, quand
>    la prochaine tentative a lieu, et garde le détail technique derrière un bouton.
> 4. **Ligne verrouillée** — un cadenas désactivé à la place des boutons retirés, pour que
>    la colonne d'actions garde une largeur constante. Deux causes, même traitement visuel,
>    l'infobulle dit laquelle : verrouillée par son statut, ou permission manquante.
>
> Le point 4 existe déjà sur Ventes depuis l'étape 2 : généralise-le au lieu de le
> réécrire.
>
> Applique les trois premiers à Ventes, Achats et Stock d'abord ; dis-moi ce que ça donne
> avant que j'étende aux autres.
