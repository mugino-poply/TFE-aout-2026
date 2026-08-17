# Session 19 — Réécriture du chapitre 5 (méthodologie) + §11.1 / §11.3

**Auteur :** Hippolyte AMORY
**Date :** 15 août 2026
**Remise du rapport :** 17 août 2026 · **Arrêt du code :** 1er septembre 2026 · **Défense :** 2 septembre 2026

---

## Contexte et état de départ

Suite de la réécriture du rapport entamée en S18 (chapitres 10 et 11 + §5.1/§5.3/§5.4). Objectif de la session : solder les dettes ouvertes du **chapitre 5** (§5.2, §5.5, §5.6, §5.7) et corriger les contradictions de cohérence inter-chapitres que ces réécritures faisaient remonter (notamment §11.1 et §11.3). Aucun code applicatif visé. Travail entièrement rédactionnel, mené en boucle *écrire → vérifier sur pièce → corriger*.

Principe directeur tenu toute la session : **défendable > correct**, et surtout **cohérence d'ensemble** — chaque section doit raconter la même histoire que le §5.2, le §11.1 et le chapitre 9, pas seulement être juste isolément.

---

## Ce qui a été travaillé

### 19.1 — §5.2 « Organisation incrémentale : MVP et paliers de livraison »
Réécrit intégralement (l'ancienne version était encore en structure v1 « quatre releases »).
- **Décision de cadrage :** aligné réel + prévisionnel pour les modules futurs, en réutilisant le vocabulaire déjà posé au ch.11 (*socle livré / perspectives court terme / hors-périmètre*), pas le mot « cercle » (interne au gel).
- **MVP conservé et redéfini honnêtement** = le socle (cercle 1 du gel) : backend livré + parcours secrétaire (`SecretairePage.jsx`) + déploiement + recette. Justification : *« un backend seul, sans interface ni déploiement, ne constitue pas un MVP utilisable »*.
- **Frontière posée §5.2 (stratégie de priorisation) vs §11 (bilan de l'état)** pour éviter le doublon d'inventaire avec §11.1/§11.3.
- **Argument de défense sourcé du gel :** le classement Diego (SMS) petit-déj/souper → exports → boissons *coïncide* avec la dépendance technique (les exports n'ont rien à exporter tant qu'US-43/44 ne sont pas livrées) → **réduction de périmètre = arbitrage validé avec le client, pas subie**.
- Corrections successives de rattachements d'US erronés (vérifiés contre les titres du backlog) : appartements = **US-04** (pas US-05/06) ; couples/invités (US-10) et remarque (US-42) rangés en *saisie* et non en *vue/annulation* ; US-12 = vue+annulation, US-45 = liste « en appartement ».

### 19.2 — §5.5 « Interactions avec les parties prenantes »
Réécrit. Vestiges v1 retirés (« fins de release », « dépôt en juin »).
- Cadence réelle avec Diego décrite : validation des règles métier (AT-01, AT-02 validés le 09/08, dont la ligature « œ »), gel de cadrage (classement validé le 12/08), recette **présentée comme à venir** (elle suppose un frontend livré, non fait).
- **Distinction sourcée** : les *arbitrages techniques* validés par Diego sont au registre `arbitrages_techniques.md` (datés, canal) ; les *décisions de périmètre* sont actées dans le gel, pas dans le registre (cf. synthèse l.206 : le report Socket.IO n'entre pas au registre).
- « dépôt en août » corrigé (au lieu de juin).

### 19.3 — §5.6 « Répartition estimée de la charge de travail »
Réécrit, avec un **graphique** généré (livrable).
- **480 h**, ancre **doublement sourcée** : règlement TFE (16 ECTS ≈ 480 h) *et* commentaire `[^c0]` de la rapporteure (« il vaut mieux viser 480 heures »).
- Ventilation par activité (et non plus MVP/R2/R3), somme = 480 : analyse/conception 90 (19 %), socle applicatif 165 (34 %), tests 75 (16 %), déploiement/recette 30 (6 %), spécification perspectives 20 (4 %), rédaction rapport 75 (16 %), défense 25 (5 %).
- **Décision assumée : la v1 abandonnée n'est pas comptée** — position conservatrice (« 480 h sur le seul livrable, v1 en plus, non comptée »), à défendre à l'oral.
- Graphique vertical (barres) généré en PNG + SVG, répondant à la seconde moitié du commentaire c0 (« sous un format graphique »). Fichier : `figure_charge_5-6.png` / `.svg`, à insérer comme **figure 4** (vérifier la séquence).

### 19.4 — §5.7 « Gestion des risques projet »
Tableau réécrit sur commentaire `[^c1]` de la rapporteure.
- Vestiges v1 retirés : « release 3/4 sacrifiables » → paliers (socle protégé, cercles 2/3 sacrifiables).
- **Ligne ajoutée « Perte de connexion en cours de service »** → atténuation = **coexistence papier (§1.4.3)** : si le service tombe, la prise de commande bascule sur papier, sans interruption. Mesure réelle et sourcée.
- **Sécurité et données sensibles → renvoi au chapitre 9** (STRIDE, RGPD, résiduels) plutôt que duplication.
- Corrections d'affirmations fausses : « Dockerfile fourni » retiré (le gel l.142 : Docker ne porte que PostgreSQL, dockerisation applicative = engagement) ; « sauvegardes externalisées » requalifiées en engagement (§11.3 : runbook défini, non exécuté).
- Note tenue : « Faible » sur la ligne sécurité n'est défendable que comme probabilité **résiduelle** (§9.5 classe le résiduel allergies « Faible »), à ne pas confondre avec l'inhérent (§9.2 « Critique »).

### 19.5 — §11.1 « Bilan »
Réécrit pour coller au §5.2 et lever les sur-claims.
- Mesuré **point par point contre le §1.4**.
- Socle backend **accompli et testé** (auth, RBAC, résidents/appartements, menu, saisie, annulations US-09, allergies) ; « à ce niveau de mécanique, l'objectif est atteint ».
- **Deux objectifs fonctionnels partiellement tenus** : saisie (backend agnostique, seul le dîner livré comme fonctionnalité — US-43/44 frontend non faits) ; annulations (deux niveaux `annulee_temps`/`annulee_retard`, pas trois ; répercussion facturation non construite).
- Allergies **pleinement tenues côté backend** (détection, unicité, traçabilité, minimisation), l'« afficher » du §1.4 dépendant du frontend (engagement).
- Auth pleinement tenue côté backend, asymétrie avec la saisie justifiée (mécanisme exercé par l'API vs geste utilisateur exigeant une UI).
- **Exports + vue temps réel déplacés de « engagé » vers « perspective à court terme »** (cercle 2), conformément au gel (« le rapport ne s'engage que sur le cercle 1 »).
- Hors-périmètre **scopé au §1.4** (seul boissons y figure) + renvoi §11.3 pour l'inventaire complet des cinq items.

### 19.6 — §11.3 corrigé
- Phrase « export mensuel = vue recalculée à la demande » **supprimée** (elle affirmait un livrable inexistant sous « ce qui est livré » ; contredit §11.1 et la synthèse l.71/102 : prédicats « à facturer ? » cadrés-non-implémentés).
- Corollaire : « **Deux** écarts » → « **Un** écart » (il n'en restait qu'un, le Socket.IO d'US-09).

---

## Concepts compris / à consolider

**Acquis cette session :**
- **Ne pas confondre purge v1 et redéfinition d'objectif.** Le §1.4 (objectifs) ne se réécrit pas pour coller au livré — ce serait peindre la cible autour de la flèche. Seule la *réalisation* (ch.10) était v1-spécifique.
- **Le MVP se garde et se redéfinit**, il ne se supprime pas : la grille EPHEC note explicitement « une première itération fonctionnelle (MVP) » (vérifié dans `grille_rapport_final`). Le lâcher = perdre des points méthodo.
- **Stratégie (§5.2) vs bilan (§11)** : la cible peut être nette, le bilan doit être nuancé (« partiellement tenu »).
- **Vérifier avant d'affirmer, y compris quand c'est Claude qui affirme** : le §11.1 n'était pas « bogué » comme annoncé au départ — la lecture du §1.4 a montré que « seul boissons » y est *exact* (les 4 autres items hors-périmètre ne sont pas des objectifs §1.4). C'est une ambiguïté à scoper, pas une erreur.

**À consolider :**
- Le pattern des **vestiges v1 dispersés** : ils réapparaissent section après section (défense juin, EPIC 06, export mensuel, tableau UC ch.4). Un **balayage systématique** vaut mieux que la chasse réactive.

---

## Points à mentionner dans le rapport TFE (choix justifiés issus de la session)
- 480 h ancrées sur 16 ECTS (règlement + demande rapporteure).
- MVP = socle utilisable, argument « backend seul ≠ MVP ».
- Réduction de périmètre = arbitrage client validé (convergence priorité Diego × dépendance technique), pas subie.
- Continuité d'activité par coexistence papier en cas de perte de connexion.
- Distinction registre d'arbitrages techniques (AT-XX) vs décisions de périmètre (gel).

---

## Exigences EPHEC couvertes / progressées
- **Méthodologie & organisation** (§5.2, §5.5, §5.6, §5.7) — cadence, charge chiffrée (16 ECTS), registre des risques élargi à l'exploitation.
- **Planning détaillé** — répartition de charge graphique (demande explicite rapporteure c0).
- **Analyse de risques** (§5.7 + renvoi ch.9) — projet + opérationnel, distinct des résiduels sécurité (§11.3).
- **Analyse critique finale** (§11.1 bilan honnête, §11.3 non-conformités).

---

## État des sections du rapport (après cette session)
- ✅ §5.1, §5.2, §5.3, §5.4, §5.5, §5.6, §5.7 — chapitre 5 clôturé (rédaction).
- ✅ §11.1 (bilan réécrit), §11.3 (export mensuel corrigé).
- ⚠️ **Non intégré au `.docx` vérifié** : l'upload du fichier à jour n'est pas arrivé cette session ; l'instantané `/mnt/project` est en retard (il montre encore l'ancien §5.2). Intégration à confirmer à la reprise.

---

## Blocages rencontrés et résolution
- **« §11.1 bogué » (annonce initiale) → nuancé** après lecture du §1.4 : « seul boissons hors-périmètre » est exact dans le cadre §1.4 ; le problème réel était (a) l'ambiguïté de la phrase, (b) le mauvais classement des exports/temps réel en « engagé ».
- **Rattachements d'US erronés au §5.2** (appartements, groupement frontend) → résolus par `grep` des titres exacts du backlog.
- **Instantané périmé / upload manquant** → constaté ; balayage v1 fiable à relancer sur le fichier **local**.

---

## Ce qui reste à faire (par priorité, pour la reprise)

1. **[FONDATEUR] Tableau de priorisation des UC — chapitre 4 (≈ l.470-491).** Encore en structure v1 « Release », avec le mapping inversé (UC-04 export / UC-10 facturation classés **MVP** ; UC-14 auth classée **Release 2** ; UC-08 liste appartement en Release 2 alors qu'US-45 est cercle 1). Contredit frontalement §5.2, §11.1 et §10.1. Gros chantier : reclasser chaque UC sur les paliers et la réalité de livraison. **À attaquer en premier.**
2. **§2.1** — « valide chaque release » (→ valide les livrables/règles) et « défense finale en juin » (→ dépôt 17 août, défense septembre).
3. **Backlog** — EPIC 06 en « Done » (vestige v1, contredit §11.1) ; conflit UC-15 (export mensuel dans le backlog vs gestion des stocks au §11.4).
4. **Gel** — substituer la date du **12/08** au « date exacte à compléter » (le §5.5 la cite désormais).
5. **Figure 3 (Gantt)** — à refaire : trois paliers, légende sans « releases ». Chantier d'Hippolyte.
6. **§5.5** — vérifier « dont / ainsi que » sur la ligature œ en ouvrant `arbitrages_techniques.md` (dit fait en local).
7. **Intégration** — basculer §5.2, §5.5, §5.6, §5.7, §11.1 réécrits dans le `.docx` ; insérer `figure_charge_5-6` en §5.6.

**⚠️ Garde-fou (ne PAS purger) :** les mentions d'annulation **à temps / veille / jour-même** dans les chapitres 1 à 4 ne sont pas des vestiges — c'est la **règle métier réelle à trois niveaux** (l'objectif). Le socle en tient deux, et le §11.1 réconcilie déjà objectif↔livré. Les toucher casserait cette cohérence.

---

## Structure du dépôt (impact de la session)
```
/ (racine)
├── figure_charge_5-6.png        ← NOUVEAU (à insérer §5.6)
├── figure_charge_5-6.svg        ← NOUVEAU (version vectorielle)
├── TFE_Rapport_final.docx       ← MODIFIÉ en local (ch.5, §11.1, §11.3) — à re-uploader
├── gel_decisions_2026-08-12.md  ← à MODIFIER (date SMS 12/08)
├── backlog_user_stories.md      ← à MODIFIER (EPIC 06, UC-15)
└── docs/sessions/session_19.md  ← NOUVEAU (ce rapport)
```
*(Aucun code applicatif touché : les 163 tests d'intégration restent l'état de référence.)*

---

## Instructions pour reprendre (Session 20)

1. **Re-uploader le `.docx` à jour** — l'upload de fin de S19 n'a pas abouti ; sans lui, impossible de vérifier l'intégration réelle.
2. **Relancer le balayage v1 sur le fichier local** :
   ```
   grep -niE 'release|\bjuin\b|jest|playwright|prisma 5|32 tests|mots de passe' TON_FICHIER
   ```
3. **Attaquer le tableau UC du chapitre 4** (point 1 ci-dessus) — c'est le vestige fondateur, tout en découle.
4. Puis **§2.1**, puis le **backlog** et le **gel** (rapides).
5. Se rappeler la frontière : §5.2 = stratégie, §11 = bilan ; §5.7 = risques projet, ch.9 = sécurité détaillée, §11.3 = résiduels du livré. Ne pas re-dupliquer.

**Vérification rapide de l'état :** ch.5 clôturé (7 sous-sections), §11.1/§11.3 corrigés, chapitre 4 UC table = prochain chantier.

---

*Rapport mis à jour le 15 août 2026 — Session 19*
