import express from "express";
import prisma from "../lib/prisma.js";
import { authenticateToken, requireRole } from "../middlewares/auth.js";
import { TypeAllergie } from "@prisma/client";

// routeur imbriqué sous /api/residents/:id/allergies
// mergeParams sinon je perds le req.params.id du résident
const allergiesRouter = express.Router({ mergeParams: true });

// pas de token = 401 direct ici, pas un 404 random
allergiesRouter.use(authenticateToken);

allergiesRouter.use(requireRole(["secretaire", "admin"]));

allergiesRouter.post("/", async (req, res) => {
  const { libelle, type, notes } = req.body;

  // chaque champ est validé au niveau où il est vraiment exposé
  // libelle : durci fort (typeof + trim), c'est sa seule garde, rien derrière le rattrape
  // type : juste présence ici, l'enum juste en dessous fait le sale boulot par liste blanche
  // notes : optionnel, donc je le valide seulement s'il est là, sinon un POST sans notes serait recalé à tort
  if (typeof libelle !== "string" || libelle.trim() === "" || !type) {
    return res.status(400).json({ error: "Champs obligatoires manquants" });
  }

  if (!Object.values(TypeAllergie).includes(type)) {
    return res.status(400).json({ error: "Type d'allergie invalide" });
  }

  if (notes !== undefined && typeof notes !== "string") {
    return res.status(400).json({ error: "Notes invalides" });
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
  let allergie;
  try {
    allergie = await prisma.allergie.create({
      data: {
        libelle,
        notes,
        type,
        resident: { connect: { id_resident: idResident } },
        utilisateur: { connect: { id_utilisateur: req.user.userId } },
      },
    });
  } catch (e) {
    if (e.code === "P2002") {
      return res.status(409).json({ error: "Cette allergie est déjà enregistrée pour ce résident" });
    }
    throw e;
  }

  res.status(201).json(allergie);
});

allergiesRouter.get("/", async (req, res) => {
  const idResident = Number(req.params.id);

  const resident = await prisma.resident.findUnique({
    where: { id_resident: idResident },
  });
  if (!resident) {
    return res.status(404).json({ error: "Résident introuvable" });
  }

  const allergies = await prisma.allergie.findMany({
    where: { id_resident: idResident },
    select: {
      id_allergie: true,
      libelle: true,
      type: true,
      notes: true,
      created_at: true,
    },
  });

  res.json({ id_resident: idResident, allergies });
});


// ownership volontairement pas implémentée : le requireRole global limite déjà le DELETE
// à secrétaire/admin, qui sont justement les rôles superviseurs qui la bypasseraient.
// aucun rôle réel ne peut la déclencher aujourd'hui, donc pas de code spéculatif.
// elle deviendra active (avec son cycle red/green) le jour où la création d'allergie
// s'ouvre à un rôle non superviseur
allergiesRouter.delete("/:id_allergie", async (req, res) => {
  const idResident = Number(req.params.id);
  const idAllergie = Number(req.params.id_allergie);

  if (!Number.isInteger(idResident)) {
    return res.status(400).json({ error: "Identifiant de résident invalide" });
  }
  if (!Number.isInteger(idAllergie)) {
    return res.status(400).json({ error: "Identifiant d'allergie invalide" });
  }

const allergie = await prisma.allergie.findUnique({
    where: { id_allergie: idAllergie },
    select: { id_resident: true },
  });

  // existence et appartenance donnent le même "introuvable" : du point de vue de l'URL,
  // absente ou rattachée à un autre résident, c'est pareil, elle est pas dans cette collection
  // (anti-énumération : je révèle pas qu'elle existe ailleurs, même logique que le 403)
  if (allergie === null || allergie.id_resident !== idResident) {
    return res.status(404).json({ error: "Allergie introuvable" });
  }

  await prisma.allergie.delete({
    where: { id_allergie: idAllergie },
  });

  res.sendStatus(204);
});

export default allergiesRouter;