# Session 10 — Livraison d'US-06 (changement de résident) en TDD : clôture de l'EPIC 2, verrou « sans count », invariant vs convention

**Session :** 10
**Date :** 31 juillet 2026
**Auteur :** Hippolyte AMORY
**Défense :** 17 août 2026
**Palier :** 1 (socratique) — code écrit par Hippolyte, Claude en cadrage + revue (Paliers 2)

---

## Contexte et état de départ

Fin de S9 : US-05 (CRUD résidents) complète, **54 tests verts**. EPIC 02 (Résidents & appartements) partiellement Done — restait **US-06 (UC-06) : changement de résident**, dernière brique de l'EPIC.

Objectif de session : cadrer puis livrer US-06 en TDD, en réutilisant consciemment l'infrastructure de concurrence de S9 (verrou `FOR UPDATE`, transaction interactive), et clore l'EPIC 2. **68 tests verts** à la clôture (+14 net).

---

## Ce qui a été travaillé

### 10.1 — Cadrage : route, ressource-pivot, correction d'un vestige de backlog

**Route retenue : `POST /api/appartements/:numero/changement`, dans `appartements.js`.** Décision de conception, pas de rangement : l'appartement est la ressource **identifiable et stable** (un `numero` unique et permanent), les résidents sont des occupants **transitoires**. On expose donc une **action métier** (verbe `changement`, pas un CRUD d'entité) comme sous-ressource d'action ancrée sur la ressource-pivot. Le fichier suit mécaniquement le préfixe d'URL (`/api/appartements/...` → `appartements.js`). Formulation d'Hippolyte : *« l'appartement est la ressource stable, pivot ; l'opération concerne 2 résidents mais un seul appartement. »*

**Correction d'un fait (règle des faits).** Le backlog §5 d'US-06 porte encore *« Routes : `src/routes/residents.js`. Pattern : `prisma.$transaction([...])`. Livré session 4. »* — **vestige de l'ancien projet**, même famille que la mention « US-05 livré session 4 » déjà repérée. Ni le fichier (`residents.js`), ni le pattern batch, ni la session ne correspondent à la réalité. À corriger dans le backlog avant la défense.

### 10.2 — Règle métier « couple → pas de remplacement » : invariant de données vs convention organisationnelle

Point de cadrage le plus dense de la session, et **question de jury la plus dangereuse** de l'US.

Hippolyte a d'abord affirmé « si un membre d'un couple part, il n'est jamais remplacé » — signalé 🚩 comme assertion posée de mémoire. **Vérification à la source** (grep backlog) : la seule règle couple documentée est *« au plus 2 résidents actifs simultanément par appartement »* → 409 (validée par Diego, lignes 122/129). La règle « pas de remplacement » **n'existe nulle part**. Hippolyte a alors **corrigé la nature de l'affirmation** : ce n'est pas une lecture approximative du rapport mais un **fait métier de première main** (expérience terrain). Recevable — et il avait lui-même distingué « dans la réalité » de « rien ne l'interdit dans le système ».

**Contradiction apparente avec le principe S1** (« propriété vérifiable par le système, pas vigilance ») : une règle métier réelle que le système n'empêche pas. **Résolution construite par Hippolyte** : distinction **invariant de données** / **convention organisationnelle**. *« Le système garantit les invariants qui protègent l'intégrité (au plus 2 actifs, historique préservé, atomicité). "Pas de remplacement dans un couple" est une convention organisationnelle, pas un invariant de données. Mon principe : rendre vérifiable ce qui menace l'intégrité, pas coder toutes les conventions humaines. »*

**Critère de démarcation** (le point que le jury sondera — ne pas se contenter des étiquettes) :
1. **Représentabilité** — le schéma ne modélise pas la notion de « couple » (un `Resident` a `prenom`/`nom`/`actif`/dates + FK ; rien ne distingue « sont un couple » de « cohabitent »). Une règle que le système ne peut **évaluer** ne peut être un invariant système.
2. **Conséquence de la violation** — violer « au plus 2 » → 3 actifs → l'affichage (US-10 : 1 bloc solo / 2 couple) et la facturation cassent : **état corrompu dont d'autres modules dépendent**. Violer « pas de remplacement » → 2 vraies personnes, tout le downstream fonctionne : **état cohérent**, seulement socialement indésirable.

Synthèse d'Hippolyte : *« pas un invariant système parce que le système peut même pas savoir si c'est un couple, et de toute façon si ça foire ça casse rien en aval. »* Reformulation pour l'oral retenue : dire **« corrompt un état dont d'autres modules dépendent »** plutôt que « ça pète tout » (le *pourquoi* vaut des points).

### 10.3 — Forme de transaction : interactive obligatoire

Le batch `$transaction([...])` du §5 est un **tableau de requêtes figées d'avance**, envoyé d'un bloc : aucune requête ne peut lire le résultat d'une autre. Or la séquence d'US-06 comporte une **décision qui dépend d'un résultat intermédiaire**. D'où la forme **interactive** `$transaction(async (tx) => { … })`, réutilisée de S9. Formulation d'Hippolyte : *« la décision existe seulement à l'exécution, une fois le count revenu, et le batch n'a aucun moment "entre deux requêtes" où je pourrais l'insérer. »*

### 10.4 — Le verrou « sans count » : justification qui change de nature (LE point de défense d'US-06)

Découverte centrale. La séquence de cadrage initiale était `verrou → soft-delete → count → décision → create`. **Le code final n'a pas de count**, pas de 409 couple — et c'est **correct**, pas un oubli :

- Le POST de S9 **ajoute** un actif sans en retirer → peut franchir le seuil 2→3 → count nécessaire.
- Le changement **retire** un actif (soft-delete, garanti actif par le 409 « déjà inactif ») **puis** en ajoute un → opération **neutre en compte** → ne peut pas passer de 2 à 3 en solo → count inutile *ici*.

**Alors pourquoi garder le verrou ?** Réponse d'Hippolyte, après vérification : *« il ne protège pas un count (je n'en ai pas), il rend fiable ma garde "le sortant est-il encore actif ?" face à toute autre porte qui touche la même ligne appartement. »* Le vrai partenaire dangereux est **un autre US-06 sur le même appartement** : deux changements simultanés ciblant le même sortant A, chacun lit A comme actif (état committé, périmé pour l'autre), chacun passe sa garde, chacun ajoute son entrant, l'appartement grimpe à **3 actifs**. La **justification du verrou change de nature** entre S9 (il sérialise *mon* count) et US-06 (il sérialise ma *garde d'état* pour les autres portes). C'est l'argument le plus fort de l'US et il **ne vit nulle part dans le code**, à porter dans la doc de défense.

**Correction de fait (tracée volontairement).** Le cadrage initial de cette section justifiait le verrou par une « sérialisation contre un `POST /api/residents` concurrent qui verrait la place libérée par mon soft-delete et créerait un 3e actif ». **C'était faux**, invalidé par vérification `psql` sous READ COMMITTED : tant que le soft-delete de T1 n'est pas committé, il reste **invisible** à toute transaction concurrente, donc le POST compte **2** actifs et rejette proprement en 409. Le POST n'est de toute façon pas le partenaire : il pose **son propre** `FOR UPDATE` sur la même ligne appartement (US-05) et se sérialise seul. La leçon reste, avec le bon partenaire : le verrou ne se raisonne pas route par route mais invariant par invariant.

**Portée générale formulée** : le verrou ne se raisonne pas route par route mais **invariant par invariant**. Toute transaction qui peut faire passer un appartement de 2 à 3 actifs doit prendre le **même** verrou, sur la **même** ligne appartement. Vérifié sur pièce (session_9 ligne 47) : S9 verrouille `SELECT id_appartement FROM "Appartement" WHERE numero = ${numero} FOR UPDATE` — la ligne appartement, « point de rendez-vous », pas péage. US-06 rouvre sa transaction par le **même** `SELECT … FOR UPDATE`, mot pour mot → collision des deux portes. Défaut nommé : **TOCTOU** (*Time-Of-Check-To-Time-Of-Use*) — lecture avant écriture de l'autre, chacune décide sur une photo périmée, la somme viole l'invariant.

### 10.5 — Ciblage explicite `id_resident_sortant`

Le `numero` identifie le **contexte** (où) mais pas la **cible** (qui) quand il y a 2 actifs. `id_resident_sortant` lève l'ambiguïté et **protège le conjoint restant d'une désactivation collatérale** (formulation d'Hippolyte). Sans lui : soit choix arbitraire (désactiver une vraie personne au hasard, inacceptable), soit refus dès 2 actifs (US-06 ne marcherait plus sur les couples). Le ciblage rend l'opération **déterministe** sur solo comme couple. Rattaché à l'intégrité (pas à la convention) : « ne désactiver que la personne désignée » protège l'exactitude de la donnée.

### 10.6 — Taxonomie d'erreurs à deux couches

Le ciblage introduit deux paramètres qui doivent être cohérents (`:numero` URL + `id_resident_sortant` body). Structure décidée :
- **Appartenance** (couche 1) — le sortant est-il occupant de *cet* appartement ? Non → **404**. Range ensemble le fantôme (id inexistant) **et** « habite ailleurs » : décision d'**existence scopée à l'URL** (un seul critère). Discussion tranchée : plutôt que traiter « existe ailleurs » en 409, Hippolyte a retenu que du point de vue de l'appartement `:numero`, un résident d'un autre appartement est **aussi introuvable ici** qu'un id fantôme → 404 pour les deux, ligne cohérente.
- **État** (couche 2) — le sortant appartient bien mais est-il actif ? Déjà `actif: false` → **409** (« on ne fait pas sortir quelqu'un de déjà sorti »).
- **Forme** (avant tout) — **400** sur `:numero` non entier, `id_resident_sortant` non entier, `prenom`/`nom` absents/non-string/blancs.

Vigilance de conception notée : le test d'appartenance est une **lecture supplémentaire à placer *dans* la transaction verrouillée**, après le `SELECT … FOR UPDATE`. Fait correctement dans le code.

### 10.7 — Atomicité « tout ou rien »

La transaction enchaîne soft-delete sortant **puis** create entrant. Si le create échoue, le **rollback atomique** annule le soft-delete → base pile à l'état d'avant. Hors transaction : soft-delete tenu + entrant absent → **état incohérent** (résident sorti jamais remplacé), alors que « changement » est une opération **indivisible**. Le `throw` des cas 404/409 sert double : court-circuit **et** garantie qu'aucune écriture partielle ne survit. Fait confirmé à Hippolyte : dans une `$transaction` interactive, **le verrou `FOR UPDATE` est aussi relâché par le rollback**, pas seulement par le commit → pas de verrou orphelin même en cas d'échec.

### 10.8 — Implémentation TDD (écrite par Hippolyte)

Ordre sécurité-first respecté : **401 → 403 → 400 → 404 → 409 → 201**.
- **401 né vert** : `router.use(authenticateToken)` hérité d'US-04 filtre déjà. Contraste défendu : même route absente, 401 sans token (auth court-circuite avant routing) vs 404 avec token valide (Express cherche le handler et ne le trouve pas) → **preuve que l'auth passe avant le routing**.
- **403** : red→green ; route + garde `requireRole(['secretaire'])` créées dans le même green. Effet de la garde justifié par **isolation de la chaîne** (seul `requireRole` émet un 403 sur un rôle), pas par la transition seule — arbitrage nommé : *« j'ai fusionné route+garde ; je justifie l'effet par l'isolation, pas par un rouge→vert isolé sur la garde. »*
- **400 `id_resident_sortant`** : `Number.isInteger` (strict, sans coercion ; rejette `"5"`) — **fail-fast sur entrée ambiguë** vs coercition silencieuse (`parseInt(" 5abc") === 5`).
- **400 `:numero`** : aligné sur la garde du GET voisin (cohérence de forme entre les deux routes du segment).
- **400 `prenom`/`nom`** : **durci** de `!prenom` (truthiness) vers `typeof x !== "string" || x.trim() === ""`. Aligné sur la doctrine stricte du sortant. `typeof` **avant** `.trim()` (le court-circuit `||` protège l'appel : `123.trim()` crasherait → 500). **Red d'abord** (commit `4ac4bd7`, tests `prenom: 123` et `prenom: "   "`) **puis green** (`7eb946f`) — vérifié dans `git log`.
- **404 scopé** : `sortant === null || sortant.id_appartement !== appartId`.
- **409** : `sortant.actif === false`.
- **201 minimisé** : `select { id_resident, prenom, nom }` sur le create ; tests en **`toEqual`** (pas `toMatchObject`) → **prouvent** que `actif`/`id_appartement`/`date_entree` ne fuient pas.

### 10.9 — Architecture de test : isolation structurelle

- **Cas couple (fixture locale, appart 9001)** : appartement créé avec **PK générée par Prisma et capturée** (`appart.id_appartement`), pas forcée — évite la **désynchronisation de séquence autoincrement** (bug fantôme d'unicité). `afterAll` supprime résidents **puis** appartement (ordre FK). Quatre assertions : entrant minimisé, sortant archivé, **conjoint préservé** (preuve exécutable que `id_resident_sortant` protège le conjoint), entrant actif + `date_entree`.
- **Validation stricte (fixture locale, appart 9002)** : deux résidents actifs créés **comme assurance anti-régression**. Le test asserte un **400** (`"Prénom et nom de l'entrant requis"`), donc la garde de forme est présente : `prenom: 123` échoue à la porte, sortant réel ou bidon, les vrais sortants ne servent **pas** au vert d'aujourd'hui. Ils servent au monde **contrefactuel** : si cette garde 400 saute un jour, le prénom n'est plus vérifié qu'au `create`. Avec un id bidon, la requête meurt au 404 « sortant introuvable » avant d'atteindre le `create` : la régression prénom est **masquée**. Avec deux vrais actifs, elle traverse jusqu'au `create` et échoue là sur le prénom (500 DB), rouge **sur le bon motif**. Même principe « échouer pour la bonne raison » que le 403 : rougir sur la propriété surveillée, pas sur un effet de bord.
- **Suppression du describe « changement réussi »** : il mutait du **seed partagé** (Hervé/appart 4) **sans `afterAll`** → vert par position (fragile). Et **redondant** : le cas couple le domine strictement (même chemin de code, aucun branchement solo/couple). Supprimé.

---

## Concepts compris / à consolider

**Acquis :**
- **Verrou dont la justification change de nature** (protège *mon* count en S9 → sérialise contre le count *des autres portes* en US-06). Raisonnement de haut niveau.
- **Invariant de données vs convention organisationnelle**, avec critère à deux tests (représentabilité + conséquence de violation dont d'autres modules dépendent).
- **TOCTOU multi-portes** ; discipline de verrou **protocolaire**, raisonnée invariant-par-invariant.
- **Ciblage explicite** pour déterminisme + protection du conjoint.
- **Atomicité = rollback atomique** ; `throw` → rollback ; verrou relâché aussi au rollback.
- **Taxonomie à deux couches** (appartenance → état).
- **Fixture anti-régression** (« échouer pour la bonne raison »).

**À consolider :**
- Formuler à l'oral, sans hésitation, **pourquoi** la fixture 9002 monte de vrais sortants actifs (angle (b) anti-régression) — `git log` l'implique mais l'articulation orale doit être verrouillée maintenant, pas au jury.

---

## Points à mentionner dans le rapport TFE

- **Verrou « sans count » justifié par la fiabilité de la garde « sortant encore actif ? » face à un autre US-06 concurrent sur le même appartement** (pas le POST, qui a son propre verrou) : argument central d'US-06, à écrire explicitement (n'existe pas dans le code).
- **Distinction invariant/convention + critère de démarcation** — répond directement à l'objection « votre principe "vérifiable, pas vigilance" est-il tenu ? ».
- **Ciblage `id_resident_sortant`** : déterminisme sur solo/couple, protection du conjoint, rattaché à l'intégrité.
- **Atomicité** comme propriété vérifiable par le système (jamais d'entre-deux visible) — le principe S1 appliqué au **temps**.
- **Minimisation prouvée par `toEqual`** (fuite de champ = test rouge).

---

## Exigences EPHEC couvertes (progression)

- ✅ **Tests d'intégration** : 54 → **68 verts**. Discipline TDD maintenue (red séparé du green ; durcissement de garde né d'un rouge, vérifiable dans `git log`).
- ✅ **Analyse de sécurité** : concurrence (verrou partagé multi-portes, TOCTOU nommé), validation stricte anti-coercition, minimisation exécutable (`toEqual`). Rattachables au STRIDE §9.2.
- ✅ **Versioning Git** : narration TDD étendue (né-vert 401 ; red/green 403 ; red/green 400 ×3 ; red/green minimisation 201 ; red/green durcissement prénom/nom). Ordre sécurité-first sur la route.
- ✅ **Documentation du code** : commentaires justificatifs conservés.

---

## État des fonctionnalités / routes

- ✅ `POST /api/auth/login` (US-01)
- ✅ `GET /api/users` (US-02)
- ✅ `authenticateToken` + `requireRole` (US-03)
- ✅ `GET /api/appartements` + `GET /api/appartements/:numero/residents` (US-04)
- ✅ `POST` / `PATCH` / `DELETE /api/residents` + `GET /api/residents?tous=1` (US-05)
- ✅ **`POST /api/appartements/:numero/changement` (US-06)** ← NOUVEAU — **EPIC 02 clôturé**

---

## Blocages rencontrés et résolution

- **Aucun blocage technique de code.** Les corrections de revue (verrou sans count à justifier, fragilité du test « changement réussi », asymétrie des gardes de forme, PK forcée) ont toutes été comprises et corrigées par Hippolyte.
- **Fichiers uploadés sans contenu inline** (deux fois) : le message ne portait que le chemin. Résolu en lisant directement sur disque (`view` sur `/mnt/user-data/uploads/…`) plutôt qu'en supposant le contenu — même réflexe « vérifier sur pièce » que le reste de la session.

---

## Ce qui reste à faire

1. **Écrire le point de défense « verrou sans count »** dans la doc de défense (argument central, absent du code).
2. **Corriger le §5 fantôme d'US-06** dans le backlog (`residents.js` / batch / « session 4 » → `appartements.js` / interactive / S10).
3. **Verrouiller l'oral** sur la fixture 9002 (angle anti-régression).
4. Poursuivre Phase 2 selon `plan_daction.md` (prochaine US hors EPIC 2 — à confirmer sur le plan, US-13 CRUD allergies pressentie).

---

## Structure du dépôt

```
backend/src/routes/
├── appartements.js              ← MODIFIÉ (route POST /:numero/changement ajoutée)
├── residents.js
└── __tests__/
    └── appartements.test.js     ← MODIFIÉ (describes US-06 ajoutés ; « changement réussi » supprimé)
```

Reste inchangé par ailleurs.

---

## Instructions pour reprendre (Session 11)

**Contexte :** EPIC 02 (Résidents & appartements) **clôturé** — US-04, US-05, US-06 livrées et testées. **68 tests verts.** Prochaine cible hors EPIC 2 selon `plan_daction.md`.

**Rappels de posture :** Palier 1 (socratique) ; sécurité-first (401→403→400→404→409→201) ; red committé séparément du green ; fixtures locales pour tout test **mutant** (jamais muter du seed partagé sans `afterAll`) ; `toEqual` quand la minimisation doit être *prouvée*.

**Avant de coder la suite — 3 dettes légères à solder :** point de défense « verrou sans count », correction backlog §5 US-06, articulation orale fixture 9002.

**Relance :**
```bash
cd backend
docker compose up -d
npm test              # 68 tests verts attendus (~8 s, sérialisé)
npm run dev           # serveur sur :3000
```

**Vérification rapide avant de reprendre :** `git status` propre, `git log --oneline` montre la narration US-06 (né-vert → red/green ×n), `docker compose ps` sain.

---

*Rapport mis à jour le 31 juillet 2026 — Session 10*
