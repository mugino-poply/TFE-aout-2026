-- CreateEnum
CREATE TYPE "Role" AS ENUM ('secretaire', 'cuisine', 'serveur', 'admin');

-- CreateEnum
CREATE TYPE "TypeRepas" AS ENUM ('petit_dejeuner', 'diner', 'souper');

-- CreateEnum
CREATE TYPE "StatutCommande" AS ENUM ('active', 'annulee_temps', 'annulee_retard');

-- CreateEnum
CREATE TYPE "TypeAllergie" AS ENUM ('allergie', 'intolerance', 'regime');

-- CreateEnum
CREATE TYPE "CategorieOption" AS ENUM ('entree', 'plat', 'plat_substitution', 'dessert', 'fruits', 'yaourt', 'soupe', 'soupe_dessert', 'repas_complet', 'plat_dessert', 'plat_seul');

-- CreateEnum
CREATE TYPE "TypeClient" AS ENUM ('resident', 'invite_externe', 'invite_resident');

-- CreateTable
CREATE TABLE "Appartement" (
    "id_appartement" SERIAL NOT NULL,
    "numero" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Appartement_pkey" PRIMARY KEY ("id_appartement")
);

-- CreateTable
CREATE TABLE "Resident" (
    "id_resident" SERIAL NOT NULL,
    "id_appartement" INTEGER NOT NULL,
    "prenom" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "date_entree" TIMESTAMP(3) NOT NULL,
    "date_sortie" TIMESTAMP(3),
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Resident_pkey" PRIMARY KEY ("id_resident")
);

-- CreateTable
CREATE TABLE "Allergie" (
    "id_allergie" SERIAL NOT NULL,
    "id_resident" INTEGER NOT NULL,
    "libelle" TEXT NOT NULL,
    "type" "TypeAllergie" NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER NOT NULL,

    CONSTRAINT "Allergie_pkey" PRIMARY KEY ("id_allergie")
);

-- CreateTable
CREATE TABLE "Menu" (
    "id_menu" SERIAL NOT NULL,
    "date_menu" TIMESTAMP(3) NOT NULL,
    "semaine" INTEGER NOT NULL,
    "annee" INTEGER NOT NULL,

    CONSTRAINT "Menu_pkey" PRIMARY KEY ("id_menu")
);

-- CreateTable
CREATE TABLE "OptionMenu" (
    "id_option" SERIAL NOT NULL,
    "id_menu" INTEGER NOT NULL,
    "categorie" "CategorieOption" NOT NULL,
    "libelle" TEXT NOT NULL,
    "contient_allergenes" TEXT,

    CONSTRAINT "OptionMenu_pkey" PRIMARY KEY ("id_option")
);

-- CreateTable
CREATE TABLE "Commande" (
    "id_commande" SERIAL NOT NULL,
    "id_resident" INTEGER NOT NULL,
    "date_repas" TIMESTAMP(3) NOT NULL,
    "type_repas" "TypeRepas" NOT NULL,
    "statut" "StatutCommande" NOT NULL DEFAULT 'active',
    "en_appartement" BOOLEAN NOT NULL DEFAULT false,
    "remarque" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" INTEGER NOT NULL,
    "annule_le" TIMESTAMP(3),
    "type_client" "TypeClient" NOT NULL DEFAULT 'resident',
    "note_invite" TEXT,

    CONSTRAINT "Commande_pkey" PRIMARY KEY ("id_commande")
);

-- CreateTable
CREATE TABLE "LigneCommande" (
    "id_ligne" SERIAL NOT NULL,
    "id_commande" INTEGER NOT NULL,
    "id_option" INTEGER NOT NULL,

    CONSTRAINT "LigneCommande_pkey" PRIMARY KEY ("id_ligne")
);

-- CreateTable
CREATE TABLE "BoissonCatalogue" (
    "id_boisson_catalogue" SERIAL NOT NULL,
    "categorie" TEXT NOT NULL,
    "sous_categorie" TEXT,
    "variante" TEXT,
    "format" TEXT,
    "libelle" TEXT NOT NULL,
    "prix" DECIMAL(6,2) NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoissonCatalogue_pkey" PRIMARY KEY ("id_boisson_catalogue")
);

-- CreateTable
CREATE TABLE "Boisson" (
    "id_boisson" SERIAL NOT NULL,
    "id_resident" INTEGER NOT NULL,
    "date_service" TIMESTAMP(3) NOT NULL,
    "id_boisson_catalogue" INTEGER NOT NULL,
    "prix_unitaire" DECIMAL(6,2) NOT NULL,
    "libelle" TEXT NOT NULL,
    "service_id" UUID,
    "quantite" INTEGER NOT NULL DEFAULT 1,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Boisson_pkey" PRIMARY KEY ("id_boisson")
);

-- CreateTable
CREATE TABLE "Utilisateur" (
    "id_utilisateur" SERIAL NOT NULL,
    "login" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "code_pin" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login" TIMESTAMP(3),

    CONSTRAINT "Utilisateur_pkey" PRIMARY KEY ("id_utilisateur")
);

-- CreateIndex
CREATE UNIQUE INDEX "Appartement_numero_key" ON "Appartement"("numero");

-- CreateIndex
CREATE INDEX "Resident_id_appartement_actif_idx" ON "Resident"("id_appartement", "actif");

-- CreateIndex
CREATE INDEX "Allergie_id_resident_idx" ON "Allergie"("id_resident");

-- CreateIndex
CREATE UNIQUE INDEX "Menu_date_menu_key" ON "Menu"("date_menu");

-- CreateIndex
CREATE INDEX "Commande_date_repas_type_repas_idx" ON "Commande"("date_repas", "type_repas");

-- CreateIndex
CREATE INDEX "Commande_id_resident_date_repas_idx" ON "Commande"("id_resident", "date_repas");

-- CreateIndex
CREATE INDEX "BoissonCatalogue_categorie_sous_categorie_variante_format_idx" ON "BoissonCatalogue"("categorie", "sous_categorie", "variante", "format");

-- CreateIndex
CREATE INDEX "Boisson_date_service_id_resident_idx" ON "Boisson"("date_service", "id_resident");

-- CreateIndex
CREATE UNIQUE INDEX "Utilisateur_login_key" ON "Utilisateur"("login");

-- AddForeignKey
ALTER TABLE "Resident" ADD CONSTRAINT "Resident_id_appartement_fkey" FOREIGN KEY ("id_appartement") REFERENCES "Appartement"("id_appartement") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allergie" ADD CONSTRAINT "Allergie_id_resident_fkey" FOREIGN KEY ("id_resident") REFERENCES "Resident"("id_resident") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allergie" ADD CONSTRAINT "Allergie_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "Utilisateur"("id_utilisateur") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionMenu" ADD CONSTRAINT "OptionMenu_id_menu_fkey" FOREIGN KEY ("id_menu") REFERENCES "Menu"("id_menu") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commande" ADD CONSTRAINT "Commande_id_resident_fkey" FOREIGN KEY ("id_resident") REFERENCES "Resident"("id_resident") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commande" ADD CONSTRAINT "Commande_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "Utilisateur"("id_utilisateur") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneCommande" ADD CONSTRAINT "LigneCommande_id_commande_fkey" FOREIGN KEY ("id_commande") REFERENCES "Commande"("id_commande") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneCommande" ADD CONSTRAINT "LigneCommande_id_option_fkey" FOREIGN KEY ("id_option") REFERENCES "OptionMenu"("id_option") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Boisson" ADD CONSTRAINT "Boisson_id_resident_fkey" FOREIGN KEY ("id_resident") REFERENCES "Resident"("id_resident") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Boisson" ADD CONSTRAINT "Boisson_id_boisson_catalogue_fkey" FOREIGN KEY ("id_boisson_catalogue") REFERENCES "BoissonCatalogue"("id_boisson_catalogue") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Boisson" ADD CONSTRAINT "Boisson_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "Utilisateur"("id_utilisateur") ON DELETE RESTRICT ON UPDATE CASCADE;
