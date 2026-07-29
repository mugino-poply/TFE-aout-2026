import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../../app.js";
import prisma from "../../lib/prisma.js";

describe("POST /api/residents", () => {
  describe("400 champ obligatoire manquant (forme)", () => {
    let token;

    beforeAll(() => {
      // Token secrétaire VALIDE
      token = jwt.sign(
        { userId: 1, role: "secretaire" },
        process.env.JWT_SECRET,
        { expiresIn: "11h" }
      );
    });

    it("rejette un resident sans prenom", async () => {
      const res = await request(app)
        .post("/api/residents")
        .set("Authorization", `Bearer ${token}`)
        .send({
          nom: "Dupont",
          numero_appartement: 3,
          date_entree: "2026-01-15",
        });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "Champs obligatoires manquants" });
    });
  });

  describe("404 appartement inexistant", () => {
    let token;

    beforeAll(() => {
      token = jwt.sign(
        { userId: 1, role: "secretaire" },
        process.env.JWT_SECRET,
        { expiresIn: "11h" }
      );
    });

    it("rejette un numero_appartement bien formé mais absent de la base", async () => {
      const res = await request(app)
        .post("/api/residents")
        .set("Authorization", `Bearer ${token}`)
        .send({
          prenom: "Jean",
          nom: "Dupont",
          numero_appartement: 999,
          date_entree: "2026-01-15",
        });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Appartement introuvable" });
    });
  });

  describe("201 création sur appartement à 1 actif", () => {
    let token;

    beforeAll(() => {
      token = jwt.sign(
        { userId: 1, role: "secretaire" },
        process.env.JWT_SECRET,
        { expiresIn: "11h" }
      );
    });

    it("crée le résident et renvoie 201 quand l'appart a 1 actif (< 2)", async () => {
      // Appart 4 : un seul occupant actif (Hervé Raskin) au seed US-04, donc on peut ajouter un occupant
      const res = await request(app)
        .post("/api/residents")
        .set("Authorization", `Bearer ${token}`)
        .send({
          prenom: "Jean",
          nom: "Dupont",
          numero_appartement: 4,
          date_entree: "2026-01-15",
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("id_resident");
      expect(res.body.prenom).toBe("Jean");
      expect(res.body.nom).toBe("Dupont");
    });
  });

  describe("409 appartement plein (metier, regle couple)", () => {
    let token;

    beforeAll(() => {
      token = jwt.sign(
        { userId: 1, role: "secretaire" },
        process.env.JWT_SECRET,
        { expiresIn: "11h" }
      );
    });

    it("refuse un 3e resident actif quand l'appart en a deja 2", async () => {
      // Appart 3 : couple actif 
      const res = await request(app)
        .post("/api/residents")
        .set("Authorization", `Bearer ${token}`)
        .send({
          prenom: "Jean",
          nom: "Dupont",
          numero_appartement: 3,
          date_entree: "2026-01-15",
        });

      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: "Appartement complet (maximum deux résidents actifs)" });
    });
  });

  describe("201 place libre malgré un inactif (métier, filtre actif)", () => {
    let token;

    beforeAll(() => {
      token = jwt.sign(
        { userId: 1, role: "secretaire" },
        process.env.JWT_SECRET,
        { expiresIn: "11h" }
      );
    });

    it("autorise un nouvel actif quand l'appart a 1 actif + 1 inactif", async () => {
      // Appart 7 au seed US-04 : Francis actif + Leopold inactif.
      // Le count ne doit voir que Francis (actif) : la place reste libre
      const res = await request(app)
        .post("/api/residents")
        .set("Authorization", `Bearer ${token}`)
        .send({
          prenom: "Jean",
          nom: "Dupont",
          numero_appartement: 7,
          date_entree: "2026-01-15",
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("id_resident");
    });
  });
});

describe("PATCH /api/residents/:id", () => {
  describe("400 sur :id invalide (forme)", () => {
    let token;

    beforeAll(() => {
      // Token valide volontairement : l'auth passe, donc le rouge vient du
      // handler PATCH pas encore monté (404)
      token = jwt.sign(
        { userId: 1, role: "secretaire" },
        process.env.JWT_SECRET,
        { expiresIn: "11h" }
      );
    });

    it("rejette un :id non entier (abc)", async () => {
      const res = await request(app)
        .patch("/api/residents/abc")
        .set("Authorization", `Bearer ${token}`)
        .send({ prenom: "Jean" });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "Identifiant de résident invalide" });
    });
  });

  describe("404 résident inexistant (existence)", () => {
    let token;

    beforeAll(() => {
      token = jwt.sign(
        { userId: 1, role: "secretaire" },
        process.env.JWT_SECRET,
        { expiresIn: "11h" }
      );
    });

    it("retourne 404 quand l'id est bien formé mais absent de la base", async () => {
      const res = await request(app)
        .patch("/api/residents/999999")
        .set("Authorization", `Bearer ${token}`)
        .send({ prenom: "Jean" });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Résident introuvable" });
    });
  });

  describe("200 modification appliquée (contenu)", () => {
    let token;

    beforeAll(() => {
      token = jwt.sign(
        { userId: 1, role: "secretaire" },
        process.env.JWT_SECRET,
        { expiresIn: "11h" }
      );
    });

    it("modifie le prenom et renvoie 200 avec le résident à jour", async () => {
      // Francis De Jonghe (appart 7) au seed, id autoincrement inconnu d'avance
      const francis = await prisma.resident.findFirst({
        where: { prenom: "Francis", nom: "De Jonghe" },
      });

      const res = await request(app)
        .patch(`/api/residents/${francis.id_resident}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ prenom: "François" });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id_resident: francis.id_resident,
        prenom: "François",
        nom: "De Jonghe",
        date_entree: expect.any(String),
      });
    });
  });
  
  describe("400 aucun champ modifiable (contenu)", () => {
    let token;

    beforeAll(() => {
      token = jwt.sign(
        { userId: 1, role: "secretaire" },
        process.env.JWT_SECRET,
        { expiresIn: "11h" }
      );
    });

    it("rejette un body vide", async () => {
      // Pierrot (appart 3), résident existant : on passe l'existence, on teste le contenu
      const pierrot = await prisma.resident.findFirst({
        where: { prenom: "Pierrot", nom: "VanDenStraat" },
      });

      const res = await request(app)
        .patch(`/api/residents/${pierrot.id_resident}`)
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "Aucun champ à modifier" });
    });

    it("rejette un body ne contenant que des champs interdits", async () => {
      const pierrot = await prisma.resident.findFirst({
        where: { prenom: "Pierrot", nom: "VanDenStraat" },
      });

      const res = await request(app)
        .patch(`/api/residents/${pierrot.id_resident}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ actif: true });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "Aucun champ à modifier" });
    });
  });

  describe("400 valeur vide sur champ whitelisté (contenu)", () => {
    let token;

    beforeAll(() => {
      token = jwt.sign(
        { userId: 1, role: "secretaire" },
        process.env.JWT_SECRET,
        { expiresIn: "11h" }
      );
    });

    it("rejette un prenom vide", async () => {
      // Giselle (appart 3), existante : on passe forme + existence, on teste le contenu
      const giselle = await prisma.resident.findFirst({
        where: { prenom: "Giselle", nom: "VanDenStraat" },
      });

      const res = await request(app)
        .patch(`/api/residents/${giselle.id_resident}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ prenom: "" });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "Champ obligatoire vide" });
    });
  });

  describe("whitelist stricte : champ interdit ignoré (sécurité, anti mass-assignment)", () => {
    let token;

    beforeAll(() => {
      token = jwt.sign(
        { userId: 1, role: "secretaire" },
        process.env.JWT_SECRET,
        { expiresIn: "11h" }
      );
    });

    it("applique prenom mais n'écrit pas actif glissé dans le body", async () => {
      // Hervé Raskin (appart 4, actif: true au seed). L'attaque pousse actif: false.
      // État de départ (true) différent de l'attaque (false) : une fuite serait observable.
      const herve = await prisma.resident.findFirst({
        where: { prenom: "Hervé", nom: "Raskin" },
      });

      const res = await request(app)
        .patch(`/api/residents/${herve.id_resident}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ prenom: "Modifié", actif: false });

      expect(res.status).toBe(200);

      // La vérité sur actif = la base, pas res.body (le select n'expose pas actif).
      const enBase = await prisma.resident.findUnique({
        where: { id_resident: herve.id_resident },
        select: { prenom: true, actif: true },
      });
      expect(enBase.prenom).toBe("Modifié"); // le whitelisté a bien été écrit
      expect(enBase.actif).toBe(true);       // l'interdit a été ignoré
    });
  });

});

describe("DELETE /api/residents/:id", () => {
  describe("400 sur :id invalide (forme)", () => {
    let token;

    beforeAll(() => {
      token = jwt.sign(
        { userId: 1, role: "secretaire" },
        process.env.JWT_SECRET,
        { expiresIn: "11h" }
      );
    });

    it("rejette un :id non entier (abc)", async () => {
      const res = await request(app)
        .delete("/api/residents/abc")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "Identifiant de résident invalide" });
    });
  });


  describe("404 résident inexistant (existence)", () => {
    let token;

    beforeAll(() => {
      token = jwt.sign(
        { userId: 1, role: "secretaire" },
        process.env.JWT_SECRET,
        { expiresIn: "11h" }
      );
    });

    it("retourne 404 quand l'id est bien formé mais absent de la base", async () => {
      const res = await request(app)
        .delete("/api/residents/999999")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Résident introuvable" });
    });
  });

});