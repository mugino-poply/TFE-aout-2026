# Rapport d'avancement — Synthèse

**Auteur :** Hippolyte AMORY
**TFE :** Le Cénacle — application web interne de gestion des commandes du restaurant
**Remise du rapport :** 17 août 2026 · **Arrêt du code :** 1er septembre 2026 · **Défense :** 2 septembre 2026
**Dernière mise à jour :** 16 août 2026 — Session 20

---

## Historique des sessions

- **S1** — Verrouillage du `schema.prisma`, abandon `LogAccesAllergie` (risque résiduel accepté), régénération WireGuard.
- **S2** — Poursuite conception, alignement figures rapport (différé).
- **S3** — Livraison US-01 (login PIN, JWT, bcrypt) en TDD, seed idempotent.
- **S4** — Livraison US-02 (liste publique utilisateurs) en TDD, projection `select`.
- **S5** — Cadrage US-03, séparation `authenticateToken` / `requireRole` en middlewares distincts.
- **S6** — Livraison US-03 en TDD, pattern route-par-route, palier 1 confirmé.
- **S7** — Ouverture Phase 2 ; audit RGPD ; cadrage US-04 ; TDD route 1 `GET /api/appartements` (28 tests verts).
- **S8** — Route 2 d'US-04 `GET /api/appartements/:numero/residents` en TDD (36 tests verts). Taxonomie 400/404/200-vide, forme vs inventaire, minimisation à la source. **US-04 complète.**
- **S9** — **US-05 CRUD résidents complète** (54 tests verts) : règle couple (verrou `FOR UPDATE`), anti-mass-assignment (whitelist), soft delete idempotent, `GET ?tous=1` ; refonte de l'isolation des tests.
- **S10** — **US-06 changement de résident complète** (68 tests verts) : transaction interactive atomique (soft-delete puis create), **verrou « sans count »** justifié par la fiabilité de la garde « sortant encore actif ? » face à un autre US-06 concurrent (pas le POST), ciblage explicite `id_resident_sortant`, taxonomie à deux couches (appartenance/état). **EPIC 02 clôturé.**
- **S11** — **US-13 CRUD allergies** (86 tests verts) : première US sur donnée de santé sensible (RGPD art. 9). POST (7 comportements, `created_by` via `connect`, garde de forme asymétrique), GET (enveloppé `{ id_resident, allergies }`, **minimisation `created_by` vérifiée par test**), DELETE (3 branches : forme des 2 ids, existence, appartenance ; **hard delete art. 17**). **Ownership tranchée hors-implémentation** (branche inatteignable/non testable sous RBAC actuel). 3 dettes S10 soldées (verrou sans count corrigé *et falsifié*, §5 backlog, oral 9002). **Phase 2 close.**
- **S12** — **US-07 menu du jour complète** (120 tests verts) : ouverture Phase 3. `POST /api/menus` (9 gardes de validation TDD par mutants + unicité **structurelle** `@unique`→P2002→409 + création imbriquée atomique + dérivation **ISO** semaine/année + stockage **minuit UTC** + minimisation `menuSelect`) et `GET /api/menus?date=` (**lookup par clé naturelle** → 404, 400-avant-404, `menuSelect` partagé). **Immuabilité `OptionMenu` en 3 tiers** documentée. Correction bornée en **choix A**. RBAC différencié POST (secrétaire/cuisine) / GET (+serveur). **Taxonomie de messages** en 3 registres.
- **S13** — **US-08 saisie commande dîner (UC-01) complète** (139 tests verts) : `POST /api/commandes`, première route créant des `LigneCommande` → `OptionMenu`. **`date_repas` dérivée serveur**. Étage de forme 8 gardes. Garde **résident actif** (2 rouges). Lecture **unique** des options → existence + **même menu** + dérivation. Happy-path 201 **étagé**. **Doublon 409 = index unique PARTIEL SQL brut** → P2002 ; **structurel car unicité**. RBAC secrétaire-seul. `type_repas` **enum complet reçu** (backend multi-type). Frontières **allergène→US-14**, **Socket.IO→US-20**. **Remédiation Git** (`bb96f48` faux `green` squashé avant push). Discipline « vérifier pas affirmer » (rétractation `orderBy`).
- **S14** — **US-14 détection d'allergie non bloquante** (147 tests verts) : détection **complète côté détection**, mais **US-14 non clôturable** (dépend alors de l'invariant AT-02, non implémenté). 7 comportements TDD + **canal double** `libelle` OU `contient_allergenes` (**AT-01**) + **ligature « œ »** (décision Diego ; `.replace(/œ/g,"oe")`, commit 3724d40). **Deux arbitrages validés Diego (09/08)** : **AT-01** et **AT-02**. **Registre des arbitrages** créé. Politique **backlog vivant mixte** posée.
- **S16** — **US-09 socle livré et testé** (annulations UC-02/03, **162 tests verts**). Ouverture EPIC 03. Design figé au gel 12/08 ; session = clôture des points ouverts + TDD. **`compterJours`** (écart en jours civils belges) : « le fuseau trouve le jour (`Intl` Bruxelles), UTC compte les jours (`Date.UTC`, insensible DST) » — **un seul fuseau, celui de la résidence, pour les deux côtés** (supprime 2 invariants à surveiller, arbitrage type S13) ; **3 né-verts orthogonaux** (heure d'été → minuits belges soustraits ; soir-de-J-2 → instants bruts /24 ; fuseau ambiant → getters natifs). **Choix lib-vs-natif tranché sur preuve** (`date-fns-tz` installée puis **retirée** au profit d'`Intl`, après test frontière `TZ`). **`classerAnnulation`** + seuil nommé `SEUIL_ANNULATION_TEMPS_JOURS` (`config/seuils.js`) : **politique nommée mais gelée à l'écriture** (option B), dissymétrie littéral `0` (fait) / constante `2` (politique). **Route `PATCH /:id/annuler`** : **TOCTOU fermé par écriture conditionnelle atomique** (`updateMany` conditionnel, pas verrou — critère « une seule décision vs plusieurs »), 404 avant 409 univoque (existence en amont), `annule_le = now` prouvé sous horloge gelée. **Socket.IO `commande_annulee` reporté US-20 (§ 11.3), déclaré.** Vigilance : *conclusion juste ≠ raison juste* (arithmétique de fuseau à poser, pas à intuiter) ; *« vert » ≠ « fait »*.
- **S17** — **Sprint rapport : cinq ⚠️ du gel § 1.2 fermés + rate-limit login TDD (163 verts) + dépôt rendu public.** Recadrage priorité produit → **rapport** (échéance impérative 17/08, 30 %). Calendrier fixé : **17/08 rapport, 1er/09 code+erratum, 2/09 défense** (stratégie B). ⚠️ vérifiés sur pièce : Express **5.2.1** (défaut sain, pas arbitrage) ; rate-limit **absent → implémenté** ; sauvegarde 3-2-1 **absente → minimum défendable + runbook** ; journal **local → versionné `docs/sessions/`** ; pagination = **règle règlementaire § 5.1**. **Rate-limit login** (risque brute-force PIN + liste US-02 publique ; clé IP+id_utilisateur + résiduel balayage ; `skipSuccessfulRequests` ; 5/15min **politique nommée** ; isolation store hors-base par `resetLoginRateLimit` en `beforeEach` ; **temps de verbe = vérité au 17/08**). **Audit sécurité avant public** : leçon « exposition = suivi Git + atteignabilité, pas étiquette » ; secrets neutralisés **par invalidation, pas réécriture d'historique** ; `POSTGRES_PASSWORD` sorti en var d'env, backlog **non suivi** (IP/SSH/WireGuard jamais exposés), PIN `2911` = seed de dev inerte. §§ 5.4/9.3.4/9.3.5 **réécrits et réinjectés**. **Cartographie du rapport** (verdicts par chapitre ; ch. 10 et 8 = RÉÉCRIRE, point de départ S18).
- **S16** — **US-09 socle livré et testé** (annulations UC-02/03, **162 tests verts**). `compterJours` (« le fuseau trouve le jour, UTC compte les jours », 3 né-verts orthogonaux ; `date-fns-tz` retirée au profit d'`Intl` sur preuve) ; `classerAnnulation` + seuil nommé gelé à l'écriture (option B) ; `PATCH /:id/annuler` (**TOCTOU fermé par écriture conditionnelle atomique**, 404-avant-409 univoque). Socket.IO reporté US-20.
- **S15** — **AT-02 implémenté et clôturé + US-14 clôturée** (**151 tests verts**). Session dominée par le **cadrage du registre AT-02** avant tout code : renoncement à **fermer l'input** (champ libre → mode d'échec « bloquer une allergie légitime » pire que le doublon → **garantie bornée assumée**, pas totale) ; **fantôme de correspondance JS/SQL** démonté (détection re-normalise le brut, ne lit jamais `libelle_normalise` → découplées → **jambe 4 supprimée**) ; **axe des options corrigé** (départage = **sur-blocage**, `unaccent` collapse plus que le sanctionné → rejette une allergie légitime, pas « correspond à la détection ») ; trigger **`BEFORE INSERT OR UPDATE`** (pas INSERT-only contingent). Implémentation TDD : **3 rouges de collapse + né-vert discriminant æ** (sourcé `unaccent('æ')='ae'`) → green (`normalise_libelle` **`translate` explicite** + colonne + `@@unique` + trigger + `catch P2002 → 409`, US-13 rouverte). **Détection de doublons préexistants prouvée** en schéma jetable (arrêt + rapport, pas de suppression) — `preuve_garde_doublons.sql`. **US-14 clôturée sur ses propres critères + ligature** (ses 4 critères ne dépendaient **pas** de l'unicité — histoire causale rectifiée). Point ouvert : **colonne générée vs trigger** (justification stale depuis le retrait d'`unaccent`).
- **S18** — **Réécriture du rapport, purge v1.** Chapitres **10** (Réalisation) et **11** (Analyse critique) refaits en entier + **§5.1/§5.3/§5.4** (Méthodologie). Récit de reprise logé (§5.1 le pourquoi, §5.3 les dates, §11.6 le réflexif). Rattrapage majeur : `bb96f48` (hash mort après rebase) → §11.2 s'appuie sur la chaîne poussée `9756012 → f4c199f → dba28e9` ; reflog en appui oral. PG18 vérifié pour la colonne générée (piste §11.4). Aucun code applicatif modifié. Dettes ouvertes : §5.5/§5.6/§5.2, bibliographie v1, volume, forme.
- **S19** — **Chapitre 5 clôturé + cohérence inter-chapitres.** Réécriture §5.2 (MVP redéfini = socle/cercle 1, paliers, arbitrage Diego validé), §5.5 (interactions réelles, registre technique vs gel), §5.6 (**480 h ancrées 16 ECTS** + **graphique généré** `figure_charge_5-6`), §5.7 (risques élargis à l'exploitation, coexistence papier, renvoi ch.9, Dockerfile/sauvegardes requalifiés en engagement). Corrections cohérence : **§11.1** (bilan point-par-point vs §1.4 ; exports/temps réel → perspective ; partiellement-tenu restaurés) et **§11.3** (phrase export mensuel supprimée, « deux écarts » → « un »). Aucun code modifié. **Découverte majeure : le tableau UC du chapitre 4 est encore en structure v1** (mapping inversé exports=MVP / auth=Release 2) → prochain chantier prioritaire.
- **S20** — **Assainissement du rapport écrit (audit des non-conformités).** Aucun code (sauf `.env.example`). **Cluster A soldé** (« présent de l'accompli sur du non-livré ») : ch.8 réécrit sur la suite réelle (**163 = 8 unitaires + 155 intégration**, testing trophy assumé, 3 statuts de preuve, absence de socle statique nommée) ; §7.1/§9.5 (`LogAccesAllergie` retirée → 10 entités, asymétrie de routes) ; §6.5 (3 registres, **`.env.example` créé et poussé**, 16 routes) ; §7.2.1 + **figure 7 refaite** (classes des entités, bande service fictive supprimée) ; matrice RBAC §9.3.2 (**11 routes réelles vs 22 fantasmées**, vérifiées au `grep requireRole`). **Bloc B soldé** : §4.1 (2 axes Priorité/Palier, MoSCoW re-noté), §4.3 (fiches → annexe, gel pt 83), §2.1. **C1/D1/D2/D3/D5** soldés (biblio, ventilation §5.6 = « Graphique 1 », compte de tests). Consignes de forme sourcées (page de garde, police non imposée, pagination §5.1). Erreurs de Claude corrigées par vérification (`tarifs.js`/`annulations.js` existants, D4 faux positif, nom `reglesAnnulation.js`, enums périmés). **Reste : figures E1/E2/E4, forme (F), liminaires, questions Diego (H).**

---

## Ce qui est en place

- Repo Git, `.gitignore` racine, Conventional Commits, narration TDD.
- Mono-dépôt `backend/` + `frontend/`.
- PostgreSQL 18 conteneurisée (`localhost:5433`), volume nommé, healthcheck.
- **Prisma 7.8** : `schema.prisma` verrouillé (S1), `prisma.config.ts`, driver adapter explicite, migrations versionnées.
- Backend ESM : `app.js` / `index.js`, `lib/prisma.js` singleton.
- **US-01** connexion PIN : `POST /api/auth/login`, bcrypt coût 12, JWT 11h, anti-énumération testée.
- **US-02** liste publique utilisateurs : `GET /api/users`, `select`, filtre `actif: true`.
- **US-03** middlewares JWT + RBAC : `authenticateToken` + `requireRole([...])` séparés (named exports), montage route-par-route, pas de bypass admin.
- **US-04** appartements : `GET /api/appartements` et `GET /api/appartements/:numero/residents` (forme 400 / existence 404 / contenu 200 avec allergies imbriquées, `select` à 3 niveaux, minimisation).
- **US-05 — CRUD résidents (complète)** :
  - `POST /api/residents` : résolution `numero_appartement` → `connect: { numero }` ; **règle couple** (au plus 2 actifs) garantie par verrou `SELECT … FOR UPDATE` en tête d'une `$transaction` **interactive** ; 201/400/404/409. `$queryRaw` tagged template.
  - `PATCH /api/residents/:id` : whitelist stricte `prenom`/`nom` (anti-mass-assignment) ; 200/400/404.
  - `DELETE /api/residents/:id` : soft delete `actif: false` + `date_sortie` ; **idempotent** ; 200.
  - `GET /api/residents?tous=1` : filtrage `actif` ; RBAC `['secretaire']`.
- **US-06 — Changement de résident (complète)** : `POST /api/appartements/:numero/changement` (`['secretaire']`). `$transaction` **interactive** ouverte par le **même** `SELECT … FOR UPDATE` que S9. Séquence : verrou → appartenance du sortant (scopée) → état → soft-delete → create. **Pas de count** (opération neutre) ; le verrou rend fiable la garde « sortant encore actif ? ». Taxonomie 400/404/409/201 minimisé. Atomicité tout-ou-rien par `throw` → rollback.
- **US-13 — CRUD allergies (POST/GET/DELETE, données de santé art. 9)** : routeur imbriqué `allergies.js` (`mergeParams`), `authenticateToken` + `requireRole(['secretaire','admin'])` globaux au routeur.
  - `POST` : **`201/400/404/409`** (le **409** né d'AT-02 : `catch P2002` sur violation d'unicité de forme normalisée → conflit ; **rétroactif S15**). Garde de forme asymétrique assumée. `created_by` via `utilisateur: { connect }`.
  - `GET` : `200/404`, réponse enveloppée `{ id_resident, allergies }`. **Minimisation `created_by` prouvée** (`not.toHaveProperty`). Liste vide = `[]` en 200.
  - `DELETE` : `204/400/404`. **Hard delete** (art. 17). Garde de forme sur les 2 ids. 404 à deux sous-branches (même message anti-énumération).
  - **Ownership** : non implémenté — branche inatteignable sous RBAC actuel → décision documentée.
- **AT-02 — Unicité d'allergie sur forme normalisée (implémentée 11/08, S15)** :
  - **`normalise_libelle(text)`** : fonction SQL **IMMUTABLE**, `replace(translate(lower(txt), 'àâäéèêëîïôöùûüÿç','aaaeeeeiioouuuyc'), 'œ','oe')` — **`translate` explicite (pas `unaccent`)** : collapse **exactement** les équivalences sanctionnées (casse, accents français, œ) et **rien de plus** (ne sur-bloque jamais, contrairement à `unaccent` qui collapse æ→ae, ß→ss…). Ordre `lower` puis `replace(œ)` (une seule forme à cibler).
  - **Colonne `Allergie.libelle_normalise`** calculée par **trigger `BEFORE INSERT OR UPDATE`** (incontournable tout chemin d'écriture, y compris maintenance/insertion directe ; INSERT-only écarté car garantie contingente).
  - **Contrainte `@@unique([id_resident, libelle_normalise])`** posée en **SQL manuel** (le trigger et la fonction ne sont pas Prisma-natifs).
  - **Migration ordonnée** : `normalise_libelle` (définie en 1er) → colonne nullable → remplissage (via la fonction) → **détection doublons de forme normalisée** (via la fonction — **échoue avec rapport**, pas de suppression silencieuse) → NOT NULL → contrainte → trigger. **Une définition, trois appelants.**
  - **Détection de doublons prouvée** (`preuve_garde_doublons.sql`) : schéma jetable pré-contrainte, deux `Arachides` → migration s'arrête et **nomme** `resident 1, forme "arachides" (x2)`, aucune suppression.
  - **Découplage détection/contrainte** : la détection US-14 re-normalise le `libelle` **brut** en JS des deux côtés, ne lit **jamais** `libelle_normalise`. Décision **non falsifiable** (trigger correct → état incohérent impossible ; rebranchement inoffensif sur le vocabulaire courant) → **commentaire de garde** dans `commandes.js` + registre, non testée (même classe que l'ownership DELETE).
  - **Résiduel acté** : unicité **orthographique**, pas sémantique (« Arachide »/« Arachides », « Sans gluten »/« Sans-gluten » survivent) — fermer cet écart sur du texte libre risquerait de bloquer une saisie légitime.
- **US-07 — Menu du jour (POST/GET, complète)** : routeur `menus.js`. `POST` (9 gardes séquentielles sécurité-first, unicité `date_menu @unique` → P2002 → 409, création imbriquée atomique, dérivation ISO, stockage minuit UTC, minimisation `menuSelect`) ; `GET ?date=` (lookup par clé naturelle → 404, `menuSelect` partagé). RBAC POST `['secretaire','cuisine']` / GET `+serveur`.
- **US-08 — Saisie commande dîner UC-01 (complète)** : `POST /api/commandes` (`['secretaire']`). `date_repas` dérivée serveur ; `type_repas` reçu + validé enum complet (backend multi-type). Étage de forme 8 gardes. Garde résident actif. Lecture unique des options (existence + même menu + dérivation). Happy-path 201 étagé. **Doublon 409 = index unique PARTIEL SQL brut** → P2002. Nested create atomique. Frontières allergène→US-14, Socket.IO→US-20.
- **US-09 — Annulations à temps / en retard UC-02/03 (socle livré et testé, S16)** : close **sur le périmètre socle**, pas sur ses critères d'origine (l'émission Socket.IO manque, volontairement).
  - **Couche `domain/`** introduite (logique métier partagée entre routes) : `regles-annulation.js` (renommé pour éviter la collision avec `config/seuils.js`).
  - **`compterJours(annuleLe, dateRepas)`** (pure) : écart en **jours civils belges**. Réduit chaque instant au triplet (Y,M,D) belge via `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' })` (insensible au `TZ` ambiant), puis compte via `Date.UTC(Y,M-1,D)` soustraits (minuits UTC → multiples exacts de 24 h → **calendaire par construction**, insensible au DST). **Un seul fuseau (résidence) pour les deux côtés.** 4 tests : nominal + **3 né-verts orthogonaux tagués** (heure d'été 29/03 → falsifie minuits belges soustraits ; soir-de-J-2 → falsifie instants bruts /24 ; `TZ=UTC` → falsifie getters natifs).
  - **`classerAnnulation(ecart)`** : `ecart >= SEUIL ? 'annulee_temps' : 'annulee_retard'`. Seuil `SEUIL_ANNULATION_TEMPS_JOURS = 2` dans **`config/seuils.js`** (politique révisable Diego, sourcé § 4.4 RG-02). **Politique nommée mais gelée à l'écriture** (option B : changer le seuil ne réécrit pas le passé). Dissymétrie `2` (constante/politique) vs `0` (littéral/fait). Nominal + frontière `2` (pinne `>=`) + 2 régressions métier (veille `1` facturée ; repas passé `-1` facturé).
  - **`PATCH /api/commandes/:id/annuler`** (`annulations.js`, `['secretaire']`, monté **avant** `commandesRouter`). Lit `date_repas` (`select` minimal, TOCTOU-sûr : donnée immuable) → **404 si absente** (avant classement, évite crash `null`) → `now` capturé **une fois** → classe → **`updateMany({ where: { id, statut: 'active' }, data: { statut, annule_le: now } })`** → `count === 1 → 200` / `count === 0 → 409`. **TOCTOU fermé par écriture conditionnelle atomique**, pas verrou (une seule décision). 404-avant-409 **univoque** (existence établie en amont → `count 0` = ré-annulation seule). `annule_le = now` prouvé sous horloge gelée (`vi.useFakeTimers({ toFake: ['Date'] })`).
  - **Reporté-assumé** : émission Socket.IO `commande_annulee` (**US-20, cercle 2, déclaré § 11.3**) ; prédicats de lecture « à préparer ? »/« à facturer ? » (cadrés, non implémentés faute de consommateur avant les exports). **Fantôme** DELETE concurrent documenté sans code (aucune route ne supprime de commande).
- **US-14 — Détection d'allergie non bloquante (complète et clôturée, S15)** : enrichit `POST /api/commandes` avec `allergies_detectees` (toujours présent, `[]` si rien), **non bloquante**.
  - **Croisement double canal (AT-01)** : nom du plat (`option.libelle`) OU allergènes déclarés (`option.contient_allergenes`) contre `resident.allergies`, `.includes()` sur formes normalisées, un push par (option, allergie).
  - **Normalisation** (`normalise`, `commandes.js`, pure) : `NFD → diacritiques → lowercase → replace(/œ/g,"oe")`, aux deux opérandes.
  - **7 comportements + ligature verrouillés TDD** (rouge authentique ou né-vert discriminant tagué).
  - **Clôturée** sur ses **4 critères propres** (backlog l.360-364 : détectée→201+warning ; aucune→201 ; non bloquant ; IT-02) **+ le correctif ligature** (S14). Ses critères **ne dépendaient pas** de l'unicité d'AT-02 — l'invariant AT-02 rend en bonus la dédup inter-allergies homonymes sans objet (plus de doublon possible en base), mais la clôture ne repose **pas** dessus.
- **Registre des arbitrages techniques** (`arbitrages_techniques.md`) : **AT-01** (validé 09/08) et **AT-02** (validé 09/08, **implémenté 11/08**, renvois commits + preuve).
- **Seed** : source unique `seedData.ts`. 4 utilisateurs, 88 appartements (numéros 3-90), 6 résidents nommés — apparts 3 (couple actif Giselle/Pierrot), 4 (Hervé seul), 5 (vacant), 6 (Baudouin inactif), 7 (Francis actif / Leopold inactif) — 1 allergie (Giselle « Arachides »).
- **Rate-limit login (S17)** : `POST /api/auth/login` protégé contre le brute-force. `config/rateLimit.js` (politique : `LOGIN_MAX_ECHECS=5`, `LOGIN_FENETRE_MS=15min`) + `middlewares/rateLimit.js` (mécanique : `loginRateLimit` + `resetLoginRateLimit`, store `MemoryStore` unique au niveau module). Clé **IP+id_utilisateur** (helper IPv6), **`skipSuccessfulRequests`**, greffé sur la route login (pas global). Isolation tests par `resetLoginRateLimit()` en `beforeEach` (store hors-base, insensible à `migrate reset`). **Résiduels déclarés** : `trust proxy` requis en prod (reverse proxy HTTPS) ; balayage multi-comptes depuis une IP (liste US-02 publique) ; bucket IP-seul sur requête malformée.
- **Journal de bord (S17)** : `session_N.md` + synthèse **versionnés** dans `docs/sessions/` (racine). `docs/exploitation/restauration.md` = runbook de sauvegarde (restauration au centre, journal de tests vide). Dépôt GitHub **public**, Kanban Projects accessible (issues publiques).
- **Secrets (S17)** : aucun `.env` suivi (`git ls-files` vide, historique propre) ; `POSTGRES_PASSWORD` en variable d'environnement (`${…}` dans `compose.yaml`, valeur dans `backend/.env` non suivi). Report déploiement : seed prod PIN admin hors dépôt.
- **Rapport RGPD** cohérent avec S1 et S7.
- **Mécanique de test** : Vitest + Supertest, base `tfe_test` isolée. Reseed **par fichier** (`setupFiles`) + **`fileParallelism: false`**. **Tests mutants isolés par fixtures locales jetables** (apparts 9001/9002 US-06 ; 8–16 US-13 ; menus-fixtures US-08/14 ; **résident jetable 9101 pour le describe 409 AT-02**, `afterAll` ordre FK ; **commande jetable en `beforeEach` pour US-09**, consommée par l'annulation → recréée à chaque `it`, FK vers seed non muté). **163 tests d'intégration verts** (US-09 : +11 en S16 ; rate-limit login : +1 en S17). **Horloge gelée** pour les tests dépendant du temps : `vi.useFakeTimers({ toFake: ['Date'] })` (Date seul, jamais tous les timers → sinon hang I/O Prisma/Supertest), `setSystemTime`, `useRealTimers` en `afterEach` ; `TZ` muté-restauré (piège `undefined` → `delete`, pas `"undefined"`). *`green` = affirmation de fait : lancer la suite avant tout commit `green` (leçon `bb96f48`). Clôture ≠ suite verte : un vert est aveugle aux chemins non exercés.*

---

## Ce qui reste à faire

### Phase A — RAPPORT (PRIORITÉ ABSOLUE avant le 17/08)
Chapitres **10, 11 (partiel), et 5 entier** réécrits (S18-S19). Reste, dans l'ordre d'attaque :
- **[FONDATEUR] Tableau UC — chapitre 4 (≈ l.470-491)** : encore en structure v1 « Release », mapping inversé (UC-04 export / UC-10 facturation = MVP ; UC-14 auth = Release 2 ; UC-08 liste appart = Release 2 alors qu'US-45 = cercle 1). Contredit §5.2, §11.1, §10.1. Reclasser sur paliers + réalité de livraison. **Premier chantier de la reprise.**
- **§2.1** : « valide chaque release » (→ livrables/règles) ; « défense en juin » (→ dépôt 17/08, défense septembre).
- **Backlog** : EPIC 06 en « Done » (vestige v1) ; conflit UC-15 (export mensuel vs gestion stocks §11.4).
- **Gel** : substituer la date **12/08** au « à compléter » (le §5.5 la cite).
- **Figure 3 (Gantt)** : refaire — trois paliers, légende sans « releases » (chantier Hippolyte).
- **Intégration** : basculer §5.2/§5.5/§5.6/§5.7/§11.1 réécrits dans le `.docx` ; insérer `figure_charge_5-6` en §5.6. **⚠️ Upload du fichier à jour à refaire (non abouti en S19).**
- **Ch. 8 Tests — RÉÉCRIRE** (Jest/32 tests/Playwright/routes inexistantes → Vitest, 163 IT, TDD discriminant, né-verts, recette + axe-core).
- **Corrections ponctuelles restantes** : 6.7 (Swagger + verbes → « prévus ») ; 9.3.2 (matrice RBAC réelle).
- **Volume** (~19 000 mots → cible ~30 p.) : couper 4.3 (20 fiches UC → 3 + annexe).
- **Forme** (page de garde, encart IA, liste annexes, romains tableaux) ; **conversion texte → Word paginé** — **en dernier**.
- **⚠️ Garde-fou** : les mentions annulation **à temps / veille / jour-même** en ch.1-4 = règle métier réelle (objectif), **PAS un vestige**. Le §11.1 réconcilie déjà objectif(3)↔livré(2). Ne pas purger.
- **Stratégie de temps de verbe** : backend = accompli ; frontend/déploiement/exports = **engagement** (erratum 1er/09).
- **Reports déploiement (→ erratum)** : sauvegarde exécutée + restauration datée ; seed prod PIN hors dépôt ; `trust proxy`.

### Phase 3 — cœur métier commandes (prochaine US à choisir + cadrer)
- ✅ **US-07** (menu du jour), ✅ **US-08** (saisie commande dîner), ✅ **US-14** (détection, **clôturée S15**), ✅ **AT-02** (unicité allergie, **clôturé S15**), ✅ **US-09** (annulations UC-02/03, **socle livré S16** ; Socket.IO reporté US-20).
- **Reporté d'US-09** : émission Socket.IO `commande_annulee` (**US-20**) ; prédicats de lecture « à préparer ? »/« à facturer ? » (à écrire quand un consommateur existe — exports cercle 2).
- **Candidates suivantes** : **US-11** (remarque, backend, petit) ; **US-12 backend** (`?vue=secretaire` sur `GET /api/commandes`) ; **US-20** (Socket.IO, débloque le temps réel + l'émission d'US-09) ; **US-10** (couples/invités jusqu'à 30, frontend) ; **US-43/44** (petit-déj/souper — backend déjà compatible, frontend). ⚠️ **Phase A (rapport) reste prioritaire absolue avant le 17/08.**

### Point ouvert de défense — colonne générée vs trigger (AT-02)
- `normalise_libelle` est devenue **IMMUTABLE** (retrait d'`unaccent`) → la raison qui écartait une **colonne générée** (`GENERATED ALWAYS AS … STORED`, qui exige IMMUTABLE) **est tombée**. Le registre ne pèse pas cette option et le trigger n'est plus justifié *contre elle* sur un fondement à jour. Vérifier (PG18 accepte-t-il une UDF immuable en colonne générée ?) et trancher/justifier avant le jury — question quasi certaine.

### Corrections backlog (à confirmer si déjà faites en local)
- l.351 (cible → renvoi AT-01, format daté) ; l.554 (IT-02 → `commandes.test.js` + recomptage ; **US-22 périmée** : `cenacle_test`/Jest/31 tests → réel `tfe_test`/vitest/151) ; mapping IT-02 → describe ; **note liminaire « backlog vivant mixte »**.

### Dettes / limites (pour l'analyse critique §11)
- **Observabilité des erreurs incohérente** : seul `auth.js`/US-07 loggent `e` avant un 500 → **middleware d'erreur global** serait la correction propre.
- **Branches 500 génériques / rollback / catch non-P2002 non couvertes** : provoquer une erreur Prisma arbitraire = disproportionné ; choix assumé et documenté (US-07/US-08).
- **Discrimination P2002 sur `e.code` seul** : valide tant qu'une table n'a qu'une contrainte unique hors PK (vérifié `\d` sur `Commande` ; sur `Allergie`, l'unique AT-02 est désormais la seule) ; à raffiner si un second unique arrive.
- **Index/trigger SQL bruts = drift Prisma** (hors schéma) : assumé, rejoués par `migrate reset`.
- **Couplage parser de query** (GET menus) ; **narration `orderBy`** (US-08, `Map`) ; **factorisation gardes d'enum** à la règle de trois.
- **Helper de forge de token** (`allergies.test.js`) : dette de test héritée.

### Points ouverts non bloquants
- Casse du scope Git US-01→US-04 (héritage S8). Update Prisma 7.8 → 7.9. Newline finale des fichiers de test. Justification niveau « Faible » §9.5.

### Hérité (avant remise du 17 août)
- Aligner les figures du rapport (EA + relationnel + UML classes) sur le schéma verrouillé (S1) — **inclure `libelle_normalise` + trigger AT-02**.
- **Formaliser la justification du modèle à deux champs** `id_appartement` / `numero` (question de jury quasi certaine).
- Dockerisation applicative à finaliser ; Kanban à revalider avec la rapporteure ; §11 analyse critique ; déclaration IA générative.

---

## Décisions techniques clés (référence rapide)

- **Séparation `authenticateToken` / `requireRole`** (named exports) ; `requireRole` = factory. `authenticateToken` au niveau router, `requireRole` route-par-route.
- **Option B RBAC** : `requireRole([...])` explicite. Pas de bypass admin. **RBAC par finalité** : lecture US-04 (prise de commande, 4 rôles) vs écriture/gestion US-05 & US-06 (`['secretaire']`).
- **Action métier sur ressource-pivot** : `POST /api/appartements/:numero/changement` — l'appartement est la ressource stable et identifiable, les résidents transitoires ; verbe d'action, pas CRUD d'entité ; le fichier suit le préfixe d'URL.
- **Réponse nested** + vocabulaire contextuel `residents` (DB) → `occupants` (API).
- **Taxonomie statuts** : 400 forme (validée par la route) / 404 absence (base) / 409 conflit d'état / 200-vide ≠ absence. **Deux couches en US-06** : appartenance (404, existence *scopée à l'appartement* — fantôme et « habite ailleurs » traités pareil) puis état (409).
- **Résolution métier** : le client envoie `numero` (donnée porte), pas la clé technique ; `connect: { numero }` (car `@unique`).
- **Règle couple = propriété vérifiable** : TOCTOU fermé par `SELECT … FOR UPDATE` (verrou, pas `SERIALIZABLE` → pas de retry) en tête d'une `$transaction` **interactive** ; garantie **protocolaire** (unique porte), non structurelle.
- **Verrou raisonné invariant-par-invariant, pas route-par-route** : toute porte pouvant faire passer un appartement de 2 à 3 actifs prend le **même** verrou sur la **même** ligne appartement. En US-06 le verrou n'a **pas de count** à protéger (opération neutre en compte) : il **sérialise contre toute autre porte touchant la ligne appartement** (typiquement un autre US-06) pour rendre fiable la garde « le sortant est-il encore actif ? ». Le partenaire n'est **pas le POST** (il a son propre verrou), et sous READ COMMITTED la « place transitoirement libérée » est de toute façon invisible à une transaction concurrente tant qu'elle n'est pas committée. La justification d'un même verrou peut **changer de nature** selon la route (protège *mon* count en S9, protège ma *garde d'état* pour les autres portes en US-06).
- **Critère invariant de données vs convention organisationnelle** : un invariant système est une règle que le schéma permet d'**évaluer** ET dont la violation **corrompt un état dont d'autres modules dépendent**. « Au plus 2 actifs » passe les deux tests (schéma le voit ; 3 actifs cassent affichage/facturation) ; « pas de remplacement dans un couple » échoue aux deux (schéma ignore la notion de couple ; 2 personnes = état cohérent) → convention non codée, assumée.
- **Critère général du verrou** : protéger un invariant que la concurrence peut violer, **pas** une valeur dont deux versions concurrentes sont correctes (→ pas de verrou au `DELETE`).
- **Atomicité tout-ou-rien** : `throw` dans la callback → **rollback atomique** (aucune écriture partielle) ; le verrou est **relâché aussi par le rollback**, pas seulement le commit. Le principe S1 appliqué au temps : jamais d'entre-deux visible.
- **Validation de forme stricte** : `Number.isInteger` (sans coercion) et `typeof + trim` — **fail-fast** sur entrée ambiguë plutôt que coercition silencieuse ou truthiness ; `typeof` avant `.trim()` (court-circuit protège l'appel). Une forme invalide échoue en 400 à la porte, jamais en 500 dans la transaction.
- **Sécurité SQL brut** : `$queryRaw` tagged template (anti-injection, STRIDE Tampering) ; `$queryRawUnsafe` proscrit ; table physique `"Appartement"` (aucun `@@map`).
- **Anti-mass-assignment** : whitelist en écriture ; preuve par relecture de la **base**, pas de la réponse.
- **Minimisation contextuelle** : le `select` dépend de ce que l'action/la vue doit montrer ; prouvée par **`toEqual`** (fuite de champ = test rouge).
- **Isolation des tests** : reseed par fichier + `fileParallelism: false` ; **tout test mutant sur fixture locale jetable** (jamais muter du seed partagé sans `afterAll` ; ordre de suppression FK : résidents avant appartement) ; PK **générée et capturée**, jamais forcée (évite la désync de séquence autoincrement).
- **Durée de vie des tests** : permanent (métier) vs échafaudage ; test « né vert » assumé ; **fixture anti-régression** (monter de vraies données pour qu'une régression échoue « pour la bonne raison »).
- **Ordre TDD sécurité-first** : barrière (401) → rôle (403) → forme (400) → existence (404) → conflit/métier (409/201). Red committé séparément ; un durcissement de garde naît d'un rouge (vérifiable dans `git log`).
- **`LogAccesAllergie` abandonné** (S1) ; accountability via `created_by` + RBAC + WireGuard. **Lecture allergies élargie au serveur** (S7, art. 9§2c), portée à l'oral.
- **Hard delete pour la donnée de santé (art. 17)** vs **soft delete pour l'entité métier** (résident) : asymétrie **dérivant de la nature de la donnée** — « le métier veut la mémoire du résident, le RGPD veut l'oubli de la donnée de santé ». Pas une incohérence : deux exigences distinctes sur deux objets distincts.
- **Minimisation exécutable** (`created_by` jamais exposé en lecture) : prouvée par `not.toHaveProperty` sur **toute la collection** GET (propriété vérifiable par le système, pas vigilance). `select` explicite = la ligne où la minimisation devient du code.
- **Garde de forme asymétrique justifiée** : le niveau de validation de chaque champ **dérive de sa défense en aval** (libelle durci car seule garde ; type présence + enum strict en aval ; notes durci seulement si fourni). Défendable contre « pourquoi trois traitements différents ? ».
- **Autorisation par ressource ≠ par rôle** : l'ownership (comparer `created_by` à l'utilisateur) exige de **lire la ressource**, ne peut vivre dans `requireRole` (qui n'a que le token) → ordre forcé 404 (existence) avant 403 (ownership). Distinction à tenir : « pas de bypass admin » = RBAC **rôle/route** ; bypass ownership = couche **ressource**, distincte.
- **Branche inatteignable = ne pas coder** : une garde dont la branche de refus ne peut être exercée par aucun test honnête (ownership sous RBAC actuel) n'est pas du défensif testé mais du code mort déguisé. La règle « propriété **vérifiable** » implique de **s'abstenir** tant qu'un test réel ne l'exige pas — à écrire en TDD le jour où le POST s'ouvre.
- **Réponse enveloppée sur sous-collection nichée** : `{ id_resident, allergies }` aligné sur la route **structurellement sœur** `:numero/residents` (`{ numero, occupants }`), pas sur la liste racine `/residents` (tableau nu). Critère de cohérence = la forme d'URL, pas la première route venue.
- **`created_by` : relation en écriture, scalaire en lecture** — `utilisateur: { connect }` obligatoire à l'écriture (relation pilotant la FK) ; `created_by` sélectionnable comme scalaire à la lecture. `createMany` (fixtures) accepte le scalaire car il bypasse la couche relationnelle — à distinguer du `create` de prod.
- **Trois tiers de garantie (US-07)** : *structurel* (`@unique`, imposé par le SGBD — un SQL brut le respecte) / *protocolaire* (vérif runtime unique, ex. verrou couple) / *surface applicative* (l'API sanctionnée est l'unique voie d'écriture à l'exécution, aucune route de mutation exposée). L'immuabilité `OptionMenu` relève du 3e tier — **pas** `@unique` (un `UPDATE` direct passerait), pas runtime — et porte sur le **jeu d'options entier**. Limite assumée : accès base/migration/route future = voies hors-bande. Parade à « et un UPDATE direct ? ».
- **Unicité structurelle ≠ protocolaire (US-07 vs US-05)** : `date_menu @unique` refuse atomiquement en base → **pas de verrou, pas de pré-check** (un `findUnique` de pré-check aurait son propre TOCTOU, ne peut être le rempart). Catch **`P2002` ciblé** → 409, tout autre code → 500. À l'inverse de la règle couple (non exprimable en contrainte simple → verrou protocolaire).
- **Lookup par clé naturelle → 404, pas `[]` (US-07 GET)** : `@unique` fait de la date une clé ; réponse **objet** (pas tableau) = recherche de ressource (`GET /:id`), pas filtre de collection → absence = 404. Distinct du `[]` d'US-13 (parent existant, sous-collection vide).
- **Cohérence temporelle UTC (US-07)** : `parseISO(date + "T00:00:00Z")` — minuit **UTC** canonique, pas minuit local (Bruxelles UTC+2 stockerait la veille). Rend l'`@unique` fiable **par instant** (sinon un autre chemin d'écriture à minuit-UTC-franc créerait un doublon). Une seule source `dateObj` alimente validation + stockage + dérivation ; **le GET réutilise le même parse** (sinon lookup sur un instant jamais stocké). Dérivation **ISO** : `semaine` ET `annee` de la même convention (`getISOWeekYear`, pas `getFullYear` — divergent à la frontière d'année).
- **Taxonomie de messages en 3 registres (contrat message US-07)** : présence de champ de body → « Champs obligatoires manquants » (groupé) ; présence de param de recherche GET → « [Param] requise » (singulier nommé) ; forme d'une valeur (type/format/calendaire) → « [Param] invalide » (correctif client identique). Tests assertent `res.body.error` (contrat), pas seulement le statut.
- **Sur-tester = défaut de jugement (US-07)** : figer par test un invariant/une divergence de doctrine (categorie-absente = invalide) ; **assumer par décision documentée** un choix cosmétique (ordre libelle/categorie — un seul message servi, inversion sans enjeu métier). Distinguer « figer » (coûteux, invariants) de « assumer » (gratuit, cosmétique).
- **Mutation manuelle pour deux branches sous un même message/statut (US-07)** : quand deux branches d'une garde (`typeof || trim`) rendent le même statut et message, la suite verte **ne peut pas** distinguer branche vivante de branche morte → commenter chaque branche et vérifier que chaque témoin rougit seul. Preuve exécutable, non committée. (Sous suppression du `typeof`, le témoin `123` casse en 500 → prouve l'ordre du court-circuit.)
- **`menuSelect` factorisé (US-07)** : constante de projection **partagée POST/GET** → minimisation cohérente écriture/lecture par construction (une seule définition). `contient_allergenes`/`semaine`/`annee` ne quittent pas Postgres.
- **Atomicité documentée non testée (US-07)** : nested create atomique (transaction implicite Prisma). Chemin de rollback **inatteignable par l'API** (pré-gardes rejettent toute option invalide avant le `create` ; l'`@unique` rejette le menu parent avant toute option). Propriété ORM documentée, tester serait malhonnête.
- **Garde `typeof` omise sur GET (US-07)** : parser query par défaut → `req.query.date` ∈ {string, undefined} (tableau via clé répétée recalé par regex/virgule ; singleton `["x"]` inatteignable hors parser `qs`). Couplage config documenté (réintroduire si parser `extended`). Pile GET plus courte que POST — asymétrie justifiée par la source (body tout-type vs query).
- **Dérivation vs réception (US-08)** : un champ dérivable d'une source déjà reçue **ne se reçoit pas**. `date_repas` dérivée (plats → `id_menu` → `date_menu`) supprime le cas « date ≠ plats ». `type_repas`, lui, n'a **aucun fil** menu→repas (options portent `categorie`/`id_menu`, pas le repas) → propriété indépendante, reçue + validée enum. Critère : existe-t-il un fil vers une source de vérité déjà présente ?
- **Structurel choisi par la *nature de la règle* (US-08 vs US-05)** : le doublon est une **unicité** → exprimable en base (index) → index unique *partiel* SQL brut, pas de verrou/pré-check (garantie « tous chemins, niveau stockage »). US-05 était un **comptage** (`≤ 2 actifs`) → non exprimable en unicité → verrou *nécessaire*. Le mécanisme découle de la règle, pas d'une préférence. Prendre le verrou ici = choisir la garantie faible quand la forte est dispo.
- **Index unique *partiel* (US-08)** : `WHERE type_client = 'resident' AND statut = 'active'` — non exprimable dans le DSL Prisma → **migration SQL brute** (rejouée par `migrate reset` = structurel ; **drift** aux yeux de Prisma, hors schéma, assumé). L'exemption invités **tombe du prédicat** (pas un cas bricolé) ; `statut = 'active'` libère le créneau après annulation. Discrimination du catch sur `e.code === "P2002"` **seul**, adossée au fait `\d` (une seule unique hors PK sur `Commande`) — le moins couplé (pas d'anatomie d'adaptateur ni de parsing de message).
- **`type_client` discrimine mangeur/hôte (US-08)** : `id_resident` = mangeur (`resident`) ou hôte facturé (invités, US-10). Ni le prix (`invite_resident` = tarif résident) ni « est-ce un résident » ne discriminent → c'est le *rôle* de `id_resident`. De là **tombe** l'exemption doublon des invités (un hôte invite plusieurs personnes au même créneau).
- **`green` = affirmation de fait (US-08, leçon `bb96f48`)** : un commit `green` affirme « la suite passe » ; l'écrire sans lancer la suite = affirmer sans vérifier (jumeau du numéro cité de mémoire). Un `green` dont la garde est *morte* (variable non déstructurée → `ReferenceError` → 500) checkout en rouge. Remède : **lancer la suite avant `green`** ; auditer par `git show <sha>:<fichier>` (lecture pure) plutôt que `checkout` sur arbre sale.
- **Réécriture d'historique avant push (US-08)** : `rebase -i` **squash** d'un `green`-cassé + son fix en un seul `green` honnête — légitime **tant que non poussé** (`origin` en retard). On nettoie *avant* de pousser, jamais après (un `push --force` casserait l'historique partagé). Le log qui porte les cicatrices d'une revue = preuve de processus réel, à raconter, pas à cacher.
- **Chaîne de préconditions étendue (US-08)** : forme (400) avant base (404/409) est une *nécessité* (frontière = accès base) ; l'ordre *entre gardes de forme indépendantes* est une *convention* défendable. `distinct` avant `count` (sinon un doublon `[5,5]` simule un manquant, Postgres dédoublonne `IN`) ; `entier` avant `distinct` (sinon `[1,"1"]` — même id — passe pour distinct dans un `Set`). Chaque garde rend la suivante *correcte*, pas seulement ordonnée.
- **Ordre de collection garanti par le code, pas par l'ORM (US-08)** : les `lignes` de la réponse sont ré-ordonnées **depuis le body reçu** (`Map` id→option), garantissant l'ordre de saisie *indépendamment* de l'ordre d'insertion de Prisma. Retenu contre `orderBy: { id_ligne: 'asc' }` (qui pariait sur `id_ligne = ordre d'envoi`, jamais vérifié). La garantie vient du `Map`, pas d'un pari sur l'ORM.

**Décisions S14 (US-14 / AT-01 / AT-02 conception) :**
- **Détection santé non bloquante = « l'algo assiste, il ne certifie pas »** : la garantie est le dispositif non bloquant, pas l'algorithme (couplé au vocabulaire cuisine). Faux positif accepté, « faux négatif interdit » walké back en « l'algo assiste ».
- **Cible de détection = enrichissement (AT-01)** : `libelle` OU `contient_allergenes` ; le nom détecte dès aujourd'hui, le champ dédié affinera. Divergence backlog **tracée et validée Diego**.
- **`contient_allergenes` inerte** (aucune route de saisie) → double canal.
- **Normalisation partagée, une règle des deux côtés** ; « œ » par `replace` explicite (NFD ne décompose pas) ; lowercase avant replace.
- **Consignation datée des validations santé** : toute décision Diego au registre (statut + date + canal). Accord oral non tracé = indéfendable.
- **Né-vert discriminant vs décoratif** : ne vaut que s'il rougirait sur une alternative crédible ; fixture bâtie pour discriminer.

**Nouvelles décisions S15 (implémentation AT-02) :**
- **Garantie bornée sur input ouvert > garantie totale sur input fermé** (donnée de santé) : on ne prouve pas une garantie totale sur un domaine ouvert par énumération. Fermer l'input pour y parvenir introduit un mode d'échec pire — **rejeter (400) une allergie légitime** (faux négatif de santé) — que le doublon prévenu (cosmétique, la détection fire quand même). Le champ `libelle` étant du **texte libre** (allergie/intolérance/régime, backlog l.324/333), « clos et petit » était **imposé**, pas constaté → **input ouvert, garantie bornée à `C` (accents français + œ), résiduel tracé**. `frontière(garantie) ≥ frontière(input)` est le critère ; ici l'input est ouvert par conception.
- **Axe de départage des options = sur-blocage, pas correspondance à la détection** : `unaccent` (option 1) satisfait la règle métier (collapse casse+accents+œ, testé) mais collapse **plus** que le sanctionné par Diego (æ→ae, ß→ss…) sur un champ libre → fusionne des libellés distincts → **rejette une 2e allergie légitime comme faux doublon** (côté interdit du faux négatif). `normalise_libelle` par `translate` explicite (option 4) collapse **exactement** le sanctionné, **rien de plus** → ne sur-bloque jamais. *(Correction d'une contradiction interne du registre S14, qui départageait sur « correspond à la détection » — axe démoli par le découplage ci-dessous.)*
- **Découplage détection/contrainte = décision non falsifiable, documentée au point de rencontre** : la détection re-normalise le `libelle` **brut** en JS des deux côtés (confirmé `commandes.js` l.84 + `select` sans `libelle_normalise`), la colonne SQL sert **exclusivement** la contrainte → les deux normaliseurs **ne se rencontrent nulle part** → la règle SQL et la règle JS **n'ont pas à correspondre**. La « correspondance base/détection » (jambe 4 du registre S14) était un **fantôme** — l'échec qu'elle prétendait couvrir n'est constructible que si la détection lit `libelle_normalise`, ce que le design ne fait pas → **jambe 4 supprimée**. Le découplage n'est pas falsifiable par un rouge honnête (trigger correct → état incohérent brut↔normalisé impossible ; rebranchement inoffensif sur le vocabulaire courant) → **commentaire de garde au code** (rend un futur rebranchement visible comme régression volontaire) + registre, **non testé** (même classe que l'ownership DELETE d'US-13).
- **Trigger `BEFORE INSERT OR UPDATE`, pas INSERT-only** : « aucune route n'édite le libellé » est un fait comportemental **contingent**, pas une garantie système (une maintenance en base, ou une future US d'édition, laisserait `libelle_normalise` périmé). Couvrir l'UPDATE = cohérent avec l'incontournabilité « tout chemin » de l'option 4.
- **Une définition, trois appelants** : `normalise_libelle` définie **en premier** dans la migration ; remplissage + détection des doublons + trigger l'appellent (jamais leur propre expression) → pas de divergence interne (détecter zéro doublon puis échouer à la pose).
- **Résiduel = unicité orthographique, pas sémantique** : la contrainte attrape les doublons de forme normalisée, laisse survivre les doublons de formulation. Aucune règle automatique ne peut fermer cet écart sur du texte libre sans risquer de bloquer une saisie légitime.
- **US-13 rouverte par la moitié applicative d'AT-02** : la contrainte fait échouer un insert doublon en `P2002` ; sans branche `catch P2002 → 409`, 500 au lieu de 409 (même motif qu'US-08). Le rouge applicatif (deux POST de même forme → 409) **force** contrainte base **et** branche route.
- **Une garde qui n'a gardé contre rien n'est pas prouvée** : la détection de doublons de migration a été **exercée en face d'un vrai doublon** (schéma jetable pré-contrainte) — « 151 verts sur un seed sans doublon » ne la prouvait pas. À distinguer du chemin UPDATE du trigger, non exercé mais **défendable** faute d'appelant réel : « non exercé » se défend là où il n'y a pas d'appelant, jamais là où il y en a un (la base réelle contiendra vraisemblablement des doublons au premier run).
- **Colonne générée vs trigger (point ouvert)** : le retrait d'`unaccent` (STABLE) au profit de `translate` (IMMUTABLE) a rendu `normalise_libelle` immuable → une colonne générée redevient techniquement envisageable ; justification du trigger *contre elle* à rafraîchir avant le jury.

**Décisions S16 (US-09 annulations) :**
- **« Le fuseau trouve le jour, UTC compte les jours »** : réduire deux **instants** à leur jour civil belge (via `Intl.DateTimeFormat` à `timeZone` explicite, insensible au `TZ` ambiant du process) *puis* compter via deux **minuits UTC** reconstruits (`Date.UTC`) — jamais soustraire deux instants ÷ 86,4M ni deux minuits **belges** (47 h autour d'un changement d'heure). Deux minuits UTC sont espacés d'un multiple exact de 24 h (UTC ignore le DST) → comptage **calendaire par construction**. Respecte « journées civiles entières, pas en heures » (§ 4.4 RG-02).
- **Un seul fuseau (résidence) pour les deux côtés** : justifié par le **sens** (« un jour civil est une horloge murale, celle de la résidence est à Bruxelles »), pas par le stockage. Supprime **deux invariants à surveiller** (que `date_repas` reste minuit-UTC ; que l'offset belge reste positif) — même arbitrage qu'en S13 (supprimer une dépendance au lieu de la gérer).
- **Choix de dépendance tranché sur preuve** : `date-fns-tz`/`toZonedTime` installée puis **retirée** au profit d'`Intl` natif, après un test frontière montrant que les getters natifs sur le `Date` recalé dépendent du `TZ` ambiant (= vigilance) alors qu'`Intl` à `timeZone` explicite reste juste sous `TZ=UTC` et `TZ=Tokyo` (= propriété vérifiable). Dépendance inutilisée = point d'attaque au jury → désinstallée. *L'erreur assumée (installer puis retirer) est une meilleure histoire de méthode qu'un choix « juste du premier coup ».*
- **Né-vert orthogonal** : un test par implémentation crédible falsifiée, **sans recouvrement**, nommant *précisément* ce qu'il tue **et ce qu'il ne tue pas**. Les 3 né-verts de `compterJours` se répartissent le travail (heure d'été → minuits belges soustraits ; soir-de-J-2 → instants bruts /24 ; `TZ=UTC` → getters natifs). Sur-revendiquer le label (nommer 2 cibles quand le test n'en tue qu'1) le dévalue ; la rareté fait le poids. Crédibilité maximale quand l'implémentation falsifiée a un **auteur réel** (la version getters-natifs proposée puis corrigée en séance).
- **Option B (figé / dérivé), politique nommée mais gelée à l'écriture** : la frontière temps/retard est figée dans `statut` à l'annulation ; changer le seuil `SEUIL_ANNULATION_TEMPS_JOURS` vaut pour l'avenir, **jamais** pour le passé (recalculer à la lecture serait dé-figer). Dissymétrie assumée : `2` = constante nommée (**politique** révisable Diego, `config/seuils.js`) ; `0` = littéral au point d'usage (**fait** physique : le repas du jour est déjà en cuisine). Ne pas les emballer dans un même objet « seuils ».
- **TOCTOU fermé par écriture conditionnelle atomique, pas par verrou** : `updateMany({ where: { id, statut: 'active' }, … })` collapse le check-then-act en une opération atomique sérialisée par la base (2 annulations concurrentes → la 2e mord 0 ligne → 409 légitime, sans transaction). **Critère : verrou si plusieurs décisions dépendent de la lecture (US-06) ; écriture conditionnelle si c'est un seul geste (US-09).** Même famille que l'index partiel d'US-08 (laisser la base arbitrer). `updateMany` (pas `update`) car il accepte le `where` composite, ne jette pas, rend un `count` borné à {0,1} par la cardinalité PK.
- **Séparer donnée immuable et donnée contestée** : lire `date_repas` **avant** l'écriture est sûr (immuable, aucun concurrent ne la mute) ; l'état contesté `statut` n'est **jamais lu pour décider** (seulement contraint dans le `where`). Le `select: { date_repas: true }` (ne projette même pas `statut`) est à la fois minimisation **et** sûreté TOCTOU.
- **404 avant 409 sans relecture de diagnostic** : garde d'existence **en amont** → si l'on atteint l'`updateMany`, la commande existe → `count === 0` ne peut venir que d'un statut non-active → 409 **univoque**. Le réordonnancement (existence avant classement) évite le crash `null.date_repas` **et** rend inutile toute relecture. Fantôme DELETE concurrent documenté sans code (aucune route ne supprime de commande).
- **Un seul `now`** capturé (bord impur de la route) réutilisé pour le calcul **et** l'écriture `annule_le` (évite un bord-de-minuit divergent entre deux `new Date()`). Décision de **construction**, non testable directement — mais partiellement verrouillée par l'assertion `annule_le.getTime() === instant gelé` sous horloge figée.
- **Garde de projection multi-appelants ≠ garde d'existence mono-handler** : la garde bruyante (`!annule_le`, opérateur `!` qui stoppe aussi `null` — domination sur `in`) sert les **prédicats de lecture** (plusieurs appelants, oubli silencieux faute de test dédié) ; au PATCH, l'oubli de `date_repas` est **bruyant gratuitement** (le test de la route le prend) → pas de garde spéciale, le test suffit. Deux surfaces, deux réponses. *(Le choix `!`>`in` se défend par domination logique, pas par un né-vert : le cas discriminant `annulee_retard`+`null` est irréachable par construction → décision documentée, non testée.)*
- **Report de périmètre ≠ arbitrage technique** : le report Socket.IO n'entre **pas** au registre des arbitrages (réservé aux vrais départages entre options techniques — AT-01, AT-02) mais en **§ 11.3 du rapport** (non-livraisons assumées, comme le module boissons). Se justifie par le **périmètre** (US-20, cercle 2), jamais par un faux argument de non-testabilité (une émission se teste par spy sur l'émetteur — le dire prouve que c'est un choix de scope).
- **Conclusion juste ≠ raison juste** : une conclusion opérationnelle correcte étayée par une arithmétique de fuseau posée de tête et fausse s'effondre au jury dès qu'on pousse sur la raison. Réflexe : **poser les quatre nombres** (jour natif des deux bornes sous les deux fuseaux) plutôt que raisonner par intuition de « recul ».

---

## Checklist nommage Prisma (référence)

| Élément | Valeur correcte |
|---|---|
| Dossier middleware | `middlewares` (avec `s`) |
| Import middleware | `import { authenticateToken } from '../middlewares/auth.js'` (named) |
| Payload JWT | `req.user.userId` |
| Relations Prisma (écriture) | `{ connect: { … } }` ; `connect: { numero }` autorisé car `numero @unique` |
| SQL brut | `tx.$queryRaw` tagged template (jamais `$queryRawUnsafe`) ; table physique `"Appartement"` |
| Transaction concurrente | `prisma.$transaction(async (tx) => …)` interactive ; verrou `FOR UPDATE` en tête |
| Auth psql | `-h localhost` (TCP) |
| PK Allergie | `id_allergie` |
| Champ catégorie Allergie | `type` (enum `TypeAllergie`) |
| FK Allergie → Resident | `id_resident` |
| Champ texte Allergie | `libelle` (String, NOT NULL) — **texte libre** (allergie/intolérance/régime), seule garde « fourni » |
| Champ notes Allergie | `notes` (String?, jamais exposé) |
| **Colonne AT-02 (implémentée S15)** | `Allergie.libelle_normalise` (String, NOT NULL, **calculée par trigger `BEFORE INSERT OR UPDATE`**) + `@@unique([id_resident, libelle_normalise])` posé en **SQL manuel** (fonction + trigger non Prisma-natifs) → `catch P2002 → 409` sur le POST |
| **Fonction `normalise_libelle` (SQL, AT-02)** | **IMMUTABLE** : `replace(translate(lower(txt), 'àâäéèêëîïôöùûüÿç','aaaeeeeiioouuuyc'), 'œ','oe')` — `translate` explicite (pas `unaccent`), `lower` avant `replace(œ)`. Une définition, trois appelants (remplissage, détection doublons, trigger) |
| Enum `TypeAllergie` | `allergie` / `intolerance` / `regime` |
| Relation Resident → Allergie | `allergies` (Allergie[]) |
| PK Resident | `id_resident` (autoincrement) |
| Champs Resident | `prenom`, `nom`, `date_entree` (DateTime obligatoire), `date_sortie` (DateTime?), `actif` (Boolean @default(true)) |
| Relation Resident → Appartement | `appartement` |
| PK Appartement | `id_appartement` (@id autoincrement) |
| Champ métier Appartement | `numero` (@unique, = `id_appartement` par coïncidence de seed) |
| Index utile | `@@index([id_appartement, actif])` sur Resident |
| PK Menu | `id_menu` (autoincrement) |
| Champs Menu | `date_menu` (DateTime **@unique**, minuit UTC), `semaine` (Int, ISO), `annee` (Int, ISO) |
| Relation Menu → OptionMenu | `options` (OptionMenu[]) |
| PK OptionMenu | `id_option` |
| Champs OptionMenu | `id_menu` (FK), `categorie` (enum `CategorieOption`), `libelle` (String), `contient_allergenes` (String?, **lu par la détection US-14**, nom OU ce champ ; non exposé) |
| Constante projection Menu | `menuSelect` (partagée POST/GET dans `menus.js`) |
| Fonction `normalise` (JS, US-14) | module scope `commandes.js`, pure : `s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/œ/g,"oe")` — **découplée de `normalise_libelle` SQL** (ne se rencontrent nulle part ; garde anti-rebranchement au code) |
| PK Commande | `id_commande` (autoincrement) |
| Champs Commande | `id_resident` (FK, non-nullable), `date_repas` (DateTime, **dérivée serveur**), `type_repas` (`TypeRepas`, reçu), `statut` (@default(active)), `en_appartement` (@default(false)), `remarque` (String?), `created_by` (FK Utilisateur), `annule_le` (DateTime?), `type_client` (`TypeClient`, @default(resident)), `note_invite` (String?) |
| PK LigneCommande | `id_ligne` — FK `id_commande`, `id_option` ; **pas de `quantite`** (⇒ ids distincts) ; pas de snapshot |
| Enum `TypeClient` | `resident` / `invite_externe` / `invite_resident` |
| Enum `StatutCommande` | `active` / `annulee_temps` / `annulee_retard` |
| Index doublon commande (US-08) | **partiel, SQL brut** (`20260807135226_doublon_resident_actif`) : `… ON "Commande" (id_resident, date_repas, type_repas) WHERE type_client = 'resident' AND statut = 'active'` → P2002 → 409 |
| Enum `TypeRepas` | `petit_dejeuner` / **`diner`** / `souper` *(vérifié S12 : `diner`, PAS `dejeuner`)* |
| Enum `CategorieOption` | **11 valeurs** *(vérifié S12)* : `entree` / `plat` / `plat_substitution` / `dessert` / `fruits` / `yaourt` / `soupe` / `soupe_dessert` / `repas_complet` / `plat_dessert` / `plat_seul` |
| Enum `TypeBoisson` | `vin` / `soft` |
| PK Utilisateur | `id_utilisateur` |
| Enum rôles | `Role` *(vérifié S12)* : `secretaire` / `cuisine` / `serveur` / `admin` — champ `role` |
| Import date | `import { parseISO, isValid, getISOWeek, getISOWeekYear } from "date-fns"` ; `parseISO(date + "T00:00:00Z")` |

---

## Exigences EPHEC couvertes

- ✅ Étude de l'existant (§3).
- ✅ Analyse de sécurité STRIDE (§9.2) + contre-mesures (§9.3) + RGPD (§9.4) + risques résiduels (§9.5). **RGPD art. 9** opérationnalisé (RBAC contextuel, minimisation testée), **art. 17** (hard delete). **Modèle de menace sur l'écriture de la table Allergie** → AT-02 (garantie système vs vigilance). **S15 : gouvernance donnée de santé prouvée** (migration qui échoue-avec-rapport au lieu de supprimer, pièce `preuve_garde_doublons.sql`).
- ⏳ Schémas techniques : EA, relationnel, UML — figures à aligner sur le schéma verrouillé (**inclure `libelle_normalise` + trigger**).
- ✅ Versioning Git dès le début, Conventional Commits, narration TDD tracée. *Vigilance : casse du scope US-01→US-04.*
- ✅ Tests d'intégration : **162 verts**, discipline TDD (Red/Green séparés, né-vert **discriminant** tagué avec preuve par construction, régressions métier distinguées des né-verts, refactor/infra distincts). Historique audité et corrigé avant push. **Registre des arbitrages (AT-01, AT-02)** citable au jury. **3 né-verts orthogonaux d'US-09** = étude de cas « description de la validation ».
- ✅ Documentation du code : commentaires justificatifs, commentaire de garde AT-02, registre des divergences.
- ⏳ Procédure de déploiement Docker : compose PostgreSQL en place, dockerisation applicative à finaliser.
- ⏳ Planning détaillé (Kanban) : à revalider avec la rapporteure.
- ⏳ Analyse critique finale (§11) : à écrire.
- ⏳ Déclaration IA générative : formulaires annexes à joindre.

---

## Structure du dépôt

```
TFE - AOUT 2026/
├── .git/
├── .gitignore
├── README.md
├── arbitrages_techniques.md            (AT-01 ; AT-02 IMPLÉMENTÉ 11/08)
├── preuve_garde_doublons.sql           (preuve détection doublons AT-02)
└── backend/
    ├── compose.yaml
    ├── package.json
    ├── package-lock.json
    ├── prisma.config.ts
    ├── vitest.config.js
    ├── vitest.setup.js
    ├── prisma/
    │   ├── schema.prisma                (Allergie.libelle_normalise + @@unique)
    │   ├── seed.ts
    │   ├── seedData.ts
    │   └── migrations/
    │       ├── <timestamp>_init/
    │       ├── 20260807135226_doublon_resident_actif/     (index partiel SQL brut)
    │       └── <timestamp>_unicite_allergie_normalisee/   (AT-02 : fonction + colonne + contrainte + trigger)
    └── src/
        ├── config/
        │   ├── tarifs.js
        │   └── seuils.js                    (SEUIL_ANNULATION_TEMPS_JOURS — US-09)
        ├── domain/
        │   └── regles-annulation.js         (compterJours, classerAnnulation — US-09)
        ├── routes/
        │   └── annulations.js               (PATCH /:id/annuler — US-09, monté avant commandesRouter)
        ├── app.js
        ├── index.js
        ├── lib/
        │   └── prisma.js
        ├── middlewares/
        │   ├── auth.js
        │   └── __tests__/
        │       ├── authenticateToken.test.js
        │       └── requireRole.test.js
        └── routes/
            ├── auth.js
            ├── users.js
            ├── appartements.js
            ├── residents.js
            ├── allergies.js                (catch P2002 → 409)
            ├── menus.js
            ├── commandes.js                (normalise + détection US-14 ; garde anti-rebranchement)
            └── __tests__/
                ├── auth.test.js
                ├── users.test.js
                ├── appartements.test.js
                ├── residents.test.js
                ├── allergies.test.js       (describe 409 AT-02 : 3 rouges collapse + né-vert æ, fixture 9101)
                ├── menus.test.js
                └── commandes.test.js
```

Frontend non démarré (Phase 4).

---

## Instructions pour reprendre

Depuis la racine du projet :

```bash
cd backend
docker compose up -d
npm test              # 163 tests verts attendus
npm run dev           # serveur sur :3000
```

Pipeline complet de test (reset schéma + reseed par fichier + vitest) :

```bash
dotenv -e .env.test -- bash -c 'npx prisma migrate reset --force && npx prisma db seed && vitest run'
```

Vérification des invariants structurels (doivent survivre au reset, sur `tfe_test`) :

```bash
docker exec -it tfe_postgres psql -U tfe -d tfe_test -c '\d "Commande"'   # index partiel commande active
docker exec -it tfe_postgres psql -U tfe -d tfe_test -c '\d "Allergie"'   # @@unique(id_resident, libelle_normalise) + trigger BEFORE INSERT OR UPDATE
```

**Backend livré et gelé (163 tests verts, 11 routes). Rapport écrit assaini sur le fond (S20) : clusters A et B soldés, plus C1/D1/D2/D3/D5. Il ne reste AUCUNE réécriture de fond.** Reste à faire avant remise (17/08) : **figures** E1 (EA vertical, 10 entités) / E2 (relationnel vertical) / E4 (vue cuisine + sommes) ; **forme** (numérotation §3.2, purge ancres `[^c0-c8]`, TdM + pagination double romains/arabes par sauts de section) ; **liminaires** (page de garde + encart déclaration IA) ; **questions Diego** (UC-10 palier facturation, UC-15 cohérence stocks). **En tout dernier :** balayage `grep` final des vestiges + passe typographique visuelle.

Rappels de discipline : **`grep`/schéma/`git` avant d'écrire un fait** (vaut aussi pour Claude) ; **fichier d'abord, affirmation ensuite** (`git ls-files` pour la présence réelle) ; **une figure n'est conforme que si elle est appelée ET expliquée dans le texte** (règlement l.366-367) ; **lancer la suite avant tout commit `green`** ; **consigner toute validation Diego datée** ; réécriture d'historique **avant push** uniquement.

---

*Rapport synthétique — 20 sessions — dernière mise à jour 16 août 2026*
