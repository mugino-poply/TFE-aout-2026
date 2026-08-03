import { Router } from "express";
import { authenticateToken, requireRole } from "../middlewares/auth.js";

const menusRouter = Router();

menusRouter.post(
  "/",
  authenticateToken,
  requireRole(["secretaire", "cuisine"]),
  (req, res) => {
    const { date } = req.body;

    if (date === undefined) {
      return res.status(400).json({ erreur: "Champs obligatoires manquants" });
    }

    return res.sendStatus(501);
  }
);

export default menusRouter;