// Exporte l'app - importée par les tests
import express from "express";
import authRouter from "./routes/auth.js";

const app = express();

app.use(express.json());

app.use("/api/auth", authRouter);

export default app;