# Session 17 — Sprint rapport : audit des ⚠️, rate-limit TDD, sécurisation avant passage public du dépôt

**Auteur :** Hippolyte AMORY
**TFE :** Le Cénacle — application web interne de gestion des commandes du restaurant
**Remise du rapport :** 17 août 2026 · **Fin de développement :** 1er septembre 2026 · **Défense :** 2 septembre 2026
**Date de session :** 13 août 2026

---

## Contexte et état de départ

Fin de S16 : **162 tests verts**, socle US-09 (annulations) livré, EPIC 03 ouvert. Le gel du 12/08 (`gel_decisions_2026-08-12.md`) avait cadré le périmètre définitif (trois cercles, stratégie B), catalogué les corrections du rapport (§ 1.1 à 1.6) et laissé **cinq ⚠️** non vérifiés au § 1.2.

Objectif implicite en début de session : Hippolyte demandait par quoi enchaîner côté **produit** (frontend secrétaire ou déploiement). Recadrage : les deux ont une marge jusqu'au 1er/09, **le rapport a une échéance impérative dans 4 jours et pèse 30 %**. Priorité rebasculée sur le rapport, conformément à la note de reprise de S16 (« Le rapport (Phase A) reste priorité absolue avant le 17/08 »).

**Faits de calendrier fixés cette session** (les en-têtes des sessions précédentes portaient « Défense : 17 août », ce qui était faux) : **17/08 = remise du rapport ; 1er/09 = arrêt du code + erratum ; 2/09 = défense.** L'erratum de la veille de la défense enregistre tout ce qui est livré après le dépôt → stratégie **B** confirmée (le rapport annonce conservateur, l'erratum acte la sur-livraison).

État final : **163 tests verts** (rate-limit login ajouté), les **cinq ⚠️ du § 1.2 fermés**, trois sections du rapport réécrites et réinjectées, dépôt GitHub rendu public après audit de sécurité, cartographie complète du rapport établie.

---

## Ce qui a été travaillé

### 17.1 — Vérification des cinq ⚠️ du gel § 1.2 (méthode : lire le dépôt, ne pas supposer)

Principe appliqué tout du long : **vérifier qu'une lib est déclarée ≠ vérifier qu'elle est branchée.** Une affirmation « corrigée » vers du faux est pire que l'originale, donc on établit le fait avant de toucher à une section.

1. **Express 4 ou 5** → `package.json` : **`^5.2.1`**. Le § 6.7 annonçait 4. Corrigé. Distinction de défense posée : Express 5 est un **défaut sain adopté** (version courante au démarrage juin 2026, gestion async native des promesses rejetées), **pas** un arbitrage réfléchi — à présenter honnêtement comme tel, distinct des vrais arbitrages (Prisma 7.8 + driver adapter, `translate` vs `unaccent`, verrou vs écriture conditionnelle).
2. **Rate-limit `express-rate-limit` 100 req/min** (§ 9.3.4) → **absent** (ni paquet, ni `app.use`). Implémenté cette session (voir 17.2).
3. **Sauvegarde 3-2-1 + GPG + `docs/exploitation/restauration.md`** (§ 9.3.5) → **néant** dans le dépôt. Ramené au **minimum défendable** (voir 17.3).
4. **Journal de bord + Kanban GitHub Projects** (§ 5.4) → journal **absent du dépôt** (sessions locales), Kanban existant mais inexploitable (issues privées). Réglé par versionnement du journal + passage public (voir 17.4).
5. **Pagination romains/arabes** → règle **explicite** du règlement, § 5.1 (voir 17.6).

### 17.2 — Rate-limit login en TDD (US de sécurité, cercle 1) — 162 → 163 verts

Cadrage complet **avant** tout code (le vrai travail est là, pas dans le `app.use`) :

- **Risque visé** : brute-force du PIN. Le login accepte `^\d{4,}$` (PIN à 4 chiffres = 10 000 valeurs) **et** la liste des `id_utilisateur` est **publique** (US-02) → le brute-force ciblé est le risque principal sur l'auth. Fait plus précis que la ligne v1 « 100 req/min ».
- **Clé** : `IP + id_utilisateur` (cible le compte, pas le réseau — plusieurs rôles derrière un même NAT à la résidence). **Résiduel assumé et déclaré** : depuis une IP unique, balayage possible de tous les comptes (liste publique). Fermeture possible = double limiteur (IP lâche + IP+user serré), non engagée.
- **Périmètre de comptage** : **échecs seulement** (`skipSuccessfulRequests`) — cible l'attaque (succession d'échecs), ne punit pas un usage légitime, et allège l'isolation des tests. Arbitrage « à deux bénéfices », même famille que la dérivation serveur de `date_repas` (S13).
- **Fenêtre** : **5 échecs / 15 min**, **politique nommée** dans `config/rateLimit.js` (`LOGIN_MAX_ECHECS`, `LOGIN_FENETRE_MS`), même statut que `SEUIL_ANNULATION_TEMPS_JOURS`. Défendue sur le seul terrain sécurité, **pas** comme contrainte de test (voir isolation ci-dessous).
- **Emplacement** : sur `router.post("/login", loginRateLimit, …)` dans `auth.js`, **pas** sur le montage global — la garde au plus près de ce qu'elle garde (même réflexe que `annulationsRouter` avant `commandesRouter`, S16).

**Difficulté centrale = l'isolation des tests** (le « fuseau horaire » de cette feature). Le store d'`express-rate-limit` vit **en mémoire du process**, pas en base : `migrate reset` ne le touche pas, et sous `fileParallelism: false` il traverse tous les tests et fichiers sans retomber à zéro. Sans reset explicite, les échecs d'un test débordent sur les suivants → un test attendant 401 récolterait 429 de façon non déterministe. Résolu par `resetLoginRateLimit()` (table rase du store entier via `store.resetAll()`, **pas** reset par clé — évite de reconstruire `IP:id` et de deviner l'IP de Supertest) appelé en `beforeEach`. Même famille que le `TZ` en `afterEach` de S16 : état global hors-base réinitialisé à la main.

**Architecture** : séparation **politique** (`config/rateLimit.js` : constantes gelées) / **mécanique** (`middlewares/rateLimit.js` : instance du limiteur, store, fonction de reset — le limiteur et le reset ferment sur la **même** référence `loginStore`, créée au niveau module → une seule instance sous `fileParallelism: false`). Distinction défendable : la valeur change pour d'autres raisons que le limiteur.

**Cycle TDD** (rouge d'abord, isolation embarquée dans le rouge, vert ensuite) :
- Faux départ instructif : premier « rouge » = `Cannot find module '../../config/rateLimit.js'` → **rouge d'absence de module, pas rouge de comportement** : ne discrimine rien. Refactoring assumé (« déplacement dans le temps et l'espace ») : `config/rateLimit.js` créé avec les constantes seules, `resetLoginRateLimit` déplacé vers `middlewares/rateLimit.js` au vert.
- **Rouge de comportement** obtenu : boucle de `LOGIN_MAX_ECHECS` échecs (401 attendus) puis `expect(429)` → **`expected 429, received 401`**. Discriminant des deux côtés (la boucle pinne « les N premiers sont autorisés », l'assertion finale pinne « le N+1 est bloqué »).
- **Vert** : `express-rate-limit` installé, limiteur greffé, `resetLoginRateLimit` branché sur le vrai store. Suite relancée : **163 verts, dont les 7 tests d'auth d'origine** → preuve mécanique que l'isolation ne fuit pas (+1 seul test, pas de régression).

**Comportements introduits et tranchés consciemment** : `id_utilisateur` absent → clé IP seule (requête malformée → 400 comptée dans le quota, résiduel mineur assumé, non testé) ; `handler` custom uniquement pour cohérence du format `{ error: … }` + choix de **transparence** assumé (le message révèle l'existence du limiteur).

**Report au déploiement (→ erratum)** : `trust proxy` à régler derrière le reverse proxy imposé par HTTPS — sinon `req.ip` = IP du proxy pour tous les clients et la clé IP dégénère. Jamais `trust proxy: true` en aveugle (rouvre le spoofing de `X-Forwarded-For` → contournement total du limiteur).

Commits : `test(rate-limit): red - le login doit renvoyer 429 après LOGIN_MAX_ECHECS échecs` (isolation embarquée) puis `feat(rate-limit): green - bloque le login après 5 échecs sur 15 minutes par IP et utilisateur` (corps portant l'audit § 9.3.4, le risque, la clé + résiduel, les deux résiduels).

### 17.3 — Sauvegarde : du néant au minimum défendable + runbook

Constat : aucune trace de sauvegarde dans le dépôt (`ls docs/exploitation` vide, aucun script, aucun `pg_dump`/`gpg`). Contrairement au rate-limit, l'issue « rendre vrai » n'est pas ouverte : une stratégie 3-2-1 est de l'infra, et **une sauvegarde ne se teste pas en l'écrivant, elle se teste en la restaurant** — or la base de prod n'existe pas.

Décision : **engager le minimum défendable** (dump PostgreSQL chiffré + **restauration effectivement rejouée et datée**), **déclarer le 3-2-1 complet en perspective** (non promis pour une date). Runbook créé (`docs/exploitation/restauration.md`) : il porte sa propre garde (statut « définie, pas exécutée », journal de tests vide qui **interdit le passé composé au § 9.3.5 tant qu'aucune date n'est inscrite**), met la **restauration au centre** (pas le dump), et documente le choix `--format=custom`. Casse PascalCase des tables corrigée (`"Utilisateur"` avec guillemets — Prisma conserve la casse) ; **⚠️ à confirmer par `\dt`** que les noms exacts correspondent (pas encore vérifié sur pièce).

§ 9.3.5 réécrit au **futur d'engagement** et réaligné sur le minimum (le 3-2-1 en évolution possible, pas en promesse — sinon l'erratum devrait démentir une sous-livraison).

### 17.4 — Journal de bord versionné + dépôt rendu public (audit de sécurité)

**Journal** : les `session_N.md` étaient **locaux**. Ils *sont* le journal de bord exigé (§ 5.4), à condition d'être dans le dépôt. Versionnés dans **`docs/sessions/`** (racine, portée projet — pas `backend/docs/`, et le rapport cite `docs/` sans préfixe). Le terme « **hebdomadaire** » du § 5.4 est **faux** (cadence par session, pas par semaine — le `git log` le dément) et moins valorisant → **à corriger** (résidu ouvert, voir plus bas).

**Audit avant passage public** — leçon centrale de la session : **ce qui détermine l'exposition, ce n'est pas la sensibilité apparente d'une valeur, c'est (a) si Git la suit et (b) si ce qu'elle déverrouille est atteignable.** L'intuition de gravité était inversée par rapport à la réalité.
- `git ls-files | grep .env` → **vide** : aucun `.env` suivi. `git log --all --full-history -- backend/.env*` → **vide** : jamais versionnés. Risque public sur les `.env` = nul.
- Seul secret réellement suivi trouvé par audit : `POSTGRES_PASSWORD: tfe_dev_password` en dur dans `backend/compose.yaml` (dev jetable). **Sorti** en variable d'environnement (`${POSTGRES_PASSWORD}` + valeur dans `backend/.env` non suivi). Commit `chore(infra)`. L'historique le contient encore → **non-réécriture assumée** (valeur de dev sans pouvoir ; la prod utilisera un secret distinct).
- **Backlog** (IP `165.22.207.137`, compte SSH, clés WireGuard) : **non suivi par Git** (`git ls-files | grep backlog` vide) → jamais dans le dépôt, jamais exposé. Fausse alerte la plus grave, désamorcée par un fait. À nettoyer par hygiène (les clés WireGuard sont **publiques**, non compromettantes ; l'infra est de toute façon à rejouer, gel § 1.1).
- **PIN `2911`** (session 3 + seed) : d'abord qualifié « PIN admin réel », puis établi que c'est **le PIN du seed de dev**, sans compte exposé (aucune instance accessible depuis l'extérieur). **Inerte aujourd'hui.** Report déploiement : le seed de prod doit poser un PIN admin **hors dépôt**, différent de `2911`.

Principe de traitement des secrets acquis : **un secret dans l'historique se traite d'abord par invalidation, pas par réécriture.** On ne réécrit l'historique que pour les secrets non-invalidables (donnée personnelle réelle, clé privée non révocable). Ici tout est soit non-suivi, soit invalidable, soit sans pouvoir → **aucune réécriture d'historique nécessaire.**

Dépôt et Project rendus **publics**. Diagnostic au passage : Project public ≠ dépôt public ; les cartes du Kanban sont des **issues**, qui héritent de la visibilité du **dépôt** — rendre le dépôt public a débloqué les cartes. « Kanban partagé en lecture à la rapporteure » (§ 5.4) devient **vrai**.

### 17.5 — Trois sections du rapport réécrites et réinjectées dans le document

Vérifié sur pièce (le `.docx` est en réalité un fichier **texte/markdown**, pas un Word) : **9.3.4** (injections + rate-limit, verbes frontend passés en engagement, CSRF borné au backend, « toutes les entrées » → « les entrées des routes livrées US-04 à US-09 »), **9.3.5** (sauvegarde minimum + perspective 3-2-1), **5.4** (trois supports de suivi) sont **présents dans le document** dans leurs versions corrigées. (Erreur de ma part corrigée : j'avais supposé qu'ils flottaient hors fichier — ils étaient réinjectés.)

### 17.6 — Pagination : règle règlementaire établie, exécution reportée

Le règlement (§ 5.1, lu sur pièce) impose **explicitement** : avant-propos + remerciements **non numérotés** ; pages suivantes **table des matières incluse en chiffres romains** ; **arabes à partir de l'introduction** ; numéro en angle droit. Donc **quatre zones** (couverture/page de garde non num. → avant-propos/remerciements non num. → TdM/listes en romains → corps en arabes). Confirmé aussi : tableaux/figures en **majuscules + romains + titre** (« TABLEAU II : … »), **liste des annexes** après la TdM (exigences fermes).

Constat structurant : le `TFE_Rapport_final.docx` **n'est pas un Word** — c'est du texte/markdown, sans pagination réelle (les numéros de la TdM sont des artefacts figés d'un rendu antérieur). La pagination, les romains, la page de garde et la liste des annexes se construisent **à la conversion texte → Word**, qui est une **étape finale** : la faire avant d'avoir purgé (§ 1.1) et coupé (§ 1.6) le contenu = formater un document qu'on va éventrer. **Pagination résolue sur le principe, exécutée en dernier.**

### 17.7 — Cartographie du rapport (point de départ de S18)

Structure complète lue (11 chapitres). Contenu vérifié sur pièce pour **6.7, 8, 10** ; le reste classé **d'après le gel** (à reconfirmer en lecture). Verdicts :

- **RÉÉCRIRE (v1 pur, vérifié)** : **ch. 10 Réalisation** (10.1 état livré = tout faux : Prisma 5.22, 32 tests Jest, React livré, VPS WireGuard ; 10.2 chronologie v1 semaines 1-7 ; 10.3 difficultés v1) et **ch. 8 Tests** (Jest, 32 tests, `lib/annulation.js`/`tarifs.js`/`souper.js`, `cenacle_test`, `--runInBand`, Playwright, tableaux IT/UT référençant des routes inexistantes). Les deux plus faux **et** à plus fort rendement une fois refaits (la vraie stratégie est plus courte et plus forte).
- **CORRIGER** : 6.7 (retirer Swagger ; React/Socket.IO/PDFKit/ExcelJS → « prévus », pas « retenus/livrés » — table **partiellement** corrigée déjà : Prisma/Express/PG/Vitest OK) ; 9.3.2 (matrice RBAC 22 routes dont moitié inexistante + `admin` bypass contredisant S6) ; 4.1/4.2 (US v1 en Done, US-09 fausse) ; 5.2/5.3/5.6 (chronologie + charge v1) ; 11.2/11.3/11.4 (32 tests, résiduels, renvois cassés).
- **COUPER (volume)** : 4.3 (20 fiches UC ≈ 2 000 mots → garder UC-01, UC-02/03, UC-07 en corps, reste en annexe) ; 5.2 (4 tableaux release → paragraphe + Gantt).
- **GARDER** : ch. 1-3, 4.4 (RG), 7 (fond ; figures à réaligner, restent en corps), 9.4 (RGPD — point fort : données fictives, minimisation prouvée par test, hard delete art. 17).
- **AJOUTER (§ 1.4, absent)** : TDD rouge/vert/né-vert, registre AT-01/AT-02, validations Diego datées, `translate` vs `unaccent`, index partiel, verrou FOR UPDATE, minimisation prouvée par test, dérivation serveur `date_repas`, rate-limit — à loger surtout aux ch. 8 et 10.

**Ordre d'attaque retenu** : ch. 10 puis ch. 8 (purge v1 + ajout du vrai + coupe de volume d'un même geste, sur les sections les plus dangereuses en défense) → corrections ponctuelles → volume → figures/forme/conversion Word.

---

## Concepts compris / à consolider

**Acquis :**
- La sécurité d'un secret se juge sur l'**exposition réelle** (suivi Git + atteignabilité), pas sur son étiquette. `git ls-files` avant tout jugement ; `git log --all --full-history` pour l'historique.
- Un secret se neutralise **par invalidation** avant de penser réécriture d'historique.
- L'état d'un rate-limit vit **hors base**, en mémoire du process → isolation à la main, indépendante de `migrate reset`.
- Séparation **politique / mécanique** (config vs middleware) comme pour seuil d'annulation / code applicatif.
- Temps de verbe = vérité au 17/08 : accompli pour le backend livré, **engagement** pour frontend/déploiement/exports.

**À consolider :**
- Réflexe « lib déclarée ≠ lib branchée » — l'appliquer d'office aux prochaines affirmations du rapport.
- Vérifier sur pièce (`\dt`) les noms de tables du runbook avant de le figer.

---

## Points à mentionner dans le rapport TFE

- **§ 9.3.4** : rate-limit login comme **contribution de sécurité auditée** (écart code/doc trouvé par audit du rapport, fermé en TDD), avec risque précis (PIN court + liste publique) et résiduels déclarés. Fort rendement « Technicité » + « Description de la validation ».
- **§ 9.3.5** : sauvegarde comme mesure dont la **preuve est la restauration**, engagement conservateur + perspective 3-2-1.
- **§ 5.4** : suivi par sessions datées versionnées (corriger « hebdomadaire »).
- **§ 9.4 RGPD** : jeu de données **fictif** (aucune donnée art. 9 réelle exposée, y compris dépôt public), à mettre en avant.
- **Gestion des secrets** : credentials du seed = valeurs de dev ; seed de prod pose des credentials distincts non versionnés → argument attendu par un jury.

---

## Exigences EPHEC couvertes / progressées

- **Analyse de sécurité** (mesures + risques résiduels) : rate-limit ajouté, résiduels nommés (`trust proxy`, balayage IP, bucket IP-seul, sauvegarde partielle).
- **Procédure de déploiement / exploitation** : runbook de restauration créé.
- **Versioning Git + suivi** : journal de bord versionné, dépôt et Kanban rendus accessibles aux évaluateurs (poste méthodologie 20 %).
- **Forme (règlement)** : règle de pagination § 5.1 établie, exécution cadrée pour la conversion finale.

---

## État des fonctionnalités / routes

- **Rate-limit login** ✅ — `POST /api/auth/login` protégé (5 échecs / 15 min, clé IP+id_utilisateur, échecs seulement), **163 tests verts**, `config/rateLimit.js` + `middlewares/rateLimit.js`.
- Reste du backend inchangé depuis S16 (US-01→09 socle, US-13, US-14, AT-02).
- Frontend, déploiement, exports : **non commencés** (cercle 1 à livrer d'ici la défense, en engagement dans le rapport).

---

## Blocages rencontrés et résolution

- **Faux rouge « module introuvable »** : premier test rougissait sur l'import de `config/rateLimit.js` inexistant, pas sur le comportement. Résolu en créant les constantes seules (rouge de comportement obtenu : 401 au lieu de 429).
- **Store non réinitialisé entre tests** : anticipé au cadrage, `beforeEach(resetLoginRateLimit)` posé ; validé par la survie des 7 tests d'auth d'origine.
- **`.docx` illisible comme Word** : c'est un fichier texte/markdown renommé (comme le règlement, un zip renommé `.pdf`). Lu comme texte.
- **Fausse alerte sécurité (backlog)** : IP/SSH/WireGuard crus exposés → établis **non suivis par Git**, donc jamais dans le dépôt.
- **Mon erreur** : affirmé que les 3 paragraphes réécrits n'étaient pas dans le `.docx` (supposition) — vérification faite, ils y étaient. Rappel : ne pas affirmer un fait de fichier sans le lire.

---

## Ce qui reste à faire

1. **Ch. 10 Réalisation — RÉÉCRIRE** (prochaine session) : état vrai (backlog accompli / frontend-déploiement-exports en engagement), chronologie réelle, difficultés réelles.
2. **Ch. 8 Tests — RÉÉCRIRE** : Vitest, 163 tests d'intégration, TDD discriminant, né-verts, stratégie de recette frontend + axe-core.
3. **Résidus ponctuels ouverts cette session** :
   - Retirer le **« 300 »** en fin de § 5.4.
   - Corriger **« hebdomadaire »** (§ 5.4) → cadence par session.
   - **§ 5.5** : chronologie v1 (« jurys CDC novembre… ») + « comptes rendus dans `docs/` » à vérifier/corriger.
   - Vérifier par **`\dt`** les noms de tables du runbook.
   - Nettoyer le **backlog** (IP/SSH/WireGuard → mention neutre) par hygiène.
4. Corrections ponctuelles (6.7 Swagger + verbes, 9.3.2 RBAC, 4.1/4.2 backlog, 5.2/5.3/5.6, 11).
5. Volume (couper 4.3, réduire 5.2).
6. Figures à réaligner + forme (page de garde, encart IA, liste annexes, romains tableaux) + **conversion texte → Word paginé** (dernier).
7. **Reports déploiement (→ erratum 1er/09)** : sauvegarde exécutée + restauration datée ; seed prod PIN hors dépôt ; `trust proxy`.

---

## Structure du dépôt (extrait, annoté)

```
TFE-aout-2026/                         (dépôt PUBLIC depuis S17)
├── backend/
│   ├── compose.yaml                   ← MODIFIÉ (POSTGRES_PASSWORD → ${…})
│   ├── .env / .env.test               (non suivis)
│   └── src/
│       ├── config/
│       │   ├── seuils.js
│       │   └── rateLimit.js           ← NOUVEAU (LOGIN_MAX_ECHECS, LOGIN_FENETRE_MS)
│       ├── middlewares/
│       │   ├── auth.js
│       │   └── rateLimit.js           ← NOUVEAU (loginRateLimit + resetLoginRateLimit, store unique)
│       └── routes/
│           ├── auth.js                ← MODIFIÉ (loginRateLimit greffé sur POST /login)
│           └── __tests__/
│               └── auth.test.js       ← MODIFIÉ (beforeEach reset + test 429)
└── docs/                              ← NOUVEAU (racine)
    ├── exploitation/
    │   └── restauration.md            ← NOUVEAU (runbook, journal de tests vide)
    └── sessions/                      ← NOUVEAU (journal de bord versionné)
        ├── rapport_avancement_synthese.md
        └── session_1.md … session_17.md
```

Le rapport (`TFE_Rapport_final.docx`, en réalité texte/markdown) est hors dépôt côté travail ; § 5.4, 9.3.4, 9.3.5 y sont réinjectés.

---

## Instructions pour reprendre (Session 18)

**Contexte :** rapport = priorité absolue jusqu'au 17/08. Les cinq ⚠️ du § 1.2 sont fermés. Le sprint de fond restant est le **contenu du rapport**, à attaquer par le **ch. 10 (Réalisation)** puis le **ch. 8 (Tests)** — les deux sections v1-pures, les plus dangereuses en défense, et à plus fort rendement une fois refaites.

**Point de départ :** la **cartographie** (section 17.7 ci-dessus) donne le verdict par chapitre. Le `TFE_Rapport_final.docx` est un fichier **texte/markdown** — l'éditer comme tel (versionnable, diffable), pas comme un Word.

**Répartition (rappel) :** la prose que le jury fera défendre, **Hippolyte l'écrit** ; Claude localise le faux, vérifie contre le code (`grep`/`\d`/`git show`), relit, et **produit la forme** (pagination, figures, page de garde, conversion Word — livrables exemptés).

**Stratégie de temps de verbe (à tenir dans chaque section) :** backend livré = accompli ; frontend / déploiement / exports = **engagement** (« sera livré d'ici la défense »), jamais « est livré ». L'erratum du 1er/09 fait passer à l'accompli ce qui aura été livré.

**Commandes de relance :**
```bash
cd backend
docker compose up -d                    # PostgreSQL 5433
npx dotenv -e .env.test -- bash -c 'npx prisma migrate reset --force && npx prisma db seed && npx vitest run'
```
**Vérification rapide :** la suite doit rendre **163 verts**. `git log --oneline` doit montrer la paire rouge/vert du rate-limit.

**Rappels de discipline :** vérifier sur pièce, jamais de mémoire (y compris pour Claude — cette session en a fourni deux contre-exemples : le `git log -S` mal interprété et les paragraphes crus absents du `.docx`) ; répondre au cadrage avant de coder ; consigner toute validation Diego datée ; « vert » n'est pas « fait ».

---

*Rapport mis à jour le 13 août 2026 — Session 17*
