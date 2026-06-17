import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../app.js";

describe("GET /api/users", () => {
  it("200: retourne un tableau dont les clés des éléments sont: id_utilisateur, prenom, role", async () => {
    const res = await request(app).get("/api/users");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);

    for (const user of res.body) {
      expect(Object.keys(user).sort()).toEqual(["id_utilisateur", "prenom", "role"]);
    }
  });
});