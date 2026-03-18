# 🏪 Pneuma POS

Système de Point de Vente (POS) développé avec **Angular 19**, **Laravel 13** et **MySQL 8**.

## 🐳 Stack Docker

| Service    | Technologie           | Port   |
|------------|-----------------------|--------|
| **nginx**  | Nginx Alpine          | `8888` |
| **php**    | PHP 8.4 FPM           | `9000` |
| **mysql**  | MySQL 8.0             | `3307` |
| **angular**| Node 22 + Angular 19  | `4200` |

## 🚀 Démarrage rapide

### 1. Cloner et configurer

```bash
cp .env.example .env
```

### 2. Lancer la stack Docker

```bash
docker compose up --build
```

### 3. Exécuter les migrations et le seed (première fois)

```bash
docker compose exec php php artisan migrate --seed
```

### 4. Accéder à l'application

- **Application** : [http://localhost:8888](http://localhost:8888)
- **API** : [http://localhost:8888/api](http://localhost:8888/api)
- **Angular Dev Server (direct)** : [http://localhost:4200](http://localhost:4200)

## 🔑 Compte par défaut

| Champ          | Valeur               |
|----------------|----------------------|
| **Email**      | `admin@pneuma.pos`   |
| **Mot de passe** | `password`        |

> Ce compte est créé par le seeder (`DatabaseSeeder`). Vous pouvez aussi créer un nouveau compte via la page d'inscription.

## 📡 API Endpoints

| Méthode | URL             | Description          | Auth requise |
|---------|-----------------|----------------------|:------------:|
| POST    | `/api/register` | Inscription          | ❌           |
| POST    | `/api/login`    | Connexion            | ❌           |
| GET     | `/api/user`     | Profil utilisateur   | ✅           |
| POST    | `/api/logout`   | Déconnexion          | ✅           |

## 🏗️ Structure du projet

```
pneuma-pos/
├── docker-compose.yml          # Orchestration Docker
├── docker/
│   └── nginx/default.conf      # Config Nginx (reverse proxy)
├── back/                       # Laravel 13 (API)
│   ├── Dockerfile
│   ├── app/
│   │   ├── Http/Controllers/Auth/AuthController.php
│   │   ├── Http/Requests/Auth/
│   │   └── Models/User.php
│   └── routes/api.php
└── front/                      # Angular 19 (SPA)
    ├── Dockerfile
    └── src/app/
        ├── core/
        │   ├── guards/auth.guard.ts
        │   ├── interceptors/auth.interceptor.ts
        │   ├── models/auth.model.ts
        │   └── services/auth.service.ts
        └── features/
            ├── auth/login/
            ├── auth/register/
            └── dashboard/
```

## 🛠️ Commandes utiles

```bash
# Reconstruire les conteneurs
docker compose up --build

# Arrêter la stack
docker compose down

# Voir les logs
docker compose logs -f

# Accéder au conteneur PHP
docker compose exec php bash

# Exécuter des commandes artisan
docker compose exec php php artisan <commande>

# Réinitialiser la base de données avec le compte admin
docker compose exec php php artisan migrate:fresh --seed

# Accéder au conteneur Angular
docker compose exec angular sh
```
