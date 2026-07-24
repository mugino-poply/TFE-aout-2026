import { Router } from "express";

const appartementsRouter = Router();

appartementsRouter.get("/", (req, res) => {
  res.sendStatus(200);
});

export default appartementsRouter;