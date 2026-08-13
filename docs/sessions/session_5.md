# Session 5 — Le Cénacle (TFE)

- **Auteur :** Hippolyte AMORY
- **Dates :** 24 juin 2026 (cadrage) + 22 juillet 2026 (livraison partielle)
- **Échéances :** remise du rapport le 17 août 2026 ; livraison du produit dans les deux semaines suivantes (date de défense non encore fixée).
- **Objet de la session :** **Phase 1 — clôture partielle** : cadrage complet d'**US-03 (middleware JWT + RBAC)** puis livraison en TDD du premier des deux middlewares (`authenticateToken`), couvrant 5 comportements (4 cas d'échec + 1 cas nominal). `requireRole` et le test de non-régression restent à faire.

---

## Contexte et état de départ

Session étalée sur deux journées séparées par ~1 mois de pause. Nature justifiée :

- **24 juin (partie A — cadrage)** : session dédiée au cadrage avant code. Aucune ligne de production écrite ce jour-là, mais un premier test Red posé et poussé en fin de journée. Fin de session non prononcée → pas de `session_5.md` généré à l'époque.
- **22 juillet (partie B — livraison)** : reprise après pause. Validation à froid du cadrage (test mémoriel) puis exécution du TDD sur `authenticateToken`.

**État au démarrage de la partie A (24 juin) :**
- US-01 + US-02 livrées, 8 tests verts.
- Pipeline `dotenv -e .env.test -- bash -c 'migrate reset --force && db seed && vitest run'` stable.
- Architecture de tests « seed minimal + fixtures locales » adoptée.

**État au démarrage de la partie B (22 juillet) :**
- Un commit poussé le 24 juin : `test(middlewares): cas 401 sur route protégée sans header Authorization` (test Red isolé, aucun code de production).
- `src/middlewares/auth.js` existant avec un squelette `export function authenticateToken(req, res, next) { next() }`.
- 8 tests verts + 1 test rouge en attente (le test posé le 24 juin).

---

## Ce qui a été travaillé

### 5.1 — Cadrage d'US-03 (24 juin, avant code)

Six décisions prises et justifiées avant d'écrire quoi que ce soit.

**Deux middlewares séparés, pas un middleware fusionné.** `authenticateToken` (authentification — *qui es-tu ?*) et `requireRole` (autorisation — *as-tu le droit ?*) sont deux fonctions distinctes. Un `requireRoleAuth(role)` unique aurait été moins de code, mais aurait sacrifié trois propriétés : (a) **réutilisabilité** — certaines routes exigent l'identification sans restriction de rôle (ex. `GET /api/commandes?date=` accessible aux 4 rôles selon la matrice RBAC du rapport §9.3.2) ; (b) **composabilité** — l'écriture `app.get('/route', authenticateToken, requireRole(['secretaire']), handler)` permet d'empiler ou de retirer l'autorisation route par route sans dupliquer la vérification JWT ; (c) **testabilité séparée** — pouvoir vérifier isolément « je sais qui tu es » et « tu as le droit ».

**Contrat exact d'`authenticateToken`.** Lit `req.headers.authorization`. Sur succès : peuple `req.user = { userId, role }` et appelle `next()`. Sur échec (header absent, malformé, token invalide de signature, expiré) : renvoie **401** avec `{ error: "Token invalide" }` et **n'appelle pas `next()`**. La non-invocation de `next()` sur échec n'est pas un détail cosmétique : le handler downstream s'exécute côté serveur quelle que soit la réponse HTTP finale — laisser passer, c'est risquer de déclencher de la logique métier sous une identité non vérifiée, indépendamment de ce que le frontend affichera.

**Contrat exact de `requireRole`.** Factory function : `requireRole(rolesAutorises)` retourne un middleware `(req, res, next)`. Sur `req.user` absent : **401** (le vrai gardien est en amont, on ne devrait jamais arriver ici — mais on vérifie défensivement). Sur `req.user.role` hors liste : **403**. Sur rôle valide : `next()`.

**401 vs 403 — pourquoi ce n'est pas interchangeable.** 401 = « identité inconnue » (se ré-authentifier peut aider). 403 = « identité connue, accès refusé » (se ré-authentifier ne changera rien). Distinction sémantique importante pour le frontend (réponse à un 401 → renvoyer au login ; réponse à un 403 → afficher un message d'erreur), et exigence de conformité HTTP.

**Uniformité du corps d'erreur `{ error: "Token invalide" }` sur tous les 401.** Justification distincte de l'anti-énumération de S3 (qui protégeait le login). Ici, deux motifs : (a) **cohérence d'API** — un seul contrat pour tous les échecs d'auth simplifie le client ; (b) **non-divulgation de l'état du token** — distinguer « expiré » de « signature invalide » de « malformé » donne à un attaquant un signal sur ce qui a été essayé (utile pour affiner une attaque par brute force ou par réutilisation de token). Point à défendre : ce n'est pas de l'anti-énumération au sens de S3, mais c'est la même famille de raisonnement (limiter les canaux d'information latéraux).

**Stratégie de test : intégration Supertest, pas d'unit tests.** Route de test dédiée `/protected` dans le describe, montée avec les middlewares réels. Argument : la propriété critique à vérifier n'est pas le comportement d'une fonction isolée mais son insertion correcte dans une chaîne de middlewares Express. Un unit test sur `authenticateToken(req, res, next)` avec un `req` mocké testerait un contrat que le vrai Express pourrait par ailleurs violer (ex. ordre des middlewares, format effectif du header, comportement de `res.status().json()` réel). Le test d'intégration couvre la chaîne complète — c'est le seul niveau où la garantie tient.

**Collision de nommage `routes/auth.js` vs `middlewares/auth.js` — assumée.** Convention Express standard : la structure en couches (`routes/` et `middlewares/`) désambiguïse les deux fichiers. `routes/auth.js` expose `POST /api/auth/login` ; `middlewares/auth.js` expose `authenticateToken` (et bientôt `requireRole`). Pas d'ambiguïté à l'import — `../middlewares/auth.js` vs `./routes/auth.js`.

**Premier Red posé et poussé en fin de journée A** (`test(middlewares): cas 401 sur route protégée sans header Authorization`). Aucune ligne de code de production ce jour-là.

### 5.2 — Reprise après pause : validation à froid du cadrage (22 juillet)

Vérification que le cadrage de la partie A tenait après un mois : reformulation à froid de trois points clés — justification des deux middlewares séparés (avec exemples concrets sourcés dans la matrice RBAC), pourquoi `authenticateToken` doit précéder `requireRole` dans la chaîne (`req.user` peuplé par le premier, lu par le second), et diagnostic précis de ce qui se passe si l'ordre est inversé (`req.user` undefined → `req.user.role` throw → 500 non catché plutôt qu'un 401/403 propre).

**Épisode instructif de la reprise :** premier exemple donné pour justifier la réutilisabilité (« `GET /api/menus` accessible à tous les logués ») s'est révélé non conforme au rapport après vérification dans la matrice RBAC (§9.3.2) : `POST /api/menus` y est listé comme réservé à *secrétaire, cuisine, admin*, sans le serveur. 🚩 levé et redirigé vers `GET /api/commandes?date=` qui, lui, est bien listé pour les 4 rôles. **Leçon : ne jamais valider un exemple sans le sourcer dans le rapport ou le backlog.** La règle « pas de suppositions » a permis d'éviter de bâtir la défense sur un cas fictif. À porter dans le rapport comme illustration de la discipline de vérification.

### 5.3 — Cycle TDD 1 : 401 si pas de header Authorization

Test écrit et poussé le 24 juin. Repris le 22 juillet.

Assertion : `expect(res.status).toBe(401)` + `expect(res.body).toEqual({ error: "Token invalide" })`. Constante `expected401` extraite dans le describe pour être réutilisée sur les cas 401 suivants (pattern hérité de S3, garant d'uniformité).

**Green minimal :** simple garde `if (!authHeader) return res.status(401).json({ error: "Token invalide" })`. Pas d'introduction spéculative de `jwt.verify`. Discipline puriste tenue.

Test vert. **9 tests verts au total.**

### 5.4 — Cycle TDD 2 : token valide → `req.user` peuplé (200)

Test choisi en second contre l'ordre naïf (« tous les cas d'erreur d'abord »). Raisonnement défendu par Hippolyte : le cas positif est le seul qui force la structure de base (`jwt.verify` + extraction `userId`/`role` + peuplement de `req.user`). Les cas d'erreur qui suivront ne seront que des variations du `catch` autour d'un `jwt.verify` **déjà en place**. Faire les erreurs d'abord aurait exigé d'écrire un `try/catch` sans test qui l'exige — donc du code spéculatif.

**Détail du test :**
- Token signé dans le test avec `jwt.sign({ userId: 999, role: 'secretaire' }, process.env.JWT_SECRET, { expiresIn: '11h' })`. Valeurs de payload arbitraires (non-liées au seed), choix conscient — voir 5.7.
- Route de test `/protected` modifiée pour renvoyer `{ user: req.user }` afin de rendre `req.user` observable via HTTP. Cette même route sert désormais tous les cas (succès **et** échecs : sur 401, la route n'est jamais atteinte, donc pas de conflit).
- Assertion : `expect(response.body.user).toEqual({ userId: 999, role: 'secretaire' })` — `toEqual` strict, ce qui interdit implicitement de fuiter `iat`/`exp` du payload JWT dans `req.user`.

**Green minimal (voie puriste) :** `jwt.verify` **sans** `try/catch`. Justification : le seul test au vert exigeant l'appel à `jwt.verify` est le cas passant, qui ne throw pas ; le `try/catch` sera introduit en réponse à un test d'erreur qui produira un Red (500 non catché). C'est la discipline TDD stricte, opposée à la pré-anticipation défensive.

**Détail d'extraction du token :** `const [, token] = authHeader.split(' ')`. Cas non testés qui passent implicitement : `Bearer` seul (`token` sera `undefined`, `jwt.verify` throw), header type `Basic xyz` (idem). Ces cas ne sont pas testés à ce stade — le `catch` qui les couvrira arrivera plus tard.

Test vert. **10 tests verts au total.**

### 5.5 — Refactor entre 2 et 3 (assumé)

Phase Refactor conduite consciemment après le passage au vert du cycle 2, avant l'ouverture du cycle 3. Deux nettoyages :

1. `payload.userId` puis `payload.role` (3 mentions de `payload`) → `const { userId, role } = jwt.verify(...)` (destructuring direct du retour).
2. `authHeader.split(' ')[1]` → `const [, token] = authHeader.split(' ')` (destructuring du split, plus explicite sur l'intention).

Aucune modification comportementale. Les 10 tests restent verts. **Cycle Red → Green → Refactor complet, avec séparation des trois phases.** Amélioration par rapport à la discipline signalée en S3-S4 (tendance à combiner correction et refactor).

**Écart méthodologique de dialogue à noter :** ce refactor n'a pas été explicitement remontré à Claude avant le cycle 3 suivant, ce qui a produit un faux 🚩 (Claude a lu le nouveau code au moment du cycle 3 et cru y voir un refactor mélangé au Green). Correction faite par Hippolyte, 🚩 retiré. **Hygiène de dialogue à retenir :** re-coller le code après un refactor entre deux cycles évite ce type de mauvaise lecture par Claude.

### 5.6 — Cycle TDD 3 : signature invalide → introduction du `try/catch`

Test : token signé avec **un autre secret** (`jwt.sign({...}, 'un-autre-secret')` — sans `expiresIn`, sciemment, l'expiration n'a rien à voir avec ce que le test isole).

**Red produit un 500** — exactement le comportement anticipé par Hippolyte à la fin du cycle 2. C'est ce crash qui *justifie* l'introduction du `try/catch`, pas la connaissance a priori que `jwt.verify` throw. Point de défense : « j'ai ajouté ce `try/catch` en réponse au test X qui produisait cette erreur Y » — narration TDD stricte, opposée à « je savais que ça allait crasher donc j'ai anticipé ».

**Green :**
- `try/catch` autour de `jwt.verify` uniquement (option A discutée : pas de couverture spéculative de `authHeader.split(' ')`, qui ne peut throw dans les cas testés — même si `jwt.verify(undefined, ...)` throw aussi, le comportement observable reste identique).
- `catch { }` sans binder l'erreur (syntaxe ES2019) — cohérent avec la décision d'uniformité de S5.1 : on ne distingue ni ne log rien, donc pas de raison de binder.
- `next()` reste **en dehors** du `try/catch` — critique : sinon un throw dans un middleware downstream serait catché ici et transformé en 401 « Token invalide », ce qui masquerait des bugs et mentirait sur la nature de l'erreur.

Test vert. **11 tests verts au total.**

### 5.7 — Cycles TDD 4 et 5 : token expiré + token malformé (Green directs)

**Cycle 4 — token expiré :** signé avec `expiresIn: '-1s'` (plus explicite sur l'intention qu'un `expiresIn: 0` ambigu). `jwt.verify` throw `TokenExpiredError` → intercepté par le `catch` existant. **Green direct, aucune modification de production.**

**Cycle 5 — token malformé :** token construit manuellement (`'token.malformé'`, deux segments au lieu de trois) — sans passer par `jwt.sign`. `jwt.verify` throw `JsonWebTokenError` → intercepté. **Green direct, aucune modification de production.**

**Question méthodologique traitée :** un test qui passe direct (sans provoquer de changement de code) a-t-il de la valeur en TDD ? Réponse formulée pour la défense :
- **Propriété de couverture** : le test prouve que le `catch` couvre effectivement ce cas d'erreur. Sans ce test, un futur refactor pourrait remplacer `catch { }` par un filtrage plus étroit (ex. `catch (err) { if (err instanceof JsonWebTokenError && err.message === '...') ... }`) et casser le comportement sur d'autres cas sans qu'aucune alarme ne sonne.
- **Propriété d'uniformité** : le test fige la décision de session (même 401 + même body sur *toute* cause d'échec d'auth). Sans lui, quelqu'un pourrait ajouter `if (err instanceof TokenExpiredError) res.status(401).json({ error: "Token expiré" })` en pensant améliorer l'UX, et casser silencieusement le contrat de non-divulgation.

Formulation à porter au jury : **ces tests ne testent pas le code actuel, ils testent le contrat**. C'est une justification défendable qui répond à la critique classique « pourquoi écrire un test qui passe direct ? ».

Choix conscient : un seul test malformé, pas trois variantes (chaîne aléatoire / 2 segments / segments non-base64). Tous produisent le même comportement observable HTTP — les distinguer serait des tests défensifs redondants, pas comportementaux.

**12 puis 13 tests verts au total** en fin de partie B.

### 5.8 — Correction factuelle sur le pipeline de test (partie B)

Lors du cycle 2, Hippolyte a affirmé que `JWT_SECRET` était chargé « dans `vitest.config.ts` via `setupFiles` ». 🚩 factuel : c'est faux, la vérité est dans `package.json` (script `test`).

Configuration réelle vérifiée : `"test": "dotenv -e .env.test -- bash -c 'npx prisma migrate reset --force && npx prisma db seed && vitest run'"`. **`dotenv-cli`** injecte les variables (`DATABASE_URL`, `JWT_SECRET`, `BCRYPT_ROUNDS`) dans `process.env` **avant** que quoi que ce soit d'autre ne tourne. Le `bash -c '...'` enveloppe la chaîne parce que `dotenv-cli` n'exécute qu'une seule commande.

Point à défendre au jury : cette structure garantit une isolation totale de `.env` (dev). Les variables sont posées **avant Prisma** (donc migration et seed vont sur `tfe_test`) et **avant Vitest** (donc les tests utilisent le bon secret JWT). Décision structurante de S3, redécouverte et reconfirmée.

**Leçon transversale :** une affirmation technique non vérifiée sur sa propre config est un risque de crédibilité au jury. La règle « pas de suppositions » vaut aussi pour ses propres fichiers.

---

## Concepts compris / à consolider

**Compris (nouveau ou renforcé cette session) :**
- **Authentification vs autorisation** avec un exemple concret sourcé et défendable (`GET /api/commandes?date=` — 4 rôles, authentification seule vs `POST /api/commandes` — écriture qui engage, requiert le rôle secrétaire ou admin).
- **Contrainte d'ordre** dans une chaîne de middlewares : `authenticateToken` avant `requireRole` n'est pas une convention, c'est une nécessité mécanique (le second lit ce que le premier écrit). Diagnostic précis de la panne si l'ordre est inversé (500 non catché, pas de fuite mais mauvais statut et stack potentiellement journalisée).
- **Discipline puriste TDD** : pas de code spéculatif, pas de `try/catch` avant qu'un Red ne le rende nécessaire, le test suivant *justifie* l'extension du code de production.
- **Un test qui passe direct fige un contrat, pas un comportement.** Distinction subtile mais défendable, à sortir au jury si challenge sur les cycles 4 et 5.
- **`req.user` est peuplé depuis le token, pas depuis la base.** Le middleware fait confiance à sa propre signature — c'est *ce qui justifie* le payload JWT minimal de S3 (`userId`, `role`) : tout ce dont on a besoin est dans le token, pas de re-hydratation à chaque requête.

**À consolider :**
- **Hygiène de dialogue avec Claude** : re-coller le code après un refactor entre deux cycles, ne pas laisser Claude découvrir un état du code non annoncé (cf. 5.5).
- **Vérification factuelle avant affirmation** — même sur sa propre config (cf. 5.2 sur la matrice RBAC et 5.8 sur le pipeline env).
- **Cycle Red → Green → Refactor avec les trois phases séparées et commit à chaque transition** — bien tenu cette session, à maintenir sur `requireRole`.

---

## Points à mentionner dans le rapport TFE

Décisions documentables pour US-03 (partie authentification uniquement — l'autorisation viendra en S6) :

1. **Séparation `authenticateToken` / `requireRole` justifiée par trois propriétés** (réutilisabilité, composabilité, testabilité séparée), avec exemples sourcés dans la matrice RBAC.
2. **Ordre imposé par la mécanique**, pas par la convention : `authenticateToken` avant `requireRole` parce que le second lit `req.user` posé par le premier. Diagnostic de la défaillance si inversé.
3. **`req.user` peuplé depuis le payload signé, pas depuis la base** : `req.user = { userId, role }` — pas de re-hydratation par requête SQL, ce qui *justifie* le payload JWT minimal de S3.
4. **`try/catch` autour de `jwt.verify` uniquement**, pas de `next()` dans le `try` : sinon un throw downstream serait catché ici et masqué en 401.
5. **Uniformité `{ error: "Token invalide" }` sur tous les 401** : non-divulgation de l'état du token (distinct de l'anti-énumération de S3, même famille de raisonnement).
6. **`catch { }` sans binder l'erreur** (ES2019) : le code exprime précisément l'intention — la cause n'est ni utilisée, ni loggée, ni distinguée.
7. **Tests qui figent un contrat plutôt qu'un comportement** : les cycles 4 et 5 (Green directs) sont défendus comme filets de régression contre un futur refactor qui casserait l'uniformité.
8. **Discipline TDD puriste** : le `try/catch` n'a pas été anticipé — il a été introduit en réponse à un Red précis (cycle 3, signature invalide). Narration à porter en défense.
9. **Pipeline de test isolé via `dotenv-cli`** : variables injectées avant Prisma et Vitest, isolation totale de `.env` (dev). Structure explicitée pour éviter la confusion avec un chargement par `setupFiles` (redécouverte de S3 à retenir).

---

## Exigences EPHEC couvertes (progression)

- **Tests unitaires / d'intégration** : suite `authenticateToken.test.js` (5 tests verts). **13 tests verts au total.**
- **Analyse de sécurité** : uniformité 401 argumentée (non-divulgation de l'état du token) ; garanties du modèle « signature = authenticité » explicitées ; discipline « pas de trust dans req.user sans middleware d'auth en amont » posée.
- **Versioning Git** : 5 commits ciblés (1 Red poussé le 24/06 + 4 séquences Red/Green le 22/07). Discipline TDD lisible dans l'historique.
- **Documentation du code** : `authenticateToken` reste concis (~10 lignes) — pas de commentaires nécessaires à ce stade, l'intention est portée par les tests.
- **Schémas techniques** : sans changement.

---

## État des fonctionnalités / routes

- ✅ **POST `/api/auth/login`** — US-01 Done, 6 tests verts.
- ✅ **GET `/api/users`** — US-02 Done, 2 tests verts.
- 🔄 **Middleware JWT + RBAC** — US-03 partiellement livré :
  - ✅ `authenticateToken` : 5 tests verts (pas de header, signature invalide, expiré, malformé, token valide).
  - ⬜ `requireRole` : 3 cas à écrire (401 si `req.user` absent, 403 si rôle hors liste, 200 si rôle dans la liste).
  - ⬜ Test de non-régression : `/api/users` et `/api/auth/login` restent publics quand le middleware d'auth sera monté au niveau app.

---

## Blocages rencontrés et résolution

1. **Reprise après ~1 mois de pause** — le cadrage du 24 juin a été validé à froid par reformulation orale, sans besoin de retour au code. Bon signe pour la rétention des décisions. À noter comme point positif : la posture socratique produit une compréhension qui survit à la pause.
2. **Exemple d'usage `GET /api/menus` avancé sans vérification** (5.2) → corrigé en le sourçant dans la matrice RBAC du rapport. La règle « pas de suppositions » a joué son rôle.
3. **Faux 🚩 sur mélange Green/refactor au cycle 3** (5.5) → refactor avait été fait consciemment entre les cycles 2 et 3 mais non re-communiqué à Claude. Correction faite ; leçon de dialogue enregistrée.
4. **Affirmation erronée sur le chargement de `JWT_SECRET`** (5.8) → dementie par lecture de `package.json`. `dotenv-cli` confirmé.

---

## Ce qui reste à faire — prochaine session

1. **Écrire `requireRole` en TDD** — 3 tests à venir. Points de cadrage à trancher au démarrage de S6 :
   - **Structure des routes de test** : une seule route paramétrée (avec un rôle autorisé) ou plusieurs routes ?
   - **Méthode de peuplement de `req.user`** : passer par un vrai `authenticateToken` avec token signé (réaliste, cohérent avec le choix « pas d'unit tests » de 5.1) ou middleware factice qui pose `req.user` directement (isolé mais découplé de la chaîne réelle) ?
2. **Test de non-régression sur `/api/users` et `/api/auth/login`** — vérifier qu'ils restent publics quand le middleware d'auth sera éventuellement monté au niveau app. Cas concret à figer : `GET /api/users` sans header Authorization = 200 (pas 401).
3. **Refactor global éventuel de `authenticateToken.test.js`** : évaluer consciemment le passage aux 3 tests d'erreur en `it.each` paramétré (`pas de header` reste probablement à part car pas de token à construire). Répétition de 4 assertions identiques vs lisibilité individuelle — trancher, ne pas subir.
4. **Commit et push** des 4 commits en attente si pas encore fait (Green du 401 sans header, Green + Refactor du cas nominal, Green du `try/catch`, Green des cas expiré/malformé).
5. **Hérité S1-S2** — figures du rapport (EA + relationnel + UML classes) à aligner sur le schéma verrouillé. Toujours différé.
6. **Passe backlog** — aligner sur les choix S3-S4-S5.

Rappel calendrier : rapport dû le **17 août** (~3 semaines à compter d'aujourd'hui). La marge socratique se réduit — envisager passage en palier 2 ou 3 au besoin sur les phases suivantes.

---

## Structure du dépôt

```
TFE - AOUT 2026/
├── .git/
├── .gitignore
├── README.md
├── backend/
│   ├── compose.yaml
│   ├── package.json
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
│       ├── app.js
│       ├── index.js
│       ├── lib/
│       │   └── prisma.js
│       ├── middlewares/             ← NOUVEAU
│       │   ├── auth.js              ← NOUVEAU (authenticateToken avec try/catch)
│       │   └── __tests__/
│       │       └── authenticateToken.test.js  ← NOUVEAU (5 tests)
│       └── routes/
│           ├── auth.js
│           ├── users.js
│           └── __tests__/
│               ├── auth.test.js
│               └── users.test.js
└── frontend/
```

---

## Instructions pour reprendre (Session 6)

- **Contexte :** Phase 1 quasi-close. `authenticateToken` livré et testé sur 5 comportements. Reste `requireRole` + test de non-régression pour clore US-03 et la Phase 1.
- **Rappels :**
  - Pipeline de test : `dotenv -e .env.test -- bash -c 'npx prisma migrate reset --force && npx prisma db seed && vitest run'`. **`dotenv-cli` charge les env avant Prisma et Vitest** (pas `setupFiles`).
  - Architecture de tests : **seed = minimum universel ; particularités = `beforeAll` local**. Continuer à l'appliquer.
  - Posture TDD : Red → Green → Refactor, discipline du minimum. Commit à chaque transition (Red, Green, Refactor s'il y a lieu).
  - **Uniformité 401** : `{ error: "Token invalide" }` partout, sans distinction du type d'erreur, sans binder l'erreur dans `catch`.
  - `req.user = { userId, role }` — jamais rehydrater depuis la base, le token signé est la garantie.
  - Route de test `/protected` disponible dans `authenticateToken.test.js` — modèle à répliquer/adapter pour `requireRole`.
- **Ordre de cadrage à traiter avant tout code sur `requireRole` :**
  1. Structure des routes de test (paramétrée ou multiples).
  2. Méthode de peuplement de `req.user` (via `authenticateToken` réel ou middleware factice).
  3. Liste des `it(...)` à écrire dans l'ordre TDD (401 si `req.user` absent, 403 si rôle hors liste, 200 si rôle valide).
- **Commandes de relance :** `cd backend && docker compose up -d` puis `npm test` (13 tests verts attendus). `npm run dev` pour le serveur sur :3000.
- **Vérification rapide en cas de doute :** `git log --oneline -10` pour retrouver l'historique TDD ; `cat src/middlewares/auth.js` pour le code de référence de `authenticateToken`.

---

*Rapport mis à jour le 22 juillet 2026 — Session 5 (parties A du 24 juin + B du 22 juillet fusionnées)*
