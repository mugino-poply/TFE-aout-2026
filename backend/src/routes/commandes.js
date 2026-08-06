import { Router } from "express";
import { authenticateToken, requireRole } from "../middlewares/auth.js";
import { TypeClient, TypeRepas } from "@prisma/client";

const commandesRouter = Router();

commandesRouter.use(authenticateToken);
commandesRouter.use(requireRole(["secretaire"]));

commandesRouter.post("/", (req, res) => {
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

    res.sendStatus(501)
});

export default commandesRouter;