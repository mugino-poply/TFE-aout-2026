# Session 13 — US-08 (saisie commande dîner, UC-01)

**Auteur :** Hippolyte AMORY
**TFE :** Le Cénacle — application web interne de gestion des commandes du restaurant
**Défense :** 17 août 2026
**Date de session :** 7 août 2026

---

## Contexte et état de départ

Fin de S12 : US-07 (menu du jour) close, **120 tests verts**, Phase 3 (cœur métier commandes) ouverte. Objectif S13 : **US-08 — saisie de la commande de dîner (UC-01)**, `POST /api/commandes`, première route créant des `LigneCommande` qui pointent sur les `OptionMenu` d'US-07. État final : **139 tests verts**, US-08 fonctionnellement complète côté code.

Fil rouge de la session, au-delà d'US-08 : la discipline **« vérifier sur pièce, pas affirmer de mémoire »** est passée de règle imposée à réflexe appliqué par l'étudiant lui-même (remédiation Git honnête, rétractations spontanées). C'est l'acquis méthodologique majeur.

---

## Ce qui a été travaillé

### 13.1 — Cadrage complet d'US-08 avant toute ligne de code

Tous les axes tranchés et **sourcés** avant le premier cycle TDD. Le backlog décrit le projet antérieur : le **schéma verrouillé prime** (trois contradictions relevées d'emblée : `Commande` n'a pas de champ `id_menu` ; `id_resident` est non-nullable même pour les invités ; PK `OptionMenu` = `id_option`, pas `id_option_menu`).

- **Dérivation menu → date (jamais reçue du client).** `Commande` n'a pas d'`id_menu` ; le lien vers le menu est *indirect* via `LigneCommande.id_option → OptionMenu.id_menu`. Décision : le client envoie **les plats**, point. On dérive le menu des plats, puis la date du menu. `date_repas` **calculée serveur**, jamais reçue — même doctrine qu'US-07 (whitelist `semaine`/`annee`). Justification défendable : *« je supprime un invariant à surveiller au lieu de le gérer »* — une date reçue en plus des plats créerait un cas « date ≠ plats » à arbitrer, tester, défendre ; une seule source le rend impossible par construction.
- **`type_repas` reçu et validé contre l'enum complet, PAS figé à `diner`.** Vérifié sur schéma : ni `OptionMenu` ni `Menu` ne portent d'information de repas (seulement `categorie` / `id_menu` / `date_menu`). Donc, contrairement à la date, **aucun fil** ne relie un plat à son repas → `type_repas` est une propriété *indépendante*, reçue comme `id_resident`. Le `create` est **agnostique au repas** (dérivation, index partiel, nested create identiques) → accepter l'enum n'ajoute **aucun comportement non testé** (≠ Socket.IO, différé car non testable). US-43 (petit-déj) et US-44 (souper) sont des US **frontend** qui déclarent le backend « déjà compatible » (l.1184/1193/1210) → figer `diner` casserait leur prérequis (garde-à-démolir).
- **Invité + rôle de `type_client`.** `id_resident` non-nullable → sur une commande d'invité, `id_resident` = **l'hôte facturé** (US-10 l.248, « premier résident actif »). Donc `id_resident` ne désigne pas toujours le mangeur : pour `resident` c'est le mangeur, pour les deux types d'invité c'est l'hôte. **`type_client` discrimine une seule chose : `id_resident` est-il le mangeur (repas propre) ou l'hôte (repas d'invité rattaché) ?** Le prix ne discrimine pas (`invite_resident` paie tarif résident, l.266) — écarté. US-10 est **entièrement frontend** ; le backend multi-type (accepter `type_client`/`note_invite`, exempter les invités du doublon) appartient à US-08, une commande à la fois (pas de batch).
- **Doublon (409) = index unique PARTIEL, structurel.** Aucune contrainte `@unique` sur `(id_resident, date_repas, type_repas)` (deux `@@index` non-uniques seulement) → règle **protocolaire** au départ. Arbitrage **structurel vs verrou** tranché sur la *garantie*, pas le coût : le doublon est une **unicité**, donc exprimable en base ; prendre le verrou reviendrait à choisir la garantie faible (protocolaire, protège les seuls chemins qui verrouillent) quand la forte (structurelle, base refuse par tout chemin) est disponible. Contraste avec US-05 : là c'était un **comptage** (`≤ 2 actifs`), non exprimable en unicité → le verrou y était *nécessaire*, pas choisi. TOCTOU réel nommé (double-clic, retry réseau, deux secrétaires). L'index est **partiel** : `WHERE type_client = 'resident' AND statut = 'active'` — exempte les invités (dérivé du sens de `type_client`) et libère le créneau après annulation.
- **Nested create atomique, pas de transaction interactive.** En passant au structurel (« pas de pré-check, catch P2002 → 409 »), le *read-decide-write* du doublon **disparaît** → plus rien à sérialiser → simple `commande.create({ data: { …, lignes: { create } } })` (transaction implicite Prisma, atomique). Pas de TOCTOU sur le `findMany` d'options (immuabilité `OptionMenu`, doctrine 12.4).
- **Garde résident actif.** `findFirst({ where: { id_resident, actif: true } })` → `null` → 404, couvre inexistant **et** inactif en une lecture (anti-énumération : même message). Sourcé « on saisit pour un actif » (US-10 l.248/254, US-06 l.154). Justification défendable : la garde existe pour **ne pas dépendre** du frontend n'affichant que les actifs (« propriété garantie par la route, pas vigilance de l'UI »).
- **Frontière allergène (US-08 / US-14).** US-08 **crée** la commande ; tout le croisement `allergies_detectees` part en **US-14** (US dédiée, US-08 en prérequis, l.351). Pas de champ `allergies_detectees: []` spéculatif : aucun rouge honnête ne peut l'exiger aujourd'hui (le hardcoder = code spéculatif). Le `toEqual` strict est le filet : le jour où US-14 ajoute le champ, US-08 rougit et force la mise à jour consciente.
- **Socket.IO différé à US-20.** L'émission `nouvelle_commande` est un **effet de bord** hors de la réponse HTTP → **non testable** par Supertest (pas de rouge honnête possible sans changer de technique — espion sur `io.emit`, qui appartient à US-20). Distinction clé avec `type_repas` : là le comportement est observable dans la réponse ; ici non.
- **RBAC : `requireRole(['secretaire'])` seul.** Sourcé sur la story (l.191, seul rôle nommé) et sur le **principe transversal** « moindre privilège exigé par le RGPD » (US-03 l.94, vérifié mot pour mot). Admin **exclu** : le backlog *nomme* explicitement l'admin là où il le veut (export PDF l.1019, ownership US-13 l.325) → son silence en US-08 est une **exclusion délibérée**, pas un oubli. Posture « rôles littéraux par route », cohérente avec le moindre privilège (antithèse d'un admin-superset).
- **Forme du 201.** Enveloppe objet avec `lignes` imbriquées ; **9 champs scalaires** renvoyés, **4 internes exclus** (`created_by`, `created_at`, `updated_at`, `annule_le`) ; minimisation par `select` (pas `include`), prouvée par **`toEqual` strict** (prouve l'absence de fuite, pas seulement la présence) ; `id_commande` en `expect.any(Number)`.

### 13.2 — Étage de forme (8 gardes, TDD), frontière forme/base tenue

Toutes jugées **sur le body seul, zéro requête**. Ordre sécurité-first `401 → 403 → 400 → 404 → 409`, mais la vraie frontière est **l'accès base**, pas le code d'erreur (deux 400 encadrent la lecture : non-vide avant la base, même-menu après).

1. **Garde combinée de présence** `id_resident` / `type_repas` / `lignes` → 400 (une seule garde ; les cas `type_repas`/`lignes` absents sont des **né-verts** assumés, absorbés par la combinée — nommés comme tels, pas revendiqués comme rouges).
2. `type_client` **si fourni**, dans l'enum → 400 (`@default(resident)` → optionnel).
3. `type_repas` dans l'enum → 400.
4. `id_resident` `Number.isInteger` → 400 (**form-first** : cette garde posée *avant* la garde base, pour ne pas laisser un `id_resident: "abc"` atteindre Prisma → 500 ; « forme complète avant base » vraie à *chaque* commit, pas seulement à la fin).
5. `lignes` : `Array.isArray` → non-vide → chaque élément `Number.isInteger` → **distinct** (`new Set`). **Chaîne de préconditions** : chaque garde rétrécit le type pour que la suivante ait un sens (`Array.isArray` avant `.length` ; entier avant distinct, sinon `[1, "1"]` — deux fois le même id — passerait pour distinct dans un `Set`).

**Décision « ids distincts obligatoires »** sourcée sur l'**absence de `quantite`** sur `LigneCommande` (schéma l.102–110) : aucune notion de « deux fois le même plat ». Régler le doublon d'`id_option` **à la porte** (forme, 400) rend le `count` comparé de la garde existence un vrai test « tous existent » sans exception (Postgres dédoublonne `IN`).

### 13.3 — Garde résident actif : deux vrais rouges (décomposition TDD)

Décomposée en **deux cycles** pour que chaque rouge pilote une logique distincte :
- **Absent** (`999999`) → green existence seule (`findFirst({ where: { id_resident } })` → 404).
- **Inactif** (Baudouin, seedé `actif: false`) → contre le green existence-seule, Baudouin **existe**, traverse, retombe sur le stub → rouge **authentique** qui *force* le filtre `actif: true`. Un juré qui `checkout` le green existence-seule verra le test inactif rouge → narration « le filtre actif est né de son propre rouge » **vérifiable sur pièce**. Même patron que le red d'appartenance d'US-13.

Résolution des résidents par **clé métier** (`findFirst({ prenom, nom })`), jamais d'id en dur (auto-incrément). Fixtures **lecture seule** (rejet 404 avant tout insert) → pas de fixture locale ni d'`afterAll`.

### 13.4 — Lecture des options (existence, même menu, dérivation)

**Lecture unique** `findMany({ where: { id_option: { in: lignes } }, select: { id_option, id_menu, menu: { select: { date_menu } } } })` — source unique alimentant les trois gardes :
- **Existence** : `résultat.length !== lignes.length` → 404 (`count` comparé, honnête car distinct déjà garanti par la forme). Test isolant un manque **partiel** (`[réel, fantôme]`, pas tout-fantôme).
- **Même menu** : `new Set(options.map(o => o.id_menu)).size !== 1` → **400** (les plats *existent* → pas 404 ; leur **combinaison** est incohérente → requête malformée sémantiquement).
- **Dérivation** : `date_repas = options[0].menu.date_menu` (pris « en confiance » car même-menu a prouvé l'égalité). Chemin retenu : **élargir le `findMany`** (zéro requête supplémentaire) plutôt qu'un `menu.findUnique` séparé.

Fixtures options : **pas de menu/option seedé** (`seedData.ts` les *efface*, n'en crée aucun) → **fixtures locales** via `prisma.menu.create` direct (décor autonome, pas via `POST /api/menus` — découplage du SUT), dates UTC explicites distinctes, ids piochés depuis la réponse `select`. Pas d'`afterAll` (reseed par fichier nettoie).

### 13.5 — Happy-path 201, étagé en deux cycles

Décision consciente d'**étager** (vu la taille et la leçon `type_client`, éviter un green massif où un morceau casse en silence) :
- **Red 1 — création** : durci avec **relecture base** (`findUnique` post-réponse) prouvant persistance + dérivation (`date_repas` en base) + `created_by === userId` du token + `statut` default + nombre de lignes. Un green fantôme (`json({ id_commande: 1 })`) ne peut plus passer. Green : nested create avec `connect` partout (résident, `utilisateur` via `id_utilisateur: req.user.userId`, chaque `option`).
- **Red 2 — forme** : `toEqual` strict sur `res.body` (surface *réponse*, pas base). Prouve la **minimisation** (aucun `created_by`/`id_ligne` ne fuit au client). Le diff du `toEqual` a donné la spec exacte du green à écrire (dividende du strict vs `toMatchObject`).

**Point de conception tranché : ordre des `lignes`.** Le `select` imbriqué rend `lignes: [{ option: {...} }]` → `.map(l => l.option)` aplatit. L'ordre est reconstruit **depuis le body reçu** (via `Map` id→option), *pas* via `orderBy: { id_ligne: 'asc' }` initialement cadré. Justification défendable (corrigée en séance) : la garantie vient du **`Map`** (ordre de saisie garanti *indépendamment* de ce que fait Prisma), pas d'un pari sur l'ordre d'insertion de l'ORM. **⚠ dette narration** (voir plus bas).

### 13.6 — Doublon (409) : index partiel SQL brut + garde P2002

- **Migration SQL brute** (`prisma migrate dev --create-only --name doublon_resident_actif`, SQL collé à la main) : l'index partiel n'est pas exprimable dans le DSL Prisma (décision : SQL brut plutôt qu'une preview instable, invariant central). Clause finale :
  ```sql
  CREATE UNIQUE INDEX commande_resident_actif_unique
  ON "Commande" (id_resident, date_repas, type_repas)
  WHERE type_client = 'resident' AND statut = 'active';
  ```
  Table/casse/colonnes/valeurs d'enum vérifiées **sur pièce** (`\d "Commande"` en psql : `docker exec -it tfe_postgres psql -U tfe -d tfe -c '\d "Commande"'`, sans `-h/-p` car *dans* le conteneur). Postgres a coercé les littéraux en `::"TypeClient"` / `::"StatutCommande"` — preuve visible que valeurs et casse collent.
- **Checkpoint d'infra isolé** : `npm test` **avant** tout Red doublon → migration rejouée par `migrate reset` (index présent après reset sur `tfe_test` → **structurel, rejouable**), 138 verts inchangés (dates de fixture bien distinctes), pas de drift. On ne empile pas « migration » et « Red » (piège `bb96f48`).
- **Red doublon** : deux POST identiques → le second lève P2002, route sans `try/catch` → Express 5 forward → **500 vs 409** (rouge pour une raison neuve, pas 501). Isolation intra-fichier : première commande à date propre (16), aucune collision de clé.
- **Forme réelle de l'erreur observée** (`console.error(e)`, non supposée) : `e.code === "P2002"` ✓, mais **pas de `e.meta.target` plat** (index SQL brut, inconnu de Prisma via le schéma) → le nom vit dans `driverAdapterError.cause.constraint.fields` / `originalMessage`. Discrimination **niveau 1** retenue (`e.code === "P2002"` seul), adossée au fait `\d` : **une seule contrainte unique hors PK** sur `Commande` → tout P2002 = ce doublon. Le moins couplé (pas d'anatomie d'adaptateur, pas de parsing de message). `try/catch` autour du **`create` seul** ; `throw e` re-propage tout non-P2002.

### 13.7 — Remédiation Git : un `green` qui était rouge (leçon centrale)

Audit déclenché en séance sur le bloc `type_client`. Constats sur pièce (par `git show` / `checkout` + suite) :
- **`bb96f48`**, labellisé **`green`**, était en réalité **rouge** : la garde `type_client` était **morte** — `type_client` n'était **pas déstructuré** de `req.body`, donc `type_client !== undefined` déclenchait une `ReferenceError` (module ESM strict) → 500. Le test type_client (durci par `f4c199f` pour envoyer les requis) atteignait la garde et recevait 500, pas 400.
- Cause racine : **`green` committé sans lancer la suite.** `green` est une *affirmation de fait* (« la suite passe ») ; l'écrire sans exécuter = affirmer sans vérifier — **jumeau exact** du numéro de ligne cité de mémoire.
- **`d422f89`** (le fix qui déstructure `type_client` et ranime la garde) avait été committé sous un **message dupliqué** de `f4c199f`, pour débloquer un `checkout` sur arbre sale.
- **Correction** (historique non poussé → réécriture légitime) : `git rebase -i` **squash** `bb96f48` + `d422f89` → **`dba28e9`**, message honnête « déstructure et valide type_client contre l'enum si fourni ». Le squash **supprime** le commit `green`-qui-checkout-en-rouge (la mine qu'un juré déclenche par `checkout bb96f48 && npm test`). Backup `backup-avant-squash` posé puis levé après vérification des 124 verts.
- **Règle encodée** : on **nettoie l'historique avant de pousser, jamais après** ; on **lance la suite avant d'écrire `green`**, comme on grep avant de citer.

### 13.8 — Discipline « vérifier, pas affirmer » : appliquée par l'étudiant lui-même

Plusieurs corrections de citations de mémoire (numéros de ligne faux : `allergies_detectees` donné à 219/227 puis vérifié à 202/351 ; sources actif à 170/273/279 puis corrigées) — recadrées, puis **grep collé en sortie brute** au lieu de numéros reconstruits. Deux **rétractations spontanées** notables :
- l'ordre `orderBy id_ligne` « que le test a falsifié » → reconnu comme **« inférence maquillée en observation »** (le test ne pouvait pas départager les deux méthodes ; Prisma non testé). Justification ramenée sur ce qui est prouvable (la garantie vient du `Map`).
- distinction **trou de couverture vs trou de code** sur le `catch` non-P2002 (branche `throw e` correcte par conception, non exercée par un test — comme le rollback « inatteignable par l'API » d'US-07).

---

## Concepts compris / à consolider

**Acquis (défendables) :**
- **Dérivation vs réception** : un champ dérivable d'une source existante ne se reçoit pas (supprime un invariant à surveiller). Discriminé de `type_repas`, *non* dérivable faute de fil menu→repas.
- **Structurel vs protocolaire, choisi par la *nature de la règle*** : unicité → exprimable en base (index) ; comptage → verrou nécessaire. Le mécanisme découle de la règle, pas d'une préférence.
- **Index partiel SQL brut** : `WHERE` conditionnel non exprimable en DSL Prisma ; migration manuelle rejouée par `migrate reset` (structurel) ; drift assumé (Prisma ne le connaît pas via le schéma).
- **`green` = affirmation de fait** : lancer la suite avant de le proclamer. Un `toEqual` strict sauve du faux vert *au niveau test* ; il ne remplace pas l'exécution.
- **Réécriture d'historique avant push** (rebase/squash) pour un log honnête ; jamais après push.
- **Chaîne de préconditions** : forme (400) avant base (404/409) ; distinct avant count ; entier avant distinct — chaque garde rend la suivante *correcte*, pas seulement ordonnée.
- **Discrimination d'erreur la moins couplée** (`e.code` seul) adossée à un fait de structure (`\d` : une seule unique).

**À consolider :**
- **Réflexe « grep avant d'écrire un numéro/fait »** : encore quelques rechutes en début de session (numéros reconstruits de tête), corrigées mais à automatiser — un numéro de ligne est un fait, il se lit, il ne se reconstitue pas.
- **Distinction hôte/conteneur pour psql** (`-h localhost -p 5433` depuis l'hôte ; socket local depuis `docker exec`).

---

## Points à mentionner dans le rapport TFE

- **Dérivation serveur de `date_repas`** (une source de vérité : les plats → menu → date) — supprime le cas « date ≠ plats ».
- **Doublon structurel par index unique *partiel*** (SQL brut) : contraste avec le verrou d'US-05 (unicité vs comptage) ; garantie « tous chemins, niveau stockage » vs « seuls chemins qui verrouillent ». Projeter le `\d "Commande"` (coercition enum visible) comme preuve d'invariant au stockage.
- **`type_repas` enum complet reçu** : backend multi-type voulu (prérequis frontend US-43/44) ; le `create` agnostique au repas → aucun comportement non testé.
- **`type_client` discrimine mangeur/hôte** ; l'exemption invités du doublon *tombe* du prédicat de l'index, pas d'un cas bricolé.
- **Minimisation du 201 prouvée par `toEqual` strict** ; `select` = garantie système, `.map` = mise en forme d'un déjà-minimisé.
- **RBAC secrétaire-seul par moindre privilège** (US-03) ; exclusion admin *positivement sourcée* (nommé où voulu, silence = exclusion).
- **Remédiation Git honnête** (§13.7) : à raconter comme démonstration de maîtrise TDD (audit, faux vert détecté, squash), pas à cacher. Le log porte les cicatrices d'une revue = preuve de processus réel.

---

## Exigences EPHEC couvertes (progrès S13)

- **Tests unitaires/d'intégration** : **139 verts** (+19 vs S12). Discipline TDD renforcée (né-verts nommés, décomposition en rouges authentiques, isolation mutante).
- **Versioning Git** : narration TDD tracée **et auditée** ; réécriture d'historique **avant push** documentée (squash `dba28e9`).
- **Analyse de sécurité** : concurrence multi-écriture (TOCTOU doublon) fermée **structurellement** (index partiel) ; anti-énumération (404 identiques absent/inactif).
- **Documentation du code** : migration SQL commentée, décisions de conception justifiées inline.

---

## État des fonctionnalités / routes

- ✅ `POST /api/auth/login` (US-01)
- ✅ `GET /api/users` (US-02)
- ✅ middlewares `authenticateToken` / `requireRole` (US-03)
- ✅ `GET /api/appartements` + `GET /api/appartements/:numero/residents` (US-04)
- ✅ `POST/PATCH/DELETE/GET /api/residents` (US-05)
- ✅ `POST /api/appartements/:numero/changement` (US-06)
- ✅ `POST/GET/DELETE /api/residents/:id/allergies` (US-13)
- ✅ `POST/GET /api/menus` (US-07)
- ✅ **`POST /api/commandes` (US-08)** — auth (401/403) → forme (400, 8 gardes) → résident actif (404) → options existence (404) + même-menu (400) → dérivation `date_repas` → nested create atomique → doublon (409, index partiel P2002). **Fonctionnellement complète.**

---

## Blocages rencontrés et résolution

- **Faux `green` `bb96f48`** (garde `type_client` morte, `type_client` non déstructuré → 500) : détecté par audit `git checkout` + suite ; corrigé par squash `dba28e9`. Cause : `green` committé sans lancer la suite.
- **`checkout` bloqué par arbre sale** → WIP committé sous message dupliqué (`d422f89`) : résorbé par le squash. Leçon : pour auditer un commit passé, `git show <sha>:<fichier>` (lecture pure, HEAD immobile), pas `checkout` sur arbre sale.
- **Options tests sans données seedées** (`seedData.ts` efface menus/options, n'en crée aucun) : résolu par fixtures locales `prisma.menu.create` (décor autonome, dates UTC distinctes).
- **Piège fuseau reconduit** en fixture (`new Date("...T00:00:00.000Z")`, `Z` explicite) — équivalent au `parseISO(... + "Z")` d'US-07.

---

## Ce qui reste à faire

### US-08 — clôture non-code
1. **Narration `orderBy` au rapport** : documenter la reconstruction d'ordre par le body (`Map`), l'hypothèse `id_ligne = ordre d'envoi` abandonnée (jamais vérifiée) ; justification « garantie par le `Map`, indépendante de l'ORM ».
2. **Dette P2002** : discrimination sur `e.code` seul — valide *tant que* `Commande` n'a qu'une contrainte unique (vérifié `\d`) ; à raffiner si un second unique arrive.
3. **`catch` non-P2002** : branche `throw e` correcte par conception, **inatteignable par l'API** (gardes amont ferment tous les chemins d'erreur au `create`) — documenter comme le rollback « inatteignable » d'US-07, pas tester (test d'intégration impossible ; unitaire mocké = dette optionnelle).
4. **Single-source seed** : vérifier dans le dépôt vivant que `seed.ts` **importe** `seedData.ts` (pas de duplication du tableau `residents`) — la copie projet suggère une possible divergence.

### Phase 3 — suite
- **US-14** (détection allergie à la saisie, `allergies_detectees` — jonction déjà cadrée), **US-09** (annulations), **US-20** (Socket.IO), **US-11** (remarque), **US-10** (couples/invités, frontend), **US-43/44** (saisie petit-déj/souper, frontend — backend déjà compatible).

### Dettes / hygiène (héritées, non bloquantes)
- Factoriser les `beforeAll` d'`allergies.test.js` (helper forge de token). Factoriser les gardes d'enum (`type_client`/`type_repas`, motif identique) — **à la règle de trois**, pas avant.
- Middleware d'erreur global (log + forme 500 centralisés).
- Casse du scope Git US-01→US-04 ; update Prisma 7.8→7.9 ; newline finale des tests.
- Aligner figures EA/relationnel/UML sur le schéma ; formaliser le modèle `id_appartement`/`numero` ; §11 analyse critique ; déclaration IA.

---

## Structure du dépôt

```
TFE - AOUT 2026/
└── backend/
    ├── compose.yaml
    ├── package.json
    ├── prisma.config.ts
    ├── vitest.config.js
    ├── vitest.setup.js
    ├── prisma/
    │   ├── schema.prisma
    │   ├── seed.ts
    │   ├── seedData.ts
    │   └── migrations/
    │       ├── <timestamp>_init/
    │       └── 20260807135226_doublon_resident_actif/   ← NOUVEAU (index partiel SQL brut)
    │           └── migration.sql
    └── src/
        ├── app.js
        ├── index.js
        ├── lib/prisma.js
        ├── middlewares/
        │   ├── auth.js
        │   └── __tests__/{authenticateToken,requireRole}.test.js
        └── routes/
            ├── auth.js
            ├── users.js
            ├── appartements.js
            ├── residents.js
            ├── allergies.js
            ├── menus.js
            ├── commandes.js                             ← NOUVEAU (US-08)
            └── __tests__/
                ├── … (auth, users, appartements, residents, allergies, menus)
                └── commandes.test.js                    ← NOUVEAU (18 tests US-08)
```

---

## Instructions pour reprendre (Session 14)

Depuis `backend/` :

```bash
docker compose up -d
npm test              # 139 tests verts attendus
```

Pipeline complet (reset schéma + reseed par fichier + vitest) :

```bash
dotenv -e .env.test -- bash -c 'npx prisma migrate reset --force && vitest run'
```

Vérification rapide de l'index partiel (doit survivre au reset, sur `tfe_test`) :

```bash
docker exec -it tfe_postgres psql -U tfe -d tfe_test -c '\d "Commande"'
# → attendu : "commande_resident_actif_unique" UNIQUE ... WHERE type_client = 'resident'... AND statut = 'active'...
```

**US-08 close côté code (139 verts).** Prochain jalon S14 : au choix **US-14** (détection allergie à la saisie — `allergies_detectees`, jonction déjà cadrée : croiser `LigneCommande.option.libelle` — ou `option.contient_allergenes` — avec `resident.allergies`, non bloquant « choix Diego », test IT-02) **ou** clôture narration US-08 pour le rapport. Rappels : `parseISO(date + "T00:00:00Z")` pour toute `date_menu`/`date_repas` ; **lancer la suite avant tout commit `green`** ; **grep/`\d`/`git show` avant d'écrire un fait** (numéro, valeur, état de commit).

---

*Rapport mis à jour le 7 août 2026 — Session 13*
