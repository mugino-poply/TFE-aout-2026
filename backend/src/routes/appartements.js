import { Router } from "express";
import { authenticateToken, requireRole } from "../middlewares/auth.js";
import prisma from "../lib/prisma.js";

const appartementsRouter = Router();

appartementsRouter.use(authenticateToken);

appartementsRouter.get("/", async (req, res) => {
  const apparts = await prisma.appartement.findMany({
    orderBy: { numero: "asc" },
    select: {
      numero: true,
      residents: {
        where: { actif: true },
        select: {
          id_resident: true,
          prenom: true,
          nom: true,
        },
      },
    },
  });

  const response = apparts.map((a) => ({
    numero: a.numero,
    occupants: a.residents,
  }));

  res.status(200).json(response);
});

appartementsRouter.get("/:numero/residents", async (req, res) => {
  const numero = Number(req.params.numero);
  if (!Number.isInteger(numero) || numero <= 0) {
    return res.status(400).json({ error: "Numéro d'appartement invalide" });
  }

  const appart = await prisma.appartement.findUnique({
    where: { numero },
    select: {
      residents: {
        where: { actif: true },
        select: {
          id_resident: true,
          prenom: true,
          nom: true,
          allergies: {
            select: {
              libelle: true,
              type: true,
            },
          },
        },
      },
    },
  });

  if (appart === null) {
    return res.status(404).json({ error: "Appartement introuvable" });
  }

  const { residents: occupants } = appart;
  return res.status(200).json({ numero, occupants });
});

appartementsRouter.post("/:numero/changement", requireRole(["secretaire"]), (req, res) => {
  res.sendStatus(501);
});

export default appartementsRouter;