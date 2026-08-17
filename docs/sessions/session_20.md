# Session 20 — Assainissement du rapport écrit (audit des non-conformités)

**Auteur :** Hippolyte AMORY
**Date :** 16 août 2026 (veille de la remise)
**Remise du rapport :** 17 août 2026 · **Défense :** 2 septembre 2026

---

## Contexte et état de départ

Le backend est livré et gelé (163 tests verts, cf. S19). Cette session ne porte pas sur du développement mais sur la **mise en conformité du rapport écrit** avant remise, à partir du fichier `audit_rapport_reste_a_modifier_2026-08-15.md` qui recensait les vestiges v1 et les non-conformités. Objectif : traiter les items par gravité décroissante, chaque correction vérifiée à la source (`grep`, `git`, schéma) et non de mémoire.

La classe de défaut dominante identifiée : le **présent de l'indicatif appliqué à du non-livré** (des fonctionnalités décrites comme accomplies alors qu'elles sont des engagements), présente dans tous les chapitres non réécrits récemment.

---

## Ce qui a été travaillé

### 20.1 — Chapitre 8 réécrit intégralement (item A1)
Le chapitre v1 inventait des livrables (Jest, Playwright, 32 tests, `cenacle_test`, CI GitHub Actions, Husky, coverage 80 %, axe-core, endpoints boissons/exports/admin). Reconstruit sur la suite réelle, sourcé au terminal (`vitest run` + `grep` des `describe`/`it`).
- Ventilation réelle établie et défendue : **163 = 8 unitaires (domaine `reglesAnnulation`) + 155 intégration** (8 middleware via Supertest + 147 route). Décision de compter les middleware comme intégration (propriété vérifiée = montage dans la chaîne Express, pas fonction isolée), sourcée S5.
- Forme de la suite nommée **testing trophy a posteriori** (pas pyramide de Cohn), avec **absence de socle statique** (ni ESLint ni typage) assumée et versée en §11.4. Choix : citer le trophée comme comparaison en bornant la revendication, pas comme étiquette revendiquée.
- **Trois statuts de preuve distincts** posés en 8.3.2 : contraintes SQL (AT-02, index partiel) démontrées par violation réelle ; ordre des gardes 401→403→400→404 testé garde par garde mais **pas en précédence** ; concurrence (verrou `FOR UPDATE`, écriture conditionnelle) **argumentée en §10.3, non testée** (un test de course sans verrou passerait au vert de la même façon).
- Sous-sections : 8.4+8.6 fusionnées (E2E + accessibilité non couverts, engagement) ; 8.5 recette = à venir (renvoi §5.5, sans relabelliser les validations de règles Diego) ; 8.7 CI = engagement sourcé (industrialiser le script `npm test` local) ; 8.8 matrice de traçabilité reconstruite avec référentiel « backend livré » explicite.

### 20.2 — Entité fantôme LogAccesAllergie (item A2)
- §7.1.1 : `LogAccesAllergie` retirée des entités principales → **dix entités** (aligné `schema.prisma`) ; « onze » → « dix » ; « quatre choix structurants » réconcilié (n'en décrivait que trois).
- §9.5 (tableau 22) : justification « RBAC limitant à **quatre rôles** » → **asymétrie de routes** (lecture libre `id_resident` réservée secrétaire/admin ; cuisine/serveur contextuel seulement). Le compte de rôles n'était pas un argument.
- Défense orale construite : justification **à deux canaux** (contextuel = garanti par le système ; libre = risque assumé par le contexte réseau fermé). Trou `created_by`/hard delete assumé (S11 : « l'accountability vit pendant la vie de la donnée, pas après l'effacement légal » + « le métier veut la mémoire, le RGPD veut l'oubli »).

### 20.3 — Backlog priorisé §4.1 (item B1, fondateur)
Tableau reconstruit sur **deux axes distincts** : Priorité (MoSCoW, cadrée « produit cible complet » — Option B) et Palier (libellés §5.2 : MVP au sens strict / Perspective à court terme / Hors périmètre déclaré). Mapping paliers appliqué à la lettre de §5.2 (UC-14/06/08 remontent en MVP ; boissons/feedback descendent en hors-périmètre). MoSCoW re-noté (fin du mur de « Must » : 16 Must → 10). Deux cellules hors-diagonale (UC-06 Should/MVP, UC-10 Must/tardif) justifient les deux colonnes. Référentiel « Won't have » réconcilié (« hors de la vision produit », ≠ reporté).

### 20.4 — Fiches UC §4.3 (item B2, requalifié)
Requalifié après vérification du **gel pt 83** : garder 3-4 fiches en corps (UC-01, UC-02/03, UC-07), le reste en **annexe unique**. Intro §4.3 réécrite (« l'ensemble des cas », pas « les Must du MVP »). Principe UC-08 Must / UC-13 Should posé sous le tableau §4.1.

### 20.5 — §2.1 + biblio + titres (items B3, C1, D2, D3)
« valide chaque release » et « défense finale en juin » corrigés (`grep 'juin'`/`'release'` vides = bloc « Release » éradiqué). Biblio : PostgreSQL 16→18, Prisma 5.22→7.8, Jest→Vitest. Titre §5.2 et légende figure 3 : « release » → « paliers ».

### 20.6 — §6.5 architecture/déploiement (item A3)
Réécrit en **trois registres** : architecture conçue / ce qui se lance aujourd'hui / déploiement cible.
- « déploie l'app complète via `docker-compose up --build` » (phrase piège) → chaîne reproductible réelle satisfaisant l'exigence EPHEC « procédure documentée » sur le périmètre livré.
- « est hébergée sur VPS » → engagement (rien ne tourne sur le VPS, confirmé).
- **Livrable créé : `backend/.env.example`** (4 variables applicatives réelles issues d'un `grep process.env` : DATABASE_URL, PORT, JWT_SECRET, BCRYPT_ROUNDS ; TZ exclue car lue par un test), committé et **vérifié dans l'arbre Git** (`git ls-files`). « ~25 routes » → **seize** (recomptées).

### 20.7 — §7.2.1 + figure 7 (item A4)
- **Figure 7 refaite** (répond au commentaire rapporteure c4) : **diagramme de classes des entités** (Option 1), pas de couche « classes de service » fictive. Première version PNG contenait encore une bande `«service»`/Controller → supprimée en SVG. Vérifiée à la source contre `schema.prisma` (10 entités, enums réels, contraintes, boissons pointillées « hors livrable §11.3 »).
- **Tableau des modules** réaligné : fantômes supprimés, `domain/reglesAnnulation.js` à sa vraie place, modules réels ajoutés, annulation à **2 niveaux**. `config/tarifs.js` (17 tarifs dont 12 boissons, **aucune route ne le lit**) décrit honnêtement en donnée de référence non consommée.

### 20.8 — Matrice RBAC §9.3.2 (item A5)
Matrice reconstruite sur **11 routes réelles** (vs 22 fantasmées), chaque ligne vérifiée au `grep requireRole`. Corrections majeures : `PATCH …/annuler` était donnée à 4 rôles, le code la réserve à `secretaire` ; `admin` inventé sur plusieurs routes (n'est exigé nulle part) ; `PATCH /menus/:id` et GET commandes n'existent pas. Exploité comme points forts : moindre privilège (admin défini mais non exigé), commentaire ownership `allergies.js:91`. Réconciliation avec §9.4.3 (canaux contextuels = cible, route directe = livrée).

### 20.9 — Ventilation de charge §5.6 (item D1) + compte de tests §10 (item D5)
- §5.6 était une **phrase inachevée**. Complété par un graphique de charge (480 h, 7 postes, total vérifié à la main). Nommé **« Graphique 1 »** (série distincte des figures : graphique = données chiffrées, figure = structure/interface).
- §10.1/§10.2 : « 163 tests d'intégration » corrigé en **trois** endroits (le `grep` en a trouvé plus que l'audit n'en ciblait) → « 163 tests automatisés (8 unitaires, 155 d'intégration) ».

### 20.10 — Consignes de forme EPHEC (sourcées sur le règlement)
- **Page de garde** (l.404-417) : mention diplôme (libellé long du règlement, pas l'ancien modèle), nouveau sigle EPHEC (Moodle), année, nom étudiant, nom rapporteur (plus petit), titre **identique au titre approuvé** (vérifié à la remise, l.227), image représentative, « CONFIDENTIEL » si lieu. Encart déclaration IA à insérer **juste après** la page de garde.
- **Police** : **non imposée**. Impératifs : simple interligne, marges normales, 25-30 pages (hors liminaires/annexes).
- **Pagination** (§5.1, l.437-439) : numéro en **angle supérieur ou inférieur droit** ; avant-propos non numéroté ; **romains** jusqu'à la TdM incluse ; **arabes** dès l'introduction (redémarrage à 1 → saut de section Word requis).

---

## Concepts compris / à consolider

**Acquis cette session :**
- Le « présent de l'indicatif sur du non-livré » comme classe de défaut unifiée — reconnaître et reformuler en engagement (chapitres 6, 7, 8, 9.3.2).
- **Fichier d'abord, affirmation ensuite** : ne jamais rédiger un accompli pour un artefact non créé (piège du `.env.example` décrit avant existence).
- `git ls-files` ≠ « committé » : la vérité est l'arbre Git, pas le disque local (le `.gitignore` peut intercepter).
- MoSCoW ≠ palier : deux axes orthogonaux ; cadrer le référentiel du « Must » (produit complet vs TFE).
- « Adéquat et correct » > « présent » pour les diagrammes : un diagramme de classes sans classes réelles coûte des points au lieu d'en rapporter.
- Transformer une absence en asset (socle statique manquant, CI absente, VPS non déployé) : nommer le manque et le porter en engagement sourcé plutôt que le cacher.

**À consolider :**
- La double pagination romains/arabes avec sauts de section (mécanique Word, à faire en toute fin).
- La cohérence typographique après un rapport reconstruit par blocs (passe visuelle de mise en forme).

---

## Points à mentionner dans le rapport TFE (déjà intégrés)

Tous les items ci-dessus sont des corrections **du** rapport, pas des ajouts à faire. Points de défense associés : les trois statuts de preuve (8.3.2), la justification à deux canaux du non-log allergies (A2), le moindre privilège de la matrice RBAC (A5), la reproductibilité réelle du socle (A3).

---

## Exigences EPHEC touchées

- **Tests unitaires / documentation** : chapitre 8 désormais conforme au code réel.
- **Schémas techniques** : figure 7 (classes) refaite ; restent EA et relationnel à rendre verticaux (E1/E2).
- **Procédure de déploiement** : `.env.example` + chaîne reproductible documentée (§6.5).
- **Analyse de sécurité / RGPD** : matrice RBAC véridique (§9.3.2), justification article 9 à deux canaux (§9.4.3).
- **Planning / charge** : ventilation §5.6 (Graphique 1, 480 h).
- **Déclaration IA générative** : encart à insérer après page de garde (non fait).

---

## État des fonctionnalités / routes

Inchangé depuis S19 (aucun développement cette session). 11 routes livrées, 163 tests verts. **Seul ajout au dépôt : `backend/.env.example`** (committé, poussé, vérifié `git ls-files`).

---

## Blocages rencontrés et résolution

- **Figure 7 exécutée à moitié** : première version gardait la bande « classes de service » fictive à supprimer. Résolu : version SVG sur les seules entités réelles.
- **`.env.example` décrit avant création** : rédigé un accompli pour un fichier inexistant. Résolu : `grep process.env` → création → commit → vérification `git ls-files` → *puis* la phrase du rapport.
- **Dérive instantané/local** : `/mnt/project` retardait sur les éditions locales, puis a rattrapé ; les numéros de ligne dérivent section par section. Discipline : `grep` local avant chaque correction.
- **Erreurs de Claude corrigées par vérification** : `config/tarifs.js` et `routes/annulations.js` existent (dits vestiges à tort) ; D4 (nom `regles-annulation.js`) était un faux positif — le vrai nom est `reglesAnnulation.js` ; enums `TypeClient`/`CategorieOption` de la table de nommage de référence étaient périmés vs schéma réel. Chaque fois, le `grep`/schéma a tranché.

---

## Ce qui reste à faire

1. **Figures** (skills) : E1 schéma EA **vertical** (10 entités) ; E2 relationnel **vertical** ; E4 vue cuisine + **somme des produits** par défaut (c5).
2. **Forme / conversion finale** : F1 numérotation §3.2 (trou §3.1→§3.3) ; F2 purge des ancres de commentaires `[^c0]`…`[^c8]` ; F3 TdM régénérée **après** pagination double (sauts de section romains/arabes).
3. **Liminaires** : page de garde (8 mentions), encart déclaration IA après page de garde, avant-propos.
4. **Points de vigilance oral (G)** : §6.7 stack « retenue » (dire « choisis, pas tous intégrés ») ; §9.3.3 Let's Encrypt/WSS au futur ; §9.4.4 export CSV au futur.
5. **Questions Diego (H)** : UC-10 palier de la facturation mensuelle ; UC-15 cohérence stocks/§11.4.
6. **Balayage final avant remise** : `grep -niE 'release|jest|playwright|prisma 5|5\.22|postgresql 16|logacces|163 tests d.intégration|juin|docker.compose up --build|est hébergée'` → doit sortir vide.
7. **Vérifier §5.6/§5.4** (cohérence estimation) et que Graphique 1 est appelé + expliqué dans le texte.

---

## Structure du dépôt

```
backend/
├── .env.example              ← NOUVEAU (4 variables, sans valeur réelle, committé)
├── .env.test                 (inchangé)
├── compose.yaml              (PostgreSQL seul)
├── prisma/
│   ├── schema.prisma         (10 modèles — inchangé)
│   └── seed / seedData.ts
├── src/
│   ├── domain/reglesAnnulation.js  (compterJours, classerAnnulation)
│   ├── middlewares/          (auth.js, rateLimit.js)
│   ├── config/               (tarifs.js, seuils.js, rateLimit.js)
│   ├── lib/prisma.js
│   └── routes/               (auth, users, appartements, residents, allergies, menus, commandes, annulations)
```
Le rapport (`TFE_Rapport_final.docx`) est modifié dans tous les chapitres audités — hors dépôt code.

---

## Instructions pour reprendre (Session 21)

**Contexte :** le rapport écrit est assaini sur le fond (clusters A et B, plus C1/D1/D2/D3/D5 soldés). Il ne reste **aucune réécriture de fond** — uniquement des figures, du nettoyage de forme, les liminaires, et deux questions Diego.

**Rappels de discipline (inchangés) :** `grep`/schéma/`git` avant d'écrire un fait ; fichier d'abord, affirmation ensuite ; vérifier `git ls-files` pour la présence réelle d'un fichier ; une figure n'est conforme que si elle est appelée **et** expliquée dans le texte (règlement l.366-367).

**À faire en priorité (remise imminente) :**
1. Les trois figures (E1/E2/E4) — sur le schéma réel (10 entités), verticales.
2. Les liminaires (page de garde + encart IA).
3. **En tout dernier** : pagination double (sauts de section) → régénération TdM → balayage `grep` final → passe typographique visuelle.

**Dette de suivi :** mettre à jour l'audit pour A5/D1/D5 (fait en fin de S20, cf. fichier d'audit rév. 4).

---

*Rapport mis à jour le 16 août 2026 — Session 20*
