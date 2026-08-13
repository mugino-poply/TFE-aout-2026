import { SEUIL_ANNULATION_TEMPS_JOURS } from "../config/seuils.js";

const formatBelge = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Brussels",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function jourCivilBelge(instant) {
  const parts = formatBelge.formatToParts(instant).reduce((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
}

export function compterJours(annuleLe, dateRepas) {
  const ecartMs = jourCivilBelge(dateRepas) - jourCivilBelge(annuleLe);
  return Math.trunc(ecartMs / 86_400_000);
}

export function classerAnnulation(ecart) {
  return ecart >= SEUIL_ANNULATION_TEMPS_JOURS ? "annulee_temps" : "annulee_retard";
}