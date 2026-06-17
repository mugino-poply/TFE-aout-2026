import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import { authenticateToken } from "../auth.js";

describe("authenticateToken", () => {
  const app = express();
  app.get("/protected", authenticateToken, (req, res) => res.json({ ok: true }));
  const expected401 = { error: "Token invalide" };

  it("401 si pas de header Authorization", async () => {
    const res = await request(app).get("/protected");

    expect(res.status).toBe(401);
    expect(res.body).toEqual(expected401);
  });
});