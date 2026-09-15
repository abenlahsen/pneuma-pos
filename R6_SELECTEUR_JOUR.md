# Sélecteur de jour sur la liste des ventes

Décision : pas de vue « Jour » dans le Reporting. La lecture de journée se fait
sur la liste des ventes, qui a déjà les cadrans et le tableau — il ne manque
que la date.

## Pourquoi là et pas dans le Reporting

Le Reporting compare une période à la précédente. Un jour contre la veille est
trop bruité pour cet usage : une vente de flotte fait bouger la marge de 40 %,
et le lundi ne se compare pas au dimanche. La liste des ventes, elle, ne
compare rien — elle montre. C'est exactement ce qu'on veut pour une journée.

Et elle porte déjà les quatre cadrans du jour, le tableau détaillé et les
chips de filtre. Ajouter la date y coûte un champ ; l'ajouter au Reporting
coûterait une quatrième vue et une règle de comparaison bancale.

## Le prompt

> Ajoute un sélecteur de date à la liste des ventes
> (`features/sales/pages/sales-page.component.*`), pour que l'écran serve de
> lecture de journée.
>
> **1. Le champ.** Dans la rangée de chips de filtre, à droite, avant le
> compte de résultats : un `<input type="date">` habillé aux tokens — bordure
> `2px solid var(--neutral-400)`, rayon `var(--radius)`, 13 px,
> `font-variant-numeric: tabular-nums`, focus
> `outline: 2px solid var(--accent); outline-offset: 2px`.
>
> Encadre-le de deux boutons `‹` `›` (jour précédent / suivant, 32 px de côté,
> même bordure) et d'un bouton `Aujourd'hui` en chip secondaire, désactivé
> quand la date affichée est déjà aujourd'hui. Au comptoir on navigue au jour,
> pas au calendrier : les flèches sont le chemin principal, le champ sert à
> sauter loin.
>
> Par défaut : aujourd'hui. La date choisie va dans l'URL
> (`?date=2026-09-15`) pour que la vue se partage et survive au rechargement.
>
> **2. Les cadrans suivent la date.** Les quatre cadrans (CA, marge nette,
> nombre de ventes, impayés) sont déjà là mais calés sur aujourd'hui : ils
> doivent porter sur la journée sélectionnée. Leur étiquette devient « CA du
> jour » pour aujourd'hui, et la date pour un autre jour — « CA du 12/09 » :
> sans ça, on lit les chiffres d'un mardi en croyant voir ceux du jour.
>
> Ajoute sous la rangée, en 12 px / `var(--text-muted)`, la comparaison au
> **même jour de la semaine précédente** — « Lundi 08/09 : 41 200 DH ». C'est
> la seule comparaison honnête à l'échelle du jour, et elle reste
> informative sans être un graphique.
>
> **3. Le tableau et les chips** se filtrent sur la même date. Les chips
> gardent leurs comptes, recalculés sur le jour affiché : « Impayées · 2 » et
> non le total historique.
>
> **4. Journée vide.** Un dimanche ou un jour férié renvoie zéro vente :
> utilise `<app-empty-state>` en disant *pourquoi* c'est vide — « Aucune vente
> le dimanche 13/09 » — avec « Revenir à aujourd'hui » en action primaire et
> « Voir la semaine » en secondaire. Pas de tableau vide muet.
>
> **5. Le lien depuis l'accueil.** Le cadran « CA du jour » de la colonne
> latérale du dashboard devient cliquable et mène à
> `/sales?date=<aujourd'hui>`. C'est le chemin naturel : on voit le chiffre,
> on veut le détail.
>
> Côté API : `GET /api/sales` accepte déjà des bornes de date — vérifie le nom
> exact des paramètres dans `back/routes/` avant de câbler, et fais porter le
> filtre par le serveur, pas par le front.
>
> Vérifie : la date est dans l'URL et survit au rechargement ; les cadrans,
> les chips et le tableau portent tous sur la même journée ; « Aujourd'hui »
> est désactivé quand on y est déjà ; un dimanche affiche l'état vide avec sa
> raison.
