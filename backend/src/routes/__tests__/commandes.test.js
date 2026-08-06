import request from "supertest";
import jwt from "jsonwebtoken";
import { describe, it, expect, beforeAll } from "vitest";
import app from "../../app.js";
import prisma from "../../lib/prisma.js";

describe("POST /api/commandes - auth (né-vert via montage)", () => {
  let tokenCuisine;

  beforeAll(async () => {
    const cuisine = await prisma.utilisateur.findUnique({
      where: { login: "cuisine1" },
    });
    tokenCuisine = jwt.sign(
      { userId: cuisine.id_utilisateur, role: "cuisine" },
      process.env.JWT_SECRET,
      { expiresIn: "11h" }
    );
  });

  it("rejette une requête sans token (401)", async () => {
    const res = await request(app).post("/api/commandes").send({});
    expect(res.status).toBe(401);
  });

  it("refuse la cuisine (403)", async () => {
    const res = await request(app)
      .post("/api/commandes")
      .set("Authorization", `Bearer ${tokenCuisine}`)
      .send({});
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "Accès refusé" });
  });
});

describe("POST /api/commandes - 400 champ requis manquant", () => {
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

  it("rejette une commande sans id_resident", async () => {
    const res = await request(app)
      .post("/api/commandes")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ type_repas: "diner", lignes: [1, 2] });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Champs obligatoires manquants" });
  });

  it("rejette une commande sans type_repas (né-vert, déjà couvert par la garde combinée)", async () => {
    const res = await request(app)
      .post("/api/commandes")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ id_resident: 1, lignes: [1] });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Champs obligatoires manquants" });
  });

  it("rejette une commande sans lignes (né-vert, déjà couvert par la garde combinée)", async () => {
    const res = await request(app)
      .post("/api/commandes")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ id_resident: 1, type_repas: "diner" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Champs obligatoires manquants" });
  });
});

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
        .send({ id_resident: 1, type_repas: "diner", lignes: [1], type_client: "relou" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Type de client invalide" });
    });
});

describe("POST /api/commandes - 400 type_repas hors enum", () => {
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

  it("rejette un type_repas absent de l'enum", async () => {
    const res = await request(app)
      .post("/api/commandes")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ id_resident: 1, type_repas: "relou", lignes: [1] });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Type de repas invalide" });
  });
});

describe("POST /api/commandes - 400 lignes non-tableau", () => {
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

  it("rejette un lignes qui n'est pas un tableau", async () => {
    // "abc" est truthy; id_resident et type_repas valides
    const res = await request(app)
      .post("/api/commandes")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ id_resident: 1, type_repas: "diner", lignes: "abc" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Lignes invalides" });
  });
});

describe("POST /api/commandes - 400 lignes vide", () => {
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

  it("rejette un lignes vide", async () => {
    // [] est truthy et bien un tableau 
    const res = await request(app)
      .post("/api/commandes")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ id_resident: 1, type_repas: "diner", lignes: [] });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Lignes vides" });
  });
});

describe("POST /api/commandes - 400 id_option non entier", () => {
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

  it("rejette un id_option non entier dans lignes", async () => {
    const res = await request(app)
      .post("/api/commandes")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ id_resident: 1, type_repas: "diner", lignes: [1, "abc", 3] });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Identifiant d'option invalide" });
  });
});

describe("POST /api/commandes - 400 lignes en double", () => {
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

  it("rejette des id_option en double dans lignes", async () => {
    const res = await request(app)
      .post("/api/commandes")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ id_resident: 1, type_repas: "diner", lignes: [5, 5] });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Lignes en double" });
  });
});

describe("POST /api/commandes - 400 id_resident non entier", () => {
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

  it("rejette un id_resident non entier", async () => {
    const res = await request(app)
      .post("/api/commandes")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ id_resident: "abc", type_repas: "diner", lignes: [1] });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Identifiant de résident invalide" });
  });
});

describe("POST /api/commandes - 404 résident absent", () => {
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

  it("rejette une commande sur un résident inexistant", async () => {
    const res = await request(app)
      .post("/api/commandes")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ id_resident: 999999, type_repas: "diner", lignes: [1] });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Résident introuvable" });
  });
});