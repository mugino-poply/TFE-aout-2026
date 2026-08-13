# Session 9 — Livraison complète d'US-05 (CRUD résidents) en TDD : règle couple, verrou de concurrence, isolation des tests, anti-mass-assignment

**Date :** 29 juillet 2026
**Auteur :** Hippolyte AMORY
**Date de défense TFE :** 17 août 2026

---

## Contexte et état de départ

US-04 complète en fin de S8 (routes 1 et 2), 36 tests verts. Pattern route-par-route, `authenticateToken` au niveau router, chaîne `[authenticateToken, requireRole([...])]` figée. Palier 1 (socratique).

Objectif de session : cadrer et livrer **US-05 — CRUD résidents**, portée par la règle métier « **au plus 2 résidents actifs par appartement** » (couple). Quatre routes visées : `POST`, `PATCH`, `DELETE` (soft delete), `GET ?tous=1`.

Résultat : **US-05 complète, 54 tests verts** (36 → 54, +18). Plus une refonte de l'infrastructure de test (isolation par reseed par fichier + sérialisation) rendue nécessaire par une pollution inter-fichiers observée en cours de session.

---

## Ce qui a été travaillé

### 9.1 — Cadrage : périmètre, RBAC, résolution `numero → appartement`

**Périmètre des routes**, arbitré par Hippolyte :
- `POST /api/residents` → **201** (création de ressource).
- `PATCH /api/residents/:id` → **200**.
- `DELETE /api/residents/:id` → **200**, renvoie le résident **archivé** (transition d'état, pas suppression physique → 204 mentirait sur ce qui se passe).
- `GET /api/residents?tous=1` → **200**.

**RBAC : `requireRole(['secretaire'])` sur toutes les routes.** Point de discipline : Hippolyte a d'abord proposé `['secretaire', 'admin']` avec l'argument « admin sinon il peut rien réparer » — recadré comme une **invention** (non sourcée). Trois faits en contradiction : (1) la table des rôles cantonne l'admin à « configuration globale », pas à la gestion des résidents ; (2) l'architecture RBAC (US-03) a acté **« pas de bypass admin »** — l'admin n'obtient que ce qui est **listé explicitement**. Décision finale sourcée : `['secretaire']` seul, adossé à la table des rôles et à la formulation « En tant que secrétaire ». Contraste défendable avec US-04 (lecture ouverte à 4 rôles) : ici on est en **écriture**, donc plus restrictif.

**Résolution `numero_appartement` (payload) → appartement (base).** Le backlog §3 impose que le client envoie `numero_appartement`, pas `id_appartement` : le client connaît la donnée **métier** (numéro sur la porte), pas la clé technique. Découplage protège la route le jour où l'égalité de coïncidence `id_appartement = numero` cessera. Mécanisme Prisma : `connect: { numero }` — fonctionne parce que `numero` est `@unique` (Prisma autorise `connect` sur **tout champ unique**, pas seulement la PK ; retirer `@unique` casse le `connect`). Vérifié sur le schéma : relation nommée `appartement`.

### 9.2 — Règle couple : TOCTOU et verrou `FOR UPDATE`

Cœur conceptuel et pièce maîtresse de défense d'US-05. Chaîne de raisonnement entièrement dégagée par Hippolyte :

**Le problème.** Un check naïf `count(actif: true) → si ≥ 2, 409` a une séquence *lire → décider → écrire*. Deux secrétaires simultanées sur un appartement à 1 actif lisent chacune `1`, concluent « 1 < 2, ok », écrivent → **3 actifs**. Nom du défaut, apporté par Claude, raisonnement déjà tenu par Hippolyte : **race condition / TOCTOU** (*Time Of Check To Time Of Use*). Formule de défense retenue (mot d'Hippolyte) : *« une garantie qui vit dans le code applicatif ne vaut que ce que vaut le snapshot qu'il a lu. »*

**Pourquoi une transaction seule ne suffit pas.** Recadrage d'une affirmation fausse (« une transaction garantit l'atomicité et l'isolation, donc oui ça ferme la fenêtre ») :
- l'**atomicité** est orthogonale (aucun `create` ne plante ; les deux écritures réussissent) ;
- l'**isolation** n'est pas un booléen mais un **niveau réglable** ; PostgreSQL par défaut = `READ COMMITTED`, sous lequel les deux `SELECT count` voient chacun `1` tant que l'autre n'a pas committé. **Envelopper `count` + `create` dans une transaction ne change rien** sans un levier supplémentaire.

**Solution retenue : le verrou (`SELECT ... FOR UPDATE`), pas `SERIALIZABLE`.** Arbitrage d'Hippolyte : `SERIALIZABLE` ferme la fenêtre en **refusant** de committer la 2ᵉ transaction → oblige à coder un **retry**. Le verrou fait **attendre** la 2ᵉ → pas de retry. Pour une contention quasi nulle (deux secrétaires, même appartement, même seconde), payer la complexité d'un retry serait disproportionné. Choix coût/bénéfice assumé.

**Mécanique exacte** (ordre = moitié de la correction) : `prisma.$transaction(async (tx) => { … })` **forme interactive** (nécessaire car décisions intermédiaires 404/409 impossibles dans la forme « tableau »), avec en **tête** `tx.$queryRaw\`SELECT id_appartement FROM "Appartement" WHERE numero = ${numero} FOR UPDATE\``, **puis** count `actif: true` sur `tx`, décision, `create` sur `tx`. Points de défense verrouillés par Hippolyte :
- **verrou AVANT count** : le poser après signifie lire un état déjà périmé — le verrou arrive trop tard.
- **la ligne appartement n'est pas un péage, c'est un point de rendez-vous** : le `count` lit la table `residents`, pas la ligne appartement ; ce qui fait attendre la 2ᵉ transaction, c'est qu'elle doit **elle aussi** demander `FOR UPDATE` sur la **même** ligne appartement en première étape. La garantie est **protocolaire** (« tout écrivain prend le verrou d'appartement en tête »), pas structurelle — un chemin d'écriture rebelle la contournerait. Formule d'Hippolyte : *« tout chemin qui crée ou réactive un actif DOIT passer par ce verrou avant de compter, sinon un seul chemin qui l'oublie rouvre la fenêtre. »*
- **tout sur `tx`, jamais `prisma`** : un `count` sur le client global prendrait une **connexion différente** du pool, hors transaction, hors portée du verrou → compterait un état non synchronisé.
- **`$queryRaw` en tagged template, jamais `$queryRawUnsafe`** : le tagged template paramètre (`$1`) au niveau driver → protection **structurelle** contre l'injection SQL (STRIDE Tampering, §9.2), pas une précaution oubliable.
- **nom de table physique** : `"Appartement"` correct car **aucun `@@map`** dans le schéma (vérifié) → convention Prisma par défaut = nom du modèle. Le `$queryRaw` quitte l'abstraction ORM, donc exige le nom physique.

Le `findUnique` d'existence (404) a été **absorbé** dans la transaction verrouillée : le `SELECT ... FOR UPDATE` renvoie un tableau ; `length === 0` ⇒ 404 (reproduit fonctionnellement le `findUnique === null`).

Type de commit du verrou : **`refactor:`** — le comportement observable **par la suite de tests** est inchangé (409 et 201 restent verts) ; seul le régime concurrent change, hors de portée du harnais. Formule : *« refactor parce que « observable » = observable par mes tests ; le verrou n'entre pas par un cycle Red→Green car aucun rouge ne peut l'exiger. »*

### 9.3 — Testabilité de la concurrence : ce que le harnais prouve vs ce qui se défend

Point de maturité majeur. La propriété « deux écritures concurrentes ne produisent jamais un 3ᵉ actif » est **non testable** par Vitest + Supertest (requêtes en série). Tri opéré par Hippolyte :
- **testable en série** : `0 actif → 201`, `1 actif → 201`, `2 actifs → 409`, `numéro inexistant → 404`.
- **le cœur** : `2 actifs → 409` teste la règle. La paire **serrée `1 → 201` / `2 → 409`** épingle le seuil pile à 2 (une paire large `0/2` laisserait le doute). Choix de `1 actif` (pas `0`) pour le 201 justifié par cette localisation de borne.
- **le verrou se justifie, ne se teste pas** : *« on teste la décision (à 2, je refuse) ; le `FOR UPDATE` garantit qu'elle tient en parallèle. Un test « 2 POST simultanés » passerait au vert même sans verrou — il ne prouve rien. »*
- **si on voulait le tester** : `Promise.all` pour lancer les écritures sans `await` séquentiel — mais sur runtime mono-thread, test **non déterministe (flaky)**, ce qui est une **2ᵉ raison** (en plus de « ne prouve rien ») de l'exclure. *« Une garantie protocolaire justifiée vaut mieux qu'un test instable. »*

### 9.4 — Isolation des tests : pollution inter-fichiers → reseed par fichier + sérialisation

**Blocage rencontré et résolu.** Après les cycles `POST`, la suite complète a fait **rougir deux tests d'US-04** (appart 4 attendait 1 occupant → 2 ; appart 7 attendait 1 actif → 2). Diagnostic d'Hippolyte : ses tests `POST` **créent** des résidents (Jean sur appart 4 et 7) ; le seed tourne **une seule fois** avant toute la suite (`migrate reset && db seed && vitest run`), sans reset entre fichiers ; `residents.test.js` s'exécutant avant `appartements.test.js`, les créations polluent l'état lu par US-04. Preuve apportée : **appart 3 survit** (son POST est refusé 409, aucune création) — signature d'une pollution ciblée, pas d'un hasard.

**Décision : Option C — reset des données par fichier.** Principe nommé : **isolation des tests poussée à la racine** — supprimer la classe entière de bugs « un fichier pollue l'autre » plutôt que colmater par nettoyage (Option A, fragile : un test qui plante avant son `afterEach` laisse la base sale) ou par isolation locale (Option B, lourde et hors sujet pour des tests US-04 qui marchaient). Fait vérifié : `auth.test.js` et `users.test.js` créent aussi des données → problème **général** → une solution locale serait un jeu de taupes.

**Implémentation, en distinguant trois portées Vitest** (vérifiées sur doc) : `globalSetup` (une fois pour toute la suite — **inadapté**), `setupFiles` (par fichier), `beforeAll` (par fichier). Retenu : **reseed au top-level d'un setup file** (`vitest.setup.js`), déclaré dans `vitest.config.js`. Coût maîtrisé : le `migrate reset` (schéma, lourd) reste **une fois** en tête de pipeline ; entre fichiers, seul le **reset des données** (vider + reseed, léger). La commande de test devient `dotenv -e .env.test -- bash -c 'npx prisma migrate reset --force && vitest run'` (le `db seed` chaîné disparaît, remplacé par le reseed par fichier).

**Piège de concurrence identifié seul par Hippolyte** (transfert du concept de 9.2 vers le harnais) : par défaut les fichiers tournent **en parallèle** ; un reseed par fichier en parallèle sur une base unique = `residents` vide la base pendant qu'`appartements` lit → **race non déterministe, pire que le bug d'ordre** (le bug d'ordre est déterministe donc débogable ; la race est flaky). Correction : **`fileParallelism: false`** — condition de correction, pas confort.

**Deux arbitrages assumés pour la défense :**
- **troc vitesse/déterminisme** : sérialiser coûte quelques secondes (~8 s de suite), payées volontiers — *« une suite lente mais fiable vaut mieux qu'une suite rapide qui flanche une fois sur dix ; le temps de débugger un flaky dépasse le gain du parallélisme. »*
- **pourquoi pas « une base par worker »** (vraie réponse industrielle : parallélisme **et** isolation) : coût config/infra (créer/détruire/router des bases) non justifié à l'échelle d'un TFE ; la sérialisation donne le même déterminisme pour trois lignes de config. **Seuil de bascule nommé** : si la suite dépassait la minute. Choix **proportionné**, pas ignorance.

**Preuve exigée et obtenue** : `console.log("[reseed]")` compteur → **6 affichages pour 6 fichiers** (un par fichier, ni par test ni global). Un seul aurait signifié « retombé dans globalSetup ». Le log parasite est retiré une fois la preuve faite (échafaudage de preuve).

**Source unique du seed** : les données extraites dans `prisma/seedData.ts`, importées par `seed.ts` **et** le reseed → une seule définition, pas de divergence (principe « une source de vérité » appliqué à l'outillage).

### 9.5 — `PATCH` : whitelist anti-mass-assignment

**Périmètre restreint (`prenom`, `nom` uniquement ; `actif` exclu).** Décision sourcée sur le backlog : un chemin par changement d'état (`actif: false` = `DELETE`, pas `PATCH` — deux sources pour la même action à proscrire) ; la réactivation n'existe ni dans US-05 ni dans US-06 (US-06 = **remplacement**, pas flip). Conséquence de conception : `actif` hors périmètre ⇒ le `PATCH` ne franchit **jamais** le seuil couple ⇒ **pas de count, pas de verrou, handler simple** (pas de machinerie non exercée).

**Whitelist stricte contre le mass assignment** (pendant écriture de la sur-exposition en lecture). Argument de défense d'Hippolyte : un `update` naïf avec tout `req.body` laisserait un client glisser `{ actif: true }` ou `{ id_appartement: 9 }` ; en ne **lisant** que la whitelist, ces champs n'atteignent jamais l'`update`.

**Taxonomie** : `abc` → 400 (forme) ; `99999` → 404 (existence, `findUnique` sur PK — `findUnique` **exprime** l'unicité, `findFirst` suggérerait à tort plusieurs lignes) ; body vide **après filtrage** (`{}` ou `{ actif: true }`) → 400 ; `{ prenom: "" }` → 400. Deux points tranchés :
- **le 400 « rien à modifier » se déclenche sur le body APRÈS filtrage**, pas brut → `{}` et `{ actif: true }` convergent (leur rougissement conjoint *prouve* que le filtrage précède le garde).
- **refus de `{ prenom: "" }`** justifié non par « plus sûr » (recadré : argument creux) mais par cohérence d'invariant : *« mon POST traite `prenom` comme obligatoire ; laisser le PATCH le vider serait une porte dérobée vers un état que la création interdit. Un invariant qui vaut à la création doit valoir à la modification, sinon il ne vaut rien. »* Renfort métier : un résident est une personne réelle.

**Exposition de `id_resident` dans l'URL** défendue : la secrétaire tient l'`id` de la liste que le système lui a **donnée** (US-04 renvoie `id_resident`), contrairement au `numero` métier saisi par un humain.

**Test de sécurité (preuve de la whitelist)** : `PATCH { prenom: "X", actif: false }` sur **Hervé** (actif → état de départ qui **contredit** l'attaque ; Baudouin, déjà inactif, aurait rendu le test vert par coïncidence). Double assertion sur **la base** (relecture Prisma), pas sur `res.body` — car le `select` de réponse n'expose pas `actif`. Distinction de défense : *la réponse de l'API ≠ l'état de la base ; la sécurité se joue sur ce qui est écrit, pas sur ce qui est renvoyé.* Test **né vert** → prouve que la whitelist était **structurelle dès le cycle 1** (« le chemin naît sécurisé »), pas rajoutée.

### 9.6 — `DELETE` : soft delete idempotent, invariant `actif/date_sortie`

**Backlog** : seul critère, `actif: false`, historique des commandes non touché. Code retour et corps à trancher.

**Invariant `actif = false ⇒ date_sortie renseignée`** vit dans le **code**, pas la base (`date_sortie` est `DateTime?`, nullable — la base accepte un inactif sans date). Parallèle explicite avec la règle couple : **garantie protocolaire, pas structurelle** ; tenue en écrivant toujours les deux champs ensemble, `DELETE` étant l'**unique porte** vers `actif: false` (PATCH n'y touche pas, POST crée toujours actif). Un `CHECK` serait plus robuste mais hors périmètre TFE (arbitrage assumé).

**`date_sortie` = `new Date()` serveur** : fait système (quand l'action a eu lieu), non falsifiable, comme `created_at` — pas une saisie client.

**Idempotence (le point subtil).** `DELETE` sur un déjà-archivé → **200 no-op**, **sans réécraser** `date_sortie` (préservation de la date historique). Impose une séquence *lire → décider → écrire* : `findUnique` (sert **aussi** le 404) → si `actif === false`, no-op renvoyant l'existant → sinon `update { actif: false, date_sortie: new Date() }`. **Pas de verrou ici**, et le contraste avec le couple a été formulé comme un **critère général** : *« le verrou protège un invariant que la concurrence peut violer, pas une valeur dont deux versions concurrentes sont toutes deux correctes. »* Deux `DELETE` concurrents écrivent le même état légal (inactif + une date à quelques ms près), aucun invariant cassé → `FOR UPDATE` serait du réflexe, pas de l'analyse.

**`select` du DELETE ≠ celui du POST** : inclut `actif` et `date_sortie` — la minimisation suit *ce que l'action produit d'informatif* ; `date_sortie` inerte à la création, **résultat même** de l'archivage ici.

**Discipline TDD tenue jusqu'au bout (Option A choisie sur arbitrage).** Green succès = `update` **aveugle** minimal → le test idempotent **naît rouge** (Baudouin : `date_sortie` 2024-06-15 écrasée par `new Date()`, rouge chiffré `1785… ≠ 1718…`) → ce rouge **pilote** l'introduction de la lecture-décision. Refus de coder la condition d'avance (« pas de garde que le test n'exerce pas »). Motif d'Hippolyte : *« le rouge de l'idempotent est ma preuve exécutable qu'un update aveugle écrase la date ; sans lui, ma décision serait une intention non démontrée. »* Comparaison de dates sans piège de format : `.getTime()` (timestamps numériques, court-circuite l'ISO `T…Z`).

### 9.7 — `GET ?tous=1` : filtrage par témoin nommé

**Sémantique du param** : `req.query.tous === "1"` → tous ; toute autre valeur (absent, `"0"`, `"abc"`, vide) → **actifs seulement** (défaut sûr). Comparaison stricte à la **string** `"1"` (les query params sont des strings ; `if (req.query.tous)` serait piégé car `"0"` est truthy). Contrat **strict** assumé : `?tous=true` ne déclenche pas « tous » — `1` est la valeur documentée.

**Valeur inattendue → défaut permissif, pas 400.** Contraste justifié avec POST/PATCH : là-bas une valeur mal formée **corrompt une écriture** (sévérité 400) ; ici c'est un param d'**affichage en lecture**, le pire cas est « je montre les actifs au lieu de tout ». Sévérité proportionnée à la conséquence.

**RBAC `['secretaire']`, distinct d'US-04.** Défendu par la **finalité** : US-04 (occupants actifs par appartement) sert la prise de commande → 4 rôles ; ce `GET /api/residents` (surtout `?tous=1` exposant les archivés) est un outil de **gestion administrative** → secrétaire seule. Deux lectures de résidents, deux RBAC selon l'usage, pas un réflexe « lecture = ouvert ».

**Test par témoin nommé (réfutable)** : Baudouin (inactif connu) **absent** du défaut / **présent** avec `?tous=1`. Cherché via `.find(r => r.nom === "Koning")`, jamais compté ni indexé → robuste à un seed qui grossirait. Assertion enrichie : en mode `tous`, `baudouin.actif === false` (présence **et** exposition correcte de l'état archivé). Deux `it()` distincts (défaut exclut / `tous` inclut = deux propriétés, deux causes de rougissement). `select` liste : `id_resident`, `prenom`, `nom`, `actif`, `date_sortie` (les deux derniers pertinents car la vue mixe actifs et archivés).

---

## Concepts compris / à consolider

**Compris (défendables) :**
- **TOCTOU / race condition** nommé, diagnostiqué et corrigé — et le concept **transféré** spontanément du domaine métier (deux secrétaires) au harnais de test (deux fichiers sur une base partagée).
- **Isolation (niveau) ≠ transaction (contenant)** : `READ COMMITTED` par défaut, une transaction seule ne ferme pas la fenêtre.
- **Verrou vs `SERIALIZABLE`** : attendre (pas de retry) vs refuser (retry) ; arbitrage coût/bénéfice.
- **Garantie protocolaire vs structurelle** : le verrou tient tant que le protocole est l'unique porte d'écriture ; critère réutilisé pour l'invariant `actif/date_sortie`.
- **`tx` vs `prisma`** : connexions distinctes ; hors `tx`, hors portée du verrou.
- **`$queryRaw` tagged template vs `$queryRawUnsafe`** : paramétrage structurel anti-injection ; nom de table physique quand on quitte l'ORM.
- **Mass assignment** et sa fermeture par whitelist ; **la réponse API ≠ l'état de la base** (où se prouve la sécurité).
- **Isolation des tests** : reseed par fichier, portées `globalSetup`/`setupFiles`/`beforeAll`, sérialisation comme condition de correction, arbitrage proportionné vs base-par-worker.
- **Un test qui ne peut pas échouer ne teste rien** : témoin nommé réfutable, fixture qui contredit l'attaque, paire de bornes serrée pour épingler un seuil.
- **Idempotence** d'une transition d'état ; préservation d'une donnée historique.
- **Critère du verrou** : protéger un invariant violable, pas une valeur dont deux versions concurrentes sont correctes.

**À consolider :**
- **Vérification sur pièce avant d'affirmer** : progrès net (schéma, seed, `git log`, corps d'erreur tous vérifiés), mais plusieurs affirmations initiales encore posées « de mémoire » avant vérification (composition d'appartements du seed, corps d'erreur d'US-04, « auth/users créent probablement des users »). Le réflexe se solidifie mais n'est pas encore systématique. *(Claude a lui-même commis l'erreur inverse cette session — affirmer « je n'ai pas `seed.ts` » sans regarder — ce qui illustre l'universalité du réflexe à acquérir.)*
- **Distinguer « c'est vert » de « c'est fini »** : tendance à enchaîner (« next », « c'est bon ») sans donner le compteur ni la cause du rouge ; recadré. Un vert non observé (l'épisode « j'avais codé au mauvais endroit ») rappelle qu'un « tout vert » sans rouge préalable doit rendre méfiant.
- **Justifier une contrainte par sa source, pas par une intuition** (« plus sûr », « admin sinon il répare rien ») : recadré deux fois, corrigé les deux fois.

---

## Points à mentionner dans le rapport TFE

- **Règle couple comme propriété vérifiable par le système** : TOCTOU → verrou `FOR UPDATE` dans une `$transaction` interactive ; ordre verrou→count→décision→écriture ; garantie protocolaire assumée (unique porte d'écriture) et pourquoi elle n'est pas structurelle (« au plus 2 » sans expression déclarative SQL simple).
- **Choix verrou plutôt que `SERIALIZABLE`** (éviter le retry pour une contention négligeable).
- **Sécurité SQL** : `$queryRaw` tagged template (paramétrage anti-injection, STRIDE Tampering) ; nom de table physique hors ORM.
- **Anti-mass-assignment** par whitelist stricte au `PATCH` ; preuve par relecture de la **base** et non de la réponse.
- **Cohérence d'invariant création/modification** (`prenom` non vide) : le PATCH ne doit pas être une porte dérobée vers un état que le POST interdit.
- **Soft delete idempotent** : invariant `actif/date_sortie` protocolaire ; préservation de la `date_sortie` historique ; `date_sortie` = fait système non falsifiable.
- **Critère général du verrou** : invariant violable vs valeurs concurrentes toutes correctes.
- **Stratégie d'isolation des tests** : reseed par fichier + sérialisation ; arbitrage vitesse/déterminisme ; pourquoi pas base-par-worker (proportionnalité). Source unique du seed (`seedData.ts`).
- **Minimisation contextuelle** : le `select` d'une route dépend de *ce que l'action/la vue doit montrer* (mêmes champs exclus au POST, exposés au DELETE et au GET `tous`).
- **RBAC par finalité** : deux lectures de résidents (US-04 prise de commande / US-05 gestion administrative), deux périmètres de rôles.

---

## Exigences EPHEC couvertes

- ✅ **Tests d'intégration** : 36 → **54 verts**. Discipline TDD maintenue (Red rouge séparé du Green ; refactor du verrou en commit distinct ; tests « nés verts » assumés sans faux rouge). Ordre sécurité-first respecté sur chaque route.
- ✅ **Analyse de sécurité** : anti-injection (`$queryRaw` paramétré), anti-mass-assignment (whitelist), concurrence (verrou), tous rattachables au STRIDE §9.2. Preuve exécutable de la whitelist (relecture base).
- ✅ **Documentation du code** : invariants seed (Convention A), justifications structurantes, source unique `seedData.ts`.
- ✅ **Versioning Git** : narration TDD étendue (POST : forme/existence/201/place-libre/409 + refactor verrou ; PATCH : forme/existence/succès/gardes/sécurité ; DELETE : forme/existence/succès/idempotent ; GET : défaut/tous ; commit `test(infra)` d'isolation). *Vigilance héritée* : homogénéité de la casse du scope (`us-05` vs `US-05`) à vérifier avant remise.

---

## État des fonctionnalités / routes

- ✅ **US-01** — `POST /api/auth/login`.
- ✅ **US-02** — `GET /api/users`.
- ✅ **US-03** — middlewares `authenticateToken` + `requireRole([...])`.
- ✅ **US-04** — `GET /api/appartements` + `GET /api/appartements/:numero/residents`.
- ✅ **US-05 — CRUD résidents (complète)** :
  - `POST /api/residents` — création, résolution `numero`→appartement, **règle couple** (verrou `FOR UPDATE` + transaction interactive), 201/400/404/409.
  - `PATCH /api/residents/:id` — whitelist `prenom`/`nom` anti-mass-assignment, 200/400/404.
  - `DELETE /api/residents/:id` — soft delete idempotent (`actif: false` + `date_sortie`), préservation historique, 200.
  - `GET /api/residents?tous=1` — filtrage `actif` par param, RBAC administratif, 200.
- **Infrastructure de test** — isolation par reseed par fichier (`vitest.setup.js`) + `fileParallelism: false` ; source de seed unique (`seedData.ts`).

---

## Blocages rencontrés et résolution

- **Affirmation fausse « une transaction ferme le TOCTOU »** → décomposée (atomicité orthogonale ; isolation = niveau réglable, `READ COMMITTED` par défaut). Débloqué vers le verrou.
- **Pollution inter-fichiers** (créations `POST` polluant les lectures US-04) → diagnostic par signature (appart 3 épargné car 409), résolution par reseed par fichier (Option C).
- **Race dans le harnais** (reseed parallèle sur base partagée) → identifiée seul par transfert du concept TOCTOU, résolue par `fileParallelism: false`.
- **Green obtenu au mauvais endroit** (code écrit hors du fichier attendu, « tout vert » trompeur) → recodé au bon endroit, vrai rouge retrouvé. Leçon : un « tout vert » sans rouge préalable est suspect.
- **Insulte en séance** (frustration sur une demande de vérification) → limite posée une fois, registre professionnel réaffirmé, travail repris sans dramatisation.

---

## Ce qui reste à faire

### En Phase 2
1. **US-06 — Changement de résident** : transaction atomique (sortant archivé + entrant créé). Le seed pré-charge apparts 6 (inactif seul) et 7 (mixte actif/inactif). Articulation avec le verrou couple d'US-05 à anticiper (l'entrée d'un résident franchit le seuil → même protocole de verrou).
2. **US-13 — CRUD allergies** : données de santé sensibles, `created_by`, RGPD.

### Points ouverts non bloquants
3. **Homogénéité de la casse du scope Git** — vérifiée sur la tranche S9 (`git log --oneline -25`) : tout en `us-05` / `test(infra)`, cohérent. Reste à vérifier les commits US-01→US-04 (héritage S8 : `us-04` vs `US-04`) avant remise.
4. **Update Prisma 7.8 → 7.9** — commit isolé `chore(deps)` (hérité).
5. **Newline finale** sur les fichiers de test (hérité S8).

**Note narration Git** : le `log` montre la refonte `test(infra)` d'isolation **intercalée entre le Red et le Green du premier cycle PATCH** (`2998fe6 red PATCH forme` → `d65ce60 test(infra)` → `df35c1d green PATCH forme`), fidèle au déroulé réel (la pollution inter-fichiers a surgi à ce moment). Historique **honnête**, à ne pas réécrire (déjà poussé sur `origin/main`). Explication orale prête : « la pollution a surgi pendant le premier cycle PATCH, traitée avant de continuer ». Les commits « né vert » (`3382e4a` filtre count, `0279e79` anti-mass-assignment, `d58b500` `?tous=1`) sont marqués et **sans `feat` associé** — pas de faux rouge fabriqué.

### Points hérités (avant remise du 17 août)
7. **Figures du rapport** (EA + relationnel + UML classes) à aligner sur le schéma verrouillé (S1).
8. **Passe backlog** groupée (alignement S3→S9 ; le backlog marque encore US-05 « Livré session 4 » de l'ancien projet — à corriger).
9. **Justification du modèle à deux champs** `id_appartement` / `numero` à formaliser pour l'oral.
10. **Justification niveau « Faible »** §9.5 (demi-phrase, hérité S7).

Rappel calendrier : rapport dû le **17 août** (~19 jours). Livraison produit dans les deux semaines suivantes (date exacte non fixée). Marge convenable ; vigilance à l'ouverture de la Phase 3 (cœur métier commandes).

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
│   ├── vitest.config.js              ← NOUVEAU (setupFiles + fileParallelism: false)
│   ├── vitest.setup.js               ← NOUVEAU (reseed données par fichier)
│   ├── .env / .env.test              (gitignorés)
│   ├── node_modules/                 (gitignoré)
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.ts                   ← MODIFIÉ (importe depuis seedData.ts)
│   │   ├── seedData.ts               ← NOUVEAU (source unique des données de seed)
│   │   └── migrations/
│   │       └── <timestamp>_init/
│   └── src/
│       ├── app.js                    ← MODIFIÉ (montage router residents)
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
│           ├── appartements.js
│           ├── residents.js          ← NOUVEAU (POST/PATCH/DELETE/GET US-05)
│           └── __tests__/
│               ├── auth.test.js
│               ├── users.test.js
│               ├── appartements.test.js
│               └── residents.test.js ← NOUVEAU (18 tests US-05)
└── frontend/
```

Frontend non démarré (Phase 4).

---

## Instructions pour reprendre (Session 10)

- **Contexte :** US-05 **complète**, **54 tests verts**, isolation des tests en place. Prochaine cible : **US-06 — Changement de résident** (transaction atomique sortant/entrant). Palier 1 (socratique) sauf demande d'accélérer.
- **Cadrage à traiter au démarrage de S10 (US-06) :**
  1. Ouvrir le backlog (§ US-06) : que recouvre exactement « changement » — archiver le sortant **et** créer l'entrant dans **une** transaction atomique ? Codes de retour, corps.
  2. **Articulation avec le verrou couple** : l'entrant est un nouvel actif → il franchit le seuil. La transaction doit-elle reprendre le `FOR UPDATE` sur l'appartement ? (Le sortant libère une place ; ordre des opérations dans la transaction.)
  3. Fixtures : apparts 6 (Baudouin, inactif seul) et 7 (Francis actif + Leopold inactif) déjà pré-chargés — lesquels servent quel cas de test ?
  4. Atomicité : si la création de l'entrant échoue, l'archivage du sortant doit être annulé (tout ou rien) → `$transaction` interactive.
- **Rappels transversaux (inchangés + nouveaux de S9) :**
  - RBAC écriture résidents : `requireRole(['secretaire'])`.
  - Résolution appartement : `connect: { numero }` (numéro métier, `@unique`).
  - Verrou concurrence : `tx.$queryRaw\`… FOR UPDATE\`` **en tête** de `$transaction` interactive, tout sur `tx`, jamais `prisma`. Verrou AVANT count.
  - `$queryRaw` tagged template (jamais `$queryRawUnsafe`) ; nom de table physique `"Appartement"` (pas de `@@map`).
  - Whitelist en écriture : ne **lire** que les champs autorisés du body.
  - Invariant `actif = false ⇒ date_sortie` tenu par le code (unique porte d'écriture).
  - Minimisation contextuelle : le `select` dépend de ce que l'action/vue doit montrer.
  - **Isolation des tests** : reseed par fichier (`vitest.setup.js`), `fileParallelism: false`, source unique `seedData.ts`. Tests indépendants de l'ordre (résidents distincts intra-fichier + reseed inter-fichiers).
  - Vérifier le schéma / le seed / le corps d'erreur **sur pièce** avant d'affirmer.
  - Discipline commit : Red rouge séparé du Green ; verrou/refonte = `refactor:` ou `test(infra):` ; messages écrits par Hippolyte, Conventional Commits, scope minuscule ; donner le **compteur** après chaque Green.
- **Commandes de relance :**
  - `cd backend && docker compose up -d`
  - `npm test` — **54 tests verts** attendus (~8 s, sérialisé).
  - Pipeline : `dotenv -e .env.test -- bash -c 'npx prisma migrate reset --force && vitest run'` (reseed par fichier via `setupFiles`, plus de `db seed` chaîné).
- **Vérifications rapides :**
  - `git log --oneline -25` — narration TDD US-05.
  - `cat prisma/seedData.ts` — 6 résidents, invariants ; apparts 3 (couple), 4 (Hervé seul), 5 (vacant), 6 (Baudouin inactif), 7 (mixte).
  - `cat src/routes/residents.js` — routes US-05 de référence (verrou, whitelist, soft delete).
  - `cat vitest.setup.js` / `vitest.config.js` — mécanique d'isolation.

---

*Rapport mis à jour le 29 juillet 2026 — Session 9*
