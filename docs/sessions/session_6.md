# Session 6 — Le Cénacle (TFE)

- **Auteur :** Hippolyte AMORY
- **Date :** 23 juillet 2026
- **Échéances :** remise du rapport le 17 août 2026 ; livraison du produit dans les deux semaines suivantes (date de défense non encore fixée).
- **Objet de la session :** **Clôture d'US-03 et de la Phase 1** — cadrage puis livraison en TDD de `requireRole` (3 comportements), refactor pour uniformité avec `authenticateToken`, arbitrage du pattern de montage (route-par-route) et explicitation de la publicité de `POST /api/auth/login` et `GET /api/users` par deux tests documentaires. **18 tests verts.**

---

## Contexte et état de départ

Reprise dans la continuité de la fin de S5 (22 juillet 2026, veille) : `authenticateToken` livré et testé sur 5 comportements ; 13 tests verts ; `requireRole` restant à écrire ; test de non-régression sur la publicité de `/api/users` et `/api/auth/login` à traiter.

Session dédiée exclusivement au cadrage puis à l'exécution TDD de `requireRole`, avec un aiguillage stratégique en fin de session sur le pattern de montage d'`authenticateToken`. Palier 1 (socratique) sur toute la session.

---

## Ce qui a été travaillé

### 6.1 — Cadrage complet de `requireRole` avant code

Six points tranchés en amont d'écrire quoi que ce soit, dans l'ordre où ils ont été traités.

**Structure des routes de test — une seule route au niveau describe.** Analysée par confrontation directe à ce qui varie d'un test à l'autre. Dans `authenticateToken.test.js`, la variation est portée par le header `Authorization` — donc client-side, envoyée dans le `.set()` de Supertest, une seule route figée. Dans `requireRole.test.js`, la variation est portée par `req.user`, qui est posé par un middleware **en amont** figé au montage de la route. Deux options analysées : trois routes distinctes ou une seule route + variation client-side via un mécanisme test-only. Retenue : **une seule route paramétrée par un header custom `X-Test-Role`** lu par un stub factice qui pose `req.user` en fonction. Symétrie totale avec le pattern de `authenticateToken.test.js` (variation par header), au prix de l'introduction d'un mécanisme test-only à documenter et à défendre.

**Méthode de peuplement de `req.user` — stub factice, pas vrai `authenticateToken`.** Deux voies pesées : (A) chaîne réelle avec token signé en amont, (B) middleware factice qui pose `req.user` directement. Retenue : **voie B**. Deux arguments : (1) la voie A obligerait à retirer `authenticateToken` de la chaîne dans le seul cas où `req.user` doit être absent, ce qui casse la propriété « même chaîne testée d'un test à l'autre » et affaiblit le sens du test d'intégration ; (2) `authenticateToken` a déjà son fichier de test couvrant les 5 comportements — le remonter dans les tests de `requireRole` retesterait la même propriété deux fois et coupleraient la stabilité des tests. Point à défendre au jury : ce n'est **pas** contradictoire avec la décision 5.1 « pas d'unit tests ». On reste sur un test d'intégration Supertest sur chaîne Express réelle ; on isole simplement `requireRole` avec un stub à la frontière du test — substitution de dépendance amont, pas unit test.

**Cas `req.user` absent — pas de stub du tout.** Deux sous-options envisagées : (a) stub qui pose `req.user = undefined` explicitement, (b) pas de stub, route directement `app.get('/protected-role', requireRole([...]), handler)`. Retenue : **(b)**. Reproduit fidèlement le scénario de production (un middleware amont oublié dans la chaîne), tandis que (a) teste un cas artificiel qui n'arrive jamais en prod. La propriété testée est la **résilience à un oubli de configuration en amont** — c'est un test de défense en profondeur, application directe du principe directeur du projet (« propriété vérifiable par le système, pas vigilance »).

**Signature `roles: string[]`, pas variadique.** Le backlog user stories §98 formule `requireRole('admin', 'secretaire', ...)` — variadique. Décision de session : **maintenir la signature en tableau** (`requireRole(['secretaire'])`) déjà tranchée en 5.1, pour cohérence interne du projet. Le texte du backlog est descriptif, pas normatif. Écart à documenter dans le rapport TFE comme choix conscient.

**Ordre TDD des trois cas — 403 → 200 → 401, par le cœur métier.** Exercice fait de simuler le Green minimal de chacun des trois cas isolément : tous trois sont satisfaits par un `return res.status(XXX).json(...)` en dur, sans lire `req.user` ni la liste des rôles. **Aucun test seul ne force le squelette du middleware** — ce qui distingue cette phase de la 5.4 sur `authenticateToken` où le cas positif forçait `jwt.verify` + extraction + peuplement. Formulation issue de cette session à porter au rapport : le TDD prend ici la forme **triangulaire** — la structure émerge par confrontation des trois cycles, pas par un test-force-tout. C'est une propriété du code testé (`requireRole` a plusieurs axes indépendants), pas une faiblesse. Ordre choisi : **403 en premier**, comme cœur métier du middleware (« sa raison d'exister, c'est refuser »), puis **200** qui casse le fake en dur et introduit la liste et la lecture de `req.user.role`, puis **401** qui casse encore et introduit la clause défensive en amont.

**Message du 403 — `{ error: "Accès refusé" }`.** Distinct de `{ error: "Token invalide" }` réservé aux 401. Justification : le statut 403 porte déjà la sémantique du refus, le body porte l'intention lisible côté client. Pas de redondance, pas d'ambiguïté avec le message d'authentification.

### 6.2 — Épisode « admin a tous les droits » corrigé par la source de vérité

Point soulevé par Hippolyte pendant le cadrage : « l'admin a tous les droits, comment refléter ça ? ». Vérification factuelle immédiate déclenchée par la règle « pas de suppositions » :

- **`schema.prisma:187-192`** : `admin` figure dans l'enum `Role` aux côtés de `secretaire`, `cuisine`, `serveur`. Pas « futur ». Le tableau des rôles du fichier de contexte tuteur était **en retard sur la source de vérité** (mention « Admin (futur) »). Le schéma prime.
- **Backlog user stories §98** : `requireRole('admin', 'secretaire', ...)` — listage explicite, aucun bypass.
- **US-31** (l. 822) et **US-41** (l. 1110) : routes protégées par `requireRole('admin')` seul, pas par une hiérarchie implicite.
- **US-37** (l. 1018) export allergies : `secretaire, cuisine, admin` listés côte à côte.

**Diagnostic** : la règle « l'admin a tous les droits sur toutes les routes » n'existe pas dans la source de vérité. La convention effective du backlog est **le listage explicite du rôle** dans chaque `requireRole([...])`. Un bypass admin universel dans le middleware aurait été une règle métier inventée, indéfendable devant un jury.

Décision de session : **pas de bypass dans `requireRole`, admin listé explicitement là où il doit avoir accès**. Corollaire assumé et souligné dans la discussion : ce **n'est pas** « admin partout ». L'admin est ajouté sur les routes de configuration (US-31, US-41 admin-only) et sur les routes de consultation transverse (exports, listes), **pas** sur les routes d'opération métier terrain (encodage boissons par serveur, imprimante cuisine, etc.). Cette règle de portée reste à trancher route-par-route dans les US suivantes, à sourcer dans le rapport ou la matrice RBAC.

Point à porter au rapport TFE : illustration de la discipline de vérification factuelle (application de la règle « pas de suppositions » à une règle métier avancée mais non sourcée).

### 6.3 — Cycle TDD 1 : 403 si rôle hors liste

**Squelette factice commité à part avant le Red** : `export function requireRole(roles) { return (req, res, next) => next() }`. Décision de discipline : le stub factice permet d'isoler le Red sur *la logique métier absente*, pas sur *l'import manquant*. Signal plus propre, débogage plus rapide en cas de faux positif. Commit distinct dans l'historique (`chore(middlewares): squelette requireRole` ou équivalent).

**Test posé** : stub factice au niveau `describe` qui pose `req.user = { userId: 1, role: "cuisine" }` en dur, route montée avec `requireRole(["secretaire"])`, `it("403 si le rôle n'est pas dans la liste autorisée")` avec `expect(res.status).toBe(403)` et body `{ error: "Accès refusé" }`.

**Red produit 200** (stub factice laisse passer, handler atteint). Symptôme propre : logique métier manque, pas la plomberie.

**Green minimal** : `return (req, res, next) => res.status(403).json({ error: "Accès refusé" })`. Aucune lecture de `req.user`, aucun `includes`, aucun `if`. Discipline puriste tenue — la structure émergera au cycle 2.

**Cycle 1 clos, 14 tests verts.**

### 6.4 — Refactor du fichier de test entre cycles 1 et 2

Décision de discipline consciente : le passage du stub en dur (`req.user = { userId: 1, role: "cuisine" }`) au **stub piloté par header `X-Test-Role`** est un refactor **du fichier de test**, séparé du Red suivant. Précisément la discipline signalée à consolider en S3-S4 et bien tenue en S5.

Stub final :
```js
(req, res, next) => {
  const testRole = req.headers["x-test-role"];
  if (testRole) req.user = { userId: 1, role: testRole };
  next();
}
```

Propriété clé du stub : **si le header est absent, `req.user` n'est pas posé**. Ce comportement rendra le cycle 3 possible sans changement d'architecture.

Refactor neutre : 14 tests verts maintenus. Commit isolé (`refactor(tests): stub requireRole piloté par header X-Test-Role`).

### 6.5 — Cycle TDD 2 : 200 si rôle dans la liste

**Test posé** : `.set("X-Test-Role", "secretaire")`, `expect(res.status).toBe(200)`, body `{ ok: true }`.

**Red produit 403** (middleware toujours en dur). Le stub a bien peuplé `req.user`, `requireRole` n'en tient aucun compte.

**Green minimal** : `if (roles.includes(req.user.role)) next(); else res.status(403).json({ error: "Accès refusé" })`. **Pas de clause défensive `if (!req.user)` à ce stade** — aucun test ne la justifie. Anticiper serait exactement le piège de code spéculatif que 5.4 puis 5.6 ont appris à éviter.

**Cycle 2 clos, 15 tests verts.**

### 6.6 — Cycle TDD 3 : 401 si `req.user` absent

**Test posé** : pas de `.set()` du tout — reproduit fidèlement le scénario d'oubli de middleware amont. `expect(res.status).toBe(401)`, body `{ error: "Token invalide" }` (uniformité 401 de 5.1).

**Red produit 500** — exactement le symptôme anticipé en 5.2 lors du diagnostic de l'ordre inversé des middlewares. `req.user.role` sur `req.user === undefined` throw un `TypeError`, Express catch (synchrone), applique son error handler par défaut. **Sans ce test, le bug passerait inaperçu en production** : la route serait techniquement « protégée » côté HTTP (500 ≠ 200), mais avec le mauvais code, le mauvais body, et une stack trace potentiellement exposée. Argument central de défense : c'est le principe directeur du projet appliqué — sans clause défensive, la garantie repose sur la vigilance du développeur qui monte les routes ; avec, elle est portée par le middleware = **propriété vérifiable par le système, pas vigilance**.

**Green minimal** : `if (!req.user) return res.status(401).json({ error: "Token invalide" })` placé en amont de la garde de rôle. Un `if` + `return` ajouté, rien de plus.

**Cycle 3 clos, 16 tests verts.**

### 6.7 — Refactor de `requireRole` : early returns pour uniformité avec `authenticateToken`

Décision de refactor : passage à des **early returns systématiques** cohérents avec la grammaire de `authenticateToken` (garde 401 → traitement → `next()` en fin de fonction). Un lecteur qui passe d'un middleware à l'autre garde la même structure.

Version finale :
```js
export function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Token invalide" });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Accès refusé" });
    next();
  };
}
```

**Refactor sur `it.each` : rejeté, avec correction de justification.** Première formulation par Hippolyte : « je ne l'ai pas vu en cours ». 🚩 levé — cette raison ne tient pas devant un jury (choix par ignorance, pas par arbitrage). Reformulation défendable pour le rapport : **les trois cas de `requireRole` testent trois contrats sémantiquement distincts (identité manquante, autorisation refusée, autorisation accordée) avec des payloads de réponse hétérogènes** (`{ error: "Token invalide" }` / `{ error: "Accès refusé" }` / `{ ok: true }`). `it.each` s'applique naturellement quand N cas font *la même assertion* avec des entrées différentes (comme dans `authenticateToken` cycles 3-4-5, cas d'école où il aurait pu être appliqué mais ne l'a pas été). Ici, chaque test a **son entrée et sa sortie propres** — paramétrer les deux alourdirait sans clarifier. Trois `it(...)` séparés = bon choix.

**Asymétrie assumée entre `authenticateToken` et `requireRole`** : le premier place `next()` **en dehors** du `try/catch` (nécessaire pour ne pas catcher des throws downstream — décision 5.6), le second utilise des early returns et un `next()` nu en fin. Deux formes de contrôle de flow, une justification distincte pour chacune.

**16 tests verts maintenus.** Commit dédié (`refactor(middlewares): early returns dans requireRole`).

### 6.8 — Arbitrage : pattern de montage d'`authenticateToken` — route-par-route

Point d'architecture soulevé à la clôture d'US-03 : comment monter `authenticateToken` dans l'app. Trois patterns Express identifiés :

1. **Global sur l'app** (`app.use(authenticateToken)` en tête) — protégé par défaut, allowlist des routes publiques.
2. **Sur un sous-routeur** — routeur porteur des routes protégées.
3. **Route par route** — chaque route déclare explicitement sa chaîne middlewares.

Retenu : **pattern 3**. Justification : la politique de sécurité est **colocalisée avec la déclaration de route**, un lecteur voit d'un coup d'œil ce qui protège ce qui.

**Tradeoff explicitement assumé** (première formulation par Hippolyte — « détectable par les tests d'intégration » — 🚩 levée : ça suppose que quelqu'un ait écrit le test, donc déplace la vigilance du montage vers l'écriture des tests, ce qui n'est pas la même chose que la faire porter par le système). Reformulation défendable au jury :

> *« J'ai choisi le pattern route-par-route parce que la lisibilité locale prime sur la défense en profondeur au niveau app, dans un projet à surface réduite (une vingtaine de routes) où chaque endpoint est couvert par un test d'intégration RBAC dédié. Le pattern global aurait porté la garantie « par défaut protégé » au niveau système, mais aurait forcé à maintenir une allowlist de routes publiques — un mécanisme d'exception qui, s'il est mal maintenu, casse silencieusement l'accès aux routes publiques (login inclus). J'ai préféré assumer la charge du côté explicite, cohérente avec la taille du projet. »*

**Conséquence directe sur le test de non-régression** formulé en session 5 (point 2 du « ce qui reste à faire ») : **caduc**. Ce test supposait le pattern 1 (`authenticateToken` monté au niveau app avec allowlist à vérifier). En pattern 3, `authenticateToken` n'est jamais monté au niveau app — il n'y a rien à excepter.

**Chaîne de middlewares fixée** comme convention documentaire : sur toute route protégée, l'ordre sera systématiquement `authenticateToken` puis `requireRole([...])`. Diagnostic 5.2 rappelé (dépendance de flow de données : le second lit ce que le premier écrit).

### 6.9 — Explicitation de la publicité par deux tests documentaires

Bien que les tests d'US-01 (`auth.test.js`) et d'US-02 (`users.test.js`) couvrent **implicitement** la publicité des routes (aucun `.set("Authorization", ...)`, tests verts en 200), la propriété reste **portée par effet de bord** et non documentée comme intention. Décision de session : ajouter deux `it(...)` explicites dont le **nom porte la propriété défendue**.

Discipline sur l'assertion : première formulation par Hippolyte `not.toBe(401)`. 🚩 levée — négation d'une seule valeur ≠ affirmation positive. `not.toBe(401)` passe pour 200, 404, 500, 403 — n'importe quoi sauf 401. Si demain une régression casse la route sans y ajouter d'authentification, le « test de non-régression » resterait vert. Retenue : **assertion positive `toBe(200)`** dont la robustesse couvre le cas 401 par exclusion **et** protège contre les autres régressions ; la valeur documentaire est portée par le nom du `it`.

Formulation finale des deux tests, un dans `users.test.js` et un dans `auth.test.js` :

```js
it("reste accessible sans header Authorization (route publique)", ...)
```

**18 tests verts.** Un commit thématique (`test: fige la publicité de GET /api/users et POST /api/auth/login`).

**Point méthodologique à porter au rapport** : ces tests ne testent pas un comportement nouveau — ils **figent un contrat**. Cohérence directe avec la justification des cycles 4 et 5 de `authenticateToken` (5.7) où deux tests figeaient l'uniformité 401 sans changer le code. Même méthodologie appliquée à travers US-03.

---

## Concepts compris / à consolider

**Compris (nouveau ou renforcé cette session) :**

- **TDD triangulaire vs test-force-tout.** Formulé en session, à porter au rapport : deux formes de TDD selon la nature du contrat testé. Test-force-tout — un cas unique impose toute la structure (cas d'`authenticateToken` cycle 2 en 5.4). Triangulaire — chaque cas isolé est satisfaisable en dur, la structure émerge par confrontation des cycles successifs (cas de `requireRole`). Ce n'est pas une faiblesse mais une propriété du code testé.
- **Substitution de dépendance amont** en test d'intégration : remplacer un middleware réel par un stub factice piloté par un mécanisme de test (header custom) n'est pas un unit test — c'est une isolation à la frontière du test, avec la chaîne Express réelle en aval. Analogue direct au `jwt.sign` de test pour piloter `authenticateToken`.
- **Différence de nature de variation dans les tests d'intégration** : client-side (header) vs server-side (middleware amont figé au montage). Détermine si une seule route au niveau describe suffit ou s'il faut recomposer par test.
- **Le nom d'un test porte l'intention, l'assertion porte la vérification.** Un `it` avec un nom explicite et une assertion positive robuste vaut mieux qu'un nom générique et une assertion négative fragile.
- **Le pattern de montage d'un middleware Express n'est pas neutre.** Trois patterns (global / sous-routeur / route-par-route), tradeoffs distincts sur la localité, l'oubli, la vigilance. Choix à défendre pour le projet.

**À consolider :**

- **Justifier ses choix avec des raisons défendables devant un jury, pas des raisons personnelles.** Cf. faux argument sur `it.each` (« pas vu en cours ») et faux argument sur le pattern 3 (« détectable par les tests »). Les vraies justifications existaient dans les deux cas, il fallait juste ne pas s'arrêter à la première formulation.
- **Discipline de vérification factuelle sur les règles métier avancées.** Bien tenue cette session (épisode admin), à maintenir.

---

## Points à mentionner dans le rapport TFE

Décisions documentables pour US-03 (partie autorisation) et transversales à la Phase 1 :

1. **Séparation `authenticateToken` / `requireRole` confirmée par la pratique** : deux fichiers de test, deux stratégies de peuplement de `req.user` (Supertest header vs middleware stub piloté par header). Preuve empirique de la séparation.
2. **Signature `roles: string[]` (tableau)** : écart documenté vs formulation variadique du backlog §98, pour cohérence interne du projet.
3. **Stratégie de test par substitution de dépendance amont** : stub factice piloté par header `X-Test-Role` — analogue direct de la variation client-side de `authenticateToken.test.js`. Isolation propre du middleware sous test sans dupliquer la couverture.
4. **Cas `req.user` absent testé par absence de stub, pas par stub `undefined`** : reproduit le scénario d'oubli en production, pas un cas artificiel. Application directe du principe directeur.
5. **TDD triangulaire pour `requireRole`** : distinct du TDD test-force-tout de `authenticateToken`. La structure émerge par confrontation des trois cycles, aucun test seul ne la force. Propriété du code testé.
6. **Pas de bypass admin** : la règle métier « admin a tous les droits sur toutes les routes » n'existe pas dans le backlog. Convention effective : listage explicite du rôle dans chaque `requireRole([...])`. Illustration de la discipline de vérification factuelle.
7. **Pattern de montage route-par-route** pour `authenticateToken` : arbitrage assumé (lisibilité locale primant sur la défense en profondeur au niveau app) avec ses forces et faiblesses. Cohérent avec un projet à surface réduite.
8. **Ordre imposé dans la chaîne** : `authenticateToken` avant `requireRole` — dépendance de flow de données (déjà 5.2), à figer comme convention documentaire.
9. **Publicité des routes documentée par tests explicites** : deux `it(...)` avec assertion positive robuste (`toBe(200)`) et nom porteur d'intention. Méthodologie « tests qui figent un contrat » — cohérente avec 5.7.
10. **Uniformité de style entre les deux middlewares** : early returns systématiques, avec asymétrie assumée (`next()` hors `try/catch` sur `authenticateToken` pour ne pas catcher les throws downstream, `next()` nu en fin sur `requireRole` sans bloc catch).
11. **Rejet de `it.each` pour `requireRole` — raison défendable formulée en session** : trois cas avec assertions hétérogènes (payloads distincts), pas trois variations d'entrée sur assertion partagée.

---

## Exigences EPHEC couvertes (progression)

- **Tests unitaires / d'intégration** : suite `requireRole.test.js` (3 tests) + 2 tests documentaires ajoutés. **18 tests verts au total.**
- **Analyse de sécurité** : arbitrage documenté du pattern de montage (defense in depth vs colocalisation), justification de la substitution de dépendance amont en test, rappel du diagnostic « req.user undefined → 500 non catché » comme motif de clause défensive.
- **Versioning Git** : chaîne de commits ciblés — squelette factice / Red / Green cycle 1 / refactor du test / Red / Green cycle 2 / Red / Green cycle 3 / refactor uniformité / tests documentaires. Narration TDD lisible.
- **Documentation du code** : les middlewares restent concis, l'intention est portée par les tests et le nommage.
- **Schémas techniques** : sans changement.

---

## État des fonctionnalités / routes

- ✅ **POST `/api/auth/login`** — US-01 Done, 6 tests verts + 1 test de publicité documentaire.
- ✅ **GET `/api/users`** — US-02 Done, 2 tests verts + 1 test de publicité documentaire.
- ✅ **US-03 — Middleware JWT + RBAC** — Done :
  - ✅ `authenticateToken` : 5 tests verts (pas de header, signature invalide, expiré, malformé, token valide).
  - ✅ `requireRole` : 3 tests verts (401 si `req.user` absent, 403 si rôle hors liste, 200 si rôle valide).
  - ✅ Pattern de montage arbitré : route-par-route (à appliquer sur les routes protégées à venir).
- ✅ **Phase 1 close** (US-01 + US-02 + US-03).

---

## Blocages rencontrés et résolution

1. **Supposition « admin a tous les droits » avancée sans source** → corrigée par vérification directe dans `schema.prisma` et `backlog_user_stories.md`. Convention effective identifiée (listage explicite), décision alignée. Aucun bypass codé.
2. **Fichier de contexte tuteur en retard sur la source de vérité** (« Admin (futur) » alors que le schéma et le backlog listent `admin` comme rôle plein) → correction actée, le schéma prime.
3. **Justification par ignorance sur `it.each`** (« pas vu en cours ») → 🚩 levée, reformulation défendable trouvée dans le message suivant (assertions hétérogènes).
4. **Justification incomplète du pattern 3** (« détectable par les tests » comme argument principal) → 🚩 levée, tradeoff assumé reformulé (lisibilité locale + surface réduite + charge de vigilance sur les nouvelles routes).
5. **Assertion `not.toBe(401)` proposée pour les tests de publicité** → 🚩 levée, remplacée par `toBe(200)` positive et robuste avec nom de test porteur d'intention.
6. **Écart signature dans le premier code posé** (variadique dans le stub factice alors que « tableau » avait été tranché) → 🚩 levée immédiatement, corrigée.

---

## Ce qui reste à faire — prochaine session

1. **Ouvrir la Phase 2 — Référentiel résidents** (`plan_daction.md`). Prochaine US : **US-04 — Lister les appartements et leurs occupants**. Cadrage à faire au démarrage de S7 (route, projection, filtres, cas de test).
2. **Hérité S1-S2** — figures du rapport (EA + relationnel + UML classes) à aligner sur le schéma verrouillé. Toujours différé.
3. **Passe backlog** — aligner sur les choix S3 à S6 (mention Jest → Vitest, nom de route `/api/users`, architecture de tests, décisions RBAC).
4. **Application progressive de la chaîne `authenticateToken` + `requireRole([...])`** aux nouvelles routes protégées de la Phase 2 (US-05, US-06, US-13 notamment).

Rappel calendrier : rapport dû le **17 août** (~25 jours à compter d'aujourd'hui). Palier 1 confirmé par Hippolyte pour la Phase 2. Marge à surveiller à l'approche de la Phase 3 (cœur métier commandes).

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
│       ├── middlewares/
│       │   ├── auth.js              ← MODIFIÉ (ajout de requireRole)
│       │   └── __tests__/
│       │       ├── authenticateToken.test.js
│       │       └── requireRole.test.js       ← NOUVEAU (3 tests)
│       └── routes/
│           ├── auth.js
│           ├── users.js
│           └── __tests__/
│               ├── auth.test.js     ← MODIFIÉ (ajout it publicité)
│               └── users.test.js    ← MODIFIÉ (ajout it publicité)
└── frontend/
```

---

## Instructions pour reprendre (Session 7)

- **Contexte :** Phase 1 close. US-01, US-02, US-03 livrées, 18 tests verts. Phase 2 ouverte sur US-04 (« Lister les appartements et leurs occupants »).
- **Palier confirmé pour S7 :** Palier 1 (socratique), sur toute la Phase 2.
- **Rappels transversaux :**
  - Pipeline de test : `dotenv -e .env.test -- bash -c 'npx prisma migrate reset --force && npx prisma db seed && vitest run'`.
  - Architecture de tests : seed = minimum universel ; particularités = `beforeAll` local.
  - Chaîne de middlewares sur route protégée : `authenticateToken` **puis** `requireRole([...])`. Ordre imposé par le flow de données.
  - Signature `requireRole(roles: string[])` — tableau, pas variadique.
  - Messages d'erreur : `{ error: "Token invalide" }` sur tous les 401 ; `{ error: "Accès refusé" }` sur les 403.
  - Pas de bypass admin — listage explicite du rôle dans chaque `requireRole([...])`.
  - Montage route-par-route, pas au niveau app.
- **Cadrage à traiter au démarrage de S7 :**
  1. Périmètre exact d'US-04 dans le backlog (route, verbe, ressource, projection, filtres).
  2. Matrice RBAC applicable à cette route (§9.3.2 du rapport).
  3. Structure de données de la réponse (appartements et occupants — clé plate ou nested ?).
- **Commandes de relance :** `cd backend && docker compose up -d` puis `npm test` (18 tests verts attendus). `npm run dev` pour le serveur sur :3000.
- **Vérification rapide en cas de doute :** `git log --oneline -15` pour retrouver la narration TDD de la Phase 1 ; `cat src/middlewares/auth.js` pour la référence des deux middlewares.

---

*Rapport mis à jour le 23 juillet 2026 — Session 6*
