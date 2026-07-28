import { Router } from "express";
import { authenticateToken, requireRole } from "../middlewares/auth.js";

const residentsRouter = Router();

// Router-level
residentsRouter.use(authenticateToken);

residentsRouter.post("/", requireRole(["secretaire"]), (req, res) => {
  const { prenom, nom, numero_appartement, date_entree } = req.body;

  // Tous les champs requis doivent être présents
  if (!prenom || !nom || !numero_appartement || !date_entree) {
    return res.status(400).json({ error: "Champs obligatoires manquants" });
  }

});

export default residentsRouter;