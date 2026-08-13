# Session 12 — US-07 : Menu du jour (POST + GET)

**Auteur :** Hippolyte AMORY
**TFE :** Le Cénacle — application web interne de gestion des commandes du restaurant
**Date :** 5 août 2026
**Défense :** 17 août 2026
**Mode :** Palier 1 (socratique) — code écrit intégralement par Hippolyte

---

## Contexte et état de départ

Phase 2 close à fin S11 (US-04, US-05, US-06, US-13 — 86 tests verts). Ouverture de la **Phase 3 (cœur métier commandes)** selon `plan_daction.md`, qui met **US-07 (menu du jour)** en tête — bon ordre, car US-08 (saisie commande) dépend directement d'une `LigneCommande` pointant sur une `OptionMenu` : le menu doit exister avant qu'on puisse commander dessus.

**Objectif de la session :** livrer US-07 en entier — `POST /api/menus` (création menu + options) et `GET /api/menus?date=` (récupération par date) — en TDD strict, chaque décision de conception cadrée avant implémentation et défendable devant jury.

**État de fin de session : US-07 complète, 120 tests verts** (86 → 120).

---

## Ce qui a été travaillé

### 12.1 — Cadrage US-07 (avant toute ligne de code)

Toutes les décisions verrouillées avant le premier cycle TDD :

- **RBAC différencié** POST vs GET (voir 12.7 — première route du projet avec deux périmètres RBAC distincts).
- **Forme de réponse** : objet enveloppé `{ id_menu, options: [...] }`, jamais un tableau nu (cohérent US-04/US-13).
- **Unicité** : structurelle (`date_menu @unique`), pas protocolaire (voir 12.3).
- **Immuabilité `OptionMenu`** : documentée en 3 tiers (voir 12.4), correction bornée en choix A.
- **`GET ?date=`** : lookup par clé naturelle → 404 si absent (voir 12.5).
- **Dérivés serveur** `semaine`/`annee` : calculés, jamais reçus du client (voir 12.6).

**Vérification schéma vs backlog** : le `backlog_user_stories.md` décrit le projet antérieur (références « session 18 »). Le schéma verrouillé prime. Sur pièce : `TypeRepas` = `petit_dejeuner`/**`diner`**/`souper` (pas `dejeuner`) ; `CategorieOption` = **11 valeurs** (`entree, plat, plat_substitution, dessert, fruits, yaourt, soupe, soupe_dessert, repas_complet, plat_dessert, plat_seul`), pas 7 ni `fruits_yaourt`. La checklist de la synthèse était périmée sur ces deux points — corrigée.

### 12.2 — POST : pile de gardes de validation (TDD par mutants)

Neuf gardes séquentielles, sécurité-first, chacune née d'un cycle Red/Green séparé, témoins choisis par mutant :

1. **401** (identité) → **403** (rôle) — `serveur → 403` d'abord ; le côté positif (rôle autorisé traverse) fermé par le 201.
2. **Présence date** (`date === undefined`, étroit) — `null`/`""`/reste descendent aux gardes suivantes. Message groupé « Champs obligatoires manquants ».
3. **Présence options** (`options === undefined`) — garde **séparée** de la présence date (deux marches, même message réutilisé, pas une fusion `||`).
4. **Type date** (`typeof date !== "string"`) — deux témoins de **types distincts** (`null` : object ; `123` : number) pour tuer les mutants de rétrécissement (`=== null`, `typeof === "number"`).
5. **Forme date** (regex `^\d{4}-\d{2}-\d{2}$` ancré) — témoin dominant `"10/08/2026"` (slash, cas réaliste) + `"hello"`. Le `$` ancré tenu par un né-vert `"2026-08-10T00:00:00Z"` (datetime ISO valide mais hors format date pur — seul témoin distinguant regex+parse de parse seul).
6. **Calendaire** (`isValid(parseISO(...))`) — `"2026-02-30"` (jour) + `"2026-13-01"` (mois). Décision **ajouter, pas remplacer** le regex : `parseISO` accepte des ISO partiels (`"2026-08"`, `"2026-W32"`) et le datetime, que seul le regex ancré recale. Les deux gardes irréductibles.
7. **`Array.isArray(options)`** — marche « cachée » (type avant `.length`/`.map`) ; `"hello"` (string, `.length=5` trompeur) + `{}`.
8. **Non-vide** (`options.length === 0`) — rougit contre **201** (déchet silencieux : `create` avec `options: { create: [] }` crée un menu sans options), pas 500.
9. **Chaque option est un objet** (`typeof o !== "object" || o === null`) — trou `null` dans le tableau (`typeof null === "object"` laisse filer `null` sans le second terme) ; témoins `null` + `"hello"`, en position 2 pour balayer tout le tableau.
10. **Libellé par option** (`typeof o.libelle !== "string" || o.libelle.trim() === ""`) — deux branches, deux témoins (`123` → typeof ; `"   "` → trim), **isolation prouvée par mutation manuelle** (commenter chaque branche, vérifier que chaque témoin rougit seul ; sous suppression de `typeof`, `123` casse en 500 → preuve exécutable de l'ordre du court-circuit).
11. **Catégorie par option** (`!Object.values(CategorieOption).includes(o.categorie)`) — **source unique** (enum importé de `@prisma/client`, jamais de liste en dur ; 11 valeurs vérifiées au `node -e`). Catégorie absente = « invalide » (divergence assumée vs US-13, figée par un né-vert).

### 12.3 — POST : unicité structurelle (P2002 → 409)

`date_menu @unique` = garantie **structurelle** (l'index base refuse atomiquement toute 2e insertion), à distinguer de la règle couple d'US-06 (protocolaire, vivait dans le code → verrou). **Pas de verrou, pas de pré-check `findUnique`** : un pré-check aurait son propre TOCTOU (deux requêtes passent le check, une gagne l'insert), donc ne peut jamais être le rempart. Le **catch P2002 est obligatoire quel que soit le reste**. Ciblage `e.code === "P2002"` → 409 ; tout autre code → 500 explicite (pas de catch large avalant tout en 409).

### 12.4 — POST : immuabilité `OptionMenu` en 3 tiers (décision de conception)

Le schéma fait de l'immuabilité d'`OptionMenu` la justification du « pas de snapshot dans `LigneCommande` ». Cette immuabilité **n'est ni structurelle ni protocolaire** :
- pas une contrainte base (`@unique`) — un `UPDATE` SQL direct passerait ;
- pas une vérif runtime (aucun check dans le code) ;
- mais une **garantie de surface applicative** : l'API sanctionnée est l'unique voie d'écriture **à l'exécution** et n'expose aucune mutation (ni PATCH, ni DELETE, ni ajout d'option à un menu créé). L'immuabilité porte sur le **jeu d'options entier**, pas seulement les champs d'une option existante.

**Limite assumée et documentée** : un accès base direct, une migration ou l'ajout futur d'une route la contournent — voies **non sanctionnées / hors-bande**. Décision de conception documentée, pas état de fait transitoire.

**Correction d'un menu (choix A)** : hors périmètre US-07 (spec = POST + GET). Borné explicitement ; route de correction **gardée** (refus si une commande dépend du menu) prévue en US future. Une correction non gardée serait de la vigilance comportementale, contraire au principe « propriété vérifiable par le système ».

### 12.5 — GET : lookup par clé naturelle (404, pas `[]`)

`date_menu @unique` fait de la date une **clé naturelle** → `GET ?date=` est une **recherche de ressource par clé** (comme `GET /users/:id`), pas un filtre de collection. Le tell : la réponse est un **objet** (`{ id_menu, options }`), pas un tableau. Donc date valide sans menu → **404** (« Aucun menu pour cette date »), jamais `200 []`. Distinction avec le `[]` d'US-13 : là le parent (résident) existait, seule la sous-collection était vide ; ici la date seule n'est pas une ressource. Taxonomie en couches : **400 avant 404** (date pourrie rejetée à la porte, avant toute requête base).

### 12.6 — Dérivation ISO + stockage UTC (dette fuseau soldée)

`semaine`/`annee` **calculés serveur** depuis `date_menu` (`getISOWeek` / `getISOWeekYear`, noms vérifiés sur doc), **jamais reçus du client** (whitelist : entrée = `date` + `options[]`). Colonnes justifiées par le regroupement des exports hebdo/mensuels (US-16→19).

**Convention ISO cohérente** : `semaine` ET `annee` de la **même** convention (année-ISO, pas `getFullYear`) — au 31/12, un jour peut tomber en semaine 1 de l'année suivante ; `getISOWeekYear` gère la paire, `getFullYear` la casserait. Témoin de test frontière : `2027-01-01` → semaine 53, année 2026.

**Stockage minuit UTC** (`parseISO(date + "T00:00:00Z")`) : sans le suffixe, `parseISO("2026-08-19")` rend minuit **local** (Bruxelles UTC+2 → `2026-08-18T22:00Z`), et un autre chemin d'écriture (import, seed) écrivant minuit UTC franc créerait un doublon que l'`@unique` ne dédupliquerait pas. Le fix rend l'`@unique` **fiable par instant canonique** — répare l'invariant central du POST. **Le GET réutilise exactement le même parse UTC** pour le lookup, sinon il chercherait un instant que le POST n'a jamais stocké (fuseau réincarné côté lecture). Une seule source `dateObj` alimente validation, stockage et dérivation.

### 12.7 — RBAC différencié POST / GET

- **POST** = `secretaire` + `cuisine` (geste métier opérationnel : la saisie du menu). **admin exclu par finalité** (gère comptes/config, pas le contenu opérationnel) — passé au test de finalité, pas ajouté par réflexe.
- **GET** = `secretaire` + `cuisine` + `serveur`. **serveur inclus** : besoin métier **confirmé** — le serveur livre en chambre et consulte le menu du jour pour son contexte de livraison. **admin exclu** par cohérence (aucune tâche opérationnelle, ni écriture ni lecture menu).

**Source de vérité** : cette liste de rôles n'existe pas dans le backlog (qui ne mentionne que la saisie secrétaire/cuisinier). Décision de la reprise, documentée ici pour être vérifiable — pas un souvenir de conversation. Couverture RBAC GET complète : `admin → 403` (exclu), et les trois rôles autorisés prouvés traversants (`secrétaire` via cas passant, `cuisine`/`serveur` via né-vert).

### 12.8 — Taxonomie de messages d'erreur (règle en 3 registres)

Instaurée pendant US-07, **contrat message** (les tests assertent `res.body.error`, pas seulement le statut) — appliqué à partir de la garde options du POST ; les gardes antérieures ne garantissent que le statut (assumé, non rétro-testé). Règle énonçable :
1. **Présence d'un champ de body** (potentiellement plusieurs requis) → « Champs obligatoires manquants » (groupé, cohérent anti-énumération).
2. **Présence du paramètre de recherche d'un GET** (unique, nommé) → « [Param] requise » (« Date requise » ; le groupé sonnerait faux au singulier).
3. **Forme d'une valeur** (type, format, calendaire) → « [Param] invalide » (« Date invalide », partagé POST/GET car le correctif client est identique).

### 12.9 — GET : garde `typeof` omise (couplage parser documenté)

`req.query.date` en **parser de query par défaut** (Express 5, non étendu) ne rend que `string` ou `undefined`. Vérifié sur pièce : `?date=a&date=b` → tableau (recalé par le regex via coercion virgule) ; `?date[]=x` → clé littérale `date[]`, `req.query.date` reste `undefined` ; `?date=` → `""`. Le singleton `["x"]` (qui passerait le regex) n'est atteignable qu'avec le parser **étendu** (`qs`), non activé.
**Conséquence** : la garde `typeof` du POST est **superflue sur le GET** (aucun non-string n'atteint le regex). **Couplage à documenter** : à réintroduire si le parser passe en `extended`. Pile GET plus courte que POST — asymétrie voulue, justifiée par la différence de source (body JSON tout-type vs query string|undefined).

### 12.10 — Minimisation à la source + factorisation `menuSelect`

Constante `menuSelect` déclarée une fois, **partagée POST et GET** (`select: menuSelect` aux deux points d'usage — vérifié `grep`). Projette `{ id_menu, options: [{ id_option, libelle, categorie }] }` avec `orderBy: { id_option: "asc" }` (ordre déterministe → `toEqual` strict tient). `contient_allergenes` (String?, sensible en US-14), `semaine`, `annee` **ne quittent jamais Postgres** (minimisation dans la requête, pas re-map JS). `toEqual` strict prouve l'absence de fuite. Factorisation = cohérence écriture/lecture garantie par construction (une seule définition à faire évoluer).

### 12.11 — Atomicité du nested create (propriété ORM, documentée non testée)

La création `menu.create` avec `options: { create: [...] }` est **atomique** (transaction implicite Prisma, rollback si une option échoue). **Non testée par intégration** : les pré-gardes de validation rejettent toute option malformée **avant** le `create`, donc aucune option validée ne peut échouer en base (vérifié sur `OptionMenu` : PK auto-générée, FK remplie par Prisma, enum + libellé pré-validés, `contient_allergenes` optionnel). Le seul échec résiduel (`@unique` sur `date_menu`) rejette le menu **parent** avant toute option — pas d'état partiel. Le chemin de rollback est **inatteignable par l'API** → propriété de l'ORM documentée, non un comportement introduit par le code applicatif.

---

## Concepts compris / à consolider

**Acquis (démontrés en autonomie cette session) :**
- **TDD par mutants** : témoins de types distincts pour une garde catégorielle ; témoin dominant vs faible (le Red se choisit pour ce qu'il *interdit*) ; **mutation manuelle** pour prouver l'isolation de deux branches sous un même message/statut (le seul cas où la suite verte ne distingue pas branche vivante de branche morte).
- **Distinguer structurel / protocolaire / surface applicative** : trois tiers de garantie, `@unique` vs verrou vs absence de route.
- **Vérifier sur pièce avant d'affirmer** : appliqué de façon autonome (parser de query, `typeof null`, `Object.values`, comportement `parseISO` sur datetime/ISO partiels, `getISOWeek` frontière). Détection en amont d'un RBAC codé sur un souvenir non sourcé → arrêt et documentation avant de coder.
- **Sur-tester est un défaut de jugement** autant que sous-tester : figer par test un invariant (categorie-absente), assumer par décision documentée un choix cosmétique (ordre libelle/categorie).

**À consolider :**
- Réflexe « montrer la pièce » plutôt que « c'est fait » quand un résultat en dépend et que la suite verte est aveugle à la différence (cas `error`/`erreur`, forme du `parseISO`).

---

## Points à mentionner dans le rapport TFE

Tous les choux justifiés de 12.3 à 12.11 sont des points de défense. Prioritaires :
- **Immuabilité 3 tiers** (12.4) — la distinction avec `@unique` est la parade à « et un UPDATE direct ? ».
- **Unicité structurelle + fuseau UTC** (12.3, 12.6) — l'invariant « une entrée par date » n'est vrai qu'avec le stockage UTC canonique ; sans lui, l'`@unique` est perçable.
- **RBAC par finalité** (12.7) — admin exclu écriture ET lecture, chaque rôle passé au test.
- **Taxonomie de messages** (12.8) — règle en 3 registres, pas des libellés ad hoc.
- **Minimisation factorisée** (12.10) — `toEqual` prouve l'absence de fuite, `menuSelect` garantit la cohérence POST/GET.
- **Atomicité documentée non testée** (12.11) — savoir défendre *pourquoi* un test serait malhonnête ici.

---

## Exigences EPHEC couvertes (progression)

- ✅ **Tests d'intégration** : 86 → **120 verts**, discipline TDD (Red/Green séparés, né-vert nommé, refactor distinct).
- ✅ **Versioning Git** : Conventional Commits, narration TDD, un né-vert nommé, un `build(deps)` (date-fns), refactors distincts (regroupement gardes, `error`/`erreur`).
- ✅ **Analyse de sécurité / RGPD** : minimisation exécutable étendue (menu), P2002→409 (taxonomie), immuabilité documentée.
- ✅ **Documentation du code** : décisions de conception justifiées et sourcées.

---

## État des routes US-07

- ✅ `POST /api/menus` — `secretaire`/`cuisine` — 9 gardes de validation + unicité P2002→409 + création atomique + dérivation ISO + stockage UTC + minimisation `menuSelect`.
- ✅ `GET /api/menus?date=` — `secretaire`/`cuisine`/`serveur` — 401→403→400(présence/forme/calendaire)→404(lookup)→200(enveloppe projetée), parse UTC cohérent avec le POST.

---

## Blocages rencontrés et résolution

- **Faux `refactor` `error`/`erreur`** : un Green a introduit la clé `error` là où les autres gardes utilisaient `erreur` ; invisible aux tests (statut seul assertê). Résolu en unifiant sur `error` (aligné sur les routes existantes) + instauration du contrat message. Leçon : une clé de réponse ré-écrite à la main à chaque garde peut diverger — source unique d'erreur = amélioration notée.
- **Piège fuseau (3 réincarnations)** : POST (écriture), GET (lecture), fixture GET — chacun devait utiliser `parseISO(date + "T00:00:00Z")` pour rester sur le même instant. Résolu, fixture 200 créée via POST (cohérence fuseau automatique).
- **RBAC codé sur un souvenir** : la liste de rôles GET n'était sourcée nulle part → arrêt, documentation de la décision (12.7) avant de coder.

---

## Ce qui reste à faire

### Dettes / limites (pour l'analyse critique du rapport)
1. **Observabilité des erreurs incohérente sur toute l'API** : seul `auth.js` logge `e` avant un 500 ; un middleware d'erreur global (log + forme de réponse centralisés) serait la correction propre. Le catch 500 d'US-07 a été aligné sur `auth.js` (`console.error`).
2. **Branche 500 générique non couverte** (POST et GET) : provoquer une erreur Prisma arbitraire en test serait disproportionné — choix de couverture assumé.
3. **Dette `beforeAll` d'`allergies.test.js`** (héritée S11) : toujours ouverte (helper de forge de token à factoriser).

### Suite Phase 3 (selon `plan_daction.md`)
- **US-08** (saisie commande dîner, UC-01) — dépend d'US-07 (LigneCommande → OptionMenu).
- **US-14** (détection allergie non bloquante à la saisie) — exploite `contient_allergenes` / matching libellé.
- US-09 (annulations 3 niveaux), US-20 (Socket.IO), US-11 (remarque), US-10 (couples/invités).

### Hérité (avant le 17)
- Aligner figures rapport (EA, relationnel, UML) sur le schéma verrouillé.
- Formaliser la justification `id_appartement` / `numero` (question de jury quasi certaine).
- Dockerisation applicative, Kanban, analyse critique §11, déclaration IA.

---

## Structure du dépôt (modifications S12)

```
backend/src/routes/
├── menus.js              ← NOUVEAU (POST + GET, menuSelect factorisé)
└── __tests__/
    └── menus.test.js     ← NOUVEAU (34 tests US-07)
backend/package.json      ← MODIFIÉ (date-fns en dependencies)
```

---

## Instructions pour reprendre (Session 13)

```bash
cd backend
docker compose up -d
npm test              # 120 tests verts attendus
```

**US-07 close** (POST + GET, 120 verts). Prochain jalon : **US-08 (saisie commande dîner)**, qui consomme les `OptionMenu` créées par US-07 — première route à créer des `LigneCommande` pointant sur le menu. Cadrer avant tout code (RBAC, forme, taxonomie, gestion de l'allergène pour la jonction US-14).

**Rappels de posture :** Palier 1 (socratique) ; sécurité-first (401→403→400→404→…) ; Red committé séparément du Green ; né-vert nommé ; minimisation prouvée par `toEqual` ; vérifier sur pièce avant d'affirmer (des deux côtés) ; `parseISO(date + "T00:00:00Z")` pour toute manipulation de `date_menu` (cohérence fuseau).

---

*Rapport mis à jour le 5 août 2026 — Session 12*
