import { Router } from "express";
import { authenticateToken, requireRole } from "../middlewares/auth.js";
import { TypeClient, TypeRepas } from "@prisma/client";
import prisma from "../lib/prisma.js";

const commandesRouter = Router();
const normalise = (s) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/œ/g, "oe");

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

  const resident = await prisma.resident.findFirst({ 
    where: { id_resident, actif: true },
    select: {
      id_resident: true,
      // libelle brut re-normalisé en JS. Va pas lire libelle_normalise
      // (colonne SQL, contrainte AT-02), sinon SQL et JS doivent coïncider. Séparées exprès
      allergies: { select: { libelle: true, type: true } },
    },
  });
  if (!resident) {
    return res.status(404).json({ error: "Résident introuvable" });
  }

  const options = await prisma.optionMenu.findMany({
    where: { id_option: { in: lignes } },
    select: {
      id_option: true,
      id_menu: true,
      libelle: true,
      contient_allergenes: true,
      menu: { select: { date_menu: true } },
    },
  });
  if (options.length !== lignes.length) {
    return res.status(404).json({ error: "Option(s) introuvable(s)" });
  }

  const menusDistincts = new Set(options.map((o) => o.id_menu));
  if (menusDistincts.size !== 1) {
    return res.status(400).json({ error: "Options de menus différents" });
  }

  const dateRepas = options[0].menu.date_menu;
  const allergies_detectees = [];
  for (const option of options) {
    const nom = normalise(option.libelle);
    const declare = option.contient_allergenes ? normalise(option.contient_allergenes) : "";
    for (const allergie of resident.allergies) {
      const cible = normalise(allergie.libelle);
      if (nom.includes(cible) || declare.includes(cible)) {
        allergies_detectees.push({
          libelle: allergie.libelle,
          type: allergie.type,
          option_concernee: option.libelle,
        });
      }
    }
  }

  try{
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
      select: {
        id_commande: true,
        id_resident: true,
        date_repas: true,
        type_repas: true,
        statut: true,
        type_client: true,
        en_appartement: true,
        note_invite: true,
        remarque: true,
        lignes: {
          select: { option: { select: { id_option: true, libelle: true, categorie: true } } },
        },
      },
    });

    const optionParId = new Map(commande.lignes.map((l) => [l.option.id_option, l.option]));
    const lignesOrdonnees = lignes.map((id) => optionParId.get(id));
    return res.status(201).json({ ...commande, lignes: lignesOrdonnees, allergies_detectees });  } catch (e) {
    if (e.code === "P2002") {
      return res.status(409).json({ error: "Commande déjà existante" });
    }
    throw e;
  }
});


export default commandesRouter;