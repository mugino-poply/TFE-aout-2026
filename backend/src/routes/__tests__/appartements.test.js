import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../../app.js";
import prisma from "../../lib/prisma.js";

describe("GET /api/appartements", () => {
  it("401 si pas de header Authorization", async () => {
    const res = await request(app).get("/api/appartements");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Token invalide" });
  });

  describe("200 niveau 3", () => {
    let res;

    beforeAll(async () => {
      // Token fictif : authenticateToken ne consulte pas la DB, il vérifie
      // seulement la signature et lit userId + role du payload. Tant que la
      // route n'utilise pas req.user.userId pour dériver du contenu (ce qui
      // est le cas ici : accès identique pour les 4 rôles), userId est un
      // placeholder. Rôle secrétaire = rôle principal du backlog US-04
      const token = jwt.sign(
        { userId: 1, role: "secretaire" },
        process.env.JWT_SECRET,
        { expiresIn: "11h" }
      );

      res = await request(app)
        .get("/api/appartements")
        .set("Authorization", `Bearer ${token}`);
    });

    it("répond 200 avec un tableau", () => {
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("retourne les 88 appartements", () => {
      expect(res.body).toHaveLength(88);
    });

    it("appart 3 : couple actif (Giselle + Pierrot VanDenStraat)", () => {
      const appart = res.body.find((a) => a.numero === 3);
      expect(appart).toBeDefined();
      expect(appart.occupants).toHaveLength(2);
      const prenoms = appart.occupants.map((o) => o.prenom).sort();
      expect(prenoms).toEqual(["Giselle", "Pierrot"]);
    });

    it("appart 4 : occupant unique actif (Hervé Raskin)", () => {
      const appart = res.body.find((a) => a.numero === 4);
      expect(appart).toBeDefined();
      expect(appart.occupants).toHaveLength(1);
      expect(appart.occupants[0].prenom).toBe("Hervé");
    });

    it("appart 5 : vacant", () => {
      const appart = res.body.find((a) => a.numero === 5);
      expect(appart).toBeDefined();
      expect(appart.occupants).toEqual([]);
    });

    it("appart 6 : résident inactif filtré (Baudouin Koning absent)", () => {
      const appart = res.body.find((a) => a.numero === 6);
      expect(appart).toBeDefined();
      expect(appart.occupants).toEqual([]);
    });

    it("appart 7 : Francis actif présent, Leopold inactif filtré", () => {
      const appart = res.body.find((a) => a.numero === 7);
      expect(appart).toBeDefined();
      expect(appart.occupants).toHaveLength(1);
      expect(appart.occupants[0].prenom).toBe("Francis");
    });

    it("chaque occupant expose id_resident, prenom, nom", () => {
      const appart = res.body.find((a) => a.numero === 3);
      const occupant = appart.occupants[0];
      expect(occupant).toHaveProperty("id_resident");
      expect(occupant).toHaveProperty("prenom");
      expect(occupant).toHaveProperty("nom");
    });

    it("aucun occupant de l'appart 3 n'expose le champ actif (filtre transparent)", () => {
      const couple = res.body.find((a) => a.numero === 3);
      expect(couple).toBeDefined();
      couple.occupants.forEach((o) => {
        expect(o).not.toHaveProperty("actif");
      });
    });
  });
});

describe("GET /api/appartements/:numero/residents", () => {
  describe("400 sur :numero invalide (forme)", () => {
    let token;

    beforeAll(() => {
      token = jwt.sign(
        { userId: 1, role: "secretaire" },
        process.env.JWT_SECRET,
        { expiresIn: "11h" }
      );
    });

    it("rejette une valeur non numérique (abc)", async () => {
      const res = await request(app)
        .get("/api/appartements/abc/residents")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "Numéro d'appartement invalide" });
    });

    it("rejette zéro", async () => {
      const res = await request(app)
        .get("/api/appartements/0/residents")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "Numéro d'appartement invalide" });
    });

    it("rejette une valeur négative (-5)", async () => {
      const res = await request(app)
        .get("/api/appartements/-5/residents")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "Numéro d'appartement invalide" });
    });

    it("rejette une valeur décimale (3.5)", async () => {
      const res = await request(app)
        .get("/api/appartements/3.5/residents")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "Numéro d'appartement invalide" });
    });
  });
  describe("404 sur appartement inexistant", () => {
    let token;

    beforeAll(() => {
      token = jwt.sign(
        { userId: 1, role: "secretaire" },
        process.env.JWT_SECRET,
        { expiresIn: "11h" }
      );
    });

    it("retourne 404 quand le numéro est bien formé mais absent de la base (999)", async () => {
      const res = await request(app)
        .get("/api/appartements/999/residents")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Appartement introuvable" });
    });
  });

  describe("200 happy path", () => {
    let token;

    beforeAll(() => {
      token = jwt.sign(
        { userId: 1, role: "secretaire" },
        process.env.JWT_SECRET,
        { expiresIn: "11h" }
      );
    });

    it("appart 3 : couple actif avec allergies imbriquées", async () => {
      const res = await request(app)
        .get("/api/appartements/3/residents")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.numero).toBe(3);
      expect(res.body.occupants).toHaveLength(2);

      const giselle = res.body.occupants.find((o) => o.prenom === "Giselle");
      const pierrot = res.body.occupants.find((o) => o.prenom === "Pierrot");

      expect(giselle).toEqual({
        id_resident: expect.any(Number),
        prenom: "Giselle",
        nom: "VanDenStraat",
        allergies: [{ libelle: "Arachides", type: "allergie" }],
      });

      expect(pierrot).toEqual({
        id_resident: expect.any(Number),
        prenom: "Pierrot",
        nom: "VanDenStraat",
        allergies: [],
      });
    });

    it("appart 7 : Francis actif présent, Leopold inactif filtré", async () => {
      const res = await request(app)
        .get("/api/appartements/7/residents")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.numero).toBe(7);
      expect(res.body.occupants).toHaveLength(1);
      expect(res.body.occupants[0].prenom).toBe("Francis");
      expect(res.body.occupants[0]).not.toHaveProperty("actif");
    });

    it("appart 5 : vacant, 200 avec occupants vide", async () => {
      const res = await request(app)
        .get("/api/appartements/5/residents")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ numero: 5, occupants: [] });
    });
  });
});

describe("POST /api/appartements/:numero/changement - securite", () => {
  it("refuse sans token (401)", async () => {
    const res = await request(app)
      .post("/api/appartements/7/changement")
      .send({});
 
    expect(res.status).toBe(401);
  });

  it("refuse un role non secretaire (403)", async () => {
    const tokenCuisine = jwt.sign(
      { userId: 2, role: "cuisine" },
      process.env.JWT_SECRET,
      { expiresIn: "11h" }
    );
 
    const res = await request(app)
      .post("/api/appartements/7/changement")
      .set("Authorization", `Bearer ${tokenCuisine}`)
      .send({});
 
    expect(res.status).toBe(403);
  });

  it("rejette un id_resident_sortant non entier (400)", async () => {
    const tokenSecretaire = jwt.sign(
      { userId: 1, role: "secretaire" },
      process.env.JWT_SECRET,
      { expiresIn: "11h" }
    );
  
    const res = await request(app)
      .post("/api/appartements/7/changement")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ id_resident_sortant: "abc", prenom: "Marie", nom: "Dupont" });
  
    expect(res.status).toBe(400);
  });

  it("rejette un changement sur un appartement inexistant (404)", async () => {
    const token = jwt.sign(
      { userId: 1, role: "secretaire" },
      process.env.JWT_SECRET,
      { expiresIn: "11h" }
    );
  
    const res = await request(app)
      .post("/api/appartements/999/changement")
      .set("Authorization", `Bearer ${token}`)
      .send({ id_resident_sortant: 1, prenom: "Marie", nom: "Dupont" });
  
    expect(res.status).toBe(404);
  });
 
  it("rejette un sortant qui habite un autre appartement (404)", async () => {
    const token = jwt.sign(
      { userId: 1, role: "secretaire" },
      process.env.JWT_SECRET,
      { expiresIn: "11h" }
    );
  
    // Herve Raskin est actif dans l'appart 4 ; on tente de le sortir de l'appart 7
    const herve = await prisma.resident.findFirst({ where: { nom: "Raskin" } });
  
    const res = await request(app)
      .post("/api/appartements/7/changement")
      .set("Authorization", `Bearer ${token}`)
      .send({ id_resident_sortant: herve.id_resident, prenom: "Marie", nom: "Dupont" });
  
    expect(res.status).toBe(404);
  });

  it("rejette un sortant deja inactif (409)", async () => {
    const token = jwt.sign(
      { userId: 1, role: "secretaire" },
      process.env.JWT_SECRET,
      { expiresIn: "11h" }
    );
  
    const leopold = await prisma.resident.findFirst({ where: { nom: "Oud" } });
  
    const res = await request(app)
      .post("/api/appartements/7/changement")
      .set("Authorization", `Bearer ${token}`)
      .send({ id_resident_sortant: leopold.id_resident, prenom: "Marie", nom: "Dupont" });
  
    expect(res.status).toBe(409);
  });

});