# Session 11 — Ouverture de la Phase 2 finale : US-13 (CRUD allergies), données de santé sensibles, RGPD art. 9 et art. 17

**Session :** 11
**Date :** 3 août 2026
**Auteur :** Hippolyte AMORY
**Défense :** 17 août 2026
**Palier :** 1 (socratique) — code écrit par Hippolyte, Claude en cadrage + revue (Paliers 2)

---

## Contexte et état de départ

Fin de S10 : EPIC 02 clôturé (US-04/05/06), **68 tests verts**, trois dettes légères ouvertes (point de défense « verrou sans count », §5 fantôme du backlog, oral fixture 9002).

Confusion initiale à recadrer d'emblée : « la Phase 2 est terminée, on passe à la Phase 3 ». Vérification sur pièce (`plan_daction.md`) — **faux** : la Phase 2 contient encore **US-13 (CRUD allergies)**, non livrée. Confusion entre *EPIC 02 clôturé* (US-04/05/06) et *Phase 2 du plan d'action* (qui inclut US-13). US-13 n'est pas optionnelle : première US sur des **données de santé sensibles** (RGPD art. 9), pilier de tout l'argumentaire sur l'abandon de `LogAccesAllergie`.

Objectif de session : solder les 3 dettes S10, puis cadrer et livrer US-13 en TDD (Palier 1). **86 tests verts** en fin de session , POST + GET complets, DELETE à 3 branches sur 4 (ownership tranchée hors-implémentation).

---

## Ce qui a été travaillé

### 11.1 — Solde de la dette S10 n°1 : point de défense « verrou sans count » (et correction d'un fait erroné dans le record)

La dette n'était pas seulement « à écrire » : le point de défense **documenté en S10 était faux**, et l'écrire a exigé de le corriger d'abord.

Cadrage par questions (objection → scénario → phrase-clé). Hippolyte a d'abord reconstruit le scénario S10 (« T2 = POST voit la place libérée par le soft-delete de T1 et crée un 3ᵉ actif »). **Vérification `psql` sous READ COMMITTED** (deux sessions parallèles) : pendant qu'un soft-delete non committé est en vol, une session neuve lit **count = 2**, pas 1 — la place libérée en vol est **invisible**. Le scénario POST ne casse donc rien : le POST voit 2 et rejette proprement en 409, sans qu'US-06 ait pris le moindre verrou.

**Le vrai partenaire concurrent** (trouvé par Hippolyte en falsifiant sa propre hypothèse) : **un autre US-06** sur le même appartement. Appart à 2 actifs (A, B), deux changements ciblant A comme sortant ; sous RC les deux gardes « A actif ? » lisent A committé/actif, les deux passent ; T1 retire A + ajoute C ; l'`UPDATE` de A par T2 devient un **no-op idempotent** (A déjà inactif — conséquence directe du soft-delete idempotent d'US-05) ; T2 ajoute D quand même → **3 actifs**. Le `FOR UPDATE` sur la ligne appartement en tête sérialise T2 derrière T1 : T2 relit A inactif, sa garde tombe en 409, aucun ajout.

**Point le plus fin (formulation Hippolyte)** : ce n'est pas la *nature* des deux verrous (ligne résident vs ligne appartement) qui diffère, c'est leur **position dans la séquence**. Un verrou sur la ligne résident A ne mord que quand T2 atteint sa propre désactivation de A — **après** que sa garde « A actif ? » est déjà passée sur donnée périmée : trop tard. Le verrou sur la ligne appartement mord **en tête**, avant la garde : T2 attend, relit, refuse. *« Trop tard contre juste à temps. »*

Phrase-clé retenue : *« Le verrou d'US-06 ne protège pas un count — je n'en ai pas — il rend fiable ma garde "le sortant est-il encore actif ?" face à toute autre porte touchant le même appartement. TOCTOU sur la garde, pas sur un décompte. »*

Munitions orales adossées : (a) le no-op idempotent vient de la décision d'US-05 (soft-delete rejouable) → bouclage US-05 ↔ US-06 ; (b) sous SERIALIZABLE, Postgres détecterait l'anomalie via **SSI** et lèverait une erreur de sérialisation (**40001**) à rejouer côté client — d'où le choix du verrou explicite (« faire attendre plutôt qu'échouer et réessayer », cohérent S9).

**Correction de fait portée dans trois fichiers** : `session_10.md` §10.4 (bloc « correction tracée volontairement »), `rapport_avancement_synthese.md` (dette + décision technique). L'ancienne justification « sérialisation contre le POST » remplacée par le vrai partenaire (autre US-06), avec la raison RC de l'écart.

### 11.2 — Solde de la dette S10 n°2 : §5 fantôme d'US-06 dans le backlog

Épisode de discipline « vérifier sur pièce » — le plus instructif de la session, par les erreurs traversées.

La dette telle que décrite dans la synthèse (« `residents.js` / `$transaction([...])` / Livré session 4 ») était elle-même **partiellement fausse**. Série d'affirmations de mémoire (des deux côtés) sur des numéros de ligne et des contenus, invalidées une à une par `grep`/`awk`/`sed` sur `backlog_user_stories.md` :
- « Livré session 4 » : **zéro occurrence** dans tout le backlog (grep vide).
- `appartements.js` (route correcte) : **zéro occurrence** — la bonne route n'est écrite nulle part.
- Le batch `$transaction([...])` : **une seule** occurrence, **ligne 161**, sous le header **US-06** (ligne 140, confirmé par `grep "^## US-0[56]"`).

**Défaut réel unique** : ligne 161 annonce un `$transaction([...])` **batch**, alors que le code livré est **interactif** (§10.3). Correction portée par Hippolyte : `$transaction` interactive `(async (tx) => …)`, justifiée par la décision dépendant d'un résultat intermédiaire (garde d'état lue après le verrou), vérifiée sur pièce après édition.

**Leçon opérationnelle nommée** : une fausse affirmation *habillée en vérification* (« ligne 186, mot pour mot : … ») est plus dangereuse qu'une incertitude assumée, parce qu'elle désarme la re-vérification. Réflexe pour le jury : avant de dire « le fichier dit exactement X à la ligne N », lancer la commande.

### 11.3 — Solde de la dette S10 n°3 : oral fixture 9002 (« échouer pour la bonne raison »)

Cadrage de l'argument de conception de test. La fixture 9002 monte **deux vrais résidents actifs** pour un test de validation stricte (`prenom: 123`). Objection anticipée : pourquoi de vrais sortants pour un test qui vérifie juste le rejet d'un prénom invalide ?

Point tranché sur pièce (lecture de la route) : **aujourd'hui la garde 400 rejette le prénom à la porte**, avant le `create`. Les vrais sortants ne servent donc **pas** au vert du jour. Ils servent au **monde régressé** : si la garde 400 disparaît, le prénom n'est plus vérifié qu'au `create` ; avec un sortant *bidon* la requête meurt au 404 avant d'atteindre le `create` (régression masquée) ; avec deux vrais sortants actifs elle traverse 404/409, atteint le `create`, et échoue **là, sur le prénom** — le bon motif. Objection avancée à connaître : « défense en profondeur » (le test ne fait pas confiance à une seule ligne de garde). Formulation retenue : *« un test se juge sur ce qu'il attrape quand le code casse, pas sur son vert du jour. »*

### 11.4 — Cadrage US-13 : RBAC, ownership, minimisation (avant tout code)

Source de vérité relue (`backlog` US-13, `schema.prisma` modèle `Allergie`). Trois endpoints : `POST` / `GET` / `DELETE /api/residents/:id/allergies`.

**Matrice RBAC tranchée** (montée au niveau routeur : `authenticateToken` + `requireRole(['secretaire','admin'])` globaux) :
- `POST` : secrétaire/admin + `created_by` (traçabilité).
- `GET` : secrétaire/admin. **Cuisine resserrée** (retirée), **serveur exclu**. Décision d'audit : la matrice §9.3.2 accordait le GET à la cuisine, mais son besoin réel est **contextuel** (détection à la saisie + badges vue du jour, US-14 / UC-07) — pas un lookup par résident. La resserrer = cohérence avec la minimisation (art. 5§1c). Posture *audit finding*, pas changement d'avis.
- `DELETE` : secrétaire/admin + contrôle d'ownership (voir 11.7).

**Base légale de l'asymétrie serveur** (art. 9§2c intérêt vital en contexte livraison + art. 5§1c minimisation) : restée **orale** depuis S7, **décidée écrite** dans §9.4.3 tant qu'on y touche (sinon le rapport annonce des rôles que le code n'ouvre pas).

**Minimisation `created_by`** : trace interne d'accountability (qui a saisi), **jamais exposée** en lecture — révélerait un détail RH. Verrouillée par un test (voir 11.6), pas par la vigilance.

### 11.5 — Chaîne des gardes des trois endpoints

Réutilisation de l'ordre sécurité-first établi (`401 → 403 → 400 → 404 → …`), avec le 401/403 **né-verts** (montage global du routeur), comme US-04/06.

- **POST** : `401 → 403(rôle) → 400(forme) → 404(résident) → 201`.
- **GET** : `401 → 403(rôle) → 404(résident) → 200`, réponse **enveloppée** `{ id_resident, allergies: [...] }` (alignée sur la route **structurellement sœur** `GET /appartements/:numero/residents` qui enveloppe `{ numero, occupants }`, pas sur la liste racine `/residents` qui renvoie un tableau nu — critère : cohérence avec la sous-collection nichée).
- **DELETE** : `401 → 403(rôle) → 400(forme des DEUX ids) → 404(existence + appartenance) → 204`.

**Point de conception DELETE (ownership)** : le contrôle d'ownership est une **autorisation par ressource**, pas par rôle — il ne peut vivre dans `requireRole` (qui n'a que le token), il exige de **lire l'allergie** d'abord. Ordre forcé par les données : 404 (l'allergie existe) **avant** 403 ownership (`created_by` n'existe que si la ligne existe). Une **seule lecture DB** (`findUnique`) sert existence + appartenance (+ ownership si activé).

### 11.6 — Livraison POST (7 comportements) en TDD

Décor : `feat` de montage du routeur protégé (né-vert 401), puis cycles red/green **séparés et vérifiés dans `git log`** :
1. **201 cas passant** — body renvoyé + relecture base `created_by === idSecretaire` (prouve que `req.user.userId` traverse jusqu'à la colonne). Stub `sendStatus(501)` d'abord pour un rouge propre (501≠201 = logique absente, pas 404-route).
2. **400 libelle** — durci `typeof libelle !== "string" || libelle.trim() === ""` (doctrine US-06, `typeof` avant `.trim()`), deux branches couvertes (`123` → typeof, `"   "` → trim).
3. **403 rôle** (cuisine refusée) — body valide pour isoler le motif.
4. **404 résident** absent.
5. **400 enum** — `type ∉ Object.values(TypeAllergie)`. **Source unique** : enum importé de `@prisma/client`, pas de liste en dur → la garde suit le schéma.
6. **400 type absent** vs invalide — décision : « absent » traité comme champ manquant (message groupé « Champs obligatoires manquants »), « présent mais hors enum » comme « Type d'allergie invalide ».
7. **notes** (champ `String?` listé au backlog, initialement ignoré) — cycle ajouté : POST persiste `notes` si fourni (assertion **en base**) ; garde conditionnelle `notes !== undefined && typeof notes !== "string"` → 400 (valide seulement si présent, ne recale pas l'absence légitime).

**Garde de forme asymétrique assumée et commentée** : `libelle` durci fort (seule garde) ; `type` en simple présence ici (l'enum en aval fait le filtrage strict) ; `notes` durci seulement si fourni. Le niveau de chaque champ **dérive de sa défense en aval**, pas d'une humeur — argument défendable contre « pourquoi trois traitements différents ? ».

`created_by` écrit via `utilisateur: { connect: { id_utilisateur } }` (relation pilotée, pas scalaire en écriture ; scalaire lisible en lecture — asymétrie lecture/écriture nommée).

### 11.7 — Livraison GET (3 comportements) en TDD

1. **200 cas passant** — réponse enveloppée `{ id_resident, allergies }` ; **minimisation vérifiée** : `res.body.allergies.forEach(a => not.toHaveProperty("created_by"))` sur **toute** la collection (pas un échantillon). Le `select` explicite `{ id_allergie, libelle, type, notes, created_at }` est la ligne où la minimisation cesse d'être une intention.
2. **404 résident** absent (vrai cycle red/green).
3. **Liste vide** — résident existant sans allergie → `[]` en 200, pas 404 (décision métier : collection vide ≠ ressource absente). Committé **né-vert** (la garde 404 du cycle précédent couvre déjà ce cas) — né-vert **nommé** dans le message de commit, pas maquillé en cycle.

Note défendable : les fixtures GET utilisent `createMany` avec `created_by` **scalaire** — légitime car `createMany` bypasse la couche relationnelle (pas de `connect`), à distinguer du `create` de prod qui passe par la relation. La fixture pose un état ; le POST respecte le contrat de l'API.

### 11.8 — Livraison DELETE (3 branches sur 4) en TDD

Décision de conception **hard delete** (art. 17 RGPD) : la donnée de santé s'efface réellement (`prisma.allergie.delete`), **asymétrie assumée** avec le soft-delete du résident (US-05). Formulation : *« le métier veut la mémoire du résident, le RGPD veut l'oubli de la donnée de santé. »* Tension traçabilité/effacement à connaître (le hard delete efface aussi le `created_by` de la ligne — accountability vit *pendant* la vie de la donnée, pas après l'effacement légal).

Cycles red/green :
1. **204 cas passant** — suppression prouvée par relecture base (`findUnique` → `null`), pas le seul code de statut.
2. **400 forme des DEUX ids** — `Number.isInteger` sur `:id` résident **et** `:id_allergie`, **deux gardes séquentielles** (messages distincts « Identifiant de résident invalide » / « Identifiant d'allergie invalide », style US-06/US-03). Deux `it` (un par id) — sinon une branche naît non couverte. Cohérence doctrine « id malformé = 400 partout, jamais 404 » vérifiée sur pièce (`grep` US-06/US-03).
3. **404 existence + appartenance** — deux sous-branches : allergie absente (`findUnique` → null) et allergie d'un **autre** résident (`allergie.id_resident !== idResident`). **Même message** « Allergie introuvable » pour les deux (non-divulgation anti-énumération, cohérent 404-vs-403). Le red « mauvais résident » rougissait sur **204** (le code supprimait une allergie n'appartenant pas au résident de l'URL) — preuve exécutable d'une faille d'autorisation par ressource, fermée par la garde d'appartenance. Bascule structurelle : `delete` direct → `findUnique(select id_resident)` → gardes → `delete` ; `idResident` cesse d'être mort.

---

## Concepts compris / à consolider

**Acquis (démontrés cette session) :**
- **Vérification sur pièce comme réflexe** : nette progression sur la seconde moitié de S10, confirmée et amplifiée en S11. Chaque affirmation factuelle (format d'erreur, enum importable, structure de relation, apparts libres, doctrine id malformé) vérifiée par `grep`/lecture avant d'être figée. Contraste net avec les épisodes de récitation de mémoire du début de session (§5 backlog), que le terminal a systématiquement corrigés.
- **« Échouer pour la bonne raison »** appliqué de façon répétée et autonome : premier red qui rougit sur « handler absent » (POST/GET/DELETE), body valide pour isoler le motif, red 204 fantôme qui prouve la faille d'appartenance.
- **Né-vert vs cycle** : distinction tenue et **nommée dans les commits** (liste vide GET).
- **Minimisation vérifiée par test**, pas espérée (`not.toHaveProperty` sur toute la collection).
- **Falsification de sa propre hypothèse** : verrou-POST (11.1), garde libelle `!libelle` régressive (revue), forme tableau nu (raccord faux corrigé). Hippolyte inverse sa position dès qu'un fait la contredit — mouvement clé pour la défense.

**À consolider :**
- Tendance résiduelle à annoncer « c'est fait / c'est dans les fichiers » sans relancer les tests après un refactor, ou à réciter des numéros de ligne avec assurance. Corrigée à chaque fois par la demande de sortie brute, mais le réflexe « lancer avant d'affirmer » doit devenir systématique **sans** sollicitation.
- Ordre d'écriture des cycles ≠ ordre d'exécution des gardes : su, mais à pouvoir expliquer au jury (l'un suit la pensée, l'autre la sécurité).

---

## Points à mentionner dans le rapport TFE

- **Hard delete allergie (art. 17) vs soft delete résident** : asymétrie dérivant de la nature de la donnée (santé sensible → oubli ; occupation → mémoire métier). Deux politiques de suppression justifiées, pas une incohérence.
- **Minimisation `created_by` exécutable** : absence vérifiée par test sur toute la collection GET (propriété système, pas vigilance).
- **Ownership DELETE comme décision documentée non implémentée** (voir « ce qui reste »).
- **Base légale asymétrie serveur** (art. 9§2c + art. 5§1c) à écrire dans §9.4.3.
- **Garde de forme asymétrique** (libelle/type/notes) : le niveau de validation de chaque champ dérive de sa défense en aval.
- **Deux couches de suppression / traçabilité** : `created_by` sert pendant la vie de la donnée ; le hard delete l'efface avec la ligne (accountability de l'acte de suppression = perspective d'amélioration, hors périmètre actuel, cohérent avec la posture réseau fermé de `LogAccesAllergie`).

---

## Exigences EPHEC couvertes (progression)

- ✅ **Tests d'intégration** : 68 → **86 verts** . Discipline TDD maintenue (red/green séparés, né-vert nommé, durcissement né d'un rouge).
- ✅ **Analyse de sécurité / RGPD** : art. 9 (donnée de santé) opérationnalisé (RBAC contextuel, minimisation testée), art. 17 (hard delete), non-divulgation (messages 404 identiques, motif ownership en log serveur si activé).
- ✅ **Versioning Git** : narration TDD étendue à US-13 (feat de montage → cycles POST ×7 → GET ×3 → DELETE ×3), né-vert explicitement taggé.
- ✅ **Documentation du code** : commentaires justificatifs (asymétrie des gardes, `connect` relationnel, minimisation).

---

## État des fonctionnalités / routes

- ✅ `POST /api/auth/login` (US-01)
- ✅ `GET /api/users` (US-02)
- ✅ `authenticateToken` + `requireRole` (US-03)
- ✅ `GET /api/appartements` + `GET /api/appartements/:numero/residents` (US-04)
- ✅ `POST` / `PATCH` / `DELETE /api/residents` + `GET ?tous=1` (US-05)
- ✅ `POST /api/appartements/:numero/changement` (US-06)
- ✅ **`POST /api/residents/:id/allergies` (US-13)** ← NOUVEAU — 7 comportements
- ✅ **`GET /api/residents/:id/allergies` (US-13)** ← NOUVEAU — enveloppé, minimisé
- 🟡 **`DELETE /api/residents/:id/allergies/:id_allergie` (US-13)** ← NOUVEAU — 3 branches (forme, existence, appartenance) ; ownership tranchée hors-implémentation

---

## Blocages rencontrés et résolution

- **Aucun blocage technique de code.** US-13 livrée sans obstacle d'implémentation.
- **Récitation de mémoire vs vérification (§5 backlog)** : plusieurs affirmations de numéros de ligne / contenus, des deux côtés, invalidées par le terminal. Résolu en exigeant systématiquement la **sortie brute** de `grep`/`awk`/`sed`. C'est le grep qui a tranché, pas l'accord entre les interlocuteurs — leçon centrale de la session pour la défense.
- **Impasse de testabilité de l'ownership** : identifiée avant de coder (voir ci-dessous), évité un cycle bancal en fin de session.

---

## Ce qui reste à faire

### US-13 — finalisation
1. **Ownership DELETE — décision tranchée, à documenter (pas à coder).** Sous le RBAC actuel (`requireRole(['secretaire','admin'])` global + bypass ownership pour secrétaire/admin), la branche de refus 403 ownership est **inatteignable par toute requête réelle** : tout ce qui franchit `requireRole` bypasse l'ownership. Elle est donc **non testable** par un red honnête (injecter un rôle non-bypass → filtré en amont par `requireRole` → on teste le 403 rôle, pas l'ownership). Conséquence de la règle « propriété **vérifiable** par le système » : une branche non exerçable par un test n'est pas du défensif testé mais du code mort déguisé → **ne pas la coder** tant qu'aucun test réel ne l'exige. À écrire en TDD (vrai red) **le jour où le POST s'ouvre à d'autres rôles**. **Distinction à tenir au jury** : « pas de bypass admin » concerne le RBAC de **rôle/route** ; le bypass ownership est une couche d'autorisation **par ressource**, distincte — pas une contradiction.
   → **Documenter** dans §9.3.2 (matrice) et §9.4.3 : suppression ouverte à secrétaire/admin ; contrôle d'ownership par ressource prévu si la création s'ouvre. **Pas** de `// TODO` fantôme dans le code.

### Dettes documentaires rapport — ✅ soldées (hors session par Hippolyte)
2. ✅ **§9.3.2** : cuisine retirée de la ligne `GET allergies` (posture audit finding).
3. ✅ **§9.4.3** : réécrit — base légale asymétrie serveur (art. 9§2c + art. 5§1c) + resserrement cuisine + serveur en contexte appartement uniquement ; cohérence propagée avec la matrice.
4. ✅ **Chaîne de cohérence** : points du rapport citant l'accès GET allergies vérifiés, aucun désynchronisé.
5. **Dette de code notée (ouverte)** : factoriser les `beforeAll` d'`allergies.test.js` (forge de token dupliquée ×N → helper `getSeededUser`/`forgeToken`).

### Phase 2 / suite du plan d'action
6. US-13 close (au sens implémentation actuelle) → poursuivre selon `plan_daction.md` : **Phase 3 — cœur métier commandes** (US-07 menu du jour, US-08, US-14 détection allergies à la saisie, US-09, US-20, US-11, US-10).

### Hérité (avant remise du 17 août)
- Aligner les figures du rapport (EA + relationnel + UML classes) sur le schéma verrouillé (S1).
- ✅ Mentions « livré session 4 » de l'ancien projet : **soldées** (vérifié — plus aucune occurrence dans le backlog).
- **Formaliser la justification du modèle à deux champs** `id_appartement` / `numero` — question de jury quasi certaine.
- Casse du scope Git US-01→US-04 (héritage S8).

---

## Structure du dépôt

```
backend/src/routes/
├── auth.js
├── users.js
├── appartements.js
├── residents.js
├── allergies.js                 ← NOUVEAU (routeur imbriqué mergeParams ; POST + GET + DELETE)
└── __tests__/
    ├── auth.test.js
    ├── users.test.js
    ├── appartements.test.js
    ├── residents.test.js
    └── allergies.test.js         ← NOUVEAU (describes POST ×N, GET ×3, DELETE ×3)
```

Montage du routeur `allergies` sous `/api/residents/:id/allergies` (mergeParams) à vérifier dans `app.js` / le routeur `residents`. Reste inchangé par ailleurs.

---

## Instructions pour reprendre (Session 12)

**Contexte :** US-13 (CRUD allergies) livrée — POST (7 comportements) + GET (3) + DELETE (3 branches : forme, existence, appartenance). **86 tests verts** . Ownership DELETE **tranchée hors-implémentation** (inatteignable/non testable sous RBAC actuel) — à documenter dans le rapport, pas à coder. Phase 2 close.

**Rappels de posture :** Palier 1 (socratique) ; sécurité-first (401→403→400→404→…) ; red committé séparément du green ; né-vert nommé ; fixtures locales jetables sur apparts hors plage seed (8–16 utilisés en S11 — vérifier la prochaine plage libre par `grep "900\|id_appartement: 1[0-9]"`) ; minimisation **prouvée** par `not.toHaveProperty` / `toEqual` ; hard delete pour la donnée de santé (art. 17), soft delete pour l'entité métier.

**Avant de coder la Phase 3 :** solder les dettes doc rapport (§9.3.2, §9.4.3, chaîne de cohérence) et documenter la décision ownership. Puis cadrer US-07 (menu du jour) selon `plan_daction.md`.

**Relance :**
```bash
cd backend
docker compose up -d
npm test              # 86 tests verts attendus 
npm run dev           # serveur sur :3000
```

Pipeline complet :
```bash
dotenv -e .env.test -- bash -c 'npx prisma migrate reset --force && vitest run'
```

**Vérification rapide avant de reprendre :** `git status` propre ; `git log --oneline` montre la narration US-13 (feat montage → POST ×7 → GET ×3 → DELETE ×3, né-vert liste vide taggé) ; `docker compose ps` sain.

---

*Rapport mis à jour le 3 août 2026 — Session 11*
