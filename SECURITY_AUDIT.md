# Audit sécurité — Pneuma POS

Relevé fait le 15/09/2026 sur la branche `new-theme`, en lecture du code, des
configurations et de l'historique git. Périmètre : backend Laravel 13
(routes, middlewares, services de domaine, FormRequests, Resources, modèles,
uploads, exports, imports), frontend Angular 21 (sinks XSS, jeton, guards,
dépendances), infrastructure (Docker Compose, Nginx, Apache, scripts de
déploiement, `.gitignore`, historique git).

Aucun secret n'est recopié dans ce document : seuls les emplacements sont
indiqués.

## Synthèse

| # | Sévérité | Constat | État |
|---|---|---|---|
| C1 | **Critique** | Jeton GitHub personnel en clair dans l'URL `origin` de `.git/config` | **Manuel** — révoquer, puis `git remote set-url` |
| C2 | **Critique** | Mot de passe MySQL de production dans l'historique git (commit `f9db8a3`, poussé sur GitHub) | **Manuel** — rotation confirmée + purge de l'historique |
| H1 | Haute | `edit roles` permet de s'octroyer toutes les permissions | **Corrigé** |
| H2 | Haute | `edit users` permet de réinitialiser le mot de passe d'un Administrateur | **Corrigé** |
| H3 | Haute | `must_change_password` appliqué côté client seulement | **Corrigé** |
| H4 | Haute | XSS stocké via favicon SVG | **Corrigé** |
| H5 | Haute | En-têtes de sécurité Nginx perdus sur `/index.html`, `/storage/`, assets ; pas de CSP ; `\.php$` sans `try_files` | **Corrigé** (une action manuelle sur le VPS, voir H5) |
| H6 | Haute | Mot de passe DB affiché à chaque déploiement et visible dans `ps` | **Corrigé** |
| H7 | Haute | Fichiers scratch suivis par git avec mot de passe admin faible | **Purge** (avec C2) |
| M1 | Moyenne | Throttle login sans compteur par IP (password spraying) | **Corrigé** |
| M2 | Moyenne | `payment_status` / `status` acceptés à la création d'une vente ou d'un OS | Reporté |
| M3 | Moyenne | Injection de formule dans les exports Excel | Reporté |
| M4 | Moyenne | Import Excel : formules évaluées, cap après chargement | Reporté |
| M5 | Moyenne | `APP_DEBUG=true` dans `.env.example` / `.env.docker` | Reporté |
| M6 | Moyenne | MySQL publié sur `0.0.0.0` avec mots de passe par défaut | Reporté |
| M7 | Moyenne | `per_page`, `all=true` et exports non bornés | Reporté |
| M8 | Moyenne | Écriture de `users` sous `edit hr-charges` ; auto-approbation des demandes d'expédition | Reporté |
| M9 | Moyenne | Routes clients enregistrées en double ; Bearer envoyé à toute URL | Reporté |
| B1–B8 | Basse | Voir la section dédiée | Reporté |

## Méthode

Trois passes en lecture seule : (1) authentification et autorisation — chaque
route, chaque middleware, chaque garde de service ; (2) entrées et fichiers —
SQL brut, tris, recherches, uploads, exports, imports, traversée de chemin,
mass-assignment, validation, exposition de données ; (3) frontend et
infrastructure — sinks XSS, stockage du jeton, guards, dépendances, Docker,
Nginx, Apache, scripts de déploiement, `.gitignore`, historique git. Chaque
constat retenu a ensuite été revérifié dans le fichier cité.

## Choix assumés

- **Portée des ventes.** Un Commercial voit, exporte et modifie toutes les
  ventes et tous les ordres de service de l'entreprise. Seules les files de
  l'accueil sont filtrées par `commercial_id` (`view unpaid.all`,
  `view service-orders.all`, `view reporting.all`). Décision de l'utilisateur
  le 15/09/2026 : c'est le fonctionnement voulu pour une petite équipe. Ce n'est
  donc pas une faille, mais le jour où un cloisonnement est souhaité, le modèle
  existe déjà dans `Domain/Dashboard/WorkQueueService.php` (filtre en SQL, jamais
  dans l'interface).
- **`/api/change-password` accepte le même mot de passe.** `different:current_password`
  n'a pas été ajouté : le global-setup Playwright (`e2e/global-setup.ts`) lève
  le flag de l'admin en remettant le même mot de passe. À ajouter si cette
  étape e2e est réécrite.

## Constats critiques

### C1 — Jeton GitHub dans `.git/config`

- **Preuve** : `git remote -v` affiche `https://<user>:ghp_…@github.com/...`.
- **Scénario** : toute lecture de `.git/config`, tout `git remote -v` collé
  dans un ticket ou un log, donne un accès complet aux dépôts du compte.
- **Correctif (manuel)** : révoquer le jeton sur GitHub (Settings → Developer
  settings → Personal access tokens), puis
  `git remote set-url origin https://github.com/abenlahsen/pneuma-pos.git` et
  un credential helper (`git config --global credential.helper manager`) ou SSH.

### C2 — Mot de passe MySQL de production dans l'historique

- **Preuve** : `git show f9db8a3:deploy/env.production` (commit du 25/03/2026,
  fichier supprimé ensuite dans `354aa00`, donc toujours dans l'historique,
  présent sur `origin/main`, `new-theme`, `new_architecture`, `new_design`,
  `feature/new_menu`).
- **État** : la valeur actuelle de `deploy/env.production` (non suivi, ignoré)
  est différente : le mot de passe a déjà été changé. À confirmer sur le VPS
  que l'ancien est bien refusé.
- **Correctif** : réécriture de l'historique avec `git filter-repo` pour
  retirer `deploy/env.production`, `tmp/verify_refactored_endpoints.ps1`,
  `tmp/verify_endpoints.php`, `read_excel.php`, `front/read_excel.js` (H7),
  puis `git push --force --all` / `--tags`. Tout clone existant doit être
  re-cloné.

## Constats hauts (corrigés)

### H1 — Escalade de privilèges via `edit roles`

- **Preuve** : `back/app/Domain/Roles/RoleService.php` (avant correctif) —
  `assignPermissions()` appelait `syncPermissions()` sans aucune garde ;
  `update()` idem, y compris sur le rôle Administrator. Route
  `PUT /api/roles/{role}/permissions` gardée par `permission:edit roles` seulement.
- **Scénario** : un rôle personnalisé détenant `edit roles` fait
  `PUT /api/roles/{son_rôle}/permissions` avec toutes les permissions →
  accès à la paie, aux utilisateurs, aux réglages. Variante : vider les
  permissions d'Administrator, ce qui verrouille l'application (aucun
  `Gate::before` super-admin n'existe).
- **Correctif** : `RoleService::guardPermissionGrant()` — (1) le jeu de
  permissions d'Administrator est figé (422) ; (2) un non-Administrateur ne
  modifie pas un rôle qu'il détient (403) ; (3) un non-Administrateur n'accorde
  que des permissions qu'il possède (403). `PermissionController` : création et
  suppression réservées à Administrator, suppression refusée si la permission
  est encore attribuée à un rôle (422). Tests dans `UserAndRoleTest` et
  `DashboardAndPermissionTest`.

### H2 — Prise de contrôle d'un compte Administrateur via `edit users`

- **Preuve** : `back/app/Domain/Users/UserService.php:81-85` (avant) — le
  mot de passe était réécrit sans vérifier le rang de la cible, sans révoquer
  ses jetons, sans lever `must_change_password`. La garde `hasRole('Administrator')`
  ne portait que sur le champ `role`.
- **Scénario** : `PUT /api/users/{id_admin}` avec `password` → connexion en
  tant qu'Administrateur.
- **Correctif** : `guardAdministratorTarget()` — un non-Administrateur ne
  modifie ni ne supprime un compte Administrateur (403). Une réinitialisation
  par un tiers lève `must_change_password` et supprime tous les jetons de la
  cible. `POST /api/users` crée toujours le compte flaggé. Au passage,
  `monthly_target` (validé mais jamais persisté) est maintenant enregistré.

### H3 — `must_change_password` non appliqué côté serveur

- **Preuve** : aucun middleware (`app/Http/Middleware/` n'existait pas) ;
  seul `front/src/app/core/guards/auth.guard.ts` redirigeait. `AuthController::login`
  délivrait un jeton complet. `/api/change-password` sans throttle.
- **Scénario** : un utilisateur muni d'un mot de passe temporaire utilise
  l'API directement, indéfiniment, sans jamais le changer.
- **Correctif** : middleware `password.changed`
  (`app/Http/Middleware/EnsurePasswordChanged.php`) sur tout le groupe protégé :
  403 `{code: "PASSWORD_CHANGE_REQUIRED"}` hors `/api/user`, `/api/logout`,
  `/api/change-password`. L'intercepteur Angular redirige ce 403 vers
  `/change-password`. `throttle:login` sur `/api/change-password`. Le
  changement de mot de passe révoque tous les autres jetons. Règle
  `Password::min(8)->letters()->numbers()`. Tests dans `AuthTest`.

### H4 — XSS stocké via favicon SVG

- **Preuve** : `UpdateCompanySettingsRequest.php:40` acceptait `svg` ; le
  fichier est stocké sur le disque `public` et servi same-origin depuis
  `/storage/` (`CompanySettingsService.php:75-76`). Le `logo` et les logos de
  marque utilisent la règle `image`, qui exclut le SVG (Laravel 13) : seul le
  favicon était exposé.
- **Scénario** : un détenteur de `edit settings` téléverse un SVG contenant
  `<script>` ; ouvert directement, il s'exécute sur l'origine de l'application
  et lit `localStorage.auth_token`.
- **Correctif** : `mimes:ico,png,jpg,jpeg,webp` ; attribut `accept` du champ
  restreint côté front. Tests `test_update_rejects_svg_favicon` et
  `test_update_accepts_png_favicon`. Aucun SVG n'était présent dans
  `storage/app/public/settings/company`.

### H5 — Nginx : en-têtes perdus, pas de CSP, `\.php$` sans `try_files`

- **Preuve** : `deploy/nginx/quel-pneu.ma.conf` déclarait les cinq en-têtes au
  niveau `server`, mais `location = /index.html`, `location ^~ /storage/` et le
  bloc des assets déclaraient leur propre `add_header` (Cache-Control), ce qui
  en Nginx remplace la liste héritée. Résultat : le document d'entrée de la
  SPA et tous les fichiers uploadés partaient sans `X-Frame-Options`, sans
  `nosniff`, sans HSTS. Aucune `Content-Security-Policy` nulle part.
  `location ~ \.php$` sans `try_files $uri =404` avec `PATH_INFO` transmis.
- **Correctif** : snippet `deploy/nginx/security-headers.conf` (cinq en-têtes +
  `Permissions-Policy` + CSP), inclus au niveau `server` et dans chacun des
  trois `location`. `try_files $uri =404` dans le bloc PHP. `deny all` sur
  `\.(php|phtml|phar)$` sous `/storage/`. Même durcissement dans
  `docker/nginx/default.conf` et `e2e.conf` (`^~ /storage/`, `client_max_body_size`).
  `deploy.sh` copie le snippet dans `/etc/nginx/snippets/` à **chaque**
  déploiement.
- **Action manuelle restante** : `deploy.sh` ne remplace jamais un vhost déjà
  en place (pour préserver la configuration SSL de Certbot). Sur le VPS,
  ajouter les lignes `include /etc/nginx/snippets/quel-pneu-security-headers.conf;`
  dans le vhost actif aux quatre endroits montrés par
  `deploy/nginx/quel-pneu.ma.conf`, puis `nginx -t && systemctl reload nginx`.
  Le script affiche un rappel tant que ce n'est pas fait.
- **À vérifier après mise en ligne** : téléchargement PDF (html2canvas,
  `frame-src 'self'`) et aperçu logo/favicon (`img-src blob:`) sous la CSP.
  Les configurations Apache (`deploy/apache/`) ne sont pas concernées par la
  perte d'en-têtes (`Header set` fusionne) mais n'ont pas de CSP non plus.

### H6 — Mot de passe DB exposé par les scripts de déploiement

- **Preuve** : `deploy/deploy.sh:158` et `deploy2.sh:190` passaient
  `--password=` sur l'argv distant (visible par tout utilisateur local via
  `ps`) ; `deploy.sh:439-440` et `deploy2.sh:391-392` affichaient le mot de
  passe en clair dans le texte d'aide au rollback, à chaque exécution.
- **Correctif** : `MYSQL_PWD` en variable d'environnement pour le dump ; `-p`
  sans valeur dans le texte de rollback ; `chmod 640 back/.env` après le
  `chmod` récursif ; `deploy2.sh` n'envoie plus `storage/app/` ni
  `storage/logs/` en production.

### H7 — Fichiers scratch suivis par git

- **Preuve** : `tmp/verify_refactored_endpoints.ps1` (mot de passe admin faible
  en dur, alors que `tmp/` est dans `.gitignore` — le fichier était déjà indexé),
  `front/read_excel.js` (`require('xlsx')` sans dépendance), `read_excel.php`,
  `tmp/verify_endpoints.php`.
- **Correctif** : retirés de l'index et purgés de l'historique avec C2.
  Vérifier qu'aucune instance déployée n'utilise encore ce mot de passe admin.

### M1 — Limiteur de connexion (corrigé avec H3)

`AppServiceProvider` : le limiteur `login` avait une seule clé email+IP, donc
une IP pouvait essayer un même mot de passe sur un nombre illimité de comptes.
Ajout d'un second compteur 20/min par IP. Test `test_login_is_rate_limited_per_ip_across_accounts`.

## Constats moyens (reportés, correctif proposé)

- **M2 — Statuts à la création.** `StoreSaleRequest` accepte `payment_status`
  et `SaleService::create()` n'appelle pas `refreshPaymentStatus()` ; une vente
  peut naître « PAYÉ » sans paiement et disparaître des impayés.
  `ServiceOrderService::create()` prend `status` et `payment_status` tels quels
  et n'utilise pas `StatusTransitionGuard`. Correctif : retirer
  `payment_status` des Store requests, appeler `refreshPaymentStatus()` en fin
  de `create()`, forcer le statut initial des OS.
- **M3 — Formules Excel dans les exports.** `fromArray()` passe par
  `DefaultValueBinder`, qui type toute chaîne commençant par `=` en formule
  (`ClientController::export`, `SaleController::export`,
  `PurchaseController::export`, `ServiceOrderController::export`,
  `StockService::export`). Un nom de client `=HYPERLINK(...)` devient une
  formule vivante. Correctif : helper d'export commun qui écrit les cellules
  texte avec `setCellValueExplicit(..., DataType::TYPE_STRING)`.
- **M4 — Import Excel.** `StockService::import()` utilise
  `toArray(null, true, ...)` (formules évaluées) et applique le cap de 10 000
  lignes après chargement complet. Correctif : `setReadDataOnly(true)`,
  `toArray(null, false, ...)`, cap sur `getHighestRow()` avant lecture.
- **M5 — `APP_DEBUG`.** `true` dans `.env.example` et `.env.docker` ;
  `withExceptions` vide. Les scripts de déploiement écrivent bien `false`.
  Correctif : `false` dans `.env.example`.
- **M6 — MySQL Docker.** `docker-compose.yml` publie `${MYSQL_PORT}:3306` sur
  toutes les interfaces avec `secret` / `rootsecret` par défaut. Correctif :
  `127.0.0.1:${MYSQL_PORT}:3306` et suppression des valeurs par défaut.
- **M7 — Pagination non bornée.** Aucun `max` sur `per_page` (hors
  `KpiHistoryController`), `all=true` sur plusieurs listes, exports en
  `->get()`. Correctif : `per_page` `integer|min:1|max:100` partout, chunking
  des exports.
- **M8 — Frontières de permission.** `PUT /api/hr-employees/{user}` écrit la
  table `users` sous `edit hr-charges` ; `PATCH shipment-change-requests/{id}/status`
  (acceptation) est gardé par le même `edit shipment-changes` que la création,
  donc un Commercial approuve sa propre demande. Correctif : permission
  `approve shipment-changes` ; `edit users` ou vérification explicite pour
  les champs RH.
- **M9 — Doublons et intercepteur.** Les routes clients de base sont
  enregistrées deux fois (`catalog.php` puis `clients.php`) : la seconde
  déclaration est ignorée, toute garde ajoutée dans `clients.php` n'aurait
  aucun effet. L'intercepteur Angular ajoute le Bearer à toute URL sans
  allowlist (latent : aucun appel externe aujourd'hui). Correctif : un seul
  fichier de routes clients ; `if (!req.url.startsWith('/api')) return next(req)`.

## Constats bas

- B1 — `SalePaymentService::createPayment()` n'empêche pas un paiement
  supérieur au reste dû (le chemin multi-ventes le fait).
- B2 — Paramètres non validés → 500 : `PrimesController` (`year`/`month`),
  `DashboardController` (`day`), `StockController` (`search[]=` → `trim(array)`).
- B3 — Modèles renvoyés sans Resource : `StockController`, `PurchaseController`,
  `VehicleController`, `ActivityLogController`, `KpiHistoryController`.
- B4 — `config/cors.php` : origines localhost en dur avec `supports_credentials`.
- B5 — `composer.json` : `minimum-stability: dev` ; `laravel/framework` figé
  en 13.0.0 (lancer `composer audit` et `composer update`).
- B6 — Intercepteur : un 401 vide `localStorage` mais pas les signaux de
  `AuthService` (`isAuthenticated()` reste vrai jusqu'au rechargement).
- B7 — `deploy2.sh` sans `--delete` (fichiers obsolètes conservés sur le serveur).
- B8 — Apache : `<DirectoryMatch "/\.">` ne bloque que les répertoires cachés,
  pas le fichier `.env` ; `Options +Includes +ExecCGI` inutiles sur `back/public`.

## Points sains

- Aucune injection SQL : tous les `raw` sont des littéraux ou utilisent des
  bindings ; les colonnes de tri sont whitelistées (`in_array(..., true)`).
- Aucune traversée de chemin ; aucun `exec`/`shell_exec` ; les chemins
  supprimés viennent de la base, jamais de la requête.
- Pas de mass-assignment : `$fillable` explicite sur les 39 modèles, aucun
  `$request->all()` dans une écriture.
- Chaque ressource enfant vérifie son parent (paiements de vente, d'achat, de
  client, de fournisseur, d'OS ; lignes d'OS ; retours d'achat).
- `UserResource` masque hash et jeton ; la paie est conditionnée à
  `view hr-charges` ; les snapshots d'`ActivityLog` ne contiennent aucun secret.
- Seeder admin sans mot de passe en dur (`ADMIN_INITIAL_PASSWORD` vide →
  génération aléatoire, affichée une fois) ; `APP_KEY` jamais commité.
- Frontend : un seul `bypassSecurityTrustHtml`, sur une table de constantes
  SVG ; aucun `eval` ; Angular 21.2.17 et `jspdf` 4.2.1 (`dompurify` 3.4.14) ;
  pas de `xlsx`/SheetJS dans l'arbre.
- Lecteur PhpSpreadsheet 5.5 : `XmlScanner` bloque `DOCTYPE`/`ENTITY` (XXE),
  `WEBSERVICE()` est whitelisté à vide (SSRF).
- `.env`, `deploy/*.env`, `e2e/.auth/` correctement ignorés (vérifié par
  `git check-ignore`) ; `e2e/global-setup.ts` échoue si aucun mot de passe
  n'est fourni plutôt que d'utiliser une valeur par défaut.
- Scripts de déploiement : `APP_DEBUG=false`, `config:cache`, `composer --no-dev`,
  permissions 755/775 (jamais 777), `APP_KEY` préservé, racines Nginx sur
  `public/` uniquement, `autoindex` jamais activé, PHP-FPM non publié.

## Vérification effectuée

- Backend : 725 tests, 2194 assertions, tous verts (`vendor/bin/phpunit`,
  1 Go de mémoire).
- Frontend : 34 fichiers, 409 tests verts (`ng test --watch=false`).
- Nginx dev : `nginx -t` OK ; un `.php` déposé dans `storage/app/public`
  répond 403, `/storage/x.txt/y.php` répond 403.
- Scripts : `bash -n deploy/deploy.sh deploy/deploy2.sh` OK.
