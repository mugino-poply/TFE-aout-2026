import { describe, it, expect, afterEach } from "vitest";
import { compterJours, classerAnnulation } from "../annulations.js";

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

    // 14/07 21h UTC = 23h heure belge (été, +2), jour civil belge = 14. Soustraire les instants bruts rend 27h => 1 ; la réduction en jour civil rend 2.
  it("rend 2 quand l'annulation est en soirée de J-2", () => {
    const annuleLe = new Date("2026-07-14T21:00:00Z");
    const dateRepas = new Date("2026-07-16T00:00:00Z");
    expect(compterJours(annuleLe, dateRepas)).toBe(2);
  });

  // 22h30 UTC = 00h30 belge le 15/07, écart 1. Sous TZ=UTC les getters natifs liraient le 14 => écart 2 ; la réduction Intl rend 1
  describe("insensibilité au fuseau ambiant du process", () => {
    const tzOrigine = process.env.TZ;
    afterEach(() => {
      if (tzOrigine === undefined) delete process.env.TZ;
      else process.env.TZ = tzOrigine;
    });

    it("rend 1 sous TZ=UTC (jour natif divergent du jour belge)", () => {
      process.env.TZ = "UTC";
      const annuleLe = new Date("2026-07-14T22:30:00Z");
      const dateRepas = new Date("2026-07-16T00:00:00Z");
      expect(compterJours(annuleLe, dateRepas)).toBe(1);
    });
  });
});

describe("classerAnnulation - temps ou retard selon le seuil", () => {
  it("classe annulee_temps quand l'écart dépasse le seuil", () => {
    expect(classerAnnulation(3)).toBe("annulee_temps");
  });

  // Né vert : frontière haute. Le seuil est >= 2, un écart de 2 est encore à temps
  it("classe annulee_temps à l'écart frontière de 2 jours", () => {
    expect(classerAnnulation(2)).toBe("annulee_temps");
  });

  // Régression métier : la veille (écart 1) est facturée => annulee_retard
  it("classe annulee_retard la veille (écart 1)", () => {
    expect(classerAnnulation(1)).toBe("annulee_retard");
  });

  // Régression métier : repas déjà passé (écart négatif) = produit, facturé => annulee_retard
  it("classe annulee_retard pour un repas déjà passé (écart négatif)", () => {
    expect(classerAnnulation(-1)).toBe("annulee_retard");
  });
});