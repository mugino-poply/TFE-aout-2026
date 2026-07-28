import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../../app.js";

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