# Session 14 — US-14 (détection d'allergènes non bloquante) + arbitrages AT-01 / AT-02

**Auteur :** Hippolyte AMORY
**TFE :** Le Cénacle — application web interne de gestion des commandes du restaurant
**Défense :** 17 août 2026
**Date de session :** 9 août 2026

---

## Contexte et état de départ

Fin de S13 : **US-08 close côté code (139 tests verts)**, Phase 3 ouverte. Objectif S14 : **US-14 — détection d'allergie non bloquante à la saisie** (`allergies_detectees` dans la réponse du `POST /api/commandes`), prérequis US-08 et US-13 (CRUD allergies) tous deux satisfaits.

État final : **147 tests verts**, détection US-14 **fonctionnellement complète et alignée sur la décision métier**, mais **US-14 non clôturable** car elle dépend d'un invariant (unicité d'allergie) dont l'implémentation — arbitrage **AT-02** — reste à faire. Deux arbitrages techniques produits, rédigés et **validés par Diego** dans la même journée : **AT-01** (cible de détection) et **AT-02** (unicité d'allergie sur forme normalisée).

Fil rouge de la session : la détection sur donnée de santé se défend par **l'honnêteté sur les limites de l'algorithme** (« l'algo assiste, il ne certifie pas ») et par la **traçabilité écrite des divergences** vis-à-vis du backlog, jamais par un accord oral.

---

## Ce qui a été travaillé

### 14.1 — Cadrage d'US-14 avant tout code
Axes tranchés et justifiés avant la première ligne : la détection **enrichit** le 201 (non bloquante, choix Diego l.359), elle ne peut pas être une garde 4xx ; le champ `allergies_detectees` est **toujours présent** (`[]` si rien), cohérent avec la décision anti-spéculative de S13 ; la réponse porte `{ libelle, type, option_concernee }`, `option_concernee = option.libelle` (minimisation).

### 14.2 — Cycle TDD de la détection (7 comportements)
Chaque garde née de son propre cycle, vérifiable au `git log` (Rouge authentique ou né-vert discriminant taggé) :
- **Détection peuplée** (Rouge) : allergène déclaré → 201 + entrée.
- **Portée** (né-vert discriminant) : allergène au menu mais **non commandé** → `[]`. Falsifie une implémentation qui parcourrait le menu du jour au lieu des lignes de la commande. Fixture construite pour discriminer (allergène réel du résident, présent au menu, absent des lignes).
- **Null** : `contient_allergenes` nullable géré sans court-circuiter le canal nom.
- **Casse + accents des deux côtés** (Rouge « Céleri »/« celeri » + né-vert symétrique) : normalisation NFD appliquée aux **deux** opérandes.
- **Négatif de matching** (né-vert discriminant) : champ rempli mais **étranger** à l'allergie du résident → `[]`. Falsifie une implémentation « champ rempli → alerte » sans comparaison.

### 14.3 — Normalisation : fonction pure extraite
`normalise = NFD → suppression diacritiques → lowercase`, extraite en module scope (fonction pure, non recréée par requête, locale au fichier). Refacto en commit séparé, comportement figé (compte inchangé avant/après).

### 14.4 — Canal de détection double (issu d'AT-01)
Découverte décisive : le champ dédié `contient_allergenes` **n'est saisissable par aucune route** (`menus.js` ne le référence pas) → détection **inerte en production** si on ne matche que lui. Pivot : matcher **le nom du plat (`libelle`) OU les allergènes déclarés** — un seul `||`, un push par allergie. Détection réelle dès aujourd'hui (tout plat a un nom), le champ dédié enrichira quand sa saisie existera. Rouge canal nom (`libelle` seul, `contient_allergenes` null) → green.

### 14.5 — Décision ligature (Diego) et correction de `normalise`
Diego a tranché : « œufs » et « oeuf » = **un seul allergène** (œuf, allergène majeur). Fait mesuré : NFD **ne décompose pas** la ligature « œ » (caractère Unicode, pas lettre accentuée). Correction : ajout de `.replace(/œ/g, "oe")` **après** le lowercase (une seule forme à cibler, trigger SQL trivial à aligner). Rouge (allergie « oeuf » / plat « Œufs ») → green → né-vert sens inverse. Validé en isolation (node) sur 5 formes avant branchement.

---

## Décisions prises et justification (pour le rapport TFE)

- **Faux positif accepté, faux négatif proscrit** : en non bloquant, un toast en trop coûte un clic, un allergène manqué coûte bien plus. Le matching sous-chaîne assume « ail ⊂ volaille ».
- **« L'algo assiste, il ne certifie pas »** : la garantie n'est pas l'algorithme (couplé au vocabulaire cuisine : singulier/pluriel, « gluten » vs « blé »), c'est le **dispositif non bloquant** qui laisse l'humain décider. Version basse assumée, après avoir walké back un « faux négatif interdit » qui sur-vendait.
- **Déduplication** : clé `(option_concernee, libelle allergie)` sur libellés (cohérent avec l'exposition de `option.libelle`, jamais l'id). Le doublon **inter-canaux** est éliminé à la source par le `||` (un push). Le doublon **inter-allergies homonymes** est renvoyé à l'invariant AT-02 (contrainte d'unicité), pas géré en aval → pas de `Set` applicatif.

---

## Arbitrages techniques produits (registre)

### AT-01 — Cible de détection (validé Diego, 09/08/2026)
Matcher `libelle` **ou** `contient_allergenes`. Enrichissement rétrocompatible du backlog (l.351 disait `libelle` seul), pas correction d'erreur. Risques résiduels actés par Diego : trou fonctionnel tant que `contient_allergenes` non saisissable (dépendance = extension du contrat d'US-07, aujourd'hui limité à catégorie + nom) ; faux positifs du nom.

### AT-02 — Unicité d'allergie sur forme normalisée (validé Diego, 09/08/2026)
Un résident ne peut avoir deux fois la même allergie (égalité insensible casse/accents/ligature « oe »). Option retenue après élimination de 4 alternatives sur le **bon axe** (incontournabilité du calcul de la forme normalisée, pas la résistance au concurrent qui vient de la contrainte UNIQUE partout) : **la base calcule elle-même la forme normalisée via un trigger**, avec une règle sous contrôle alignée sur la détection (contrairement à `unaccent` subi, qui diverge sur « œ »). Chantier **rétroactif sur US-13**. Doublons préexistants : migration **échoue avec rapport** plutôt que suppression silencieuse (donnée de santé).

---

## Concepts compris / à consolider

**Acquis :**
- Né-vert **discriminant** vs décoratif : un né-vert ne vaut que s'il rougirait sur une alternative crédible ; sa fixture doit être construite pour discriminer (vérifié : sans allergène réel du résident, le test de portée ne falsifie rien).
- Un né-vert écrit **après** le green ne prouve pas par run mais par construction ; le distinguer d'un Rouge dans la narration.
- Vérification au **bon grain** : fonction pure testée en isolation (node) avant branchement dans la suite complète.
- Arbitrage = **options pesées sur le bon axe** + risques résiduels + gouvernance datée. Un accord oral non consigné ne vaut rien sur donnée de santé.

**À consolider :**
- Réflexe de **répondre aux questions de cadrage avant de coder** (symétrie, ordre d'insertion) plutôt que de partir sur l'implémentation — rappelé deux fois (accents, ligature).
- Distinguer **retard documentaire** (à corriger) et **anticipation assumée** (cible future) dans un backlog vivant mixte.

---

## Exigences EPHEC couvertes / progressées

- **Tests unitaires** : 147 verts, discipline TDD tracée au `git log` (red/green séparés, né-vert taggé).
- **Analyse de sécurité** : modèle de menace explicite sur l'écriture de la table Allergie (qui écrit ? garantie système vs vigilance applicative) → choix AT-02.
- **Documentation / justification** : registre d'arbitrages techniques (AT-01, AT-02) citable au jury.
- **Versioning** : commits conventionnels, scope lowercase, red/green/né-vert/refactor distincts.

---

## État des fonctionnalités / routes

- `POST /api/commandes` — détection allergènes **complète côté détection** ✅ (casse, accents, ligature, nom + allergènes déclarés, non bloquante, portée lignes commandées, négatif de matching, `[]` toujours présent).
- `normalise` (module `commandes.js`) — corrigée ligature ✅.
- Contrainte d'unicité Allergie (AT-02) — **non implémentée** ⬜ (migration à faire).
- US-14 — **non clôturable** tant que l'invariant AT-02 n'est pas garanti en base.

---

## Blocages rencontrés et résolution

- **`contient_allergenes` inerte** : découvert par grep de `menus.js` (aucune route de saisie) → pivot vers double canal (AT-01), transformant une divergence en enrichissement.
- **Doublon d'allergie possible** : découvert en cadrant la dédup (pas d'`@@unique` sur `Allergie`, seulement un index) → remonté en amont (AT-02) plutôt que déduplication aval.
- **Impasse (1)/(2) sur AT-02** : les deux options éliminées par les faits (unaccent diverge sur « œ » ; colonne applicative contournable par les `create` bruts de test) → 4e voie (trigger base) identifiée.
- **NFD ne décompose pas « œ »** : mesuré en isolation, corrigé par `replace` explicite.

---

## Ce qui reste à faire

1. **Migration AT-02** (prochaine action réelle) : colonne `libelle_normalise` nullable → remplissage → détection doublons préexistants (échec+rapport) → NOT NULL → contrainte UNIQUE `(id_resident, libelle_normalise)` → trigger aligné sur `normalise`.
2. **Fait préalable au trigger** : tester le comportement Postgres de `lower(unaccent('Œufs'))` — gère-t-il « œ »→« oe », ou faut-il un `replace` explicite dans le trigger comme en JS ?
3. **Test de correspondance base/détection** : jeu de libellés (œuf inclus) normalisés à l'identique des deux côtés — verrouille le risque résiduel d'AT-02.
4. **Clôture d'US-14** une fois l'invariant AT-02 garanti : la détection est déjà correcte *sous* cet invariant.
5. **Corrections backlog** (si non déjà faites en local) : l.351 (cible → renvoi AT-01), l.554 (migration IT-02 vers `commandes.test.js` + recomptage, US-22 périmée à réaligner : `tfe_test`/vitest, pas `cenacle_test`/Jest), mapping IT-02 → describe.
6. **Note liminaire backlog** à envisager : « backlog vivant mixte, écarts d'implémentation tracés au registre » — désamorce les questions de divergence backlog↔code.

---

## Instructions pour reprendre (Session 15)

- **Contexte** : détection US-14 complète (147 verts), en attente de l'invariant AT-02 pour clôture. AT-01 et AT-02 validés Diego (09/08), consignés au registre.
- **Reprise** : attaquer la migration AT-02. Commencer par le **fait SQL** (`lower(unaccent('Œufs'))` sur `tfe_postgres`) qui détermine l'écriture du trigger.
- **Rappels de discipline** : lancer la suite avant tout `green` ; `grep`/`\d`/`git show` avant d'écrire un fait ; répondre au cadrage (symétrie, ordre) avant de coder ; consigner toute validation Diego datée.
- **Relance** : `dotenv -e .env.test -- bash -c 'npx prisma migrate reset --force && npx prisma db seed && vitest run'` → attendu **147 passed**.
- **Vérif rapide** : `git log --oneline` doit montrer la chaîne US-14 red/green/né-vert (dernier : né-vert ligature sens inverse, 3724d40).

---

*Rapport mis à jour le 9 août 2026 — Session 14*
