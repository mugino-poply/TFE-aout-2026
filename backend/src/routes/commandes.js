import { Router } from "express";
import { authenticateToken, requireRole } from "../middlewares/auth.js";
import { TypeClient, TypeRepas } from "@prisma/client";
import prisma from "../lib/prisma.js";

const commandesRouter = Router();

commandesRouter.use(authenticateToken);
commandesRouter.use(requireRole(["secretaire"]));

commandesRouter.post("/", async (req, res) => {
  const { id_resident, type_repas, lignes, type_client } = req.body;

  if (!id_resident || !type_repas || !lignes) {
    return res.status(400).json({ error: "Champs obligatoires manquants" });
  }

  if (!Number.isInteger(id_resident)) {
    return res.status(400).json({ error: "Identifiant de résident invalide" });
  }

  if (type_client !== undefined && !Object.values(TypeClient).includes(type_client)) {
    return res.status(400).json({ error: "Type de client invalide" });
  }

  if (!Object.values(TypeRepas).includes(type_repas)) {
    return res.status(400).json({ error: "Type de repas invalide" });
  }

  if (!Array.isArray(lignes)) {
    return res.status(400).json({ error: "Lignes invalides" });
  }

  if (lignes.length === 0) {
    return res.status(400).json({ error: "Lignes vides" });
  }

  if (!lignes.every((id) => Number.isInteger(id))) {
    return res.status(400).json({ error: "Identifiant d'option invalide" });
  }

  if (new Set(lignes).size !== lignes.length) {
    return res.status(400).json({ error: "Lignes en double" });
  }

  const resident = await prisma.resident.findFirst({ where: { id_resident, actif: true } });
  if (!resident) {
    return res.status(404).json({ error: "Résident introuvable" });
  }

  const options = await prisma.optionMenu.findMany({
    where: { id_option: { in: lignes } },
    select: { id_option: true, id_menu: true, menu: { select: { date_menu: true } } },
  });
  if (options.length !== lignes.length) {
    return res.status(404).json({ error: "Option(s) introuvable(s)" });
  }

  const menusDistincts = new Set(options.map((o) => o.id_menu));
  if (menusDistincts.size !== 1) {
    return res.status(400).json({ error: "Options de menus différents" });
  }

  const dateRepas = options[0].menu.date_menu;

  const commande = await prisma.commande.create({
    data: {
      type_repas,
      date_repas: dateRepas,
      resident: { connect: { id_resident } },
      utilisateur: { connect: { id_utilisateur: req.user.userId } },
      lignes: {
        create: lignes.map((id_option) => ({
          option: { connect: { id_option } },
        })),
      },
    },
    select: { id_commande: true },
  });

  return res.status(201).json({ id_commande: commande.id_commande });
});

export default commandesRouter;