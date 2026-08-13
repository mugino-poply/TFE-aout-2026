# Session 16 — US-09 socle : annulations à temps / en retard (UC-02/03)

**Auteur :** Hippolyte AMORY
**TFE :** Le Cénacle — application web interne de gestion des commandes du restaurant
**Défense :** 17 août 2026
**Date de session :** 12 août 2026

---

## Contexte et état de départ

Fin de S15 : **151 tests verts**, AT-02 implémenté et clôturé, US-14 clôturée, US-13 reclôturée. EPIC allergies terminé.

Objectif S16 : ouvrir et livrer **US-09** (annulations, UC-02/03), première US de l'EPIC 03 sur le cycle de vie d'une commande. La règle métier et le design étaient **déjà figés** au gel du 12/08 (`gel_decisions_2026-08-12.md`, `plan_daction_v2.md` § 5) ; la session porte donc sur les **points ouverts** que le cadrage avait laissés (garde de projection, fonction pure, traitement des commandes actives) puis sur l'implémentation TDD.

État final : **socle US-09 livré et testé** (`compterJours`, `classerAnnulation`, route `PATCH /api/commandes/:id/annuler` avec ses gardes 404/409). Le critère Socket.IO est **reporté et déclaré** (§ 11.3). US-09 est close **sur le périmètre socle**, pas sur ses critères d'origine (l'émission `commande_annulee` manque, volontairement).

---

## Ce qui a été travaillé

### 16.1 — Clôture du contrat de la fonction de dérivation (design, avant tout code)

Le cadrage figé avait laissé trois points ouverts touchant tous la **signature** de la fonction. Tranchés par dialogue socratique, dans l'ordre de dépendance :

**Traitement des commandes actives.** Décision : la dérivation **lit `statut` d'abord et court-circuite**. `active` → prépare oui / facture oui, ne lit jamais `annule_le`. `annulee_temps` → prépare non / facture non, ne lit jamais `annule_le`. Seule `annulee_retard` **descend** dans `(annule_le, date_repas)`, et **uniquement** pour trancher préparé-ou-pas — **jamais** pour recalculer temps/retard. Justification défendable : la frontière temps/retard est une **politique gelée** portée par `statut` ; recalculer à la lecture serait dé-figer, exactement ce que l'option B refuse. Ce court-circuit est aussi ce qui **désamorce** la garde de projection pour les commandes actives (un champ jamais lu ne peut pas trahir en `undefined`).

**Emplacement de la logique.** Créé `src/domain/regles-annulation.js` (+ `regles-annulation.test.js`). Renommé depuis un premier `annulations.js` pour **tuer la collision** avec `config/seuils.js` : le nom du fichier dit sa nature (logique métier) et se distingue à l'œil de la config. Décision d'architecture à raconter au rapport : introduction d'une **couche `domain/`** pour la logique métier partagée entre routes (la dérivation aura quatre appelants dans quatre fichiers, dont `exports.js` non encore créé).

### 16.2 — `compterJours` : primitif de comptage (4 tests, dont 3 né-verts orthogonaux)

**Décision temporelle centrale, la seule vraie difficulté d'US-09.** Compter les jours entre deux **instants** (soustraction ÷ 86,4M) et compter les jours entre deux **jours civils belges** ne sont pas la même opération ; seule la seconde respecte « journées civiles entières, pas en heures » (§ 4.4 RG-02).

**Un seul fuseau, celui de la résidence, pour les deux côtés.** Arbitrage tranché : plutôt que « `date_repas` lu en UTC (car stockée ainsi), `annule_le` réduit en belge », **les deux** côtés se réduisent en `Europe/Brussels`. Justification par le **sens** (« un jour civil est une horloge murale, l'horloge de la résidence est à Bruxelles »), pas par l'implémentation. Bénéfice : **supprime deux invariants à surveiller** (que `date_repas` reste minuit-UTC ; que l'offset belge reste positif) — même arbitrage qu'en S13 (« supprimer une dépendance au lieu de la gérer »).

**Le fuseau sert à trouver le *jour* ; UTC sert à *compter* les jours.** Implémentation : `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels', … })` extrait le triplet (Y,M,D) belge de chaque instant (insensible au `TZ` ambiant du process — sourcé, voir plus bas) ; puis `Date.UTC(Y, M-1, D)` reconstruit deux **minuits UTC** ; leur différence ÷ 86,4M donne l'écart. Deux minuits UTC sont espacés d'un multiple **exact** de 24 h (UTC ignore le DST) → calendaire **par construction**, pas par prudence.

**Décision de dépendance, tranchée sur preuve.** D'abord installé `date-fns-tz` (compatible `date-fns` 4.4.0 : peer `^3||^4`, dédup vérifiée) pour `toZonedTime`. Puis **abandonné au profit d'`Intl` natif** après un test frontière : sous `TZ=UTC`, les getters natifs (`getDate`…) sur le `Date` recalé rendent le **mauvais jour** dans la fenêtre 00h–02h (= vigilance dépendante du fuseau du process) ; `Intl.DateTimeFormat` avec `timeZone` explicite reste juste sous `TZ=UTC` **et** `TZ=Asia/Tokyo` (= propriété vérifiable). `date-fns-tz` **désinstallée** (dépendance inutilisée = point d'attaque au jury). Histoire de défense : *choix lib-vs-natif tranché sur preuve, pas sur réflexe*.

**Batterie TDD :**
- **Rouge 1** (nominal) : `compterJours(14/07 midi, 16/07 minuit) === 2` — rouge d'**absence de module** (nommé comme tel, pas « arithmétique fausse »). Vert par l'implémentation `Intl` + `Date.UTC`.
- **Né-vert « heure d'été »** (tagué) : `28/03 → 30/03 = 2`. L'intervalle enjambe le 29/03/2026 (journée belge de 23 h, passage été vérifié : dernier dimanche de mars). Falsifie **les minuits belges soustraits** (47 h → 1). *Ne falsifie pas* le `/24` sur instants bruts (48 h → 2 en juillet comme en mars, UTC ignore le DST). Vert par construction.
- **Né-vert « soir de J-2 »** (tagué) : `14/07 21h UTC (= 23h belge) → 16/07 = 2`. Falsifie **les instants bruts /24** (27 h → 1). *Ne falsifie pas* les minuits belges soustraits (48 h → 2). Pas un piège de fuseau (jour 14 des deux côtés). Vert par construction.
- **Né-vert « insensibilité au fuseau ambiant »** (tagué) : `22h30 UTC = 00h30 belge le 15 → 16/07 = 1`, sous `TZ=UTC` (jour natif divergent du jour belge). Falsifie les **getters natifs** (rendraient 2). Une seule branche `TZ` (un second fuseau hostile serait redondant contre la même cible ; Tokyo *coïnciderait* avec belge sur cet instant, donc ne discriminerait pas). Restauration `TZ` en `afterEach` (piège `undefined` → `delete`, pas la chaîne `"undefined"`, sous `fileParallelism: false`).

Les trois né-verts sont **orthogonaux** : DST-comptage / non-réduction / fuseau-ambiant. Chacun nomme **une** implémentation crédible falsifiée (auteur réel documenté pour le 3e : l'implémentation getters-natifs proposée puis corrigée en séance).

### 16.3 — `classerAnnulation` + seuil nommé

`classerAnnulation(ecart)` dans `domain/regles-annulation.js` : `ecart >= SEUIL ? 'annulee_temps' : 'annulee_retard'`. Ignore le fuseau et le comptage (délégués à `compterJours`).

**Dissymétrie `2` / `0` = doctrine option B appliquée :** le `2` est une **politique révisable de Diego** → constante nommée `SEUIL_ANNULATION_TEMPS_JOURS = 2` dans `src/config/seuils.js` (à côté de `tarifs.js`, sourcé § 4.4 RG-02). Le `0` (jour même → à préparer) est un **fait physique** (le repas est déjà en cuisine) → littéral au point d'usage. Les emballer dans un même objet « seuils » les remettrait sur le même plan — refusé.

**Politique nommée MAIS gelée à l'écriture :** un changement du seuil vaut pour les annulations **futures**, jamais pour le passé. Une commande déjà `annulee_temps` en base ne bouge pas si Diego passe à J-3. C'est **voulu** (option B), pas un défaut : recalculer à la lecture serait dé-figer. Réponse préparée à la question de jury « seuil mutable mais données gelées ».

**Tests :** nominal `3 → temps` (rouge d'absence de fonction) ; **frontière `2 → temps`** (pinne `>=` et non `>`) ; deux **régressions métier** nommées (`1 → retard` la veille facturée ; `-1 → retard` repas passé produit donc facturé). Ces trois derniers sont des tests **ordinaires** groupés dans le green (pas des né-verts — la frontière `>=`/`>` est évidente dans la ligne de code, les régressions ne falsifient aucune alternative crédible). L'écart négatif (repas déjà passé) est un **comportement voulu à déclarer** (§ 11.3 ou registre).

### 16.4 — Route `PATCH /api/commandes/:id/annuler` (3 cycles rouges)

Fichier `src/routes/annulations.js`, monté `annulationsRouter` **avant** `commandesRouter` sur `/api/commandes` (vérifié `index.js`). Ordre = **prudence défensive** : `commandesRouter` n'a aujourd'hui que `POST /` (pas de collision réelle), l'ordre garantit `PATCH /:id/annuler` le jour où il gagnera un `PATCH /:id`.

**Enchaînement figé :** lire la commande par `:id` (`select: { date_repas: true }`) → garde existence (`if (!commande) → 404`) → capturer `now = new Date()` **une seule fois** → `compterJours(now, date_repas)` → `classerAnnulation(ecart)` → `updateMany({ where: { id, statut: 'active' }, data: { statut, annule_le: now } })` → `count === 1 → 200` / `count === 0 → 409`.

**TOCTOU fermé par écriture conditionnelle, pas par verrou.** L'`updateMany` avec `where: { statut: 'active' }` collapse le check-then-act dans une seule opération atomique sérialisée par la base : deux annulations concurrentes → la seconde mord 0 ligne → 409 légitime, **sans transaction**. Critère de défense : *verrou si plusieurs décisions dépendent de la lecture (US-06) ; écriture conditionnelle si c'est un seul geste (US-09)*. Même famille que l'index partiel d'US-08 (laisser la base arbitrer).

**Séparation données stable / contestée.** On lit `date_repas` **avant** l'écriture, sans risque, car `date_repas` est **immuable** (un concurrent ne la mute pas). L'état contesté (`statut`) n'est **jamais lu pour décider** — seulement contraint dans le `where`. Le `select: { date_repas: true }` (ne projette même pas `statut`) est donc à la fois minimisation **et** sûreté TOCTOU.

**404 avant 409, sans relecture de diagnostic.** La garde d'existence est **en amont** ; si l'on atteint l'`updateMany`, la commande existe → un `count === 0` ne peut venir que d'un statut non-active → 409 **univoque**. Le réordonnancement (existence avant classement) évite le crash `null.date_repas` **et** rend inutile toute relecture pour distinguer 404/409.

**`updateMany` plutôt que `update` :** `update` exige un `where` unique (PK), refuse le composite `{ id, statut }`, et jette `P2025` (mélange absence/état à démêler) ; `updateMany` accepte le composite, ne jette pas, rend un `count` testable, borné à {0,1} par la cardinalité PK (`=== 1` justifié par la cardinalité, pas l'habitude).

**Cycles :**
1. **Rouge nominal** → 404 d'absence de route (route non écrite). Green : route minimale (sans gardes 404/409), 200 + statut classé.
2. **Rouge 404** (id inexistant) → **500** (crash `null.date_repas`, débusqué). Green : garde `if (!commande) → 404` avant le classement.
3. **Rouge 409** (double appel : annuler puis ré-annuler) → **200** (faux positif d'annulation : `count` non lu, statut calculé jamais écrit renvoyé). Green : `const { count } = …` + `if (count === 0) → 409`.

**Test nominal renforcé :** vérifie `statut === 'annulee_temps'` **et** `annule_le.getTime() === instant gelé`. Sous `vi.useFakeTimers({ toFake: ['Date'] })` + `setSystemTime(2026-07-13T12:00:00Z)` (annulation J-3, franc), l'assertion `annule_le` prouve **d'un coup** que le champ est écrit *et* que c'est bien `now` (pas un instant recalculé) — verrouille indirectement le « un seul `now` ». `toFake: ['Date']` (et non tous les timers) pour ne pas geler les timers d'I/O dont Prisma/Supertest dépendent (sinon hang). `vi.useRealTimers()` en `afterEach`.

**Fixture jetable** créée en **`beforeEach`** (pas `beforeAll` : l'annulation *consomme* la commande, chaque `it` en veut une fraîche). FK vers résident/utilisateur du seed (non mutés → réutilisables). `id`/`date_repas` capturés du `create`, jamais devinés.

État final : **162 tests verts** (151 + 4 `compterJours` + 4 `classerAnnulation` + 3 route ; le nominal renforcé compte pour un `it`).

---

## Concepts compris / à consolider

**Acquis (défendables au jury) :**
- Le triplet réduction/comptage/fuseau : réduire chaque instant au jour civil belge (via `Intl`, fuseau explicite), puis compter en minuits UTC reconstruits (insensibles au DST). « Le fuseau trouve le jour, UTC compte les jours. »
- Né-vert **orthogonal** : un test par implémentation crédible falsifiée, sans recouvrement ; nommer *précisément* ce que chacun tue (et ce qu'il *ne* tue *pas*).
- Écriture conditionnelle atomique vs verrou : critère « une seule décision / plusieurs décisions ». Séparer donnée immuable (lisible avant) et donnée contestée (jamais lue pour décider).
- Politique nommée mais gelée à l'écriture (option B) ; dissymétrie littéral `0` (fait) / constante `2` (politique).
- Distinguer garde de **projection multi-appelants** (bruyante, `!`) et garde d'**existence mono-handler** (couverte par le test de la route) — deux surfaces, deux réponses.

**À consolider / vigilance :**
- **Conclusion juste sur raison fausse.** Trois fois cette session, une conclusion opérationnelle correcte a été étayée par une arithmétique posée de tête et fausse (« /24 rend 2 ici » sans démonstration ; « Tokyo tue getters-natifs » alors qu'il coïncide ; « NY : le repas recule »). Corrigées en séance en **posant les quatre nombres** (jour natif des deux bornes sous les deux fuseaux). Au jury, une conclusion juste sur une raison fausse s'effondre dès qu'on pousse sur la raison. Réflexe à ancrer : quand on ne sait pas *exactement* pourquoi un cas discrimine, on calcule, on ne raisonne pas par intuition.
- **« Vert » n'est pas « fait ».** Deux fois, « 160/162 passed » a été présenté comme preuve de complétude alors que trois comportements (`annule_le`, 404, 409) n'étaient pas couverts. Un vert est aveugle aux chemins non exercés (leçon S15, `bb96f48`). Lire le code, pas le compteur.

---

## Points à mentionner dans le rapport TFE

- **§ 4.4 RG-02** : répercuter la règle à trois niveaux (avant-veille `annulee_temps` non facturée / veille `annulee_retard` facturée hors production / jour même `annulee_retard` facturée et produite). Corriger la formulation fausse du backlog (« plus de 2 jours d'avance »).
- **§ 8 (validation)** : les trois né-verts orthogonaux de `compterJours` comme étude de cas « description de la validation » — chaque test nomme l'implémentation qu'il falsifie.
- **§ 9 / conception** : TOCTOU d'US-09 fermé par écriture conditionnelle atomique (`updateMany` conditionnel) et non par verrou ; critère « une seule décision vs plusieurs ». Séparation donnée immuable / donnée contestée.
- **Décision d'architecture** : introduction de la couche `domain/` (logique métier partagée).
- **Option B (figé/dérivé)** : politique nommée mais gelée à l'écriture ; seuil révisable sans réécrire le passé.
- **Choix lib-vs-natif tranché sur preuve** : `Intl` natif retenu, `date-fns-tz` installée puis retirée après test frontière `TZ`.
- **§ 11.3** : émission Socket.IO `commande_annulee` reportée (voir ci-dessous). Écart négatif (repas passé → facturé) comme limite/choix assumé.

## § 11.3 — critère Socket.IO reporté (rédaction retenue)

> **US-09 — critère Socket.IO reporté (non-conformité assumée).** Le critère d'acceptation d'US-09 prévoit l'émission Socket.IO `commande_annulee` (`id_commande` + nouveau statut). Non implémenté dans le socle livré. Raison : l'émission dépend de l'infrastructure Socket.IO (US-20), classée en **cercle 2** (extension probable) au gel du 12/08 ; la livrer isolément ferait entrer US-20 hors du périmètre socle déclaré. Les autres critères d'US-09 (classement du statut, `annule_le`, 404, 409) sont couverts et testés. Reporté à US-20, pas oublié — testable le moment venu par injection d'un émetteur mocké.

> ⚠️ **À ne pas écrire** : « un side-effect n'a pas de preuve honnête en Supertest » — argument **faux** (un spy sur l'émetteur le teste). Le report se justifie par le **périmètre** seul.

Commentaire de route (dans le code) : `// Socket.IO commande_annulee (critère US-09) reporté à US-20, hors socle. Voir § 11.3.`

---

## Exigences EPHEC couvertes / progressées

- **Tests d'intégration** : **162 verts**, discipline TDD maintenue (rouge séparé, né-verts discriminants tagués avec preuve par construction, régressions métier distinguées des né-verts).
- **Analyse de sécurité** : nouveau cas concret de TOCTOU (concurrence sur annulation) fermé structurellement ; fantôme (DELETE concurrent) documenté sans code (aucune route ne supprime de commande).
- **Documentation** : décision d'architecture `domain/` ; § 11.3 report Socket.IO.

---

## État des fonctionnalités / routes

- **US-09 — socle livré et testé** ✅ (close **sur le périmètre socle**, pas sur ses critères d'origine)
  - `compterJours(annuleLe, dateRepas)` ✅ — écart en jours civils belges (`Intl` Bruxelles + `Date.UTC`), pur, 4 tests
  - `classerAnnulation(ecart)` ✅ — `>= SEUIL` → temps/retard, seuil nommé, 4 tests
  - `PATCH /api/commandes/:id/annuler` ✅ — 200 (statut + `annule_le = now`) / 404 / 409, `updateMany` conditionnel atomique
  - Émission Socket.IO `commande_annulee` ⏳ **reportée US-20, déclarée § 11.3**
  - Prédicats de lecture « à préparer ? » / « à facturer ? » ⏳ **cadrés-non-implémentés** (cercle 2, pas de consommateur avant les exports)

---

## Blocages rencontrés et résolution

- **500 sur commande absente** (rouge 404) : `null.date_repas` déréférencé avant la garde d'existence. Résolu en plaçant `if (!commande) → 404` **avant** le classement (réordonnancement déjà prévu au cadrage).
- **Faux positif d'annulation** (rouge 409) : `count` non lu → 200 sur ré-annulation avec un statut jamais écrit. Résolu par `const { count } = updateMany()` + `count === 0 → 409`.
- **Getters natifs dépendants du `TZ` ambiant** : détecté au test frontière, résolu en passant de `date-fns-tz`/`toZonedTime` à `Intl.DateTimeFormat` (fuseau explicite).

---

## Ce qui reste à faire

1. **Répercuter US-09 dans le rapport** : § 4.4 RG-02 (trois niveaux), figure 11 (séquence UC-02), correction du backlog, § 11.3 (Socket.IO + écart négatif).
2. **US-11** (champ remarque, backend, petit) et **US-12 backend** (`?vue=secretaire` sur `GET /api/commandes`).
3. **Prédicats de lecture** « à préparer ? » / « à facturer ? » — à écrire avec leur garde de projection **quand un consommateur existe** (exports US-15/16/19, cercle 2).
4. **US-20** (Socket.IO) — débloque l'émission `commande_annulee` et le temps réel cuisine.
5. Point ouvert de défense hérité S15 : **colonne générée vs trigger** (AT-02).

---

## Structure du dépôt (extrait, annoté)

```
backend/src/
├── config/
│   ├── tarifs.js
│   └── seuils.js                         ← NOUVEAU (SEUIL_ANNULATION_TEMPS_JOURS)
├── domain/
│   ├── regles-annulation.js              ← NOUVEAU (compterJours, classerAnnulation)
│   └── __tests__/
│       └── regles-annulation.test.js     ← NOUVEAU (8 tests : 4 + 4)
├── routes/
│   ├── annulations.js                    ← NOUVEAU (PATCH /:id/annuler)
│   ├── commandes.js
│   ├── menus.js
│   └── __tests__/
│       └── annulations.test.js           ← NOUVEAU (nominal + 404 + 409)
├── app.js
└── index.js                              ← MODIFIÉ (annulationsRouter avant commandesRouter)
```

---

## Instructions pour reprendre (Session 17)

**Contexte :** US-09 socle terminé et testé (162 verts). La règle métier et le design sont figés (gel 12/08). Le socle *ne comprend pas* l'émission Socket.IO (US-20, cercle 2) ni les prédicats de lecture (pas de consommateur avant les exports).

**Rappels de doctrine réaffirmés cette session :**
- « Le fuseau trouve le jour, UTC compte les jours » — la temporalité d'US-09 en une phrase.
- Né-vert = **une** implémentation crédible falsifiée, nommée précisément ; conclusion juste ≠ raison juste (poser les nombres).
- « Vert » n'est pas « fait » : lire le code, pas le compteur.
- Écriture conditionnelle atomique (une décision) vs verrou (plusieurs décisions).

**Commandes de relance :**
```bash
cd backend
docker compose up -d                       # PostgreSQL 5433
npx dotenv -e .env.test -- bash -c 'npx prisma migrate reset --force && npx prisma db seed && npx vitest run'
```

**Vérification rapide :** la suite doit rendre **162 verts**. `git log --oneline` doit montrer, pour US-09, une chaîne rouge/né-vert(tagué)/green séparée par cycle.

**Prochaine décision à cadrer :** choisir la prochaine US (US-11 remarque, US-12 backend, ou bascule vers l'infra/déploiement de la Phase B). Le rapport (Phase A) reste **prioritaire absolue** avant le 17/08.

---

*Rapport mis à jour le 12 août 2026 — Session 16*
