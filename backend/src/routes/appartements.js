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

appartementsRouter.post("/:numero/changement", requireRole(["secretaire"]), async (req, res) => {
  const numero = Number(req.params.numero);
  if (!Number.isInteger(numero) || numero <= 0) {
    return res.status(400).json({ error: "numero d'appartement invalide" });
  }

  const { id_resident_sortant, prenom, nom } = req.body;
  if (!Number.isInteger(id_resident_sortant)) {
    return res.status(400).json({ error: "id_resident_sortant invalide" });
  }
 
  try {
    const entrant = await prisma.$transaction(async (tx) => {
      const apparts = await tx.$queryRaw`
        SELECT id_appartement FROM "Appartement" WHERE numero = ${numero} FOR UPDATE
      `;
      if (apparts.length === 0) {
        throw Object.assign(new Error("appartement introuvable"), { status: 404 });
      }
      const appartId = Number(apparts[0].id_appartement);
 
      const sortant = await tx.resident.findUnique({
        where: { id_resident: id_resident_sortant },
      });
      if (sortant === null || sortant.id_appartement !== appartId) {
        throw Object.assign(new Error("sortant introuvable dans cet appartement"), {
          status: 404,
        });
      }
 
      if (sortant.actif === false) {
        throw Object.assign(new Error("le sortant est deja inactif"), { status: 409 });
      }
 
      await tx.resident.update({
        where: { id_resident: id_resident_sortant },
        data: { actif: false, date_sortie: new Date() },
      });
 
      return tx.resident.create({
        data: {
          id_appartement: appartId,
          prenom,
          nom,
          actif: true,
          date_entree: new Date(),
        },
      });
    });
 
    return res.status(201).json(entrant);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(500).json({ error: "erreur interne" });
  }
});

export default appartementsRouter;