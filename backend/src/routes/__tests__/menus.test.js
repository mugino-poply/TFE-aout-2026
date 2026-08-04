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

  it("refuse une date null (400)", async () => {
    const res = await request(app)
        .post("/api/menus")
        .set("Authorization", `Bearer ${tokenSecretaire}`)
        .send({
        date: null,
        options: [{ libelle: "Potage du jour", categorie: "soupe" }],
        });

    expect(res.status).toBe(400);
  });

  it("refuse une date numérique (400)", async () => {
    const res = await request(app)
        .post("/api/menus")
        .set("Authorization", `Bearer ${tokenSecretaire}`)
        .send({
        date: 123,
        options: [{ libelle: "Potage du jour", categorie: "soupe" }],
        });

    expect(res.status).toBe(400);
  });

  it("refuse une date non structurée (400)", async () => {
    const res = await request(app)
        .post("/api/menus")
        .set("Authorization", `Bearer ${tokenSecretaire}`)
        .send({
        date: "hello",
        options: [{ libelle: "Potage du jour", categorie: "soupe" }],
        });

    expect(res.status).toBe(400);
  });

  it("refuse une date à séparateurs slash (400)", async () => {
    const res = await request(app)
        .post("/api/menus")
        .set("Authorization", `Bearer ${tokenSecretaire}`)
        .send({
        date: "10/08/2026",
        options: [{ libelle: "Potage du jour", categorie: "soupe" }],
    });

    expect(res.status).toBe(400);
  });

  it("refuse un jour impossible pour le mois (400)", async () => {
    const res = await request(app)
        .post("/api/menus")
        .set("Authorization", `Bearer ${tokenSecretaire}`)
        .send({
        date: "2026-02-30",
        options: [{ libelle: "Potage du jour", categorie: "soupe" }],
        });

    expect(res.status).toBe(400);
  });

  it("refuse un mois impossible (400)", async () => {
    const res = await request(app)
        .post("/api/menus")
        .set("Authorization", `Bearer ${tokenSecretaire}`)
        .send({
        date: "2026-13-01",
        options: [{ libelle: "Potage du jour", categorie: "soupe" }],
        });

    expect(res.status).toBe(400);
  });

  it("refuse un datetime ISO complet, pas au format date pur (400)", async () => {
    const res = await request(app)
        .post("/api/menus")
        .set("Authorization", `Bearer ${tokenSecretaire}`)
        .send({
        date: "2026-08-10T00:00:00Z",
        options: [{ libelle: "Potage du jour", categorie: "soupe" }],
        });

    expect(res.status).toBe(400);
  });

  it("refuse un POST sans options (400)", async () => {
    const res = await request(app)
      .post("/api/menus")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({
        date: "2026-08-11",
      });

    expect(res.status).toBe(400);
  });

  it("refuse une valeur options non structurée en chaîne (400)", async () => {
    const res = await request(app)
      .post("/api/menus")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({
        date: "2026-08-11",
        options: "hello",
      });

    expect(res.status).toBe(400);
  });

  it("refuse un objet à la place d'un tableau d'options (400)", async () => {
    const res = await request(app)
      .post("/api/menus")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({
        date: "2026-08-11",
        options: {},
      });

    expect(res.status).toBe(400);
  });

  it("refuse un tableau d'options vide (400)", async () => {
    const res = await request(app)
      .post("/api/menus")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({
        date: "2026-08-13",
        options: [],
      });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Au moins une option est requise" });
  });

  it("refuse une option dont le libellé n'est pas une chaîne (400)", async () => {
    const res = await request(app)
      .post("/api/menus")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({
        date: "2026-08-14",
        options: [
          { libelle: "Potage du jour", categorie: "soupe" },
          { libelle: 123, categorie: "plat" },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Libellé d'option invalide" });
  });

  it("refuse une option au libellé vide après trim (400)", async () => {
    const res = await request(app)
      .post("/api/menus")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({
        date: "2026-08-15",
        options: [
          { libelle: "Potage du jour", categorie: "soupe" },
          { libelle: "   ", categorie: "plat" },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Libellé d'option invalide" });
  });

  it("refuse une option dont la catégorie est hors enum (400)", async () => {
    const res = await request(app)
      .post("/api/menus")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({
        date: "2026-08-16",
        options: [
          { libelle: "Potage du jour", categorie: "soupe" },
          { libelle: "Donut sucré au sucre", categorie: "dessert_mauvais" },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Catégorie d'option invalide" });
  });

  it("refuse une option sans catégorie (400)", async () => {
    const res = await request(app)
      .post("/api/menus")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({
        date: "2026-08-17",
        options: [
          { libelle: "Potage du jour", categorie: "soupe" },
          { libelle: "Salade verte" },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Catégorie d'option invalide" });
  });

});

describe("POST /api/menus - cas passant", () => {
  let res;
  let menuEnBase;

  beforeAll(async () => {
    res = await request(app)
      .post("/api/menus")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({
        date: "2027-01-01",
        options: [
          { libelle: "Potage du jour", categorie: "soupe" },
          { libelle: "Blanquette de veau", categorie: "plat" },
        ],
      });

    if (res.body?.id_menu) {
      menuEnBase = await prisma.menu.findUnique({
        where: { id_menu: res.body.id_menu },
      });
    }
  });

  it("répond 201", () => {
    expect(res.status).toBe(201);
  });

  it("renvoie le menu minimisé (id_menu, options projetées)", () => {
    expect(res.body).toEqual({
      id_menu: expect.any(Number),
      options: [
        { id_option: expect.any(Number), libelle: "Potage du jour", categorie: "soupe" },
        { id_option: expect.any(Number), libelle: "Blanquette de veau", categorie: "plat" },
      ],
    });
  });

  it("dérive semaine et année ISO en base (paire cohérente à la frontière)", () => {
    expect(menuEnBase.semaine).toBe(53);
    expect(menuEnBase.annee).toBe(2026);
  });
});