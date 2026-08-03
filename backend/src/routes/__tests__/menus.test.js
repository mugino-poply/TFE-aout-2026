import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../../app.js";
import prisma from "../../lib/prisma.js";

let tokenServeur;
let tokenSecretaire;

beforeAll(async () => {
  const serveur = await prisma.utilisateur.findUnique({ where: { login: "serveur1" } });
  tokenServeur = jwt.sign(
    { userId: serveur.id_utilisateur, role: serveur.role },
    process.env.JWT_SECRET
  );

  const secretaire = await prisma.utilisateur.findUnique({ where: { login: "secretaire1" } });
  tokenSecretaire = jwt.sign(
    { userId: secretaire.id_utilisateur, role: secretaire.role },
    process.env.JWT_SECRET
  );
});

describe("POST /api/menus", () => {
  it("refuse un rôle sans droit d'écriture en menu (403)", async () => {
    const res = await request(app)
      .post("/api/menus")
      .set("Authorization", `Bearer ${tokenServeur}`)
      .send({
        date: "2026-08-10",
        options: [{ libelle: "Potage du jour", categorie: "soupe" }],
      });

    expect(res.status).toBe(403);
  });

  it("refuse un POST sans date (400)", async () => {
    const res = await request(app)
        .post("/api/menus")
        .set("Authorization", `Bearer ${tokenSecretaire}`)
        .send({
        options: [{ libelle: "Potage du jour", categorie: "soupe" }],
        });

    expect(res.status).toBe(400);
    });
});