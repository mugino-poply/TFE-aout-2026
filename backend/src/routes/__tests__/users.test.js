import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../../app.js";
import prisma from "../../lib/prisma.js";
import bcrypt from "bcrypt";

describe("GET /api/users", () => {
  let userInactif;
  const pinInactif = "0042";
  const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 4;

  beforeAll(async () => {
    const hashedInactif = await bcrypt.hash(pinInactif, BCRYPT_ROUNDS);

    userInactif = await prisma.utilisateur.create({
      data: {
        login: "test_inactif_admin",
        prenom: "UserTestInactif",
        code_pin: hashedInactif,
        actif: false,
        role: "admin",
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("200: retourne un tableau dont les clés des éléments sont: id_utilisateur, prenom, role", async () => {
    const res = await request(app).get("/api/users");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);

    for (const user of res.body) {
      expect(Object.keys(user).sort()).toEqual(["id_utilisateur", "prenom", "role"]);
    }
  });

  it("retourne un tableau qui ne comporte que les users actifs", async () => {
    const res = await request(app).get("/api/users");

    expect(res.body.map(u => u.id_utilisateur)).not.toContain(userInactif.id_utilisateur)
  });

  it("reste accessible sans header Authorization (route publique)", async () => {
    const res = await request(app).get("/api/users");
    expect(res.status).toBe(200);
  });
});