import { describe, it, expect } from "vitest";
import { compterJours } from "../annulations.js";

describe("compterJours - écart en jours civils belges", () => {
  it("rend 2 pour une annulation deux jours civils avant le repas", () => {
    const annuleLe = new Date("2026-07-14T12:00:00Z");
    const dateRepas = new Date("2026-07-16T00:00:00Z");
    expect(compterJours(annuleLe, dateRepas)).toBe(2);
  });
});