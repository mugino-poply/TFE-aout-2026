import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";

const appartementsRouter = Router();

appartementsRouter.use(authenticateToken);

appartementsRouter.get("/", (req, res) => {
  res.sendStatus(200);
});

export default appartementsRouter;