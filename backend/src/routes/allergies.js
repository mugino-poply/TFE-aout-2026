import express from "express";
import { authenticateToken } from "../middlewares/auth.js";

// routeur imbriqué sous /api/residents/:id/allergies
// mergeParams sinon je perds le req.params.id du résident
const router = express.Router({ mergeParams: true });

// pas de token = 401 direct ici, pas un 404 random
router.use(authenticateToken);

// stub pour l'instant, la vraie création arrive au green
// je renvoie 501 exprès : comme ça mon test POST rougit sur 501 != 201
// (logique manquante) et pas sur un 404 ou un timeout de handler vide
router.post("/", (req, res) => res.sendStatus(501));

export default router;