# Étape 7 — Paramètres, comptes, charges RH

`Refonte Parametres.dc.html` est dans ce dossier (gabarit 17a). Les deux autres écrans se
traitent par consigne, sans maquette.

Audit des onze modules jamais revus : huit suivent déjà le motif de liste et n'ont rien à
faire (`partners`, `primes`, `users`, `suppliers`, `vehicles`, `kpi-history`,
`activity-log`, `shipment-changes`). Trois sortent du motif, ci-dessous.

## 7a — Paramètres

> Lis `design_handoff_refonte_2b/Refonte Parametres.dc.html`, gabarit 17a.
>
> Refais `company-settings-page` en deux colonnes : liste de sections de 248 px à gauche,
> contenu à droite, pied d'actions propre à la section affichée. Chaque section
> s'enregistre seule — plus de bouton unique en fin de page.
>
> **Supprime entièrement le personnalisateur de thème.** Son sélecteur pilote
> `menuLayout`, supprimé à l'étape 3 : l'option n'existe plus et l'aperçu en direct dessine
> une barre latérale qui n'existe pas. Retire le bloc `.theme-section`, le bloc
> `.theme-preview` et tout leur SCSS, plus les trois sélecteurs de couleur et le sélecteur
> de mode. Vérifie ce que le backend stocke pour ces réglages (`theme_mode`,
> `menu_layout`, les trois couleurs) et dis-moi ce qu'il faut retirer côté API et
> migration — ne le fais pas sans mon accord.
>
> **Sections de la liste de gauche**, dans cet ordre :
>
> - Entreprise : Identité et contact · Documents et logo · Dépôts et zones
> - Commercial : Objectifs et primes · Délais et crédit · TVA et facturation
> - Référentiels : Marques · Transporteurs · Catégories de transaction (avec leur compte)
> - Accès : Utilisateurs · Rôles et permissions · Journal d'activité
>
> Les référentiels, utilisateurs, rôles et journal d'activité gardent leurs routes et leurs
> composants : la liste de gauche y navigue, elle ne les réimplémente pas. Les entrées de
> rail correspondantes disparaissent — ce sont des réglages.
>
> **Déplacements** : l'objectif mensuel de primes quitte le bas du formulaire d'identité
> pour « Objectifs et primes ». Les coordonnées bancaires vont sous « TVA et facturation ».
> Crée « Délais et crédit » avec un délai de paiement par défaut et une limite de crédit
> standard, appliqués à la création d'un client.

## 7b — Comptes

> `accounts-page` est la seule page qui a gardé les cartes à icône colorée du thème
> d'origine : cartes de compte cliquables, puis quatre cadrans `summary-card` à icône, puis
> deux tableaux.
>
> Aligne-la sur le motif des autres écrans : les quatre cadrans deviennent une bande de
> cellules à filet comme sur Ventes ou Achats (pas de carte, pas d'icône colorée, pas
> d'ombre), les cartes de compte deviennent une liste de lignes sélectionnables, et les
> deux tableaux passent au motif de liste de `_page-layout`.
>
> Note au passage : cette page recoupe la colonne « Comptes » du Cash Flow refait, qui
> montre déjà caisse, banque et chèques en circulation. Dis-moi si tu vois une raison de
> garder les deux, je poserai la question au métier.

## 7c — Charges RH

> `hr-charges-page` génère ses cadrans de synthèse par `*ngFor` sur les sous-catégories :
> le nombre est illimité et la rangée casse au-delà de quatre ou cinq.
>
> Fixe la bande à quatre cellules — Total du mois, Employés concernés, et les deux
> sous-catégories les plus lourdes — et déplace la répartition complète par sous-catégorie
> dans une colonne de droite, en barres horizontales comme le bloc « Dépenses du mois par
> poste » du Cash Flow refait.
>
> La navigation par mois passe dans la barre de titre, au même endroit que celle du
> Reporting refait (`←` `Septembre 2026` `→`), plutôt qu'au-dessus du contenu.
