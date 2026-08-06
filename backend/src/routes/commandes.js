import { Router } from "express";
import { authenticateToken, requireRole } from "../middlewares/auth.js";

const commandesRouter = Router();

commandesRouter.use(authenticateToken);
commandesRouter.use(requireRole(["secretaire"]));

commandesRouter.post("/", (req, res) => {
    const { id_resident, type_repas, lignes } = req.body;

    if (!id_resident || !type_repas || !lignes) {
    return res.status(400).json({ error: "Champs obligatoires manquants" });
    }
    res.sendStatus(501)
});

export default commandesRouter;