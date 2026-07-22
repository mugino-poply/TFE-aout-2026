import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import { authenticateToken } from "../auth.js";
import jwt from "jsonwebtoken";

describe("authenticateToken", () => {
  const app = express();
  app.get("/protected", authenticateToken, (req, res) => res.json({ user: req.user }));
  const expected401 = { error: "Token invalide" };

  it("401 si pas de header Authorization", async () => {
    const res = await request(app).get("/protected");

    expect(res.status).toBe(401);
    expect(res.body).toEqual(expected401);
  });

  it('accepte un token valide et rempli req.user avec userId + role', async () => {
    const token = jwt.sign(
      { userId: 999, role: 'secretaire' },
      process.env.JWT_SECRET,
      { expiresIn: '11h' }
    );

    const response = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.user).toEqual({ userId: 999, role: 'secretaire' });
  });

    it('rejette un token avec signature invalide', async () => {
    const token = jwt.sign(
      { userId: 999, role: 'secretaire' }, 
      'un-autre-secret'
    )

    const response = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual(expected401);
  });

});