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
});