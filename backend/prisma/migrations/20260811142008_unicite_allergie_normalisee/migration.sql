-- AT-02 : unicité d'une allergie par résident sur forme normalisée (US-13, rétroactif).
-- Voir registre AT-02. Une seule règle de normalisation vit en base (normalise_libelle),
-- appelée par le remplissage, la détection de doublons et le déclencheur : une définition,
-- trois appelants.

-- 1. La règle, une fois. IMMUTABLE (ne dépend que de son entrée), donc légale en trigger.
--    Ordre : lower d'abord (une seule casse à cibler), translate pour les accents simples
--    (1 pour 1), replace pour la ligature oe (1 vers 2, hors de portee de translate).
--    Collapse exactement casse + accents francais + oe, et rien de plus (ni ae-lie, ni eszett).
CREATE OR REPLACE FUNCTION normalise_libelle(txt text)
RETURNS text AS $$
  SELECT replace(
    translate(lower(txt), 'àâäéèêëîïôöùûüÿç', 'aaaeeeeiioouuuyc'),
    'œ', 'oe'
  );
$$ LANGUAGE sql IMMUTABLE;

-- 2. Colonne de forme normalisee, d'abord facultative pour pouvoir remplir l'existant.
ALTER TABLE "Allergie" ADD COLUMN "libelle_normalise" text;

-- 3. Remplir l'existant via la meme fonction.
UPDATE "Allergie" SET "libelle_normalise" = normalise_libelle("libelle");

-- 4. Doublons preexistants : echouer avec un rapport plutot que supprimer en silence.
--    Sur donnee de sante, aucune allergie effacee automatiquement. La detection utilise
--    la meme fonction que la contrainte, donc pas de divergence interne a la migration.
DO $$
DECLARE
  doublons text;
BEGIN
  SELECT string_agg(format('resident %s, forme "%s" (x%s)', id_resident, libelle_normalise, n), '; ')
    INTO doublons
  FROM (
    SELECT id_resident, libelle_normalise, count(*) AS n
    FROM "Allergie"
    GROUP BY id_resident, libelle_normalise
    HAVING count(*) > 1
  ) d;
  IF doublons IS NOT NULL THEN
    RAISE EXCEPTION 'Doublons d''allergie preexistants, a resoudre a la main avant migration : %', doublons;
  END IF;
END $$;

-- 5. La colonne devient obligatoire une fois l'existant rempli et deduplique.
ALTER TABLE "Allergie" ALTER COLUMN "libelle_normalise" SET NOT NULL;

-- 6. Contrainte d'unicite sur le couple resident + forme normalisee.
ALTER TABLE "Allergie"
  ADD CONSTRAINT "allergie_resident_libelle_normalise_unique"
  UNIQUE ("id_resident", "libelle_normalise");

-- 7. Declencheur : la base recalcule la forme normalisee a chaque ecriture (insertion ET
--    modification), incontournable quel que soit le chemin. Ecrase toute valeur fournie.
CREATE OR REPLACE FUNCTION allergie_set_libelle_normalise()
RETURNS trigger AS $$
BEGIN
  NEW.libelle_normalise := normalise_libelle(NEW.libelle);
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER allergie_libelle_normalise_trg
  BEFORE INSERT OR UPDATE ON "Allergie"
  FOR EACH ROW
  EXECUTE FUNCTION allergie_set_libelle_normalise();