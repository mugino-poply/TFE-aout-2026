// Exporte l'app - importée par les tests
import express from "express";
import authRouter from "./routes/auth.js";
import usersRouter from "./routes/users.js";
import appartementsRouter from "./routes/appartements.js";
import residentsRouter from "./src/routes/residents.js";

const app = express();

app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/appartements", appartementsRouter);
app.use("/api/residents", residentsRouter);

export default app;