# Session 1 — Le Cénacle (TFE)

- **Auteur :** Hippolyte AMORY
- **Date :** 9 juin 2026
- **Échéances :** remise du rapport le 17 août 2026 ; livraison du produit dans les deux semaines suivantes (date de défense non encore fixée).
- **Objet de la session :** cadrage du projet repris de 0, plan d'action, et **conception + verrouillage du schéma de données**.

---

## Contexte et état de départ

Projet repris **de 0** sur un repo neuf, dans le but de maîtriser et défendre chaque décision (et non de récupérer l'ancien projet). Le `backlog_user_stories.md` décrit le projet antérieur à un stade avancé : ici, **aucun de ses statuts « Done » n'est repris** — le backlog sert de **spécification cible**, pas d'état d'avancement.

---

## 1. Décisions de cadrage

**1.1 — Plan d'action en 8 phases** (`plan_daction.md`) : Phase 0 fondations + schéma · 1 auth · 2 référentiel résidents · 3 cœur commandes · 4 sortie & temps réel · 5 module boissons · 6 admin & finitions · 7 infra & déploiement. Engagements transversaux : Git dès le début (commits réguliers, jamais un seul gros commit la veille), tests écrits au fil des features (pas une phase reléguée), Docker dès la Phase 0.

**1.2 — Fusion des US d'adaptation.** En repartant propre, on construit directement la cible : US-34/35/36/37 (adaptations de l'ancien projet) fusionnent avec leurs US de base. *Pourquoi :* ces US n'existaient que parce que la v1 avait été construite puis corrigée. À valoriser au jury comme maturité d'analyse.

**1.3 — Infra VPS rejouée de 0.** La configuration (durcissement SSH, UFW, fail2ban, WireGuard) est **rejouée étape par étape**, avec `session_vpn.md` comme guide de *compréhension* (pas de copier-coller). Le VPS physique peut être conservé. **Régénération obligatoire des paires de clés WireGuard** : les clés publiques de l'ancien projet ont été exposées en clair dans le backlog → une clé exposée doit être révoquée même si personne ne l'a utilisée.

---

## 2. Décisions de conception du schéma — les 3 principes (cœur de la session)

Ces trois principes sont la colonne vertébrale de la défense du modèle de données.

**2.1 — FK vers une donnée IMMUABLE → la clé étrangère suffit.**
`LigneCommande` pointe vers `OptionMenu` par simple FK, sans rien copier. *Pourquoi c'est sûr :* une `OptionMenu` est immuable **par construction** — `Menu.date_menu` est `@unique`, donc une option par date, jamais partagée ni recyclée d'un jour à l'autre. La valeur ne peut pas changer « sous » la commande. La justification défendable est une **propriété du modèle**, pas une promesse de comportement.

**2.2 — FK vers une donnée MUTABLE → on fige (snapshot).**
`Boisson` copie `prix_unitaire` **et** `libelle` depuis `BoissonCatalogue` au moment de l'encodage. *Pourquoi :* le `prix` du catalogue est modifiable par l'admin (US-31, `PATCH .../prix`). Sans snapshot, une facture passée relue via la FK deviendrait fausse au prochain changement de prix. C'est une **dénormalisation volontaire et justifiée** (pas un oubli de normalisation). Terme à employer dans le rapport : *snapshot*.

**2.3 — Une donnée figée se relit TOUJOURS depuis le figé, jamais depuis la source.**
À la création : on lit le catalogue et on remplit `prix_unitaire` + `libelle`. Partout ensuite — addition en cours du serveur **comme** facturation mensuelle — on relit ces champs figés, jamais la FK/le catalogue. *Pourquoi :* relire le catalogue « parce que c'est la même valeur » crée une incohérence latente qui se révèle le jour où un prix change en cours de service. Ce design garantit la cohérence **indépendamment** du comportement de l'admin.

**Principe transversal (méta, critique pour le jury) :** un bon design garantit une propriété **sans dépendre de ce que font les utilisateurs**. Toute justification qui commence par « les gens ne feront pas X » s'appuie sur une convention, pas sur le modèle — c'est un signal d'alerte. Préférer systématiquement « le système garantit X ».

---

## 3. Décisions du module boissons (service)

**3.1 — Pas de table `Service`.** Un simple `service_id` (UUID, **nullable**) sur `Boisson`, généré côté **frontend**. *Pourquoi :* le besoin réel est de **regrouper** les consos d'une séance en additions — pas de raisonner sur le service comme objet daté/clôturable. Une table `Service` serait de la sur-ingénierie au regard du besoin.

**3.2 — Mécanique des boutons (pure gestion frontend).** « Commencer le service » → génère un nouvel UUID actif. « Clôturer le service » → `service_id` repasse à `NULL`. **Aucun acte serveur**, aucun enregistrement de clôture en base.

**3.3 — Endpoint `POST /services/cloturer` SUPPRIMÉ.** US-33 amendée : la clôture étant un pur geste frontend, l'endpoint n'a rien à faire et n'existe pas.

**3.4 — « Hors service » n'est plus un cas métier distinct.** US-49 dans sa formulation d'origine n'a plus d'objet. Une conso encodée hors d'un service ouvert est une **conso normale** avec `service_id = NULL`. Le `NULL` est ici un **état voulu et lisible** (« encodé alors qu'aucun service n'était ouvert »), rendu non ambigu par le bouton explicite « commencer le service ».

**3.5 — Règle de facturation (à ne jamais confondre avec le regroupement).** Le `service_id` sert **uniquement** au regroupement des additions du serveur en séance. La **facturation mensuelle (US-19) ignore totalement `service_id`** et additionne **toutes** les consos d'un appartement, lignes `NULL` comprises. *Risque à éviter :* filtrer la facture sur « `service_id` renseigné » ferait disparaître silencieusement les consos hors service → bug de facturation invisible.

---

## 4. Décisions issues de l'audit du `schema.prisma`

**4.1 — Un seul enum de catégorie.** Les deux enums `CategorieOption` et `CategorieRepas`, devenus identiques, sont fusionnés en `CategorieOption`. Le champ `LigneCommande.categorie` est **retiré** : il est dérivable de `option.categorie`, et comme l'`OptionMenu` est immuable (principe 2.1), copier une donnée immuable est exactement ce qu'il ne faut pas faire. *Compromis assumé :* pour grouper par emplacement dans un export, on fait une jointure vers `option.categorie` au lieu de lire un champ local — une jointure contre zéro duplication.

**4.2 — `TypeRepas` = `petit_dejeuner` / `diner` / `souper`.** Choix de `diner` (et non `dejeuner`) : usage belge (dîner = midi, souper = soir). Backlog mis à jour. **À vérifier :** que le **rapport** dit « dîner » partout (source de vérité métier).

**4.3 — Intégrité commande ↔ menu : validation applicative ASSUMÉE.** Rien dans le schéma n'empêche structurellement une `LigneCommande` de pointer vers une `OptionMenu` d'un autre jour que `commande.date_repas`. Cette cohérence est garantie par une **validation au moment du `POST`**, pas par le modèle. *Choix défendable, à présenter comme tel.* Alternative écartée : une **FK composite à colonne `id_menu` partagée** (relationnelle, déclarative, possible sous Prisma) — écartée car elle alourdit le schéma (dénormalisation de `id_menu` à deux endroits, deux FK composites) pour une garantie déjà couverte par la validation à l'encodage. **Ne pas dire au jury « le seul renforcement possible serait un trigger »** : la voie composite existe, on l'a écartée sciemment.

**4.4 — `LogAccesAllergie` RETIRÉ.** Ce n'était pas un stockage d'allergies mais un **journal de consultation** (qui consulte les données de santé, et quand). Décision à porter dans l'**analyse de sécurité** (exigence EPHEC) comme **risque résiduel assumé** : allergies = données de santé (catégorie particulière RGPD) ; accès en consultation restreint par RBAC (cuisine/secrétaire) ; traçabilité en **écriture** assurée par `created_by` sur `Allergie` ; **pas** de journal de consultation car le périmètre d'accès et le volume ne le justifient pas → risque documenté et accepté.

**4.5 — Points secondaires assumés.** `Boisson.date_service` vs `created_at` : distinction voulue (date métier de consommation vs date technique d'insertion) ; **la facturation filtre sur `date_service`** → s'assurer qu'elle est toujours fiable et jamais confondue avec `created_at`. `Appartement` : `id_appartement` autoincrement + `numero` unique séparé (PK technique distincte du numéro métier).

**4.6 — Détail mineur non tranché (non bloquant).** L'enum s'appelle `Role` au lieu de `RoleUtilisateur` (convention projet). Sans impact fonctionnel ; à harmoniser ou non au choix.

---

## Concepts acquis cette session

- Distinguer FK nue (donnée immuable) vs snapshot (donnée mutable), et savoir *pourquoi* dans chaque cas.
- « Propriété garantie par le modèle » ≠ « convention de comportement » — et pourquoi le jury creuse la première.
- Trancher d'abord le **besoin métier**, le mécanisme en découle (et non l'inverse).
- Réinterroger une spec héritée fait tomber de la sur-spécification (table `Service`, endpoint de clôture, « hors service »).

## À consolider

- Réflexe de ne pas basculer de conclusion sous la dernière objection entendue : instruire les options jusqu'au bout avant de trancher.
- Réflexe de ne pas justifier un choix par « normalement les gens ne font pas… ».

---

## Exigences EPHEC progressées

- **Schémas techniques** : modèle de données (entité-association / relationnel / classes) — verrouillé côté `schema.prisma`, figures du rapport encore à aligner.
- **Analyse de sécurité** : amorce d'un risque résiduel documenté (traçabilité des accès aux allergies, cf. 4.4) + clés WireGuard à régénérer (cf. 1.3).

## État actuel

- Repo initié. **Phase 0 en cours.**
- `schema.prisma` : **verrouillé et défendable** (chaque table, FK, snapshot et non-snapshot justifié, commentaires en attestent).
- Aucune route ni feature codée à ce stade.

---

## Reste à faire — prochaine session

1. **Commit du schéma** s'il ne l'est pas encore (commit dédié : « schéma : fusion catégories, retrait log accès, snapshot boissons »).
2. **Aligner les figures du rapport** sur le schéma verrouillé (schéma EA + relationnel + classes UML, cohérents entre eux). Grille de confrontation : liste US-60 (ajout `BoissonCatalogue` ; `Boisson` enum→FK + `service_id` + `quantite` ; `prenom`/`code_pin` sur `Utilisateur` ; `en_appartement`/`type_client`/`note_invite`/`remarque`/`annule_le` sur `Commande` ; suppression champs livraison) **+** ajouts de la session (`prix_unitaire` + `libelle` sur `Boisson` ; retrait de `LigneCommande.categorie` ; un seul enum catégorie ; `diner`). NB : figures = images dans le `.docx`, à confronter manuellement ou exporter en PNG pour relecture.
3. Poursuivre la Phase 0 (Docker dev, init Prisma, connexion PostgreSQL), puis Phase 1 (authentification) selon `plan_daction.md`.

## Pour reprendre dans une autre conversation

- Verser ce fichier (et `plan_daction.md`, `schema.prisma`) au contexte.
- Le `schema.prisma` est la **référence** : toute figure ou tout code en hérite.
- Posture de travail : socratique, mentor exigeant ; l'objectif est la défendabilité, pas la livraison rapide du code.

---

*Rapport mis à jour le 9 juin 2026 — Session 1*
