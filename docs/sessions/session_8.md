# Session 8 — Livraison de la route 2 d'US-04 (`GET /api/appartements/:numero/residents`) en TDD

**Date :** 27 juillet 2026
**Auteur :** Hippolyte AMORY
**Date de défense TFE :** 17 août 2026

---

## Contexte et état de départ

Phase 2 ouverte en S7 : route 1 d'US-04 (`GET /api/appartements`) livrée, 28 tests verts. Pattern route-par-route, chaîne `[authenticateToken, requireRole([...])]` figée, `authenticateToken` monté au niveau router. Palier 1 (socratique) confirmé.

Objectif de session : cadrer et livrer la **route 2 d'US-04**, `GET /api/appartements/:numero/residents` — premier endpoint du projet avec un **paramètre de chemin**. Le cadrage attendu (fixé en fin de S7) : format de retour nested, cas 404, validation du `:numero`, RBAC identique à la route 1.

---

## Ce qui a été travaillé

### 8.1 — Cadrage : taxonomie des codes de statut (forme / existence / contenu)

Trois situations distinctes, trois réponses distinctes, arbitrées par Hippolyte :

- `abc` → **400** : la valeur est malformée. 400 parle de la **requête**.
- `999` → **404** : la valeur est bien formée mais la ressource n'existe pas. 404 parle de la **ressource**.
- `5` (appartement vacant) → **200** avec `occupants: []` : la ressource existe, son contenu est vide. **Une collection vide n'est pas une ressource absente.**

Formule de défense retenue : *400 = requête malformée, 404 = ressource introuvable, 200 vide = ressource trouvée mais sans occupant.* Cohérence transversale vérifiée avec la route 1 : l'appartement 5 rend déjà `occupants: []` côté route 1 ; les deux routes appliquent la même règle sur le vide. Une divergence (200 vide d'un côté, 404 de l'autre pour le même appartement) aurait été un signal de non-maîtrise sémantique.

### 8.2 — Validation du `:numero` : forme vs inventaire

Décision d'Hippolyte : **la route valide la forme (« entier strictement positif »), la base tranche l'existence.** Argument défendable, formulé par Hippolyte : coder la plage `3-90` dans la route créerait deux sources de vérité pour « quels appartements existent » ; le jour où la base change sans que le code suive, la route mentirait en 404 sur une ressource réelle — **et aucun test ne le détecterait, parce que test et route réciteraient la même constante en dur.** Une propriété qu'aucun test ne peut réfuter n'est pas vérifiée, elle est décorative. (Application inverse du principe directeur *propriété vérifiable par le système*.)

Traitement des cas limites, tous sur le seul critère de **forme** :
- `abc` (non numérique), `-5` (négatif), `0` (non strictement positif), `3.5` (non entier) → **400**.
- `91`, `999` (entiers positifs, mais absents) → passent la forme → **404** à l'étage existence.
- `007` → **accepté** : `Number("007")` normalise vers `7`. Choix conscient assumé — Hippolyte préfère tolérer une saisie sémantiquement non ambiguë plutôt que d'imposer une écriture canonique.

Point de discipline : Hippolyte a d'abord voulu ranger `0` en 400 au motif « il n'y aura jamais d'appartement 0 » — motif d'**inventaire**, incohérent avec le traitement de `91` (rangé en 404 pour le même type de motif). Recadré : `0` tombe en 400 parce qu'il **échoue à la forme** (zéro n'est pas strictement positif), pas parce qu'il n'existe pas. Formule finale retenue : **« la règle rejette sur la forme, pas sur l'inventaire ».**

Emplacement de la validation : **`if` en tête de handler**. Argument correct retenu (après recadrage) : la validation est **locale** à cette route, pas transversale comme `authenticateToken`. La portée décide de l'emplacement — on extrait en middleware ce qui est transversal, on garde dans le handler ce qui est mono-route. Extraire ici serait de l'abstraction spéculative. Note pour l'oral : le jour où une deuxième route prendra le même `:numero`, la portée deviendra transversale et l'extraction se justifiera — *ce jour-là*.

Erreur d'argumentation corrigée : Hippolyte avait justifié le `if` en tête par « séparation des responsabilités ». Faux — mettre validation et traitement dans le même bloc est du **séquencement**, pas une séparation (la vraie séparation, c'est ce qu'il a fait en sortant `authenticateToken` et `requireRole` en middlewares distincts). Le bon argument est la **portée locale**, pas la séparation.

### 8.3 — Stratégie de requête Prisma : racine `Appartement`

Décision d'Hippolyte : interroger la racine **`Appartement`** (résidents inclus), et non la table `Resident`. Justification en deux questions distinctes qu'il a formulées :
1. *L'appartement existe-t-il ?* → réponse portée par la présence/absence de la ligne racine.
2. *A-t-il des occupants actifs ?* → réponse portée par le contenu du tableau `residents` imbriqué.

Interroger `Resident` directement aurait effondré les deux questions sur un seul signal (tableau vide), incapable de distinguer `999` (inexistant → 404) de `5` (existant, vacant → 200). Cette forme de requête **préserve** la distinction dont dépend le code de statut.

Méthode et signal : `findUnique({ where: { numero } })` → renvoie `null` si absent → branche 404. Le branchement se fait sur `findUnique === null` (existence de la ligne), **pas** sur `residents.length === 0` (occupation) — sans quoi l'appartement 5 vacant tomberait en 404 à tort.

**Vérification du schéma sur pièce** (règle « pas de suppositions ») : `model Appartement` porte **deux** champs distincts, `id_appartement` (`@id @default(autoincrement())`) et `numero` (`@unique`). Les deux sont ciblables par `findUnique`. Décision : cibler **`numero`**, car c'est la donnée **métier** exposée dans l'URL (le numéro sur la porte), pas l'identifiant technique. Conséquence défendable : la route reste correcte le jour où l'égalité de coïncidence `id_appartement = numero` (posée dans le seed) cessera de tenir. Cibler le bon champ n'est pas cosmétique — c'est ce qui garde la route juste indépendamment d'une coïncidence de données.

Choix `appart === null` plutôt que `!appart` : `findUnique` a un contrat de retour précis (l'objet ou `null`, jamais `undefined`/`0`/`""`). `=== null` colle au contrat exact ; `!appart` ratisse tout le falsy, plus large que ce que l'API peut produire. `=== null` dit la vérité sur la source du signal.

### 8.4 — Conception des tests (méthodologie TDD)

**Le faux vert du 401.** Le test « 401 sans token » écrit en premier est né **vert** (32→ pas de changement rouge attendu). Signal d'alarme : un Red qui naît vert masque quelque chose. Cause identifiée par Hippolyte : `authenticateToken` étant monté au **niveau router**, il intercepte toute requête entrant dans le préfixe `/api/appartements` **avant** le matching de route ; le 401 tombe donc même sur une route inexistante. `GET /api/appartements/5/frites` (sans token) donnerait le même 401. Le test est vert, mais **vide de la propriété qu'on lui prêtait** (« la route 2 est branchée »).

**Résolution — Voie B :** écrire d'abord un test qui **exige l'existence de la route** pour passer (le 400 sur `abc`), de sorte que le Red soit un vrai rouge (route absente → 404 de non-match → assertion 400 échoue). Le 401 vient ensuite, comme garde-fou.

**Deux propriétés, deux `it()`.** Distinction établie par Hippolyte : « rejette sans token » (permanent) et « route déclarée » (transitoire) sont deux propriétés distinctes — un `it()` fusionnant les deux perdrait la localisation de l'échec. La discipline « un échec = une cause nommée » impose la séparation. Point de formulation corrigé : on nomme toujours la **cause du rouge** (ce qu'un test existe pour attraper), pas la condition de vert.

**Durée de vie des tests — l'échafaudage.** Le test « route déclarée » (statut ≠ 404) est un **échafaudage** : sa fonction est de forcer l'existence du handler à un instant T. Dès l'arrivée du test « 200 vacant » (appart 5), ce dernier couvre *a fortiori* « route déclarée » (une route absente ne pourrait jamais rendre 200) avec plus de précision → l'échafaudage est supprimé. **Savoir supprimer un test devenu redondant est aussi discipliné que savoir en écrire un.** Tous les tests n'ont pas la même durée de vie (permanents = comportement métier ; transitoires = pilotage du dev).

**Structure : partager ou séparer la requête.** Les 4 cas de rejet 400 = 4 `it()` distincts (4 requêtes/stimuli différents). Contraste avec le niveau 3 de la route 1 (S7) : `describe + beforeAll + N×it()` partageant **une** requête HTTP (8 lectures de la même réponse). Critère défendable dégagé : **on partage une requête entre plusieurs `it()` quand ils lisent la même réponse ; on sépare en `it()`/requêtes distincts quand les stimuli diffèrent.** Bénéfice concret observé au terminal : les 4 verdicts s'affichent **simultanément** (`[1/4]`…`[4/4]`), pas en série — un `it()` unique s'arrêterait au premier `expect` échoué.

**Assertions du happy path.** `toEqual` exact sur l'objet occupant entier plutôt qu'un empilement de `toHaveProperty` + `not.toHaveProperty` (redondants avec un `toEqual` exact). Le `toEqual` exact vérifie d'un seul geste le contrat **positif** (bons champs présents) *et* **négatif** (aucun champ en trop) — il teste donc la **minimisation RGPD** en même temps que la structure. `expect.any(Number)` sur `id_resident` (valeur volatile car autoincrement, on asserte le type sans se lier à la valeur). Ajout d'une assertion sur Pierrot (`allergies: []`) pour prouver que l'imbrication fonctionne aussi pour un résident sans allergène (tableau vide, pas champ absent).

### 8.5 — Happy path : requête imbriquée à trois niveaux + minimisation RGPD

Forme JSON cible arbitrée :
```
{ numero, occupants: [ { id_resident, prenom, nom, allergies: [ { libelle, type } ] } ] }
```

**`select` partout, jamais `include`.** Décision d'Hippolyte, justifiée : `include` ramènerait la relation entière (dont `notes`, `created_by`, `created_at`) ; `select` oblige à lister chaque champ exposé, à chaque niveau d'imbrication. Formule retenue : **minimisation à la source, pas filtrage a posteriori** — avec `select`, les colonnes sensibles ne figurent **jamais** dans le SQL généré, elles ne franchissent pas la frontière de la base. Distinction défendable : *la donnée existe* (la ligne est entière en base) ≠ *la donnée est lue*. Vérifiable matériellement via `log: ['query']` de Prisma si le jury insiste.

**Justification champ par champ** (chaque champ exposé doit être défendable) :
- `libelle`, `type` : le `type` (`allergie` / `intolerance` / `regime`) permet au serveur de **prioriser urgence vitale vs préférence** — usage opérationnel réel, cohérent avec l'art. 9§2c (intérêt vital) invoqué en S7. Ne sur-expose pas, sert la finalité de protection.
- `id_resident` : le front l'utilisera pour `POST /api/commandes` — évite un aller-retour supplémentaire. (Anticipation à vérifier quand la commande sera codée.)
- **Exclus** : `notes` (texte médical libre — sur-exposition RGPD concrète), `created_by`, `created_at` (audit interne, sans usage opérationnel).

**Vérifications de schéma sur pièce** (règle « pas de suppositions ») :
- `model Allergie` : champ catégorie confirmé nommé `type` (et non `type_allergie`) ; valeur d'enum réelle `allergie` (minuscule), et non `ALIMENTAIRE` qui avait été supposée à tort.
- `model Resident` : relation inverse vers les allergies nommée `allergies`. Coïncide avec le nom API → **pas de traduction** à ce niveau.

**Filtre `actif: true`** placé dans un `where` **imbriqué** dans la relation `residents` (`residents: { where: { actif: true }, select: {...} }`) — filtre les occupants remontés, distinct du `where` racine qui identifie l'appartement. Même filtre que la route 1, pour cohérence (un résident inactif ne doit pas apparaître dans l'une ni l'autre route).

**Mapping `residents` → `occupants`** par déstructuration renommante : `const { residents: occupants } = appart;` puis `res.json({ numero, occupants })`. La clé `residents` n'apparaît jamais dans la sortie — même logique que le `select` (on construit ce qu'on expose, on ne nettoie pas après). Traduction faite **au handler**, car Prisma ne peut pas renommer une relation dans le `select`.

**Source du `numero`** : depuis `req.params` (déjà validé, en mémoire locale), **pas** re-sélectionné par Prisma — le refaire ressortir de la base serait demander ce qu'on vient de recevoir du client. Conséquence : le `select` racine ne contient que `residents` (pas `numero: true`).

### 8.6 — Adaptation du seed

Ajout de l'allergie de Giselle (Arachides, type `allergie`), requise par le happy path. Implémentation : `findFirst` pour retrouver `id_resident` (autoincrement, inconnu après `createMany`), `findUnique` pour l'`id_utilisateur` de `admin1`, puis `allergie.create` avec `created_by` renseigné. Bloc d'invariants (Convention A) mis à jour en conséquence. `date_entree: now` injecté au `map` — confirmé nécessaire : `date_entree` est `DateTime` **sans** `@default` dans le schéma, donc obligatoire.

Note défendable relevée : `@@index([id_appartement, actif])` sur `Resident` sert exactement le filtre « occupants actifs d'un appartement ». Point d'optimisation à mentionner au jury si la question de la performance des requêtes se pose.

---

## Concepts compris / à consolider

**Compris (défendables) :**
- Taxonomie des statuts ancrée dans *ce dont parle chaque code* : 400 = la requête, 404 = la ressource, 200 vide = ressource trouvée sans contenu.
- Séparation **forme / inventaire** : la route valide la forme, la base tranche l'existence. Une source de vérité unique pour l'existence.
- **Portée** (locale vs transversale) comme critère d'emplacement : handler pour le local, middleware pour le transversal.
- **Faux vert TDD** : un Red qui naît vert masque une propriété non testée ; il faut comprendre *pourquoi* avant de continuer.
- `select` vs `include` : minimisation **à la source**, la donnée sensible ne quitte jamais la couche data.
- **Durée de vie des tests** : échafaudage transitoire vs test permanent ; supprimer un test redondant est de la discipline.
- Partager vs séparer une requête entre `it()` selon que les stimuli sont identiques ou distincts.
- Déstructuration renommante pour la traduction de vocabulaire à la frontière API.

**À consolider :**
- **Justification du modèle à deux champs** `id_appartement` (technique) / `numero` (métier) : question de jury quasi certaine sur ce modèle. Intuition présente (une clé métier peut changer alors qu'une PK référencée en FK ne devrait pas), **pas encore formalisée**. À travailler avant l'oral.
- **Discipline de commit** : tendance récurrente en session à vouloir sauter/regrouper le commit Red, ou à demander à Claude d'écrire les messages de commit. Recadré plusieurs fois. À intérioriser : le Red se commite rouge, séparément ; la narration Git est un artefact évalué (exigence EPHEC) et doit rester de la main d'Hippolyte.
- **Réflexe de vérification schéma** : bon progrès (deux vérifications sur pièce cette session), mais deux tentatives initiales de *deviner* un nom de champ (`numero`/`id_appartement`, puis `type` d'`Allergie`). Le réflexe « lire le schéma avant de coder un nom » est en cours d'acquisition, pas encore automatique.

---

## Points à mentionner dans le rapport TFE

- Taxonomie 400 / 404 / 200-vide et sa justification (requête vs ressource vs contenu).
- Refus de coder la plage d'appartements dans la route : une seule source de vérité pour l'existence (la base), et démonstration que la duplication rendrait le test non réfutable.
- Minimisation RGPD **à la source** via `select` exhaustif : `notes` (donnée de santé), `created_by`, `created_at` jamais lues. `toEqual` exact du test comme preuve exécutable de la minimisation.
- Justification de l'exposition de `type` (priorisation urgence vitale, art. 9§2c) et `id_resident` (usage `POST /commandes`).
- Choix de `numero` (métier) vs `id_appartement` (technique) comme cible de `findUnique`, et robustesse quand l'égalité de coïncidence cessera.
- Traduction de vocabulaire `residents` → `occupants` à la frontière API.

---

## Exigences EPHEC couvertes

- ✅ **Tests d'intégration** : 36 tests verts (28 → 36). Discipline TDD, cycles Red/Green committés séparément (403 non applicable ici — RBAC hérité du router). Sécurité-first respecté (barrière externe → cœur métier).
- ✅ **Analyse de sécurité / RGPD** : minimisation renforcée et rendue **exécutable** par le test (contrat négatif du `toEqual`). Cohérent avec §9.4.3 (« affichage limité à l'allergène pertinent »).
- ✅ **Documentation du code** : commentaires justificatifs sur le seed (invariants Convention A) et les choix structurants.
- ✅ **Versioning Git** : narration TDD poursuivie. *Point de vigilance* : homogénéité de la casse du scope (`us-04` vs `US-04`) à vérifier sur l'ensemble du `git log` avant remise.

---

## État des fonctionnalités / routes

- ✅ **US-01** — `POST /api/auth/login` (PIN, bcrypt, JWT).
- ✅ **US-02** — `GET /api/users` (liste publique, `actif: true`).
- ✅ **US-03** — middlewares `authenticateToken` + `requireRole([...])`.
- ✅ **US-04 route 1** — `GET /api/appartements` (liste + occupants actifs).
- ✅ **US-04 route 2** — `GET /api/appartements/:numero/residents` (validation forme 400, existence 404, contenu 200 avec allergies imbriquées + minimisation). **US-04 complète.**

---

## Blocages rencontrés et résolution

- **Faux vert du 401 (Red né vert).** Cause : `authenticateToken` monté au niveau router intercepte avant le matching, donc 401 même sur route inexistante. Résolution : réordonnancement (Voie B) — le vrai premier Red métier devient le 400 sur `abc`, qui exige l'existence de la route pour passer. À retenir : un Red qui naît vert se diagnostique avant de continuer.
- **Deux tentatives de deviner un nom de champ.** (1) `numero` vs `id_appartement` comme cible du `findUnique` ; (2) `type` / valeur d'enum de l'allergie. Résolution : lecture du schéma sur pièce à chaque fois. Discipline « pas de suppositions » appliquée.

---

## Ce qui reste à faire

### En Phase 2
1. **US-05 — CRUD résidents**, règle « couple max 2 actifs par appartement ». Gros morceau, session dédiée.
2. **US-06 — Changement de résident**, transaction atomique (le seed pré-charge les cas : apparts 6 et 7).
3. **US-13 — CRUD allergies** (données de santé sensibles, `created_by` à implémenter, RGPD).

### Points ouverts non bloquants
4. **Newline finale manquante** sur `appartements.test.js` (`\ No newline at end of file`) — commit d'hygiène ou réglage éditeur « insert final newline ».
5. **Homogénéité de la casse du scope Git** (`us-04` vs `US-04`) — vérifier via `git log --oneline` avant remise.
6. **Update Prisma 7.8 → 7.9** — commit isolé `chore(deps)`.
7. **Justification du niveau « Faible »** sur la ligne §9.5 (passage 3→4 rôles) — demi-phrase manquante (hérité S7).
8. **US-38 backlog** — reformuler « accès tracé via le middleware » (ambiguïté, hérité S7).

### Points hérités
9. **Figures du rapport** (EA + relationnel + UML classes) à aligner sur le schéma verrouillé de S1.
10. **Passe backlog** groupée (alignement S3→S8 : Vitest, `/api/users`, RBAC, structures nested).
11. **Justification du modèle à deux champs** `id_appartement` / `numero` à formaliser pour l'oral.

Rappel calendrier : rapport dû le **17 août** (~21 jours). Marge convenable pour Phase 2 en Palier 1. Vigilance à l'ouverture de la Phase 3 (cœur métier commandes).

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
│   │   ├── seed.ts                  ← MODIFIÉ (allergie Giselle + invariant mis à jour)
│   │   └── migrations/
│   │       └── <timestamp>_init/
│   └── src/
│       ├── app.js
│       ├── index.js
│       ├── lib/
│       │   └── prisma.js
│       ├── middlewares/
│       │   ├── auth.js
│       │   └── __tests__/
│       │       ├── authenticateToken.test.js
│       │       └── requireRole.test.js
│       └── routes/
│           ├── auth.js
│           ├── users.js
│           ├── appartements.js      ← MODIFIÉ (route 2 ajoutée)
│           └── __tests__/
│               ├── auth.test.js
│               ├── users.test.js
│               └── appartements.test.js  ← MODIFIÉ (tests route 2 : 4×400, 404, 3×200 happy path)
└── frontend/
```

Frontend non démarré (Phase 4).

---

## Instructions pour reprendre (Session 9)

- **Contexte :** US-04 **complète** (routes 1 et 2 livrées), 36 tests verts. Prochaine cible : **US-05 — CRUD résidents**, avec la règle métier « max 2 résidents actifs par appartement » (couple). Palier 1 (socratique) sauf demande explicite d'accélérer.
- **Cadrage à traiter au démarrage de S9 (US-05) :**
  1. Périmètre CRUD : quelles opérations (create / update / delete logique via `actif` ?), quelles routes, quels rôles (RBAC : secrétaire seule d'après la table des rôles ?).
  2. Règle « max 2 actifs » : où et comment la garantir ? *Propriété vérifiable par le système* — contrainte applicative, transaction, ou vérification pré-écriture ? Cas limite : que se passe-t-il si on tente un 3e actif ?
  3. Suppression = suppression logique (`actif: false` + `date_sortie`) et non `DELETE` physique ? Cohérence avec l'invariant du seed (`actif = false ⇒ date_sortie renseignée`).
  4. Le seed pré-charge déjà les cas (apparts 6 et 7) pour US-06 — anticiper l'articulation US-05 / US-06.
- **Rappels transversaux (inchangés) :**
  - Export : `export default` pour un artefact unique (routers), `export` nommé pour plusieurs artefacts liés (middlewares).
  - Import middlewares : `import { authenticateToken } from '../middlewares/auth.js'` — jamais en default.
  - Montage middleware : **router-level** (`router.use(authenticateToken)`).
  - Chaîne route protégée : `[authenticateToken, requireRole([...])]`, option B assumée.
  - Ordre TDD sécurité-first : barrière externe (401) → forme (400) → existence (404) → contenu (200).
  - Terminer une réponse Express : `res.status(x).json(...)` / `res.sendStatus(x)` — jamais `res.status(x)` seul.
  - Convention A d'invariants seed : toute modif du seed → mise à jour du bloc de commentaire.
  - **Vérifier le schéma sur pièce** avant de coder tout nom de champ, relation ou valeur d'enum.
  - **Discipline de commit** : Red committé rouge séparément du Green ; messages écrits par Hippolyte, Conventional Commits, scope en minuscules.
- **Commandes de relance :**
  - `cd backend && docker compose up -d`
  - `npm test` — **36 tests verts** attendus.
  - `dotenv -e .env.test -- bash -c 'npx prisma migrate reset --force && npx prisma db seed && vitest run'` — pipeline complet.
- **Vérifications rapides en cas de doute :**
  - `git log --oneline -20` — narration TDD S8 (cycles : seed, Red/Green 400, Red/Green 404, Red/Green happy path).
  - `cat prisma/seed.ts` — invariants documentés + allergie Giselle.
  - `cat src/routes/appartements.js` — routes 1 et 2 de référence.

---

*Rapport mis à jour le 27 juillet 2026 — Session 8*
