import request from "supertest";
import jwt from "jsonwebtoken";
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import app from "../../app.js";
import prisma from "../../lib/prisma.js";

describe("PATCH /api/commandes/:id/annuler - nominal", () => {
  let tokenSecretaire;
  let idResident;
  let idCommande;

  beforeAll(async () => {
    const secretaire = await prisma.utilisateur.findUnique({
      where: { login: "secretaire1" },
    });
    tokenSecretaire = jwt.sign(
      { userId: secretaire.id_utilisateur, role: "secretaire" },
      process.env.JWT_SECRET,
      { expiresIn: "11h" }
    );
    const resident = await prisma.resident.findFirst({ where: { actif: true } });
    idResident = resident.id_resident;
  });

  // Fixture jetable : la commande est annulée par le test, donc recréée
  // avant chaque it. Pas de nettoyage entre tests : chaque commande a un
  // id neuf et aucun test du fichier ne compte les commandes
  beforeEach(async () => {
    const secretaire = await prisma.utilisateur.findUnique({
      where: { login: "secretaire1" },
    });
    const commande = await prisma.commande.create({
      data: {
        id_resident: idResident,
        date_repas: new Date("2026-07-16T00:00:00Z"),
        type_repas: "diner",
        created_by: secretaire.id_utilisateur,
      },
    });
    idCommande = commande.id_commande;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("annule une commande active trois jours avant le repas -> annulee_temps (200)", async () => {
    // Annulation le 13/07 pour un repas le 16/07 : écart 3, franc (hors frontière 2, hors fenêtre minuit-2h)
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-13T12:00:00Z"));

    const res = await request(app)
      .patch(`/api/commandes/${idCommande}/annuler`)
      .set("Authorization", `Bearer ${tokenSecretaire}`);

    expect(res.status).toBe(200);

    const enBase = await prisma.commande.findUnique({
      where: { id_commande: idCommande },
    });
    expect(enBase.statut).toBe("annulee_temps");
  });
});

describe("PATCH /api/commandes/:id/annuler - 404 commande absente", () => {
  let tokenSecretaire;

  beforeAll(async () => {
    const secretaire = await prisma.utilisateur.findUnique({
      where: { login: "secretaire1" },
    });
    tokenSecretaire = jwt.sign(
      { userId: secretaire.id_utilisateur, role: "secretaire" },
      process.env.JWT_SECRET,
      { expiresIn: "11h" }
    );
  });

  it("répond 404 sur un id de commande inexistant", async () => {
    const res = await request(app)
      .patch("/api/commandes/999999/annuler")
      .set("Authorization", `Bearer ${tokenSecretaire}`);
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/commandes/:id/annuler - 409 ré-annulation", () => {
  let tokenSecretaire;
  let idResident;
  let idCommande;

  beforeAll(async () => {
    const secretaire = await prisma.utilisateur.findUnique({
      where: { login: "secretaire1" },
    });
    tokenSecretaire = jwt.sign(
      { userId: secretaire.id_utilisateur, role: "secretaire" },
      process.env.JWT_SECRET,
      { expiresIn: "11h" }
    );
    const resident = await prisma.resident.findFirst({ where: { actif: true } });
    idResident = resident.id_resident;
  });

  beforeEach(async () => {
    const secretaire = await prisma.utilisateur.findUnique({
      where: { login: "secretaire1" },
    });
    const commande = await prisma.commande.create({
      data: {
        id_resident: idResident,
        date_repas: new Date("2026-07-16T00:00:00Z"),
        type_repas: "diner",
        created_by: secretaire.id_utilisateur,
      },
    });
    idCommande = commande.id_commande;
  });

  it("refuse une seconde annulation de la même commande (409)", async () => {
    const premier = await request(app)
      .patch(`/api/commandes/${idCommande}/annuler`)
      .set("Authorization", `Bearer ${tokenSecretaire}`);
    expect(premier.status).toBe(200);

    const second = await request(app)
      .patch(`/api/commandes/${idCommande}/annuler`)
      .set("Authorization", `Bearer ${tokenSecretaire}`);
    expect(second.status).toBe(409);
  });
});