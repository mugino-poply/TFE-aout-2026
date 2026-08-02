import express from "express";
import prisma from "../lib/prisma.js";
import { authenticateToken } from "../middlewares/auth.js";

// routeur imbriqué sous /api/residents/:id/allergies
// mergeParams sinon je perds le req.params.id du résident
const router = express.Router({ mergeParams: true });

// pas de token = 401 direct ici, pas un 404 random
router.use(authenticateToken);

router.post("/", async (req, res) => {
  const { libelle, type } = req.body;

  // created_by passe par le connect sur utilisateur (relation, pas un scalaire direct)
  // req.user.userId vient du token décodé par authenticateToken
  // req.params.id = le résident dans l'URL, dispo grâce au mergeParams
  const allergie = await prisma.allergie.create({
    data: {
      libelle,
      type,
      resident: { connect: { id_resident: Number(req.params.id) } },
      utilisateur: { connect: { id_utilisateur: req.user.userId } },
    },
  });

  res.status(201).json(allergie);
});

export default router;