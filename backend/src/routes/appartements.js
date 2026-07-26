import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.js";
import prisma from "../lib/prisma.js";

const appartementsRouter = Router();

appartementsRouter.use(authenticateToken);

appartementsRouter.get("/", async (req, res) => {
  const apparts = await prisma.appartement.findMany({
    orderBy: { numero: "asc" },
    select: {
      numero: true,
      residents: {
        where: { actif: true },
        select: {
          id_resident: true,
          prenom: true,
          nom: true,
        },
      },
    },
  });

  const response = apparts.map((a) => ({
    numero: a.numero,
    occupants: a.residents,
  }));

  res.status(200).json(response);
});

export default appartementsRouter;