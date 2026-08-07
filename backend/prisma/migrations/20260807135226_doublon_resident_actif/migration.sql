CREATE UNIQUE INDEX commande_resident_actif_unique
ON "Commande" (id_resident, date_repas, type_repas)
WHERE type_client = 'resident' AND statut = 'active';