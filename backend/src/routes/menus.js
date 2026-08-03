import { Router } from "express";
import { authenticateToken, requireRole } from "../middlewares/auth.js";

const menusRouter = Router();

menusRouter.post(
  "/",
  authenticateToken,
  requireRole(["secretaire", "cuisine"]),
  (req, res) => res.sendStatus(501)
);

export default menusRouter;