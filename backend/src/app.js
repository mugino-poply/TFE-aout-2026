// Exporte l'app - importée par les tests
import express from "express";
import authRouter from "./routes/auth.js";
import usersRouter from "./routes/users.js";
import appartementsRouter from "./routes/appartements.js";
import residentsRouter from "./routes/residents.js";
import allergiesRouter from "./routes/allergies.js";
import menusRouter from "./routes/menus.js";
import commandesRouter from "./routes/commandes.js";
import annulationsRouter from "./routes/annulations.js";

const app = express();

// Un seul saut : nginx tourne sur la même machine et se connecte en local.
// "loopback" plutôt que true ou 1 : seule une connexion venue de la machine
// elle-même est de confiance, donc un X-Forwarded-For forgé par un client
// ne peut pas se faire passer pour le dernier saut et échapper au limiteur.
app.set("trust proxy", "loopback");

app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/appartements", appartementsRouter);
app.use("/api/residents", residentsRouter);
app.use("/api/residents/:id/allergies", allergiesRouter);
app.use("/api/menus", menusRouter);
app.use("/api/commandes", annulationsRouter);
app.use("/api/commandes", commandesRouter);

export default app;
