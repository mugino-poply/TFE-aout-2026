# Session 2 — Le Cénacle (TFE)

- **Auteur :** Hippolyte AMORY
- **Date :** 9 juin 2026
- **Échéances :** remise du rapport le 17 août 2026 ; livraison du produit dans les deux semaines suivantes (date de défense non encore fixée).
- **Objet de la session :** poursuite de la **Phase 0** — Docker de développement, init Prisma, connexion PostgreSQL, et **migration initiale** matérialisant le schéma verrouillé en Session 1.

---

## Contexte et état de départ

Schéma `schema.prisma` verrouillé et défendable depuis la Session 1. Phase 0 en cours. Reprise : le commit du schéma était fait, l'alignement des figures du rapport a été **différé volontairement** par Hippolyte, et on a continué la Phase 0 (Docker dev, Prisma, connexion base).

Objectif de la session : amener la Phase 0 à terme — une base PostgreSQL conteneurisée, Prisma branché dessus, et le schéma transformé en vraies tables via une migration versionnée.

---

## Ce qui a été travaillé

### 2.1 — Périmètre de conteneurisation en Phase 0

**Décision : Postgres seul dans Docker, Node en natif sur l'hôte.**

*Justification (défendable au jury).* En Phase 0, la priorité est la **vitesse de développement**, pas la capacité de l'évaluateur à lancer le projet — ce dernier besoin relève de la Phase 7 (VPS) et n'est pas le rôle du `compose` de dev. L'exigence EPHEC « déployable facilement par les évaluateurs » porte sur un **artefact futur**, pas sur l'environnement de dev courant : ne pas confondre les deux évite de sur-ingénier la Phase 0.

- Postgres en conteneur = base **jetable et propre**, cassable et relançable sans rien installer en dur sur la machine.
- Node en natif = hot-reload et debugger branchés directement, sans rebuild de conteneur à chaque modification.

### 2.2 — Persistance des données : volume nommé

**Décision : volume nommé Docker (`pgdata`) pour le datadir Postgres.**

*Règle retenue :* **persistance par défaut, destruction opt-in.** Les données survivent à tous les `up`/`down` ; elles ne disparaissent que sur un `docker compose down -v` explicite. Double mode adapté à Prisma : au quotidien on garde le seed ; pour rejouer une migration propre, `down -v` (radical, raye le volume) ou `prisma migrate reset` (chirurgical : agit au niveau logique de la base — drop schéma + replay migrations + seed — sans toucher au volume ni au conteneur).

*Alternatives écartées :*
- **« rien » (données dans la couche du conteneur)** : effacées au moindre `down`. Fragile par accident, pas « jetable ».
- **bind mount** : écarté pour deux raisons valables **sur Linux natif** — (1) galères de permissions (l'image Postgres écrit avec son propre uid interne, conflit avec le dossier hôte) ; (2) `down -v` ne nettoie pas un bind mount, ce qui casse le modèle « destruction opt-in propre ».
- **Correction actée :** l'argument « bind mount = I/O lents » est **faux sur Linux en Docker natif** (c'est un artefact de Docker Desktop sur macOS/Windows, via leur couche de virtualisation). Ne pas l'avancer au jury. La conclusion (volume nommé) tient sur les deux autres arguments.

### 2.3 — Audit du `compose.yaml`

Image `postgres:18-alpine`, `restart: unless-stopped`, variables `POSTGRES_USER/PASSWORD/DB`, volume nommé, **healthcheck `pg_isready`**, et omission volontaire de la clé `version:` (obsolète en Compose v2). Deux ajustements imposés par l'environnement :

- **Port hôte `5432:5432` → `5433:5432`.** Un Postgres natif (v16) squattait déjà le 5432 sur la machine. Le port *interne* du conteneur reste 5432 (ce que Postgres écoute) ; seul le port *publié* change. Conséquence directe portée plus loin : la `DATABASE_URL` doit pointer sur `5433`. Le `pg_isready` du healthcheck, lui, s'exécute **dans** le conteneur (côté 5432 interne) → il ne change pas.
- **Mount `/var/lib/postgresql/data` → `/var/lib/postgresql`.** PostgreSQL 18 a changé sa convention de stockage dans l'image Docker officielle : `PGDATA` est devenu versionné (`/var/lib/postgresql/18/docker`) et le `VOLUME` défini pointe désormais sur le parent `/var/lib/postgresql`. **Vérifié en séance (doc officielle de l'image).** *But de ce changement (à savoir énoncer) :* monter le dossier parent permet aux montées de version majeures futures d'utiliser `pg_upgrade --link` (migration quasi instantanée par liens durs entre dossiers versionnés frères, ex. `18/docker` → `19/docker`), au lieu de recopier les données. NB : Hippolyte part d'un volume **vierge** → il n'a pas le bug de migration 17→18 ; il a simplement adopté la bonne convention dès le départ.

### 2.4 — `localhost` vs nom de service (réseau Docker)

**Formule de défense validée :** un conteneur a sa propre pile réseau, donc à l'intérieur `localhost` désigne le conteneur lui-même, jamais l'hôte. Un Node **conteneurisé** devrait donc viser le **nom de service** Postgres. Ici Node tourne **sur l'hôte**, donc `localhost` = l'hôte, où le port est publié (5433).

### 2.5 — Secret de développement : posture tranchée

**Décision : le mot de passe de dev (`tfe_dev_password`) n'est PAS un secret.** Il ouvre une base jetable, locale, sans donnée réelle, jamais réutilisée ailleurs → valeur nulle. Il est donc assumé en clair dans `compose.yaml` (versionné).

*Contradiction repérée et résolue :* gitignorer `.env` tout en hardcodant le mot de passe dans le `compose` versionné pouvait sembler incohérent. Résolution : `.env` est gitignoré **par convention, indépendamment de son contenu** — garantie structurelle (on ne se demande jamais au cas par cas « ce `.env` contient-il un vrai secret ? »), pas vigilance ponctuelle. C'est plus fort que « anticipatif ».

*Frontière dev / Phase 7 (engagement explicite à porter dans l'analyse de sécurité) :* l'argument « valeur nulle car jamais réutilisé » est aujourd'hui une **intention**, pas encore une garantie. En Phase 7, le mot de passe Postgres de prod devra être réellement différent et hors de Git (mécanisme à trancher là-bas). Tant que ce n'est pas fait, c'est une dette assumée. (Rappel de la leçon WireGuard, Session 1 : ce qui n'est pas garanti structurellement reste une dette.)

### 2.6 — Init Prisma en manuel + répartition des dépendances

**Décision : init « à la main »** (création du `.env` + installation des paquets sans `prisma init`) pour ne pas risquer d'écraser le `schema.prisma` verrouillé.

- `prisma` → **devDependency** (CLI, outil de fabrication : `migrate`, `generate`, Studio — rien de tout ça ne tourne en prod en train de servir des requêtes).
- `@prisma/client` → **dependency** (importé et exécuté à chaque requête en base → dépendance d'exécution).
- Casse npm : paquets en minuscules (`prisma`, `@prisma/client`) ; la classe importée est `PrismaClient` (PascalCase) — ne pas confondre nom de paquet et nom de classe.
- `npm init` lancé **dans `backend/`** : npm cherche le `package.json` en remontant l'arborescence ; l'ancrer dans `backend/` garantit que dépendances, scripts et `node_modules` vivent au bon niveau. Structure mono-dépôt : `backend/` et `frontend/` sont deux sous-projets npm distincts.

### 2.7 — Choix de la commande de matérialisation : `migrate dev` vs `db push`

**Décision : `prisma migrate dev`** (artefact de migration versionné), contre `db push` (sync direct, aucune trace).

*Justification (recadrée sur le fond).* La première justification avancée — « mieux vu pour le critère Git » + « on a un timestamp » — a été **écartée comme faible** (apparence + détail cosmétique : `git log` a déjà des timestamps). Les vrais arguments défendables :
- **Rejouabilité** : le fichier de migration contient le SQL exact ; en Phase 7 on reconstruit la base de zéro en rejouant les migrations dans l'ordre, structure identique garantie. (Cohérent avec la décision Session 1 : « rejouer pour comprendre », pas « pousser un état opaque ».)
- **Historique structurel** : l'évolution du schéma (colonnes, FK, index) vit en SQL lisible dans les migrations — distinct de l'historique des commits.
- **Cohérence schéma ↔ base garantie** via `_prisma_migrations` : Prisma sait quelles migrations sont appliquées et peut détecter une dérive dev/prod. C'est l'argument le plus fort, car il rejoint la colonne vertébrale méthodologique : une **propriété vérifiable par le système**, pas « je me souviens d'avoir poussé ça ».

*Précision retenue :* `migrate dev` fait **trois** choses — crée le fichier de migration, l'applique à la base, **régénère** `@prisma/client` (d'où l'installation du client avant).

### 2.8 — Changement cassant Prisma 7 et choix de version assumé

À l'exécution de `migrate dev` : **erreur P1012** — `url` n'est plus supporté dans `schema.prisma` en Prisma 7.8 ; la config de connexion migre vers `prisma.config.ts`. **Vérifié en séance (doc officielle + guide d'upgrade).**

*Drapeau levé :* Hippolyte était sur Prisma 7.8 **par accident** (`npm install` a tiré la dernière version), pas par choix — exactement le type de décision non maîtrisée que le jury reproche.

*Décision : adopter Prisma 7 (voie B).* Transformé d'un default accidentel en choix assumé. Alternative écartée (voie A) : épingler Prisma 6.x stable et abondamment documenté, où le `schema.prisma` actuel marchait tel quel.
- *Pourquoi B, défendable :* maîtrise du nouveau modèle de config et de sa logique — **séparation des préoccupations** : le `schema.prisma` ne décrit plus que la **structure** (statique), la config de connexion (runtime, dépendante de l'environnement) vit dans `prisma.config.ts`.
- *Prix assumé :* `prisma.config.ts` est un fichier **TypeScript** introduit dans un backend JS ; écosystème Prisma 7 récent (sorti nov. 2025), moins de ressources sous la main.

### 2.9 — Mise en place de `prisma.config.ts` + chargement de l'environnement

- `url` retiré du bloc `datasource` de `schema.prisma` (ne reste que `provider = "postgresql"`). `generator client` inchangé.
- `prisma.config.ts` créé à la racine de `backend/` (au niveau du `package.json`), portant le `datasource.url` via `env("DATABASE_URL")`.
- **`DATABASE_URL`** : `postgresql://tfe:tfe_dev_password@localhost:5433/tfe?schema=public`. Le `?schema=public` désigne le **schéma au sens Postgres** (espace de noms *dans* la base où vivent les tables), **pas** la base elle-même — distinction à tenir au jury.
- **`dotenv` installé** et `import "dotenv/config"` placé en **première ligne** du fichier de config. *Pourquoi l'ordre compte :* le helper `env("DATABASE_URL")` lit `process.env` au moment où `defineConfig` est évalué ; si le `.env` n'est pas chargé avant, la variable est vide. Raisonnement « ordre d'exécution / dépendance satisfaite avant d'être consommée ».

### 2.10 — Migration initiale : passage

Après création du `.env` manquant (cf. blocage ci-dessous), `npx prisma migrate dev --name init` a abouti : **« Your database is now in sync with your schema. »** Premier jalon : base conforme au modèle + artefact de migration versionné produit.

---

## Concepts compris cette session

- Conteneuriser **selon le besoin réel** (vitesse de dev en Phase 0), pas par habitude ; ne pas confondre périmètre dev et périmètre déploiement évaluateur (Phase 7).
- Modèle de persistance d'un volume : nommé vs bind mount vs « rien » ; « persistance par défaut, destruction opt-in » ; `down -v` (volume) vs `migrate reset` (logique).
- Convention de stockage PG18 et son *but* (`pg_upgrade --link`).
- `localhost` vs nom de service selon la pile réseau (hôte vs conteneur).
- Répartition devDependency / dependency motivée par *quand* la chose est utilisée (fabrication vs exécution).
- `migrate dev` vs `db push` ; valeur d'une migration versionnée (rejouabilité, `_prisma_migrations` comme propriété vérifiable).
- Séparation structure / config runtime introduite par Prisma 7.
- Ordre des imports = ordre d'exécution (dotenv avant lecture de l'env).
- Réflexe transversal : **constater** (lire `git status`, `\dt`, l'état réel) plutôt que **supposer**.

## À consolider

- **Défendre sur le fond, pas sur l'apparence** : réflexe à ancrer après le dérapage `migrate dev` justifié d'abord par « mieux vu » + « timestamp » avant recadrage sur rejouabilité / `_prisma_migrations`.
- **Question de contrôle en suspens** (à formuler) : rôle exact de `_prisma_migrations` et en quoi elle distingue `migrate dev` de `db push`.
- Faire des **choix de version conscients** (le réflexe « npm a installé la dernière » n'est pas une justification).
- Le mythe « bind mount = I/O lents » (vrai seulement sur Docker Desktop macOS/Windows, pas sur Linux natif).

---

## Points à mentionner dans le rapport TFE (choix justifiés issus de la session)

- Périmètre Docker en dev (Postgres conteneurisé, Node natif) et distinction dev / déploiement évaluateur.
- Choix du volume nommé et modèle de persistance.
- Adoption de la convention de stockage PG18.
- Posture sur le secret de dev (non-secret assumé) + frontière dev/prod à garantir en Phase 7.
- Choix `migrate dev` (migration versionnée) et ses bénéfices de rejouabilité/traçabilité.
- Choix assumé de Prisma 7 et séparation structure / config runtime.

## Exigences EPHEC progressées

- **Procédure de déploiement** : Docker de dev en place (le déploiement « propre » reste Phase 7).
- **Versioning Git** : `.gitignore` à la racine vérifié actif (`.env` et `node_modules/` ignorés), commits atomiques (message lisible décrivant le contenu).
- **Analyse de sécurité** : posture sur le secret de dev + engagement explicite pour le secret de prod en Phase 7 ; `.env` jamais versionné par convention.
- **Schémas techniques** : schéma matérialisé en base (les **figures du rapport** restent à aligner — chantier différé cette session, hérité de la Session 1).

## État des fonctionnalités / routes

- Aucune route ni feature applicative codée à ce stade. **Phase 0 terminée** côté infrastructure base de données.
- Phase 1 (authentification) non commencée.

## Blocages rencontrés et résolution

1. **Port 5432 occupé** par un Postgres natif → port hôte basculé sur **5433**.
2. **Mount PG18** : `/var/lib/postgresql/data` invalide en PG18 → remonté d'un cran sur **`/var/lib/postgresql`** (convention versionnée).
3. **Erreur P1012** (`url` non supporté en Prisma 7) → adoption de `prisma.config.ts` (décision B).
4. **`PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL`** → cause : **le `.env` n'existait pas** (gitignoré par anticipation en Session 1 mais jamais créé). Création du `.env` dans `backend/` → migration passée.

---

## Ce qui reste à faire — prochaine session

1. **Vérifier / finaliser le commit Phase 0** (s'il n'a pas été lancé) : `prisma/migrations/`, `prisma.config.ts`, `schema.prisma` modifié, `package.json`, `package-lock.json`, `compose.yaml`. Jamais le `.env`.
2. **Vérification post-migration non encore faite** : lire `prisma/migrations/<timestamp>_init/migration.sql` (repérer enums, FK + `ON DELETE Restrict` sur `Boisson → BoissonCatalogue`, index) ; `\dt` dans `psql` pour confirmer les 10 tables + `_prisma_migrations`. Et répondre à la question de contrôle sur `_prisma_migrations`.
3. **Optionnel non bloquant** : créer un `.env.example` versionné (documente les variables attendues sans exposer de secret — utile pour le critère « déployable par les évaluateurs »).
4. **Hérité Session 1, toujours ouvert** : aligner les figures du rapport (EA + relationnel + UML classes) sur le schéma verrouillé.
5. **Phase 1 — Authentification & accès** (cœur défendable) :
   - US-01 — Connexion par code PIN
   - US-02 — Liste publique des prénoms (login)
   - US-03 — Middleware JWT + RBAC

---

## Structure du dépôt

```
TFE - AOUT 2026/
├── .git/
├── .gitignore                 ← (racine ; patterns .env et node_modules/ sans slash, récursifs)
├── README.md
├── backend/
│   ├── compose.yaml           ← MODIFIÉ (Postgres 18-alpine, port 5433, volume nommé, healthcheck)
│   ├── package.json           ← NOUVEAU (prisma en devDep, @prisma/client + dotenv en dep)
│   ├── package-lock.json      ← NOUVEAU
│   ├── prisma.config.ts       ← NOUVEAU (dotenv/config + datasource.url ; séparation config runtime)
│   ├── .env                   ← NOUVEAU (gitignoré, non versionné ; DATABASE_URL port 5433)
│   ├── node_modules/          ← (gitignoré)
│   └── prisma/
│       ├── schema.prisma      ← MODIFIÉ (url retirée du bloc datasource)
│       └── migrations/        ← NOUVEAU
│           └── <timestamp>_init/
│               └── migration.sql
└── frontend/
```

---

## Instructions pour reprendre (Session 3)

- **Contexte :** Phase 0 terminée (base PostgreSQL conteneurisée + Prisma 7 branché + schéma matérialisé via migration versionnée). On attaque la **Phase 1 — authentification**.
- **Rappels :**
  - Stack Prisma **7** (config dans `prisma.config.ts`, pas dans `schema.prisma`).
  - Postgres conteneurisé sur **`localhost:5433`** (pas 5432).
  - `psql -h localhost -p 5433 -U tfe -d tfe` (convention `-h localhost`).
  - Posture : socratique, mentor exigeant ; objectif = défendabilité, pas livraison rapide du code.
- **Commandes de relance :**
  ```bash
  cd backend
  docker compose up -d
  docker compose ps        # attendre "healthy" sur le service db
  ```
- **Vérification rapide que tout est debout :**
  ```bash
  psql -h localhost -p 5433 -U tfe -d tfe -c "\dt"
  ```
  Doit lister les 10 tables + `_prisma_migrations`.

---

*Rapport mis à jour le 9 juin 2026 — Session 2*
