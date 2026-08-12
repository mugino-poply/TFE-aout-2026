import { describe, it, expect } from "vitest";
import { compterJours } from "../annulations.js";

describe("compterJours - écart en jours civils belges", () => {
  it("rend 2 pour une annulation deux jours civils avant le repas", () => {
    const annuleLe = new Date("2026-07-14T12:00:00Z");
    const dateRepas = new Date("2026-07-16T00:00:00Z");
    expect(compterJours(annuleLe, dateRepas)).toBe(2);
  });

  // 29/03/2026 : journée belge de 23h. Soustraire deux minuits belges rend 47h => 1 ; la reconstruction en minuits UTC rend 2
  it("rend 2 sur un intervalle qui enjambe le passage à l'heure d'été", () => {
    const annuleLe = new Date("2026-03-28T12:00:00Z");
    const dateRepas = new Date("2026-03-30T12:00:00Z");
    expect(compterJours(annuleLe, dateRepas)).toBe(2);
  });
});