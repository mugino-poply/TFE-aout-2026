import express from "express";
import prisma from "../lib/prisma.js";
import { authenticateToken, requireRole } from "../middlewares/auth.js";

// routeur imbriqué sous /api/residents/:id/allergies
// mergeParams sinon je perds le req.params.id du résident
const allergiesRouter = express.Router({ mergeParams: true });

// pas de token = 401 direct ici, pas un 404 random
allergiesRouter.use(authenticateToken);

allergiesRouter.use(requireRole(["secretaire", "admin"]));

allergiesRouter.post("/", async (req, res) => {
  const { libelle, type } = req.body;

    // garde de forme : libelle obligatoire
  if (!libelle) {
    return res.status(400).json({ error: "Champs obligatoires manquants" });
  }

  const idResident = Number(req.params.id);
  const resident = await prisma.resident.findUnique({
    where: { id_resident: idResident },
  });
  if (!resident) {
    return res.status(404).json({ error: "Résident introuvable" });
  }

  // created_by passe par le connect sur utilisateur (relation, pas un scalaire direct)
  // req.user.userId vient du token décodé par authenticateToken
  // req.params.id = le résident dans l'URL, dispo grâce au mergeParams
  const allergie = await prisma.allergie.create({
    data: {
      libelle,
      type,
      resident: { connect: { id_resident: idResident } },
      utilisateur: { connect: { id_utilisateur: req.user.userId } },
    },
  });

  res.status(201).json(allergie);
});

export default allergiesRouter;