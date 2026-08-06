import { Router } from "express";
import { authenticateToken, requireRole } from "../middlewares/auth.js";

const commandesRouter = Router();

commandesRouter.use(authenticateToken);
commandesRouter.use(requireRole(["secretaire"]));

commandesRouter.post("/", (req, res) => res.sendStatus(501));

export default commandesRouter;