# Session 3 — Le Cénacle (TFE)

- **Auteur :** Hippolyte AMORY
- **Date :** 12 juin 2026
- **Échéances :** remise du rapport le 17 août 2026 ; livraison du produit dans les deux semaines suivantes (date de défense non encore fixée).
- **Objet de la session :** **Phase 1 — authentification & accès**. Cible : livrer **US-01 (connexion par PIN)** de bout en bout, avec sa suite de tests d'intégration et la mécanique de test pérenne pour toute la suite du projet.

---

## Contexte et état de départ

Phase 0 terminée (Session 2). À la reprise, vérifications des reliquats Session 2 :

- `\dt` sur la base `tfe` : **11 tables confirmées** (10 métier + `_prisma_migrations`).
- Commit Phase 0 lancé, fichiers attendus présents (`prisma/migrations/`, `prisma.config.ts`, `schema.prisma` modifié, `compose.yaml`, `package.json`/`-lock.json`, jamais le `.env`).
- **Question de contrôle en suspens** (rôle de `_prisma_migrations`) : reprise en début de session, voir 3.1.

Reliquat hérité Session 1 / 2 (alignement des figures du rapport sur le schéma verrouillé) : **toujours différé**, non traité.

Objectif de la session : avancer Phase 1, US-01 complète (route + auth + JWT + tests).

---

## Ce qui a été travaillé

### 3.1 — Question de contrôle `_prisma_migrations` (reliquat Session 2)

**Réponse formulée et corrigée en séance.** `_prisma_migrations` est un **journal des migrations appliquées** (nom, timestamp, **checksum** du fichier SQL) — **pas** un état structurel de la base. Distinction critique : la table ne sait rien sur les tables `Boisson`, `Commande`, etc. Elle dit seulement *quelles migrations ont été jouées*.

*Rôle du checksum (point central pour la défense `migrate dev` vs `db push`) :* il garantit que **le contenu joué en prod est bit-pour-bit celui joué en dev**. Si quelqu'un édite un fichier de migration *après* son application, Prisma le détecte au lieu de rejouer silencieusement quelque chose de différent. C'est l'argument structurel le plus fort : **propriété vérifiable par le système**, pas vigilance humaine. (Avec `db push` : aucun fichier, aucune ligne dans le journal, aucun checksum → état poussé puis oublié.)

### 3.2 — Conception de la route `POST /api/auth/login`

**Séquence d'opérations validée (ordre figé) :**

1. Parse du body → extraire `id_utilisateur` (int) et `code` (string).
2. Validation du `code` : `typeof === "string"` ET regex `^\d{4,}$` → sinon **400**.
3. Validation de l'`id_utilisateur` (`Number.isInteger`) → sinon **400**.
4. `prisma.utilisateur.findUnique` par `id_utilisateur`.
5. Si introuvable OU `actif === false` → **401 message générique**.
6. `bcrypt.compare(code, utilisateur.code_pin)` → si `false`, même **401 strictement identique**.
7. `jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: "11h" })`.
8. Renvoyer `{ token }` en 200.

**Erreur de fond identifiée et corrigée :** la première séquence d'Hippolyte disait « on hash le pin et on compare au hash stocké ». **Bcrypt n'est pas déterministe** (sel aléatoire à chaque hash) → comparer deux hashes ne marchera jamais. Le geste correct est `bcrypt.compare(plainPin, storedHash)` qui **extrait le sel** du hash stocké, re-hash le `plainPin` avec ce même sel, puis compare. Point classique en sécurité que le jury peut tester.

### 3.3 — PIN en string et pas int (défendabilité)

Le PIN est traité en **string** de bout en bout. Le seed de dev inclut volontairement un PIN `"0307"` (compte cuisine) : si on le traitait en int, on perdrait le zéro de tête (`0307` → `307`). Le code matérialise donc concrètement la justification du type — **preuve par l'exemple, pas par argument**. Cohérent avec la posture « propriété vérifiable, pas vigilance ».

### 3.4 — Architecture des fichiers backend

Trois fichiers d'ossature créés, chacun avec une responsabilité claire :

- **`src/lib/prisma.js`** : **singleton Prisma**. Une seule instance partagée, un seul pool de connexions vers Postgres, une seule source de vérité pour la config client. Évite la saturation du pool Postgres en cas d'instances multiples (dev sous test parallèle = des dizaines de connexions sinon).
- **`src/app.js`** : exporte une instance Express configurée (middlewares, routes). **Ne fait aucun `listen`** → testable et composable.
- **`src/index.js`** : importe `app`, **vérifie les variables d'environnement critiques** (`JWT_SECRET`, `DATABASE_URL` → `process.exit(1)` si absent), puis `app.listen()`.

*Pourquoi la séparation `app.js` / `index.js` :* les tests d'intégration (Supertest) importent l'app et démarrent un serveur éphémère sur un port aléatoire pour la durée du test. Si `index.js` faisait à la fois le `listen` et l'export, on aurait des collisions de port et un serveur de dev qui squatte pendant les tests. **Choix de testabilité, défendable directement.**

### 3.5 — `JWT_SECRET` vérifié au démarrage (garantie structurelle)

Le check dans `index.js` (`if (!process.env[key]) { ... process.exit(1) }`) garantit qu'**un serveur qui tourne ⟹ le secret existe**. Sinon, beaucoup de libs JWT signent avec `undefined` sans broncher → tokens forgeables silencieusement. Le check au démarrage est la **propriété structurelle** qui rend ce risque impossible. Cohérent avec la chaîne méthodologique (vérifier par le système, pas se souvenir).

Posture identique à celle du mot de passe Postgres (Session 2) : pas de fallback magique sur une valeur faible — on échoue bruyamment plutôt que de tourner avec une faille silencieuse.

### 3.6 — Payload JWT minimal (sécurité par construction)

Le JWT est **signé, pas chiffré**. Son contenu est lisible par décodage base64. Règle figée : le payload contient **uniquement `userId` + `role`** — jamais le PIN, jamais le hash, jamais le `code_pin`, jamais quoi que ce soit de sensible. Décodage manuel en CLI vérifié en séance pour matérialiser la propriété (`echo "<payload-base64>" | base64 -d` → `{"userId":4,"role":"admin","iat":...,"exp":...}`).

**Vérification de la propriété de durée :** `exp - iat = 39600 = 11 × 3600`. Conforme strict au critère US-01 (11h).

### 3.7 — `userId` vs `id_utilisateur` (séparation des couches)

Question soulevée en séance : pourquoi ne pas mettre `id_utilisateur` (le nom de la colonne en base) dans le payload JWT ?

**Réponse défendable :** ce sont deux **concepts distincts qui portent la même valeur numérique** :
- `id_utilisateur` désigne la **clé primaire dans la table `Utilisateur`** (couche stockage).
- `userId` (dans `req.user`) désigne **l'identifiant de l'utilisateur authentifié sur la requête courante** (couche transverse HTTP).

Le nommage différencié explicite la couche dans laquelle on se trouve à la lecture du code. Même principe que la séparation `schema.prisma` (structure) / `prisma.config.ts` (runtime) en Session 2 : chaque préoccupation a son nom. Convention figée dans la checklist projet.

### 3.8 — `code` (API) vs `code_pin` (base) — séparation contrat / stockage

Confusion soulevée et clarifiée en séance : un curl envoyait `code_pin` au lieu de `code` dans le body → 400 « Code invalide » au lieu du 200 attendu. L'erreur a été un déclencheur de discussion défendable.

**Trois noms pour trois couches distinctes :**
- `seed.ts` → propriété locale `code` du tableau JS (peu importe, scope local).
- Body HTTP de `/api/auth/login` → champ `code` (contrat client/serveur, figé par US-01).
- Colonne Postgres → `code_pin` (nom physique du stockage, descriptif).

Le contrat HTTP n'est pas le nommage de stockage. Si le PIN devient un OTP ou un autre code plus tard, le contrat client reste stable.

### 3.9 — Choix ESM (cohérence stack)

`"type": "module"` ajouté à `package.json`. Imports avec extension `.js` (convention ESM stricte). Justification : alignement sur ce que `prisma.config.ts` utilisait déjà (TypeScript en mode module) ; standardisation ECMAScript ; éviter le mix CJS/ESM qui devient pénible dès qu'on grandit. **Choix conscient**, pas par défaut.

### 3.10 — Deuxième cassement Prisma 7 : driver adapter obligatoire

À l'instanciation de `new PrismaClient()` au runtime : `PrismaClientInitializationError: PrismaClient needs to be constructed with a non-empty, valid PrismaClientOptions`. Vérifié source officielle Prisma : <https://www.prisma.io/docs/orm/reference/prisma-config-reference>.

**Cause :** en Prisma 7, le moteur Rust embarqué (historique, par défaut en v6) n'est plus exposé sans configuration. Le nouveau moteur `client` exige explicitement **soit un driver adapter, soit une URL Accelerate** (offre payante Prisma Cloud).

**Fausse piste documentée pour honnêteté méthodologique :** Claude a proposé un champ `engine: "classic"` dans `prisma.config.ts`. **C'est faux en v7** — `engine: "classic"` était une option transitoire de Prisma 6.18, **supprimée à la sortie de v7**. TypeScript a rejeté le champ inconnu, ce qui a forcé la vérification source. Leçon : ne pas reprendre une suggestion non vérifiée.

**Décision :** adoption de `@prisma/adapter-pg` (driver adapter explicite basé sur la lib Node Postgres standard `pg`). Installé en `dependencies` (runtime). `src/lib/prisma.js` instancie l'adapter avec `process.env.DATABASE_URL` et le passe au constructeur de `PrismaClient`.

**Argument défendable :** la chaîne de connexion est **explicite à chaque couche** (`pg` pour le protocole Postgres, l'adapter pour l'interface Prisma, le client pour l'ORM). Plus défendable que « Prisma fait sa magie via un binaire Rust opaque ».

### 3.11 — Troisième cassement Prisma 7 : `--skip-seed` supprimé

À l'exécution du script de test (`prisma migrate reset --force --skip-seed`) : `unknown or unexpected option: --skip-seed`. Vérifié source officielle <https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7>.

**Cause :** en Prisma 7, l'auto-seeding pendant `migrate dev` / `migrate reset` a été **entièrement retiré**. Le flag `--skip-seed` n'a plus de raison d'être (il servait à désactiver un comportement automatique qui n'existe plus). Désormais, le seed se déclenche **uniquement explicitement** via `npx prisma db seed`.

**Bénéfice :** plus d'effet de bord caché. Le seed est une opération volontaire, jamais déclenchée par hasard via une commande de migration.

### 3.12 — Pattern Prisma 7 (formule défendable consolidée)

Quatre cassements documentés maintenant. Pattern transversal défendable :

> *« L'adoption de Prisma 7 m'a imposé d'expliciter quatre points de configuration qui étaient auparavant implicites — URL de connexion, instanciation du client, choix du moteur, déclenchement du seed. Cette explicitation correspond à mon principe transversal : un comportement qui n'est pas explicitement codé est un comportement qu'on ne peut pas garantir. »*

| # | Cassement | Session | Avant | Après |
|---|---|---|---|---|
| 1 | `url` dans schema.prisma | 2 | implicite, hardcodé | explicite dans `prisma.config.ts` |
| 2 | `new PrismaClient()` sans args | 3 | moteur Rust par défaut | driver adapter explicite |
| 3 | `engine: "classic"` (transitoire) | 3 | option intermédiaire 6.18 | supprimé, choix figé |
| 4 | `--skip-seed` flag | 3 | seed auto pendant migrations | seed = appel explicite |

### 3.13 — Seed idempotent et paramétrable

`prisma/seed.ts` créé avec :
- **4 utilisateurs**, un par rôle (`secretaire`, `cuisine`, `serveur`, `admin`) — critère explicite US-01.
- **`upsert`** sur la clé `login` → **idempotent**, rejouable à volonté sans collision sur la contrainte d'unicité. Même logique de rejouabilité que `migrate dev`.
- **`BCRYPT_ROUNDS` paramétrable** : `Number(process.env.BCRYPT_ROUNDS) || 12`. Défaut à 12 en dev/prod (valeur de sécurité). En test, abaissé à 4 (250× plus rapide) sans changer la valeur de production.
- **PINs distincts** entre comptes (1 zéro de tête sur l'un, pour matérialiser le besoin de string — voir 3.3).
- **`.finally(() => prisma.$disconnect())`** pour fermer proprement la connexion en sortie de script.

Posture identique au mot de passe Postgres (Session 2) : **PINs de dev = non-secrets assumés**, à régénérer en Phase 7 pour la prod.

Déclaration de la commande de seed dans **`prisma.config.ts`** (cohérent Prisma 7 : la config runtime vit là) : `migrations: { seed: "tsx prisma/seed.ts" }`.

### 3.14 — Anti-énumération validée formellement

Tous les 401 sont **strictement identiques** (même statut, même corps de réponse, même clé `error`). Trois cas couverts par le même message générique :
- User inexistant (`id_utilisateur` invalide).
- User désactivé (`actif === false`).
- User existant + mauvais PIN.

Un attaquant balayant des `id_utilisateur` ne peut **rien déduire** des réponses → la propriété est garantie par construction.

**Validée par test automatisé** (voir 3.16) : `expect(res.body).toEqual(expected401)` sur chaque cas → comparaison stricte, pas inspection humaine.

### 3.15 — Mécanique de test pérenne (décisions structurantes)

Quatre décisions verrouillées, qui s'appliqueront à toutes les US à venir :

1. **Framework : Vitest** (vs Jest mentionné dans le backlog initial). Justification : **ESM natif** sans flag `--experimental-vm-modules`, cohérence avec `"type": "module"`. **Écart documentaire vs backlog assumé**, à reporter en passe groupée sur le backlog ultérieurement.
2. **Base de test isolée : `tfe_test`**, même conteneur Postgres que `tfe`, créée manuellement une fois (`CREATE DATABASE tfe_test`). Isolation logique suffisante (les transactions sur une base ne touchent pas l'autre), moins d'infra qu'un second conteneur. Argument de simplicité justifié.
3. **Reset déterministe avant chaque suite : `prisma migrate reset --force`** dans le script `"test"`. Repart d'un état strictement identique à chaque `npm test`. Le seed n'est pas appliqué automatiquement (cf. 3.11) → c'est le `beforeAll` du test qui seedé les fixtures locales.
4. **Variables groupées dans `.env.test`** (chargé via `dotenv-cli`) : `DATABASE_URL` (pointe sur `tfe_test`), `BCRYPT_ROUNDS=4`, `JWT_SECRET` fixe distinct de la prod. Le fichier est **gitignoré par convention** (même garantie structurelle que `.env`, Session 2). Script `package.json` : `"test": "dotenv -e .env.test -- bash -c 'npx prisma migrate reset --force && vitest run'"`.

### 3.16 — Suite de tests `auth.test.js` (6 tests, US-01 Done)

Localisation : `src/routes/__tests__/auth.test.js` (convention `__tests__/` à côté de ce qu'on teste).

Structure :
- `beforeAll` crée **un seul utilisateur de test** (`test_actif_admin`, PIN `"0042"`) — login distinctif, sans collision avec les comptes seedés.
- `afterAll` fait `prisma.$disconnect()` pour fermer proprement.
- Constante `expected401 = { error: "Identifiants incorrects" }` au scope `describe` → **chaque test reste autonome**, plus de dépendance d'ordre.

Les 6 tests :

| # | Test | Vérifie |
|---|---|---|
| 1 | 200 OK + JWT signé | statut, présence/type du token, `verify`, `userId`, `role`, durée exacte (`exp - iat = 11 × 3600`) |
| 2 | 401 user inexistant | statut + corps identique à `expected401` |
| 3 | 401 user existant + mauvais PIN | statut + corps identique à `expected401` (anti-énumération formelle) |
| 4 | 400 code trop court (`"42"`) | statut + message `"Code invalide"` |
| 5 | 400 code non numérique (`"abcd"`) | statut + message `"Code invalide"` |
| 6 | 400 code absent du body | statut + message `"Code invalide"` |

**Points méthodologiques validés :**
- **`jwt.verify` et pas `jwt.decode`** : `verify` recalcule la signature → teste l'authentification de bout en bout (et pas seulement la sérialisation). Si la signature est cassée, le test rouge.
- **PIN `"0042"`** : matérialise la propriété « string préservée » (voir 3.3).
- **Un test = un comportement, pas une assertion** : le test 1 valide *toutes* les propriétés du chemin nominal (statut + body + token + payload + durée) en un seul `it()`. Plusieurs `expect()` cohérents entre eux décrivent un seul comportement.
- **Ordre des assertions du général au particulier** : statut → présence du champ → décodage → contenu du payload. Diagnostic plus rapide en cas de rouge.
- **Durée 412 ms pour 6 tests** : la décision « BCRYPT_ROUNDS paramétrable » paie déjà — à coût 12, le `beforeAll` aurait ajouté ~250 ms.

---

## Concepts compris / à consolider

**Compris :**
- bcrypt non déterministe et fonctionnement de `compare` (sel embarqué dans le hash stocké).
- `_prisma_migrations` : journal des migrations + checksum (pas état structurel).
- Séparation des couches dans le nommage (`userId` vs `id_utilisateur`, `code` vs `code_pin`).
- Pattern singleton pour le client Prisma.
- Séparation `app.js` (export) / `index.js` (listen) pour la testabilité.
- Anti-énumération par identité stricte des réponses, validable par test automatisé.
- Pattern Prisma 7 « explicite > implicite » consolidé en 4 cassements.
- Setup Vitest + Supertest + `.env.test` + `dotenv-cli` + base de test isolée.

**À consolider :**
- Discipline « un changement, une validation » : trahie une fois (refactor du test + bascule `.env.test` faits simultanément). Pas grave ici car ça a marché, mais à appliquer strictement quand ça commencera à coûter.
- Vigilance sur les suggestions Claude **vérifier en source** avant d'appliquer (cf. fausse piste `engine: "classic"` au point 3.10).

---

## Points à mentionner dans le rapport TFE (choix justifiés issus de la session)

- **Authentification PIN** : architecture (validation → findUnique → bcrypt.compare → JWT), bcrypt coût 12 (paramétrable), JWT 11h avec payload minimal (`userId`, `role`).
- **Anti-énumération** : 401 strictement identiques, validés par test automatisé `toEqual(expected401)`.
- **Garantie structurelle au démarrage** : `JWT_SECRET` et `DATABASE_URL` vérifiés ; `process.exit(1)` sinon. Pas de fallback magique.
- **Architecture backend** : singleton Prisma (`lib/prisma.js`), séparation `app.js` / `index.js` pour testabilité, driver adapter explicite (`@prisma/adapter-pg`).
- **ESM natif** assumé (`"type": "module"`, imports `.js` explicites) — alignement sur stack moderne.
- **Pattern Prisma 7** : explicitation systématique des comportements implicites (URL, client, engine, seed).
- **Méthodologie de test** : Vitest (ESM natif, écart Jest documenté), base `tfe_test` isolée, `migrate reset --force` déterministe, `BCRYPT_ROUNDS` paramétrable en test, `.env.test` groupé via `dotenv-cli`.
- **Idempotence du seed** (upsert) + posture non-secret de dev assumé sur les PINs.

---

## Exigences EPHEC progressées

- **Tests unitaires / d'intégration** : Vitest + Supertest configurés, suite `auth.test.js` (6 tests verts) couvrant US-01.
- **Analyse de sécurité** : anti-énumération validée formellement ; hashing bcrypt 12 ; JWT minimal et durée bornée ; secret vérifié au démarrage.
- **Versioning Git** : 2 commits supplémentaires significatifs ce jour (`feat(auth): structure et US-01 en cours`, puis `feat(auth): finalisation US-01`). Convention Conventional Commits respectée.
- **Documentation du code** : commentaires localisés dans `app.js`, `index.js`, `auth.js`.
- **Procédure de déploiement** : préparée par la séparation app/server et l'externalisation des secrets en env.

---

## État des fonctionnalités / routes

- ✅ **POST `/api/auth/login`** — US-01 Done, 6 tests d'intégration verts.
- ⬜ **GET `/api/auth/prenoms`** — US-02 (liste publique des prénoms pour login) — non commencée.
- ⬜ **Middleware JWT + RBAC** — US-03 (prérequis pour toutes les routes protégées de Phase 2) — non commencé.

---

## Blocages rencontrés et résolution

1. **`new PrismaClient()` sans arguments → `PrismaClientInitializationError` en Prisma 7.** Le moteur par défaut n'est plus exposé → adoption de `@prisma/adapter-pg` (driver adapter explicite). Vérifié en doc officielle.
2. **Suggestion `engine: "classic"` rejetée par TypeScript.** L'option était transitoire en Prisma 6.18, supprimée en v7. Fausse piste documentée pour honnêteté méthodologique ; vérification source impérative avant d'appliquer.
3. **`--skip-seed` flag inconnu** sur `prisma migrate reset --force`. Retiré en v7 (auto-seeding supprimé). Flag retiré du script.
4. **Curl test envoyait `code_pin` au lieu de `code`** → 400 inattendu. A déclenché la clarification API/base (cf. 3.8).

---

## Ce qui reste à faire — prochaine session

1. **US-02 — Liste publique des prénoms** (`GET /api/auth/prenoms`) — route publique, pas de middleware, tests d'intégration à écrire au fil de l'eau.
2. **US-03 — Middleware JWT + RBAC** (`requireAuth`, `requireRole`) — prérequis pour Phase 2. Tests d'intégration.
3. **Hérité S1 / S2 — figures du rapport** (EA + relationnel + UML classes) à aligner sur le schéma verrouillé. Reste différé tant que Phase 1 n'est pas close.
4. **Mise à jour du backlog** (passe groupée) : aligner mention Jest → Vitest, et tout reformulé impacté par les choix de la session 3.

---

## Structure du dépôt

```
TFE - AOUT 2026/
├── .git/
├── .gitignore
├── README.md
├── backend/
│   ├── compose.yaml
│   ├── package.json                 ← MODIFIÉ ("type":"module" ; scripts dev/start/test ;
│   │                                          deps express, bcrypt, jsonwebtoken, pg, adapter-pg ;
│   │                                          devDeps vitest, supertest, tsx, dotenv-cli, nodemon)
│   ├── package-lock.json            ← MODIFIÉ
│   ├── prisma.config.ts             ← MODIFIÉ (déclaration de la commande de seed)
│   ├── .env                         (gitignoré ; ajoute JWT_SECRET et PORT)
│   ├── .env.test                    ← NOUVEAU (gitignoré ; DATABASE_URL→tfe_test, BCRYPT_ROUNDS=4, JWT_SECRET)
│   ├── node_modules/                (gitignoré)
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.ts                  ← NOUVEAU (4 users, upsert idempotent, BCRYPT_ROUNDS env-driven)
│   │   └── migrations/
│   │       └── <timestamp>_init/
│   └── src/                         ← NOUVEAU (racine du code applicatif)
│       ├── app.js                   ← NOUVEAU (export de l'app Express configurée)
│       ├── index.js                 ← NOUVEAU (check env vars + listen)
│       ├── lib/
│       │   └── prisma.js            ← NOUVEAU (singleton Prisma + adapter pg)
│       └── routes/
│           ├── auth.js              ← NOUVEAU (POST /api/auth/login)
│           └── __tests__/
│               └── auth.test.js     ← NOUVEAU (6 tests d'intégration Vitest)
└── frontend/
```

---

## Instructions pour reprendre (Session 4)

- **Contexte :** Phase 1 entamée, US-01 **Done** (route + JWT + 6 tests verts). Reste US-02 et US-03 pour clore Phase 1.
- **Rappels :**
  - Stack Prisma **7** : config dans `prisma.config.ts`, driver adapter (`@prisma/adapter-pg`) explicite. Aucun automatisme implicite.
  - Postgres sur **`localhost:5433`**. Bases : `tfe` (dev) et `tfe_test` (test).
  - Mécanique de test : `npm test` lance `dotenv -e .env.test` → `prisma migrate reset --force` → `vitest run`.
  - Conventions de nommage : payload JWT = `userId` (pas `id_utilisateur`) ; contrat HTTP = `code` (pas `code_pin`) ; middlewares pluriels = `middlewares/`.
  - Posture : socratique, mentor exigeant. Vérifier toute suggestion non triviale en source avant d'appliquer.
- **Commandes de relance :**
  ```bash
  cd backend
  docker compose up -d
  docker compose ps        # attendre "healthy"
  npm run dev              # serveur sur :3000
  ```
- **Vérification rapide :**
  ```bash
  # Auth fonctionne end-to-end
  curl -i -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"id_utilisateur": 4, "code": "2911"}'
  # → 200 + {"token":"..."}

  # Suite de tests US-01 verte
  npm test
  # → 6 tests passed
  ```

---

*Rapport mis à jour le 12 juin 2026 — Session 3*
