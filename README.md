# TFE - Backend

Backend REST de gestion des commandes de repas et des résidents d'une résidence.
Projet de travail de fin d'études (BAC3, EPHEC, août 2026).

Ce dépôt contient le backend. Le frontend et le déploiement ne sont pas livrés à ce stade (voir le rapport, sections 10.1 et 11.3).

## Stack technique

- Node.js avec Express 5 (modules ES).
- Prisma 7.8 avec le pilote `pg` (driver adapter).
- PostgreSQL 18, exécuté dans un conteneur Docker (port 5433).
- Vitest et Supertest pour les tests d'intégration.
- bcrypt pour le hachage des codes PIN, JWT pour l'authentification.

## Prérequis

- Node.js 20 ou supérieur.
- Docker et Docker Compose.

## Installation

1. Cloner le dépôt et se placer dans le dossier backend.

```
git clone git@github.com:mugino-poply/TFE-aout-2026.git
cd TFE-aout-2026/backend
```

2. Installer les dépendances.

```
npm install
```

3. Créer les fichiers d'environnement. `.env` et `.env.test` ne sont pas versionnés (ils contiennent les secrets). Le fichier `.env` sert à la fois à Docker Compose (variable `POSTGRES_PASSWORD`) et à l'application (variable `DATABASE_URL`) : le mot de passe doit être identique dans les deux. Modèle minimal :

```
POSTGRES_PASSWORD="valeur-secrete-a-changer"
DATABASE_URL="postgresql://tfe:valeur-secrete-a-changer@localhost:5433/tfe"
JWT_SECRET="autre-valeur-secrete"
BCRYPT_ROUNDS=12
```

`.env.test` reprend les mêmes clés mais pointe vers une base de test dédiée (même serveur, base séparée).

4. Démarrer la base de données.

```
docker compose up -d
```

5. Appliquer le schéma et charger les données de démonstration.

```
npx prisma migrate deploy
npx prisma db seed
```

Note Prisma 7 : `prisma migrate reset` ne lance plus le seed automatiquement. Pour repartir d'une base de développement propre, il faut enchaîner le seed explicitement : `npx prisma migrate reset --force && npx prisma db seed`.

## Lancer les tests

La suite compte 163 tests d'intégration, exécutés sur la base de test dédiée.

```
npm test
```

Cette commande remet le schéma à neuf sur la base de test puis lance Vitest. Le chargement des données ne se fait pas ici mais avant chaque fichier de test (`vitest.setup.js`), et les fichiers s'exécutent en série (`fileParallelism: false`) pour éviter qu'un rechargement vide la base pendant qu'un autre fichier la lit. La définition des données de seed est unique (`prisma/seedData.ts`), partagée entre le seed initial et le rechargement de test.

## Comptes de démonstration

Créés par le seed, pour se connecter en développement (identifiant puis code PIN) :

| Rôle       | Identifiant  | Code PIN |
|------------|--------------|----------|
| Secrétaire | secretaire1  | 8181     |
| Cuisine    | cuisine1     | 0307     |
| Serveur    | serveur1     | 2120     |
| Admin      | admin1       | 2911     |

## Structure du dépôt

```
backend/
├── prisma/
│   ├── schema.prisma          # modèle de données
│   ├── seed.ts                # seed initial
│   ├── seedData.ts            # source unique des données de seed
│   └── migrations/            # migrations versionnées (dont les migrations SQL manuelles)
├── src/
│   ├── app.js                 # montage de l'application Express
│   ├── index.js               # point d'entrée
│   ├── lib/
│   │   └── prisma.js          # client Prisma partagé
│   ├── middlewares/
│   │   └── auth.js            # authentification JWT et contrôle de rôle
│   ├── routes/                # points d'entrée HTTP (auth, users, appartements, residents, commandes...)
│   ├── domain/                # logique métier partagée (ex : regles-annulation.js)
│   └── config/                # seuils et tarifs (règles de gestion paramétrables)
├── docs/
│   └── sessions/              # journal de bord, une note par session de travail
├── vitest.config.js
├── vitest.setup.js
└── compose.yaml
```

## Conventions de commit

Le projet suit un cycle de développement piloté par les tests, un commit par étape :

```
test(us-XX): red - description
feat(us-XX): green - description
test(us-XX): né vert - description
refactor(us-XX): description
```

`red` : nouveau test qui échoue. `green` : implémentation qui le fait passer. `né vert` : test qui passe sans phase rouge (non-régression). `refactor` : remaniement à comportement constant. Les descriptions sont en français.

## Documentation des décisions

Les décisions techniques non triviales sont tracées à trois niveaux : des commentaires en place dans le code pour les passages sensibles (par exemple la transaction verrouillée du CRUD des résidents dans `src/routes/residents.js`), des migrations SQL écrites et commentées à la main pour les contraintes non exprimables via Prisma (par exemple la normalisation et l'unicité des allergies), et un journal de bord versionné (`docs/sessions/`) qui conserve session par session le raisonnement derrière chaque choix.
