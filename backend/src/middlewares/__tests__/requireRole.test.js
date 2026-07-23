import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import { requireRole } from "../auth.js";

describe("requireRole", () => {
  const app = express();

  app.get(
    "/protected-role",
    (req, res, next) => {
      req.user = { userId: 1, role: "cuisine" };
      next();
    },
    requireRole(["secretaire"]),
    (req, res) => res.status(200).json({ ok: true })
  );

  it("403 si le rôle n'est pas dans la liste autorisée", async () => {
    const res = await request(app).get("/protected-role");

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "Accès refusé" });
  });
});