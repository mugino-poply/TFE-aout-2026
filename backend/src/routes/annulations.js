import { Router } from "express";
import { authenticateToken, requireRole } from "../middlewares/auth.js";
import prisma from "../lib/prisma.js";
import { compterJours, classerAnnulation } from "../domain/regles-annulations.js";

const annulationsRouter = Router();

annulationsRouter.use(authenticateToken);
annulationsRouter.use(requireRole(["secretaire"]));

annulationsRouter.patch("/:id/annuler", async (req, res) => {
  const id = Number(req.params.id);

  const commande = await prisma.commande.findUnique({
    where: { id_commande: id },
    select: { date_repas: true },
  });

  if (!commande) {
    return res.status(404).json({ error: "Commande introuvable" });
  }

  const now = new Date();
  const ecart = compterJours(now, commande.date_repas);
  const statut = classerAnnulation(ecart);

  const { count } = await prisma.commande.updateMany({
    where: { id_commande: id, statut: "active" },
    data: { statut, annule_le: now },
  });

  if (count === 0) {
    return res.status(409).json({ error: "Commande déjà annulée" });
  }

  res.status(200).json({ statut });
});

export default annulationsRouter;