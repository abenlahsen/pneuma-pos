# Retrait de la file « Devis sans réponse »

La gestion des devis n'entre pas dans le périmètre de cette application. La
file était une erreur de ma spécification, pas une demande — elle doit
disparaître du dashboard et de tout ce qui l'a accompagnée.

L'accueil revient à **trois files** : impayés, ordres à facturer, produits sous
seuil.

## Le prompt

> Supprime entièrement la file de travail « Devis sans réponse » du dashboard,
> ainsi que tout ce qui n'a été ajouté que pour elle. L'accueil revient à
> trois files : `unpaid`, `to_invoice`, `low_stock`.
>
> **Front** — `features/dashboard/` :
>
> - `dashboard.component.html` : retire la `<section class="queue">` des devis
>   (~lignes 123-158).
> - `dashboard.component.ts` : retire `quotes` de `pendingTotal()` et
>   `hasAnyQueue()`, les branches `queue === 'quotes'` de `scopeLabel()`,
>   `queueTitle()` et `actionLabel()`, l'entrée de `isPrimaryAction()`, et la
>   méthode `openQuote()` en entier — elle ne faisait que rediriger vers la
>   fiche client faute d'écran de devis.
> - `work-queues.model.ts` : retire la clé `quotes` du type.
> - `dashboard.component.spec.ts` : retire les cas de test des devis. Garde
>   ceux des trois autres files, et vérifie que les assertions de
>   `pendingTotal` sont mises à jour (le total attendu change).
>
> **Back** — `Domain/Dashboard/WorkQueueService.php` :
>
> - retire le bloc `if ($user->can('view quotes'))` et la méthode
>   `quotesWithoutAnswer()` en entier ;
> - retire les `use App\Enums\QuoteStatus;` et `use App\Models\Quote;` s'ils
>   ne servent plus ailleurs dans le fichier ;
> - `WorkQueueTest` : retire les cas des devis, ajuste les comptes attendus.
>
> **Permissions** — `RolesAndPermissionsSeeder.php` :
>
> - retire `view quotes.all` (ligne ~151), créée uniquement pour cette file,
>   et le commentaire qui l'accompagne (~187).
> - **Ne touche pas à `view quotes`** si elle est utilisée ailleurs : vérifie
>   d'abord avec `grep -rn "view quotes" back/ front/src` et dis-moi ce qui
>   l'utilise encore. Si elle ne sert qu'au dashboard, retire-la aussi.
>
> **Vérifie ensuite** que rien d'autre ne dépend de ce qui a été retiré :
>
> ```bash
> grep -rn "quotes\|Quote" front/src/app/features/dashboard back/app/Domain/Dashboard
> grep -rn "view quotes" back/ front/src
> ```
>
> Si les modèles `Quote` / `QuoteStatus` n'ont plus aucun usage dans
> l'application, ne les supprime pas pour autant — signale-le-moi et je
> trancherai. Retirer une table de la base est une décision qui ne se prend
> pas dans un patch de dashboard.
>
> `npm run build` et la suite de tests back doivent passer.

## Documents à corriger

Une fois le patch passé, la file devis est à retirer de trois documents du
handoff pour qu'ils ne la réintroduisent pas plus tard :

- `README.md` — le § « `5a` / `5b` — Accueil » liste quatre files, et le
  tableau de la § « Règle de portée » porte la ligne `view quotes.all`.
- `CLAUDE_CODE.md` — la tâche 9.
- `CORRECTIF_TACHE_9.md` et `RESTE_A_FAIRE.md` — les patchs R1 et le § 1.

Je peux le faire directement dans le paquet si tu préfères, mais l'urgent est
le code.
