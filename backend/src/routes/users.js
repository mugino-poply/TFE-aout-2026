import { Router } from "express";
import prisma from "../lib/prisma.js";

const router = Router();

router.get("/", async (req, res) => {
  const users = await prisma.utilisateur.findMany({
    where: { actif: true },
    select: {
      id_utilisateur: true,
      prenom: true,
      role: true,
    },
  });
  res.json(users);
});

export default router;