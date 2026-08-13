# Session 7 — Ouverture Phase 2, audit RGPD du rapport, TDD complet sur route 1 d'US-04

**Date :** 26 juillet 2026
**Auteur :** Hippolyte AMORY
**Date de défense TFE :** 17 août 2026

---

## Contexte et état de départ

Phase 1 close en fin de S6 : 19 tests verts (US-01 login PIN, US-02 liste publique, US-03 middlewares `authenticateToken` + `requireRole`). Pattern route-par-route arbitré, chaîne `[authenticateToken, requireRole([...])]` figée. Palier 1 (socratique) confirmé pour toute la Phase 2.

Objectif de session : ouvrir la Phase 2 par US-04 (« Lister les appartements et leurs occupants »). Cadrage attendu : périmètre, matrice RBAC applicable, structure de la réponse.

Découverte imprévue en début de cadrage : la matrice RBAC §9.3.2 du rapport est incohérente avec UC-07 (acteurs) et UC-08 (scénario) sur l'accès aux allergies par le serveur. Cette découverte a déclenché un audit RGPD complet du rapport avant même d'écrire une ligne de code métier.

---

## Ce qui a été travaillé

### 7.1 — Audit RGPD du rapport : passe A (abandon de `LogAccesAllergie`)

Constat : le rapport mentionne `LogAccesAllergie` (journal de consultation des allergies) dans 8 emplacements, alors que la table a été **abandonnée en session 1** au profit d'un raisonnement compensatoire (RBAC + `created_by` + WireGuard + volume borné). Le rapport n'avait jamais été aligné sur cette décision.

Décision d'Hippolyte : maintenir l'abandon (posture assumée en S1) et corriger le rapport.

Emplacements corrigés :
- UC-07 §4.3 scénario nominal (mention `LogAccesAllergie` retirée, reformulation autour de `created_by`)
- UC-07 §4.3 critère 3 (critère de journalisation supprimé, renumérotation)
- UC-18 §4.3 scénario nominal et critère 3 (2 mentions retirées) — **oubli initial du repérage, remonté par Hippolyte**
- §7.2.1 table des modules (`routes/allergies.js`)
- §9.4.2 accountability RGPD (reformulation en trois piliers : `created_by` + RBAC + documentation)
- §9.4.3 traitement renforcé (mesure de journalisation retirée + « journalisé » retiré de l'export PDF)
- §9.5 matrice risques résiduels — **nouvelle ligne ajoutée** documentant le risque Repudiation résiduel accepté, avec renvoi vers §9.2
- §10.1 état du produit livré
- RG-05 §4.4 — **oubli initial du repérage, corrigé** en fin de passe

Points de discipline notés : deux oublis dans le repérage initial de Claude (UC-18 et RG-05), remontés par Hippolyte. Discipline à retenir : table §4.4 des RG **et** survol systématique de toutes les fiches UC quand on chasse un mot dans le rapport, pas seulement l'UC visé.

### 7.2 — Audit RGPD du rapport : passe B (élargissement au rôle serveur)

Contradiction initiale identifiée : UC-07 acteurs incluent « Serveur (lecture) », UC-08 scénario donne accès aux allergies au serveur via la liste en appartement, mais UC-07 critère 4 + matrice §9.3.2 excluent le serveur.

Décision d'Hippolyte : élargir l'accès en lecture des allergies au rôle serveur, adossée à l'article 9§2c RGPD (intérêt vital). Le serveur est le dernier maillon opérationnel avant l'ingestion du repas — restreindre son accès priverait la mesure de protection de son point d'application effectif.

Paragraphe de justification travaillé en session, structuré autour des 4 axes RGPD (finalité, minimisation par asymétrie de routes, compensations d'accountability, comparaison des masses). Décision d'Hippolyte : **ne pas intégrer ce paragraphe dans le rapport**, porter la justification à l'oral uniquement. Choix assumé, à défendre au jury.

Emplacements alignés dans le rapport :
- UC-07 critère 3 : « secrétaire, cuisine, serveur et admin (RG-05) »
- §9.4.3 : liste des rôles élargie à 4
- §9.5 nouvelle ligne : « quatre rôles opérationnels » (au lieu de trois)

Point ouvert : la ligne §9.5 qualifie le risque résiduel de « Faible » sans justifier explicitement que le passage 3→4 rôles ne fait pas basculer le niveau. Point non traité à la demande d'Hippolyte (« on passe à la suite »).

### 7.3 — Cadrage complet d'US-04

**Deux routes retenues :**
- `GET /api/appartements` — liste des 88 appartements avec occupants actifs
- `GET /api/appartements/:numero/residents` — occupants + allergies d'un appartement (route 2 non ouverte cette session)

**RBAC (option B assumée) :** chaîne `[authenticateToken, requireRole(['secretaire', 'cuisine', 'serveur', 'admin'])]`. Argument défendable : sous l'option B, la matrice §9.3.2 devient une contrainte exécutable dans le code, pas seulement documentaire. Un test 403 casserait si le code divergeait de la matrice. C'est le principe directeur du projet : *propriété vérifiable par le système, pas vigilance*.

**Structure de réponse — nested (deux routes) :**
- Route 1 : `[{ numero, occupants: [{ id_resident, prenom, nom }, ...] }, ...]`
- Route 2 : allergies imbriquées **dans chaque résident**, pas au niveau appartement — cohérent avec §9.4.3 (« affichage limité à l'allergène pertinent ») qui suppose de savoir à qui l'allergène appartient.

**Justification du nested :** le format plat duplique les clés (Route 1 : `numero` répété) ou casse le lien sémantique (Route 2 : allergie/résident). Le nested suit la sémantique du domaine et ce que l'ORM lit naturellement (une requête Prisma avec `select` imbriqué = un aller-retour DB).

**Fichier de route :** `src/routes/appartements.js`. Justification : la ressource principale est l'appartement, `/:numero/residents` en est une sous-ressource logique. La route 1 sans occupants n'aurait pas sa place dans un fichier « résidents ».

**Update backlog :** US-04 critère de validation ligne 3 corrigé pour refléter la structure nested. Mention « Livré session 4 » (artefact du projet antérieur) retirée.

### 7.4 — Adaptation du seed

**Fusion :** `seedAppartements.js` fusionné dans `seed.ts`. Les 88 apparts sont une donnée métier de production (l'immeuble existe), pas des fixtures de test. Argument défendable : une seule source de vérité pour toutes les données de production simulées.

**Convention d'invariants adoptée (option A) :** bloc de commentaire en tête de la section résidents dans `seed.ts` documentant explicitement chaque cas nommé. Tradeoff assumé : simplicité opérationnelle contre absence de garantie compilatoire (option B — constantes exportées — aurait complexifié pour un gain limité à cette échelle). Compensation prévue : citer le commentaire dans les assertions de test.

**5 apparts nommés dans le seed** (numéros consécutifs 3-7, prénoms belges cohérents avec le contexte La Hulpe) :
- Appart 3 : couple actif (Giselle + Pierrot VanDenStraat)
- Appart 4 : occupant unique actif (Hervé Raskin)
- Appart 5 : vacant
- Appart 6 : occupant unique inactif (Baudouin Koning) — pré-charge US-06
- Appart 7 : mixte, Francis De Jonghe actif + Leopold Oud inactif — pré-charge US-06 (scénario changement de résident)

**Discipline du seed :**
- Ordre `deleteMany` : `Resident` puis `Appartement` (respect des FK).
- `createMany` avec `id_appartement` explicites suivi de `setval` sur la séquence PostgreSQL pour verrouiller le prochain autoincrement à 91 (piège classique des IDs explicites).
- `date_sortie` renseignée pour les résidents inactifs (Baudouin, Leopold) — cohérence avec UC-06 (« marquer le résident sortant inactif, `date_sortie` renseignée »).
- Idempotence vérifiée : `npx prisma db seed` relançable N fois sans erreur.

Point à retenir pour Phase 3 : quand la table `Commande` sera peuplée, `deleteMany` sur `Resident` plantera (contrainte FK). Il faudra étendre la cascade manuelle dans le seed (commandes → résidents → apparts). Pas d'action aujourd'hui, note pour plus tard.

### 7.5 — TDD complet sur route 1 (`GET /api/appartements`)

**Red 401 (sans token) — écrit en premier, avant le 200.** Argument (à retenir pour l'oral) : commencer par le happy path (200) permettrait de monter toute la logique sans jamais brancher `authenticateToken`, et de se retrouver avec une route publique qui passe les tests. Le 401-first est une posture de sécurité : *par défaut, la route est verrouillée*.

**Green 401 :** middleware `authenticateToken` monté au niveau **router** (`appartementsRouter.use(authenticateToken)`), pas au niveau route. Argument (à retenir pour l'oral) : toute future route ajoutée au router hérite de la protection par défaut. *Propriété vérifiable par le système* : impossible d'oublier la protection sur une future route de ce router.

**Red niveau 3 (200 avec assertions de contenu) :**
- Structure `describe + beforeAll + N × it()` — une seule requête HTTP, 8 assertions séparées, chaque échec nommé.
- Token généré à la volée avec `jwt.sign(...)` — cohérent avec S3, `authenticateToken` ne consulte pas la DB.
- Assertions :
  1. Réponse 200 avec un tableau.
  2. 88 appartements présents.
  3. Appart 3 : couple actif (2 occupants, Giselle + Pierrot).
  4. Appart 4 : occupant unique actif (Hervé).
  5. Appart 5 : vacant (`occupants: []`).
  6. Appart 6 : résident inactif filtré (`occupants: []` malgré Baudouin en base).
  7. Appart 7 : Francis actif présent, Leopold inactif absent.
  8. Chaque occupant expose `id_resident`, `prenom`, `nom` (contrat positif).
  9. Aucun occupant n'expose `actif` (filtre transparent, contrat négatif).

**Green niveau 3 :** requête Prisma unique avec `select` imbriqué et `where: { actif: true }` sur la relation `residents`. Mapping `residents → occupants` au niveau de la route (traduction contextuelle assumée : le domaine parle de « résidents », l'API parle d'« occupants »).

**Décision refactor :** garder le mapping `residents → occupants` à la frontière API (option 1). Argument (à retenir pour l'oral) : *ubiquitous language contextuel* — le domaine métier a son vocabulaire (résident), l'API le sien (occupant), la traduction se fait à la couche route. Renommer la relation dans `schema.prisma` (option 2) aurait aligné les vocabulaires mais brouillé la neutralité métier du modèle.

**Score final : 28 tests verts** (19 préexistants + 8 nouveaux niveau 3 + 1 test 401), aucune régression.

---

## Concepts compris / à consolider

### Compris

- **Distinction default vs named export** : `export default` pour un artefact unique par fichier (routers, classes principales), `export` nommé pour plusieurs artefacts liés (middlewares `authenticateToken` + `requireRole` dans un même fichier).
- **Router-level vs route-level middleware** : router-level fait de la protection un défaut, route-level la rend explicite mais oubliable.
- **Niveau de test proportionné à la propriété prouvée** : le niveau 3 (contenu) est le premier niveau qui attrape un `include` sans `where: { actif: true }`. Les niveaux 1 (statut) et 2 (forme) le laissent passer.
- **Test qui échoue « pour la bonne raison »** : la trajectoire TypeError → timeout → AssertionError sur le Red 401 illustre que chaque erreur pointe une couche différente (import, terminaison de réponse, protection effective).
- **Ordre TDD sécurité-first** : commencer par le test négatif (401) empêche de monter du code non protégé qui passe les tests par accident.
- **Séparation du domaine et de l'API** : `residents` en base, `occupants` en API — deux vocabulaires cohérents à leur niveau.

### À consolider

- **Vérifier avant d'affirmer sur le rapport.** Deux affirmations factuelles pendant la session ont été faites de mémoire (« il n'est pas mentionné serveur pour les accès allergies » — faux ; « on avait décidé d'abandonner LogAccesAllergie il me semble » — juste sur le fond mais posture « il me semble » à bannir). Discipline : ouvrir le fichier avant d'affirmer, systématiquement. Un rapporteur peut vérifier en 5 secondes.
- **Attention en fin de session sur les inattentions mécaniques.** Trois bugs d'infrastructure ont ponctué la session TDD (TypeError import default/named, timeout `res.status(200)` sans terminaison, régression de l'import default après correction). Pas de problème de compréhension, un problème d'attention. Signal à surveiller — pas à discuter.

---

## Points à mentionner dans le rapport TFE

- **Découverte de deux incohérences internes du rapport durant la session** (matrice RBAC vs UC-07/UC-08 sur les allergies ; mentions `LogAccesAllergie` non alignées avec l'abandon décidé en S1) et leur résolution par audit. À porter comme **capacité d'audit du rapport** au jury, pas comme correction subie.
- **Justification RGPD de l'élargissement au rôle serveur** portée uniquement à l'oral (choix assumé). Le rapport porte la trace factuelle (« quatre rôles ») et l'argument défendable (§9.4.1 : intérêt vital art. 9§2c). Le paragraphe complet en 4 piliers reste dans la conversation de session et devra être rejoué de mémoire au jury.
- **Décision d'architecture RBAC (option B)** : chaîne `authenticateToken + requireRole([...])` explicite plutôt que `authenticateToken` seul. Argument défendable : matrice §9.3.2 exécutable dans le code, tests 403 futurs possibles, ajout d'un nouveau rôle par défaut sans accès (secure-by-default).
- **Nested vs plat sur les deux routes d'US-04** : choix nested justifié par cohérence sémantique (une route = une entité maîtresse), performance ORM (un aller-retour DB), et pour la route 2, cohérence RGPD (l'allergie doit être identifiable à son porteur, §9.4.3).
- **TDD avec ordre 401-first** sur les routes protégées : discipline de sécurité assumée. Le rapport peut mentionner cette posture comme choix méthodologique explicite (chapitre 8).
- **Convention A d'invariants documentés du seed** : le tradeoff simplicité vs garantie compilatoire est formulable au jury (« le contrôle repose sur la discipline de mise à jour, pas sur une contrainte outillée — choix conscient »).
- **Fusion `seedAppartements.js` dans `seed.ts`** : argument défendable pour l'audit du code — les 88 apparts sont des données de production, pas des fixtures de test.

---

## Exigences EPHEC couvertes ou progressées

- **Analyse de sécurité et conformité RGPD** : passe A + passe B, matrice de risques résiduels §9.5 enrichie d'une ligne argumentée. Cohérence STRIDE §9.2 ↔ §9.5 vérifiée.
- **Tests unitaires** : 8 nouveaux tests d'intégration niveau 3 sur US-04. 28 tests verts au total. Discipline TDD (Red/Green/commit à chaque transition) tracée dans `git log`.
- **Documentation du code** : commentaire d'invariants dans `seed.ts`, commentaire de justification du choix de token fictif dans le test niveau 3.
- **Schémas techniques** : la relation `Appartement 1-N Resident` est effectivement utilisée par la route 1. Les figures du rapport (EA + relationnel + UML classes) restent à aligner sur le schéma verrouillé — hérité de S1-S2, toujours différé.

---

## État des fonctionnalités / routes

**Phase 1 (close) :**
- ✅ `POST /api/auth/login` — connexion PIN, JWT 11h, bcrypt coût 12.
- ✅ `GET /api/auth/utilisateurs` — liste publique prénoms + rôles.
- ✅ Middlewares `authenticateToken` + `requireRole([...])` (route-par-route, pas d'accès admin par bypass).

**Phase 2 (ouverte) :**
- ✅ `GET /api/appartements` — 88 apparts nested avec occupants actifs, chaîne complète `[authenticateToken, requireRole(['secretaire', 'cuisine', 'serveur', 'admin'])]`, niveau 3 (filtrage transparent des inactifs, contrat de forme).
- ⏳ `GET /api/appartements/:numero/residents` — non ouverte, prochaine en S8.
- ⏳ US-05 CRUD résidents avec règle couple max 2 actifs/appart.
- ⏳ US-06 changement de résident, transaction atomique.
- ⏳ US-13 CRUD allergies (données de santé sensibles, RGPD).

---

## Blocages rencontrés et résolution

- **TypeError sur `request(app)` (Red 401).** Cause : import nommé `import { app }` sur un fichier exportant `export default app`. Correction : alignement du style d'export sur les autres routers du projet (default).
- **Timeout 5s sur le Red 401 après retrait du body.** Cause : `res.status(200)` seul ne termine pas la réponse Express. Correction : `res.sendStatus(200)`. Note pour la défense : distinction entre `.status()` (configure) et `.sendStatus()` / `.send()` / `.end()` (termine).
- **`argument handler is required` sur `router.use(authenticateToken)`.** Cause récurrente : import default d'un fichier exportant en named. Correction : `import { authenticateToken } from ...`. Note : effet en cascade — un router qui plante à l'import fait tomber tout `npm test` via `app.js`.
- **Oubli initial de UC-18 dans la passe A RGPD.** Cause : repérage centré sur UC-07 sans survol systématique de toutes les fiches UC. Correction : Hippolyte a remonté l'oubli, discipline élargie.
- **Oubli initial de RG-05 dans la passe A RGPD.** Cause : repérage centré sur les mentions directes `LogAccesAllergie` sans passer par la table §4.4 des RG. Correction : passe RG-05 ajoutée après coup, discipline formalisée pour la suite.

---

## Ce qui reste à faire

### En Phase 2
1. **Route 2 d'US-04 — `GET /api/appartements/:numero/residents`.** Cadrage à faire : cas 404 (numéro inexistant), validation du paramètre `numero` (numérique), imbrication allergies dans chaque résident, RBAC identique à route 1.
2. **US-05 — CRUD résidents avec règle couple max 2 actifs.**
3. **US-06 — Changement de résident, transaction atomique.**
4. **US-13 — CRUD allergies (données de santé sensibles, RGPD, `created_by` à implémenter).**

### Points ouverts non bloquants
5. **Update Prisma 7.8 → 7.9.** À traiter en isolation, commit `chore(deps): prisma 7.9`. Pas en plein milieu d'une US.
6. **Justification du niveau « Faible » sur la nouvelle ligne §9.5.** Non traité en session à la demande d'Hippolyte. Une demi-phrase à ajouter pour expliquer que le passage 3→4 rôles ne fait pas basculer le niveau.
7. **Placeholders `[N]` et `[date]` du paragraphe RGPD non intégré.** Non applicable — le paragraphe reste hors rapport. Note : si l'oral demande le chiffre exact d'effectif serveur, prendre contact avec Diego (mail écrit conseillé) et fixer l'info avant le 17 août.
8. **US-38 backlog — mention « accès tracé via le middleware d'authentification ».** À reformuler (ambiguïté « tracé » ↔ « journalisé »). Une passe à faire.

### Points hérités
9. **Figures du rapport (EA + relationnel + UML classes)** à aligner sur le schéma verrouillé de S1. Toujours différé.
10. **Passe backlog** pour aligner sur les choix de S3 à S7. Toujours différé.

Rappel calendrier : rapport dû le **17 août** (~22 jours à compter d'aujourd'hui). Marge convenable pour Phase 2 en Palier 1. Point de vigilance à surveiller à l'ouverture de la Phase 3 (cœur métier commandes).

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
│   │   ├── seed.ts                  ← MODIFIÉ (fusion seedAppartements + invariants documentés)
│   │   └── migrations/
│   │       └── <timestamp>_init/
│   └── src/
│       ├── app.js                   ← MODIFIÉ (montage appartementsRouter)
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
│           ├── appartements.js      ← NOUVEAU (route 1 uniquement)
│           └── __tests__/
│               ├── auth.test.js
│               ├── users.test.js
│               └── appartements.test.js  ← NOUVEAU (9 tests : 1 × 401 + 8 × niveau 3)
├── prisma/                          (le cas échéant)
└── frontend/
```

**Rapport `TFE_Rapport_final.docx`** : modifié en 8 emplacements durant la passe A + 3 emplacements durant la passe B. À archiver comme version de session 7.

---

## Instructions pour reprendre (Session 8)

- **Contexte :** Phase 2 ouverte. Route 1 d'US-04 livrée (`GET /api/appartements`), 28 tests verts. Prochaine cible : route 2 d'US-04 (`GET /api/appartements/:numero/residents`).
- **Palier confirmé pour S8 :** Palier 1 (socratique).
- **Rappels transversaux :**
  - Convention d'export : `export default` pour un artefact unique (routers), `export` nommé pour plusieurs artefacts liés (middlewares).
  - Import middlewares : `import { authenticateToken } from '../middlewares/auth.js'` — jamais en default.
  - Pattern de montage middleware : **router-level** (`router.use(authenticateToken)`) — protection par défaut pour toute route future du router.
  - Chaîne complète attendue sur une route protégée : `[authenticateToken, requireRole([...])]`, option B assumée.
  - Ordre TDD sécurité-first : Red 401 avant Red 200.
  - Terminer une réponse Express : `res.sendStatus(200)` / `res.status(200).json(...)` — jamais `res.status(200)` seul.
  - Convention A d'invariants seed : bloc de commentaire en tête de `seed.ts`. Toute modif du seed → mise à jour du commentaire.
  - Structure de test `describe + beforeAll + N × it()` pour les tests niveau 3 partageant une réponse HTTP.
  - `id_utilisateur` fictif dans les tokens de test : `authenticateToken` ne consulte pas la DB, `userId: 1` reste un placeholder — à documenter en commentaire dans les futurs `beforeAll`.
- **Cadrage à traiter au démarrage de S8 (route 2) :**
  1. Format de retour (nested confirmé, allergies imbriquées **dans chaque résident**).
  2. Cas 404 (numéro inexistant) : quelle réponse, quel test ?
  3. Validation du paramètre `numero` (numérique, dans la plage 3-90 ?) : où et comment ?
  4. RBAC identique à route 1 : les 4 rôles, `requireRole` explicite.
- **Commandes de relance :**
  - `cd backend && docker compose up -d`
  - `npm test` — 28 tests verts attendus.
  - `dotenv -e .env.test -- bash -c 'npx prisma migrate reset --force && npx prisma db seed && vitest run'` — pipeline complet.
- **Vérifications rapides en cas de doute :**
  - `git log --oneline -20` pour retrouver la narration TDD S7 (4 commits attendus : red 401, green 401, red niveau 3, green niveau 3).
  - `cat prisma/seed.ts` pour retrouver les invariants documentés.
  - `cat src/routes/appartements.js` pour la route 1 de référence (structure attendue pour la route 2).

---

*Rapport mis à jour le 26 juillet 2026 — Session 7*
