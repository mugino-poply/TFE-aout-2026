# Session 4 — Le Cénacle (TFE)

- **Auteur :** Hippolyte AMORY
- **Date :** 17 juin 2026
- **Échéances :** remise du rapport le 17 août 2026 ; livraison du produit dans les deux semaines suivantes (date de défense non encore fixée).
- **Objet de la session :** **Phase 1 — suite** : livrer **US-02 (liste publique des utilisateurs pour l'étape 1 du login)** en adoptant le cycle **TDD Red-Green-Refactor** pour la première fois du projet. Cycle complet sur deux comportements (happy path + filtre `actif`).

---

## Contexte et état de départ

Phase 1 entamée en Session 3 :
- US-01 livrée (route `POST /api/auth/login`, bcrypt, JWT, anti-énumération, 6 tests verts).
- Mécanique de test pérenne posée (Vitest + Supertest + base `tfe_test` isolée + `.env.test` via `dotenv-cli`).
- US-02 et US-03 identifiées comme reliquats de Phase 1.

Reliquats Sessions 1-2 (alignement des figures du rapport sur le schéma verrouillé) : **toujours différés**.

Objectif de la session : clôturer US-02 — route publique servant l'étape 1 du flow login (sélection du prénom). Surface très réduite (une seule route, projection + filtre), terrain idéal pour expérimenter TDD sans plomberie.

---

## Ce qui a été travaillé

### 4.1 — Cadrage de US-02 (avant code)

Quatre questions de fond traitées avant la première ligne, pour figer un contrat défendable au jury :

**Nom de la route.** Divergence détectée entre `session_3.md` (`GET /api/auth/prenoms`) et `backlog_user_stories.md` (`GET /api/auth/utilisateurs`). Tranchée vers **`GET /api/users`** (route par ressource exposée). Justification : (a) la route renvoie des **objets** (`{id_utilisateur, prenom, role}`) — `prenoms` mentirait sur la nature du payload ; (b) convention REST standard (nommer d'après la ressource, pas d'après un champ projeté) ; (c) ouvre proprement la voie au CRUD utilisateurs admin futur.

**Caractère public (pas de JWT).** Modèle de menace écarté : attaquant externe Internet, neutralisé par le périmètre **WireGuard**. Risque résiduel accepté : un utilisateur VPN légitime peut énumérer prénoms + rôles de l'équipe — jugé proportionné à la sensibilité réelle (collègues qui se connaissent professionnellement). Défense en profondeur si le périmètre tombe : **bcrypt sur le PIN + RBAC** (US-03). À reformuler en registre soutenu pour l'oral.

**Quels champs renvoyer (minimisation).** Strict nécessaire pour le frontend étape 1 : `id_utilisateur` (envoyé à `POST /api/auth/login` étape 2), `prenom` (affichage), `role` (discriminant en cas de prénoms identiques + maquette). Tout le reste exclu (`login`, `code_pin`, `actif`, dates, mail, etc.) — ce qui n'a pas d'usage UI direct sur l'écran de login dégage.

**Filtre `actif: true` côté serveur (jamais côté client).** Filtrer côté frontend équivaut à envoyer la liste complète au client. Un `curl` ou les devtools révèleraient les comptes désactivés (anciens employés). Le serveur ne fait jamais confiance au client.

### 4.2 — Choix d'organisation : `routes/users.js` (par ressource) + URL `/api/users`

Décision : créer **`src/routes/users.js`** plutôt qu'ajouter la route dans `auth.js`. Le test « par cas d'usage » (route servant le login → dans `auth.js`) a été examiné et écarté au profit du test « par ressource exposée » (route exposant la collection users → dans `users.js`). Argument retenu : cohérence avec un éventuel CRUD utilisateurs futur, et symétrie entre chemin de fichier et préfixe URL (`routes/users.js` ↔ `/api/users`).

**Anticipation notée :** un futur `GET /api/users` pour l'admin aura besoin d'un payload complet (login, actif, dates). Deux options à trancher au moment où ce besoin émergera : route séparée (`/api/admin/users`) ou même route avec payload qui dépend du rôle JWT. Pas à arbitrer maintenant ; à garder en tête.

### 4.3 — Adoption du TDD (premier cycle vécu)

Première utilisation du cycle **Red → Green → Refactor** dans le projet. Discipline posée : à chaque étape, **minimum**. Le test ne couvre que ce qu'il assertit ; le code ne fait que ce que le test exige.

Bénéfice défense : Hippolyte pourra dire au jury avoir expérimenté code-first (US-01, S3) et TDD (US-02, S4) sur des US comparables, et **justifier le choix de l'une ou l'autre selon le contexte**. C'est un recul méthodologique réel, pas une posture.

### 4.4 — Architecture de tests : seed minimal + fixtures locales (option C)

Décision structurante du projet, à étendre aux suites futures.

**Trois options examinées :**
- (A) Tout via le seed → DRY mais couplage fort entre suites et contenu du seed.
- (B) Aucun seed, fixtures 100% locales (pattern `auth.test.js` actuel) → isolation maximale mais duplication.
- (C) **Hybride** : seed = socle universel (un utilisateur par rôle, scénarios « normaux »). Particularités spécifiques (utilisateur inactif, contraintes inhabituelles) → créées localement dans la suite qui en a besoin.

**Choix : (C).** Cohérent avec l'intention de S4 d'avoir des tests **découplés du seed** dans leur assertion (cf. happy path en `length > 0` plutôt que `length === 4`), tout en évitant la duplication systématique. Règle de discipline : *le seed contient le minimum universel ; les particularités vivent dans la suite qui les exige.*

### 4.5 — Cycle TDD 1 : happy path (forme du payload)

**Red.** Test écrit dans `src/routes/__tests__/users.test.js`. Quatre assertions : (1) status 200, (2) body est un tableau, (3) `length > 0`, (4) **clés exactement** `{id_utilisateur, prenom, role}` (égalité stricte, pas inclusion).

L'égalité stricte choisie sur les clés joue **double rôle** : elle décrit la forme attendue **et** elle protège contre toute fuite future (si Prisma renvoyait `code_pin` par accident, l'égalité casserait). C'est la même garantie que `select`, vérifiée au niveau du contrat HTTP.

Première itération de test rejetée (🚩 levé) : Hippolyte avait introduit un `beforeAll` créant un user — ce qui dédoublait l'alimentation (seed global + setup local) et créait une collision d'ID avec le seed. Corrigé : retour à un test minimaliste qui repose sur le seed.

Sortie Red : **404** (route inexistante).

**Green.** Route créée : `findMany` avec `select` projetant exactement les trois champs voulus, et `app.use("/api/users", usersRouter)` dans `app.js`.

**Pourquoi `select` plutôt qu'un filtre JS post-requête (point central pour la défense) :** la projection au niveau **Prisma** déplace la frontière de confiance vers la source. Sans `select`, la donnée sensible (`code_pin`, `login`, `actif`) existe à chaque étape de la chaîne `DB → réseau → mémoire Node → sérialisation → HTTP` — chaque étape étant un point de fuite potentiel (crash dump, log accidentel, vulnérabilité de sérialisation). Avec `select`, la donnée sensible **n'a jamais existé** dans le processus applicatif. **Garantie système, pas vigilance humaine** — exactement le principe directeur du projet.

Sortie Green attendue : tableau de 4 users. Sortie réelle : **tableau vide → assertion `length > 0` échoue**. Le test est passé du 404 à un 200 incorrect — révèle un autre problème.

### 4.6 — Découverte du breaking change Prisma 7 sur `db seed`

Diagnostic par hypothèses : (a) seed non exécuté, (b) seed sur mauvaise base, (c) seed silencieusement en échec. La piste (a) confirmée :

- Le script `npm test` actuel : `dotenv -e .env.test -- bash -c 'npx prisma migrate reset --force && vitest run'`. Aucune commande de seed.
- `auth.test.js` (US-01) ne dépendait pas du seed — il créait ses propres fixtures localement. C'est ce qui a masqué le problème jusqu'ici.
- **Prisma 7 a supprimé le déclenchement automatique de `db seed` par `migrate reset`** (cf. retrait du flag `--skip-seed` documenté en S3 — même breaking change, autre facette : le comportement par défaut a été inversé).

**Histoire à porter en défense :** un breaking change silencieux de Prisma 7 a rendu le seed inerte sans qu'aucun test ne casse, parce que les tests US-01 étaient autonomes. **C'est l'écriture du premier test qui en dépendait (US-02 happy path) qui a révélé le trou.** Argument structurel pour TDD : un test bien posé révèle des défauts invisibles par inspection.

**Correctif :** ajout explicite de `npx prisma db seed` dans le script `test`, chaîné en `&&` pour que le pipeline échoue net si le seed plante.

**Résultat :** test happy path **vert**, et les 6 tests US-01 restent verts (pas de régression — confirmation que les fixtures locales d'`auth.test.js` ne conflictent pas avec le seed).

### 4.7 — Cycle TDD 2 : filtre `actif: true`

**Red.** Nouveau bloc `it` dans la même suite, avec `beforeAll` local créant un utilisateur inactif (`actif: false`, ID 5). Assertion : `expect(res.body.map(u => u.id_utilisateur)).not.toContain(5)`.

L'assertion **par ID** plutôt que par recherche d'objet entier rend le test diagnostique : à l'échec, la sortie Vitest affiche la liste exacte des IDs renvoyés (`expected [ 1, 2, 3, 4, 5, 6 ] to not include 5`) — lecture immédiate de ce qui ne va pas.

Sortie Red : tableau `[1,2,3,4,5,6]` (l'utilisateur 5 est renvoyé → la route ne filtre pas).

**Choix de cleanup assumé.** Pas de `afterAll`. Décision formulée : *« je ne duplique pas un cleanup tant qu'aucune interférence n'est constatée »* (la base est reset entre `npm test` consécutifs ; à l'intérieur d'un run, les autres suites ne sont pas affectées par un user inactif supplémentaire). Position à requalifier si une interférence apparaît plus tard.

**Green.** Ajout de `where: { actif: true }` au `findMany`.

**Pourquoi `actif: true` plutôt que `actif: { not: false }` (formulation choisie consciemment) :** à comportement identique sur un booléen non-nullable, la formulation directe (a) **exprime l'intention métier** sans détour par double négation, et (b) **reste robuste si le schéma évolue** vers un champ nullable — `actif: true` continuerait de filtrer correctement (rejette `null`), `not: false` laisserait passer les `null`. Argument à ressortir au jury.

**Résultat :** test vert. **8 tests verts au total** (6 US-01 + 2 US-02).

### 4.8 — Vérification terrain (curl)

```
curl http://localhost:3000/api/users
[{"id_utilisateur":1,"prenom":"Olivia","role":"secretaire"},
 {"id_utilisateur":2,"prenom":"Lionel","role":"cuisine"},
 {"id_utilisateur":3,"prenom":"Diego","role":"serveur"},
 {"id_utilisateur":4,"prenom":"Hippolyte","role":"admin"}]
```

Quatre users actifs, projection respectée, pas de `code_pin`, pas de `login`, pas de `actif`. La garantie système (la donnée sensible n'a jamais existé dans le processus Node) est **observable au niveau HTTP**. Curl conservé comme artefact de défense.

---

## Concepts compris / à consolider

**Compris :**
- Le **cycle TDD** Red → Green → Refactor, avec sa discipline du **minimum** à chaque étape (le test ne couvre que ce qu'il assertit ; le code ne fait que ce que le test exige).
- La **différence entre projection serveur et filtrage applicatif** comme question de **frontière de confiance** : `select` Prisma = garantie système ; tri JS post-requête = vigilance humaine.
- La **différence entre une route publique « par construction » (rien ne la protège) et « par contrat » (intentionnellement publique)** : le test happy path *protège* le caractère public par effet de bord (un middleware d'auth global ajouté plus tard ferait casser le 200), même si ce n'est pas son intention déclarée.
- Le pattern **« propriété vérifiable par le système, pas vigilance humaine »** s'applique aux tests comme à la sécurité : un test bien posé révèle des défauts invisibles à l'inspection (cf. découverte du breaking change `db seed`).

**À consolider :**
- L'ordre des `app.use` dans Express et son couplage avec les middlewares à venir (US-03) — aujourd'hui cosmétique, demain structurant pour la frontière publique/protégée.
- L'**architecture de tests « seed minimal + fixtures locales »** : à transformer en réflexe pour les prochaines US (toujours se demander : ce besoin est-il universel ou spécifique à cette suite ?).
- L'écriture d'**assertions qui résistent à l'évolution** (ex. égalité stricte sur les clés plutôt que sur le contenu) — un test fragile est un coût caché.

---

## Points à mentionner dans le rapport TFE

Sept décisions documentables pour US-02 (à intégrer dans les sections analyse, sécurité, qualité) :

1. **Route nommée par ressource exposée** (`/api/users`) plutôt que par cas d'usage (`/api/auth/utilisateurs`) — convention REST + ouverture vers un CRUD admin futur.
2. **Caractère public assumé** : modèle de menace WireGuard + risques résiduels jugés proportionnés + défense en profondeur (bcrypt + RBAC).
3. **Minimisation par `select` Prisma** : garantie système (la donnée sensible n'est jamais chargée), pas une promesse comportementale du code.
4. **Filtre `actif: true` côté serveur** : le serveur ne fait jamais confiance au client.
5. **Formulation `actif: true`** (intention métier explicite) plutôt que `not: false` (mécanique par double négation), plus robuste à une évolution du schéma vers un champ nullable.
6. **Adoption du TDD** pour cette US : recul méthodologique (code-first sur US-01 vs TDD sur US-02, choix justifiable par contexte).
7. **Architecture de tests « seed minimal + fixtures locales »** : décision structurante à étendre aux suites futures.

Plus une **anecdote méthodologique défendable** : le breaking change Prisma 7 sur `db seed` est resté invisible jusqu'à ce qu'un test l'exige. Démontre la valeur du TDD comme révélateur d'angles morts.

---

## Exigences EPHEC couvertes (progression)

- **Tests unitaires / d'intégration** : suite `users.test.js` US-02 (2 tests verts). Mécanique de test consolidée (seed désormais inclus au pipeline).
- **Analyse de sécurité** : argumentation route publique formalisée (asset = liste prénoms+rôles, risque = énumération, mesure = WireGuard + défense en profondeur, résiduel = accepté). Minimisation des données documentée comme garantie système.
- **Versioning Git** : commits en discipline TDD (Red → Green séparés idéalement).
- **Schémas techniques** : sans changement (figures du rapport toujours à aligner).

---

## État des fonctionnalités / routes

- ✅ **POST `/api/auth/login`** — US-01 Done, 6 tests verts.
- ✅ **GET `/api/users`** — US-02 Done, 2 tests verts (happy path + filtre `actif`).
- ⬜ **Middleware JWT + RBAC** — US-03 non commencé.

---

## Blocages rencontrés et résolution

1. **Test happy path renvoie un tableau vide (200 mais `length === 0`).** Diagnostic par hypothèses successives → confirmation que `migrate reset` Prisma 7 ne déclenche plus le seed automatiquement. Correctif : `npx prisma db seed` ajouté explicitement au script `test`. Histoire à porter en défense (TDD a révélé un trou silencieux).
2. **Première version du test introduisait un setup local redondant** (🚩 levé : double alimentation seed global + `beforeAll` local créant l'user 42, collision d'ID). Test simplifié pour reposer uniquement sur le seed — cohérent avec l'intention de l'option C.

---

## Ce qui reste à faire — prochaine session

1. **Commits US-02** : trois commits ciblés à pousser pour rester propre — (a) `feat(api): GET /api/users` (route + branchement `app.use`), (b) `chore(test): exécute prisma db seed dans le pipeline test` (breaking change Prisma 7 explicité dans le message), (c) `feat(api): filtre les utilisateurs inactifs` (TDD red→green sur `actif`).
2. **US-03 — Middleware JWT + RBAC** (`requireAuth`, `requireRole`). Prérequis pour toutes les routes protégées de Phase 2. À traiter en TDD aussi. Attention : devra **préserver le caractère public** de `/api/users` et `/api/auth/login` (test de non-régression à écrire).
3. **Hérité S1 / S2 — figures du rapport** (EA + relationnel + UML classes) à aligner sur le schéma verrouillé. Reste différé tant que Phase 1 n'est pas close.
4. **Mise à jour du backlog** (passe groupée) : aligner sur les choix de S3-S4 (Vitest, nom de route `/api/users`, architecture de tests option C).

---

## Structure du dépôt

```
TFE - AOUT 2026/
├── .git/
├── .gitignore
├── README.md
├── backend/
│   ├── compose.yaml
│   ├── package.json                 ← MODIFIÉ (script test : ajout de `npx prisma db seed`)
│   ├── package-lock.json
│   ├── prisma.config.ts
│   ├── .env                         (gitignoré)
│   ├── .env.test                    (gitignoré)
│   ├── node_modules/                (gitignoré)
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.ts
│   │   └── migrations/
│   │       └── <timestamp>_init/
│   └── src/
│       ├── app.js                   ← MODIFIÉ (mount du routeur users)
│       ├── index.js
│       ├── lib/
│       │   └── prisma.js
│       └── routes/
│           ├── auth.js
│           ├── users.js             ← NOUVEAU (GET /api/users, projection select, filtre actif)
│           └── __tests__/
│               ├── auth.test.js
│               └── users.test.js    ← NOUVEAU (2 tests : happy path + filtre actif)
└── frontend/
```

---

## Instructions pour reprendre (Session 5)

- **Contexte :** Phase 1 quasi-close. US-01 + US-02 livrées avec 8 tests verts. Reste US-03 (middleware JWT + RBAC) pour clore la Phase 1.
- **Rappels :**
  - Pipeline de test : `dotenv -e .env.test -- bash -c 'npx prisma migrate reset --force && npx prisma db seed && vitest run'`. Le seed est **explicite** depuis Session 4 (Prisma 7 ne le déclenche plus automatiquement).
  - Architecture de tests : **seed = minimum universel ; particularités = `beforeAll` local**. Continuer à l'appliquer.
  - Posture TDD : Red → Green → Refactor, discipline du minimum à chaque étape.
  - Conventions S3 toujours valides : payload JWT = `userId` (pas `id_utilisateur`) ; middlewares pluriels `middlewares/` ; contrat HTTP `code` (pas `code_pin`).
  - **Préserver le caractère public** de `/api/users` et `/api/auth/login` quand le middleware d'auth global sera posé — écrire un test de non-régression dans `users.test.js` ou `auth.test.js`.
- **Commandes de relance :** `cd backend && docker compose up -d` puis `npm test` (doit passer 8 tests verts en ~1s). `npm run dev` pour le serveur sur :3000.
- **Vérification rapide :** `curl http://localhost:3000/api/users` doit renvoyer 4 users actifs avec exactement `id_utilisateur`, `prenom`, `role`.

---

*Rapport mis à jour le 17 juin 2026 — Session 4*
