import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";
import app from "../../app.js";
import prisma from "../../lib/prisma.js";
import jwt from "jsonwebtoken";

describe("POST /api/auth/login", () => {
  let userActif;
  let body2;
  const pinActif = "0042";
  const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 4;
  const expected401 = { error: "Identifiants incorrects" };

  beforeAll(async () => {
    const hashedActif = await bcrypt.hash(pinActif, BCRYPT_ROUNDS);

    userActif = await prisma.utilisateur.create({
      data: {
        login: "test_actif_admin",
        prenom: "UserTestActif",
        code_pin: hashedActif,
        actif: true,
        role: "admin",
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("200 OK avec token JWT signé (userId, role, exp à 11h)", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        id_utilisateur: userActif.id_utilisateur,
        code: pinActif,
      });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(typeof res.body.token).toBe("string");

    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET);

    expect(payload.userId).toBe(userActif.id_utilisateur);
    expect(payload.role).toBe("admin");
    expect(payload.exp - payload.iat).toBe(11 * 3600);
  });

  it("user inexistant", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        id_utilisateur: 99999,
        code: pinActif,
      });
    
    expect(res.status).toBe(401);
    expect(res.body).toEqual(expected401);
  });

  it("user existant mais mauvais pin", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        id_utilisateur: userActif.id_utilisateur,
        code: "9999",
      });
    
    expect(res.status).toBe(401);
    expect(res.body).toEqual(expected401);
  });

  it("code trop court", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        id_utilisateur: userActif.id_utilisateur,
        code: "42",
      });
    
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Code invalide");
  });

  it("code non numérique", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        id_utilisateur: userActif.id_utilisateur,
        code: "abcd",
      });
    
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Code invalide");
  });

  it("code absent du body", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        id_utilisateur: userActif.id_utilisateur,
      });
    
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Code invalide");
  });

});