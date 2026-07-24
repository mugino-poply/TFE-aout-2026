import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../app.js";

describe("GET /api/appartements", () => {
  it("401 si pas de header Authorization", async () => {
    const res = await request(app).get("/api/appartements");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Token invalide" });
  });
});