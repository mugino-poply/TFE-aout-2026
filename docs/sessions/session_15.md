# Session 15 — Implémentation et clôture d'AT-02 (unicité d'allergie sur forme normalisée) + clôture d'US-14

**Auteur :** Hippolyte AMORY
**TFE :** Le Cénacle — application web interne de gestion des commandes du restaurant
**Défense :** 17 août 2026
**Date de session :** 11 août 2026

---

## Contexte et état de départ

Fin de S14 : détection US-14 **complète côté détection** (147 tests verts), mais **US-14 non clôturable** faute de l'invariant d'unicité d'allergie — arbitrage **AT-02**, validé par Diego le 09/08 mais **non implémenté**. Objectif S15 : implémenter AT-02 (migration base : fonction de normalisation + colonne + contrainte + trigger) et clôturer US-14.

État final : **151 tests verts**, **AT-02 implémenté et prouvé** (y compris la détection de doublons préexistants, exercée en face d'un vrai doublon), **US-13 rouverte puis reclôturée** (branche `P2002 → 409` sur le POST), **US-14 clôturée** sur ses propres critères. Registre AT-02 passé au statut *Implémenté le 11/08/2026*.

Fil rouge de la session : la majeure partie du temps n'a **pas** été l'écriture de la migration mais le **cadrage du registre AT-02 lui-même**. Trois éléments que le registre affirmait se sont révélés faux ou fantômes sous examen, et ont été refermés **avant** d'écrire une ligne de SQL — conforme à la doctrine « une divergence sur donnée de santé se consigne (correctement) avant d'être codée ».

---

## Ce qui a été travaillé

### 15.1 — Faits SQL préalables (mesurés, non supposés)
Avant toute écriture du trigger, quatre faits sourcés en psql sur `tfe_postgres` :
- `pg_extension` : `unaccent` présent (v1.1).
- `lower(unaccent('Œufs')) = 'oeufs'` → le dictionnaire par défaut ramène déjà la ligature « œ » à « oe » (contrairement au JS, où NFD ne la décompose pas et où un `replace` explicite avait dû être ajouté en S14).
- `\df+ unaccent` → `unaccent` est **STABLE**, pas **IMMUTABLE** (justifie qu'une colonne générée ne pourrait pas l'utiliser — voir point ouvert 16.x sur la colonne générée après retrait d'`unaccent`).
- `unaccent('æ') = 'ae'` → sourcé pour valider le né-vert discriminant (voir 15.4).

### 15.2 — Effondrement de la « fermeture d'input » (garantie bornée assumée)
Piste initiale : fermer l'ensemble des caractères autorisés dans `libelle` à un ensemble clos `C` pour que `frontière(input) = C` par construction, rendant la correspondance base/détection **totale** et non échantillonnée.

Abandonnée après vérification au backlog (l.324, l.333) : `libelle` est **du texte libre** couvrant *allergie / intolérance / régime*, seule garde = « fourni ». « Clos et petit » n'était donc pas une propriété du champ mais une propriété **imposée**, non sourçable — le sourcer depuis « les 14 allergènes réglementaires + saisies plausibles » revenait à l'**au-jugé** proscrit (le champ n'est pas les 14 allergènes, et un régime comme « Sans porc »/« Hyposodé » est arbitraire par nature).

Décision : **input ouvert, résiduel assumé**. Fermer l'input aurait transformé le mode d'échec en « rejeter (400) un libellé de santé légitime » — un faux négatif de santé (allergène absent du système), **pire** que le doublon qu'AT-02 prévient (cosmétique : la détection fire quand même). Optimiser l'unicité au prix du travail premier du champ (consigner un fait de santé) = optimiser le mauvais côté du « faux négatif interdit ». La garantie devient **bornée et tracée** (sur `C` = accents français + œ, base et détection coïncident), pas totale.

### 15.3 — Fantôme de la correspondance JS/SQL (jambe 4 supprimée)
Le registre S14 posait une « jambe 4 » : un test de correspondance base/détection censé verrouiller un risque résiduel d'AT-02. Sous examen, ce risque **n'existe pas**.

Construction de l'échec demandée : il n'apparaît **que si** la détection lit `libelle_normalise` (sortie SQL) côté allergie tout en normalisant le plat en JS — là les deux formes se rencontrent dans le `.includes`. **Confirmé au code** (`commandes.js` l.84 `normalise(allergie.libelle)` part du **brut** ; le `select` ne charge pas `libelle_normalise` ; `grep` : la colonne est absente du fichier) : la détection re-normalise le brut en JS des deux côtés, la colonne SQL sert **exclusivement** la contrainte. Les deux normaliseurs **ne se rencontrent nulle part** → ils sont découplés → « base et détection coïncident » n'est pas un invariant porteur.

Conséquence : **jambe 4 supprimée** (elle protégeait une rencontre qui n'a pas lieu), et le test-verrou envisagé pour « prouver » le découplage a été **abandonné** — il aurait exigé un état (`libelle` brut incohérent avec `libelle_normalise`) que le trigger correct **interdit d'exister** ; le forcer aurait testé un défaut de trigger, pas le découplage.

### 15.4 — Cadre de test AT-02 (batterie complète avant tout code)
Batterie TDD, chaque test rougissant pour **sa propre** raison sur une alternative crédible :
- **3 rouges de collapse** — casse (`Arachides`/`arachides`), accents (`Céleri`/`celeri`), ligature (`Œufs`/`oeufs`). Discrimination tracée : sur `normalise_libelle` réduit à `lower()`, le rouge accents ressort 201 ; sur `lower+translate` sans le `replace`, le rouge ligature ressort 201. Chacun **exige** sa règle.
- **1 né-vert discriminant de non-collapse** — `Cæsar`/`Caesar` (201 **et** 201). Il pinne la moitié « ne sur-bloque **jamais** » : une fonction pathologique qui collapserait tout passerait les 3 rouges (409 partout) mais **échouerait** ce test. Discriminant matériel contre l'option 1 (`unaccent`) : sourcé que `unaccent('æ')='ae'`, ce test **rougirait sous `unaccent`** (æ→ae→collision) et reste vert sous la table `translate` (aucun mapping æ). Tagué né-vert : il ne prouve **qu'après le green** (avant, tout second insert ressort 201 pour la raison nulle — rien ne déduplique), par **construction** (absence de mapping æ inspectable + comportement d'`unaccent` sourcé), pas par run.

### 15.5 — Green (un seul geste) + réouverture/reclôture d'US-13
Le rouge applicatif (deux POST de même forme normalisée → 409) **force à exister** la contrainte base **et** la branche `catch P2002 → 409` du POST allergies (US-13 rouverte : elle faisait `201/400/404`, un doublon ressortait en 500). Green implémenté en un geste, dans l'ordre du registre : `normalise_libelle` (SQL explicite) + colonne `libelle_normalise` (nullable → remplissage → NOT NULL) + contrainte `@@unique([id_resident, libelle_normalise])` (SQL manuel) + trigger `BEFORE INSERT OR UPDATE` + `catch P2002 → 409`. Fixture **jetable** (résident 9101, pas Francis seedé), `afterAll` en ordre FK (allergie → résident → appartement). **Suite complète lancée** (leçon `bb96f48` : `green` est un fait mesuré) → **151 verts** (147 + 4).

`normalise_libelle` : `replace(translate(lower(txt), 'àâäéèêëîïôöùûüÿç','aaaeeeeiioouuuyc'), 'œ','oe')` — **`translate` explicite, pas `unaccent`**. `translate` est du 1-pour-1 caractère (accents simples) ; la ligature « œ »→« oe » (1→2) relève de `replace` ; `lower` en premier (une seule casse à cibler). Fonction **IMMUTABLE** (translate/lower/replace le sont).

### 15.6 — Vérifications post-green (aucune ne se déduit de « 151 verts »)
- **Trigger `BEFORE INSERT OR UPDATE`** confirmé au DDL (`\d`). L'INSERT-only aurait reposé sur un fait contingent (« aucune route n'édite le libellé ») incompatible avec la garantie « tout chemin d'écriture » — le chemin UPDATE (maintenance, future US d'édition) laisserait sinon `libelle_normalise` périmé.
- **Commentaire de garde** confirmé au code (`commandes.js`, au chargement des allergies) : « ne pas rebrancher la détection sur `libelle_normalise`, sinon SQL et JS doivent coïncider — séparées exprès (AT-02) ». Rend un futur rebranchement visible comme **régression volontaire**, pas simplification anodine.
- **Chaîne de commits honnête** (`git log`) : rouge collapse (2638a0e) → né-vert æ tagué (cf3ced3) → green (261f729) → docs garde (402baba). Cycle lisible, pas de bloc opaque.
- **Détection des doublons préexistants prouvée** (le point qui ne se déduit d'aucun vert) : schéma jetable montant l'état **pré-contrainte** (deux `Arachides` insérables car la contrainte n'y est pas), migration lancée → **arrêt avec rapport nommant** `resident 1, forme "arachides" (x2)`, **aucune suppression silencieuse**, `DROP SCHEMA CASCADE` en sortie (bac à sable nettoyé). Fichier `preuve_garde_doublons.sql` conservé au dépôt comme pièce de défense.

### 15.7 — Clôtures (AT-02 + US-14) sur les bons fondements
- **AT-02** : registre passé à *Validé 09/08 (Diego) — Implémenté 11/08* + renvois commits + renvoi preuve. Retouche : étape 4 = « détection des doublons **de forme normalisée** » (pas « doublons » tout court — la migration ne dédoublonne pas le sens).
- **US-14** : vérifié au backlog (l.360-364) que ses **4 critères ne dépendent pas** de l'invariant d'unicité d'AT-02 (allergie détectée→201+warning ; aucune→201 sans warning ; non bloquant ; IT-02). Le vrai lien US-14 ↔ ce chantier était la **ligature** (détection trouée sur « œ », corrigée en S14, commit 3724d40), **pas** l'unicité. US-14 clôturée sur **ses critères + le correctif ligature**. Histoire causale rectifiée pour la défense : « US-14 attendait le correctif ligature validé par Diego » (défendable), non « US-14 attendait la contrainte d'unicité » (démontable).

---

## Décisions prises et justification (pour le rapport TFE)

- **Garantie bornée sur input ouvert > garantie totale sur input fermé** (donnée de santé) : on ne prouve pas une garantie totale sur un domaine ouvert par énumération ; fermer l'input pour y parvenir introduit un mode d'échec (bloquer une saisie légitime) pire que le risque prévenu. `frontière(garantie) ≥ frontière(input)` est le bon critère ; ici l'input est ouvert par conception → garantie bornée à `C`, résiduel tracé.
- **Axe de départage des options = sur-blocage, pas correspondance** : `unaccent` est écarté non parce qu'il diverge de la détection (elles sont découplées) mais parce qu'il collapse **plus** que les équivalences sanctionnées par Diego (æ→ae, ß→ss…) sur un champ libre → fusionne des libellés distincts → **rejette une 2e allergie légitime comme faux doublon**. Option 4 (`translate` explicite) collapse **exactement** le sanctionné et **rien de plus** → ne sur-bloque jamais.
- **Découplage détection/contrainte = décision non falsifiable, documentée au point de rencontre** (même classe que l'ownership DELETE d'US-13) : sous un trigger correct, l'état incohérent brut↔normalisé ne peut exister ; sur le vocabulaire courant, un rebranchement ne change rien → pas de rouge honnête possible → commentaire de garde au code + registre, pas de test.
- **Trigger `BEFORE INSERT OR UPDATE` (pas INSERT-only)** : « aucune route n'édite le libellé » est un fait comportemental **contingent**, pas une garantie système. Couvrir l'UPDATE est cohérent avec la raison d'être de l'option 4 (incontournable **tout chemin**).
- **Une définition, trois appelants** : `normalise_libelle` définie **en premier** dans la migration ; le remplissage, la **détection des doublons** et le trigger l'appellent — jamais leur propre expression (sinon divergence interne à la migration : détecter zéro doublon puis voir la contrainte échouer à la pose).
- **Résiduel = unicité orthographique, pas sémantique** : la contrainte attrape les doublons de forme normalisée (casse/accents/œ), laisse survivre les doublons de formulation (« Arachide »/« Arachides », « Sans gluten »/« Sans-gluten »). Aucune règle automatique ne peut fermer cet écart sur du texte libre sans risquer de bloquer une saisie légitime.
- **US-13 rouverte par la moitié applicative d'AT-02** : la contrainte fait échouer un insert doublon en `P2002` ; sans branche dédiée, 500 au lieu de 409. Même motif qu'US-08 (`P2002 → 409` sur l'index partiel). Le trou n'est fermé que quand la route traduit la violation.
- **Une garde qui n'a gardé contre rien n'est pas prouvée** : la détection de doublons doit être exercée **en face d'un doublon** (schéma jetable pré-contrainte) ; « 151 verts sur un seed sans doublon » ne prouve pas qu'elle échoue-avec-rapport. À distinguer du chemin UPDATE du trigger, non exercé mais **défendable** car sans appelant réel (comme la branche inatteignable du DELETE) — « non exercé » se défend là où il n'y a pas d'appelant, jamais là où il y en a un (la vraie base contiendra vraisemblablement des doublons au premier run).

---

## Concepts compris / à consolider

**Acquis :**
- Distinguer **frontière de garantie** et **frontière d'input** ; on ne teste pas la sortie d'un ensemble ouvert par échantillonnage.
- **Fantôme de couplage** : avant de consigner un risque résiduel, construire l'échec concret qu'il produit ; s'il est inconstructible sous le design, le risque est un fantôme et le test qui le « verrouille » est décoratif.
- **Décision non falsifiable** vs invariant testable : quand aucun rouge honnête ne peut exister, on documente au point de rencontre, on ne fabrique pas un test artificiel.
- **Cohérence interne d'un registre** : départager des options sur un axe qui sera démoli plus loin crée une auto-contradiction — la faute la plus visible au jury. L'axe retenu doit survivre à tout le reste du document.

**À consolider :**
- **Clôture ≠ suite verte.** Deux fois cette session, « c'est fait » a été déclaré trop tôt : « 151 verts → clos » (alors que la détection de doublons n'avait jamais tourné sur un cas positif) et « il est né vert → prouvé » (alors que le né-vert était encore vert pour la raison nulle et que `unaccent('æ')` n'était pas sourcé). Un vert est aveugle aux chemins non exercés ; identifier lesquels ont un appelant réel.
- **Ne pas sauter une vérif demandée.** Le run de preuve des doublons a été contourné deux fois avant d'être fait — c'est précisément celui qui ne se déduisait d'aucun vert.

---

## Points à mentionner dans le rapport TFE

- AT-02 comme étude de cas « garantie par le système vs vigilance » : `@@index` (accélère) ≠ contrainte (interdit) ; trigger incontournable tout chemin ; migration rétroactive sur donnée de santé qui **échoue avec rapport** au lieu de supprimer.
- La correction d'axe (`unaccent` sur-bloque) comme illustration du « faux négatif de santé interdit » appliqué à l'**écriture** (rejeter une allergie légitime), pas seulement à la détection.
- Le découplage détection/contrainte comme second exemple (après l'ownership) de décision de conception **documentée mais non testée** — matière à jury sur « pourquoi ne pas tout tester ».
- La preuve exécutable de la détection de doublons (`preuve_garde_doublons.sql`) comme pièce d'analyse de sécurité (gouvernance donnée de santé).

---

## Exigences EPHEC couvertes / progressées

- **Tests d'intégration** : **151 verts**, discipline TDD tracée (3 rouges de collapse + né-vert discriminant tagué, red/green/docs séparés au `git log`).
- **Analyse de sécurité / RGPD** : gouvernance donnée de santé renforcée (suppression jamais silencieuse, prouvée) ; garantie système (trigger tout chemin) vs vigilance ; minimisation inchangée.
- **Documentation** : registre AT-02 clos et **cohérent** (contradiction interne d'axe refermée) ; commentaire de garde au code ; pièce de preuve conservée.
- **Versioning** : chaîne rouge/né-vert/green/docs honnête, citable au jury.

---

## État des fonctionnalités / routes

- `POST /api/residents/:id/allergies` — **reclôturé** : `201/400/404/409` ✅ (`P2002 → 409` sur doublon de forme normalisée).
- Contrainte d'unicité `Allergie` (AT-02) — **implémentée** ✅ (`normalise_libelle` + colonne + `@@unique` + trigger `BEFORE INSERT OR UPDATE`).
- Détection de doublons préexistants (migration) — **prouvée** ✅ (arrêt + rapport nommant le doublon).
- `POST /api/commandes` — détection allergènes ✅ (inchangée depuis S14).
- **US-14 — clôturée** ✅ (critères propres + correctif ligature S14).
- **AT-02 — clôturé** ✅ (statut *Implémenté le 11/08/2026* au registre).

---

## Blocages rencontrés et résolution

- **Prémisse « C clos et petit » non sourçable** : levée par lecture du backlog (champ libre 3 catégories) → renoncement à fermer l'input.
- **Risque de correspondance JS/SQL introuvable** : l'échec exigeait une rencontre que le design ne produit pas (confirmé au code) → jambe 4 supprimée.
- **Test-verrou du découplage impossible** : l'état incohérent est interdit par un trigger correct → décision documentée, pas testée.
- **Contradiction d'axe dans le registre** : « correspond à la détection » démoli par le découplage → réécrit sur l'axe sur-blocage.
- **Détection de doublons non exerçable naïvement** (la contrainte vivante rejette le 2e insert avant la migration) → mise en scène d'un état **pré-contrainte** en schéma jetable.

---

## Ce qui reste à faire

1. **Choisir et cadrer la prochaine US** (Phase 3) : US-09 (annulations, règle 2 jours + facturation, Socket.IO `commande_annulee`), US-20 (Socket.IO, différé 2×), US-11 (remarque), US-10 (couples/invités, frontend). US-43/44 (petit-déj/souper) : backend déjà compatible, frontend.
2. **Point ouvert de défense — colonne générée vs trigger** : `normalise_libelle` étant devenue **IMMUTABLE** (retrait d'`unaccent`), la raison qui écartait une colonne générée (`GENERATED ALWAYS AS … STORED`, qui exige IMMUTABLE) **est tombée**. Le registre ne pèse pas la colonne générée dans ses 5 options, et le trigger n'est plus justifié *contre elle* sur un fondement à jour. À vérifier (PG18 accepte-t-il une fonction UDF immuable dans une colonne générée ?) et à trancher/justifier avant le jury — question quasi certaine.
3. **Corrections backlog** (héritées S14, si non faites) : l.351 (renvoi AT-01), l.554 (IT-02 → `commandes.test.js`, recomptage, US-22 périmée `tfe_test`/vitest), mapping IT-02 → describe ; note liminaire « backlog vivant mixte ».
4. **Dettes ouvertes** : helper de forge de token (`allergies.test.js`), middleware d'erreur global (observabilité 500), casse du scope Git US-01→US-04, update Prisma 7.8→7.9.
5. **Hérité (avant remise 17/08)** : figures rapport (EA/relationnel/UML) alignées sur le schéma ; justification modèle `id_appartement`/`numero` ; dockerisation applicative ; Kanban rapporteure ; §11 analyse critique ; déclaration IA générative.

---

## Structure du dépôt

```
TFE - AOUT 2026/
├── .git/
├── .gitignore
├── README.md
├── arbitrages_techniques.md            (AT-01 ; AT-02 ← STATUT : IMPLÉMENTÉ 11/08)
├── preuve_garde_doublons.sql           ← NOUVEAU (preuve détection doublons AT-02)
└── backend/
    ├── compose.yaml
    ├── package.json / package-lock.json
    ├── prisma.config.ts
    ├── vitest.config.js / vitest.setup.js
    ├── prisma/
    │   ├── schema.prisma                (← MODIFIÉ : Allergie.libelle_normalise + @@unique)
    │   ├── seed.ts / seedData.ts
    │   └── migrations/
    │       ├── <timestamp>_init/
    │       ├── 20260807135226_doublon_resident_actif/
    │       └── <timestamp>_unicite_allergie_normalisee/   ← NOUVEAU (fonction + colonne + contrainte + trigger ; nom exact du dossier à confirmer au dépôt)
    └── src/
        ├── app.js / index.js
        ├── lib/prisma.js
        ├── middlewares/ (auth.js + __tests__)
        └── routes/
            ├── auth.js / users.js / appartements.js / residents.js
            ├── allergies.js             (← MODIFIÉ : catch P2002 → 409)
            ├── menus.js
            ├── commandes.js             (← MODIFIÉ : commentaire de garde anti-rebranchement détection)
            └── __tests__/
                ├── allergies.test.js    (← MODIFIÉ : describe 409 AT-02, 3 rouges collapse + né-vert æ, fixture jetable 9101)
                └── (auth/users/appartements/residents/menus/commandes).test.js
```

Frontend non démarré (Phase 4).

---

## Instructions pour reprendre (Session 16)

- **Contexte** : AT-02 **clos et prouvé**, US-14 **close**, US-13 **reclôturée** (409). **151 tests verts.** Phase 3 se poursuit.
- **Reprise** : choisir la prochaine US (US-09 / US-20 / US-11 / US-10) et la cadrer **avant tout code** (RBAC, forme de réponse, taxonomie d'erreurs, stratégie de requête). US-09 est le prérequis fonctionnel des annulations (règle 2 jours, facturation, Socket.IO) ; US-20 (Socket.IO) est différé deux fois et débloquerait l'effet temps réel de plusieurs US.
- **À trancher tôt** : le point ouvert **colonne générée vs trigger** (voir « Ce qui reste à faire » #2) — le régler quand tu ouvres un moment calme, pas en urgence de jury.
- **Rappels de discipline** : lancer la suite avant tout `green` ; `grep`/`\d`/`git show` avant d'écrire un fait ; répondre au cadrage avant de coder ; consigner toute validation Diego datée ; **clôture ≠ suite verte** (identifier les chemins non exercés et lesquels ont un appelant réel) ; `parseISO(date + "T00:00:00Z")` pour toute date.
- **Relance** : `dotenv -e .env.test -- bash -c 'npx prisma migrate reset --force && npx prisma db seed && vitest run'` → attendu **151 passed**.
- **Vérif rapide** : `git log --oneline` doit montrer la chaîne AT-02 (`2638a0e` red → `cf3ced3` né-vert æ → `261f729` green → `402baba` docs garde) ; `\d "Allergie"` doit montrer le trigger `BEFORE INSERT OR UPDATE` et la contrainte unique sur `(id_resident, libelle_normalise)`.

---

*Rapport mis à jour le 11 août 2026 — Session 15*
