import { Router } from "express";
import { authenticateToken, requireRole } from "../middlewares/auth.js";
import prisma from "../lib/prisma.js";

const residentsRouter = Router();

// Router-level
residentsRouter.use(authenticateToken);

residentsRouter.get("/", requireRole(["secretaire"]), async (req, res) => {
  // Flag d'affichage : égalité stricte à "1"
  // Tout sauf "1": défaut permissif = actifs seulement
  const tous = req.query.tous === "1";

  const residents = await prisma.resident.findMany({
    where: tous ? undefined : { actif: true },
    select: {
      id_resident: true,
      prenom: true,
      nom: true,
      actif: true,
      date_sortie: true,
    },
  });

  return res.status(200).json(residents);
});

residentsRouter.post("/", requireRole(["secretaire"]), async (req, res) => {

  const { prenom, nom, numero_appartement, date_entree } = req.body;

  // Forme : tous les champs requis sont présents
  if (!prenom || !nom || !numero_appartement || !date_entree) {
    return res.status(400).json({ error: "Champs obligatoires manquants" });
  }

  const result = await prisma.$transaction(async (tx) => {
    // Verrou : on sérialise l'accès à cet appartement le temps de décider.
    // FOR UPDATE bloque toute autre transaction qui vise la même ligne,
    // ce qui ferme la fenêtre TOCTOU entre le count et le create.
    const rows = await tx.$queryRaw`
      SELECT id_appartement FROM "Appartement"
      WHERE numero = ${numero_appartement}
      FOR UPDATE
    `;

    // Existence : rien à verrouiller
    if (rows.length === 0) {
      return { status: 404, body: { error: "Appartement introuvable" } };
    }
    const [appart] = rows;

    // Règle couple : avec le verrou ce count est fiable
    const actifs = await tx.resident.count({
      where: { id_appartement: appart.id_appartement, actif: true },
    });
    if (actifs >= 2) {
      return { status: 409, body: { error: "Appartement complet (maximum deux résidents actifs)" } };
    }

    const resident = await tx.resident.create({
      data: {
        prenom,
        nom,
        date_entree: new Date(date_entree),
        appartement: { connect: { numero: numero_appartement } },
      },
      select: { id_resident: true, prenom: true, nom: true, date_entree: true },
    });

    return { status: 201, body: resident };
  });

  return res.status(result.status).json(result.body);

});

residentsRouter.patch("/:id", requireRole(["secretaire"]), async (req, res) => {
  const id = Number(req.params.id);

  // Forme : :id doit être un entier positif.
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Identifiant de résident invalide" });
  }

  // Existence : le résident existe-t-il ?
  const resident = await prisma.resident.findUnique({
    where: { id_resident: id },
  });
  if (resident === null) {
    return res.status(404).json({ error: "Résident introuvable" });
  }

  // Whitelist stricte : seuls prenom et nom sont modifiables (anti mass-assignment)
  const { prenom, nom } = req.body;
  const data = {};
  if (prenom !== undefined) data.prenom = prenom;
  if (nom !== undefined) data.nom = nom;

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: "Aucun champ à modifier" });
  }

  const vide = Object.values(data).some((v) => v.trim() === "");
  if (vide) {
    return res.status(400).json({ error: "Champ obligatoire vide" });
  }

  const modifie = await prisma.resident.update({
    where: { id_resident: id },
    data,
    select: { id_resident: true, prenom: true, nom: true, date_entree: true },
  });
  return res.status(200).json(modifie);
});

residentsRouter.delete("/:id", requireRole(["secretaire"]), async (req, res) => {
  const id = Number(req.params.id);

  // Forme : :id doit être un entier positif
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Identifiant de résident invalide" });
  }

  // Existence : le résident ciblé existe-t-il ?
  const resident = await prisma.resident.findUnique({
    where: { id_resident: id },
  });
  if (resident === null) {
    return res.status(404).json({ error: "Résident introuvable" });
  }

  // Idempotence : ne réécrire que sur la transition actif true => false
  // Déjà archivé => no-op, on préserve la date_sortie historique
  if (resident.actif === false) {
    return res.status(200).json({
      id_resident: resident.id_resident,
      prenom: resident.prenom,
      nom: resident.nom,
      actif: resident.actif,
      date_sortie: resident.date_sortie,
    });
  }

  const archive = await prisma.resident.update({
    where: { id_resident: id },
    data: { actif: false, date_sortie: new Date() },
    select: {
      id_resident: true,
      prenom: true,
      nom: true,
      actif: true,
      date_sortie: true,
    },
  });
  return res.status(200).json(archive);

});

export default residentsRouter;