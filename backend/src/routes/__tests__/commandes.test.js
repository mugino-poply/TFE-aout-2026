import request from "supertest";
import jwt from "jsonwebtoken";
import { describe, it, expect, beforeAll } from "vitest";
import app from "../../app.js";
import prisma from "../../lib/prisma.js";

describe("POST /api/commandes - 400 type_client hors enum", () => {
  let tokenSecretaire;

  beforeAll(async () => {
    const secretaire = await prisma.utilisateur.findUnique({
      where: { login: "secretaire1" },
    });
    tokenSecretaire = jwt.sign(
      { userId: secretaire.id_utilisateur, role: "secretaire" },
      process.env.JWT_SECRET,
      { expiresIn: "11h" }
    );
  });

  it("rejette un type_client absent de l'enum", async () => {
    const res = await request(app)
      .post("/api/commandes")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ type_client: "relou" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Type de client invalide" });
  });
});

