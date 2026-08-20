-- Aligne la colonne sur la description Prisma du modele Allergie.
--
-- libelle_normalise est NOT NULL et remplie par un declencheur avant chaque
-- insertion. Pour PostgreSQL un declencheur n'est pas une valeur par defaut :
-- la colonne apparaissait donc sans defaut cote base, alors que Prisma la
-- declare avec @default(dbgenerated()). Cet ecart faisait echouer toute
-- ecriture depuis le client, qui exigeait la valeur.
--
-- La chaine vide posee ici n'est jamais conservee : le declencheur s'execute
-- avant l'insertion et ecrase systematiquement la valeur par le libelle
-- normalise. Elle n'existe que pour rendre la colonne facultative cote client
-- et supprimer la derive entre le schema et la base.
ALTER TABLE "public"."Allergie"
  ALTER COLUMN "libelle_normalise" SET DEFAULT '';
