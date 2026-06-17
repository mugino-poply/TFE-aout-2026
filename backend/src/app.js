// Exporte l'app - importée par les tests
import express from "express";
import authRouter from "./routes/auth.js";
import usersRouter from "./routes/users.js";

const app = express();

app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);

export default app;