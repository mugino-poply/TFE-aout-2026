import { Router } from "express";
import { parseISO, isValid } from "date-fns";
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

    if (typeof date !== "string") {
      return res.status(400).json({ erreur: "Date invalide" });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ erreur: "Date invalide" });
    }

    if (!isValid(parseISO(date))) {
      return res.status(400).json({ erreur: "Date invalide" });
    }

    return res.sendStatus(501);
  }
);

export default menusRouter;