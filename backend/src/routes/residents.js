import { Router } from "express";
import { authenticateToken, requireRole } from "../middlewares/auth.js";
import prisma from "../lib/prisma.js";

const residentsRouter = Router();

// Router-level
residentsRouter.use(authenticateToken);

residentsRouter.post("/", requireRole(["secretaire"]), async (req, res) => {
  const { prenom, nom, numero_appartement, date_entree } = req.body;

  // Tous les champs requis doivent être présents
  if (!prenom || !nom || !numero_appartement || !date_entree) {
    return res.status(400).json({ error: "Champs obligatoires manquants" });
  }

  // Existence : l'appart désigné par le numéro métier existe-t-il ?
  const appart = await prisma.appartement.findUnique({
    where: { numero: numero_appartement },
  });
  if (appart === null) {
    return res.status(404).json({ error: "Appartement introuvable" });
  }

  // Création : le payload parle métier (numero_appartement),
  // le connect parle relation (numero @unique côté schéma)
  const resident = await prisma.resident.create({
    data: {
      prenom,
      nom,
      date_entree: new Date(date_entree),
      appartement: { connect: { numero: numero_appartement } },
    },
    select: {
      id_resident: true,
      prenom: true,
      nom: true,
      date_entree: true,
    },
  });

  return res.status(201).json(resident);

});

export default residentsRouter;