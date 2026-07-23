import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import { requireRole } from "../auth.js";

describe("requireRole", () => {
  const app = express();

  app.get(
    "/protected-role",
    (req, res, next) => {
      const testRole = req.headers["x-test-role"];
      if (testRole) req.user = { userId: 1, role: testRole };
      next();
    },
    requireRole(["secretaire"]),
    (req, res) => res.status(200).json({ ok: true })
  );

  it("403 si le rôle n'est pas dans la liste autorisée", async () => {
    const res = await request(app)
      .get("/protected-role")
      .set("X-Test-Role", "cuisine");

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "Accès refusé" });
  });

  it("200 si le rôle est dans la liste autorisée", async () => {
    const res = await request(app)
      .get("/protected-role")
      .set("X-Test-Role", "secretaire");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("401 si le rôle est absent", async () => {
    const res = await request(app)
      .get("/protected-role")

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Token invalide" });
  });
});