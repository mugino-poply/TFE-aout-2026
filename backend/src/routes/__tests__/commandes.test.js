import request from "supertest";
import jwt from "jsonwebtoken";
import { describe, it, expect, beforeAll } from "vitest";
import app from "../../app.js";
import prisma from "../../lib/prisma.js";

describe("POST /api/commandes - auth (né-vert via montage)", () => {
  let tokenCuisine;

  beforeAll(async () => {
    const cuisine = await prisma.utilisateur.findUnique({
      where: { login: "cuisine1" },
    });
    tokenCuisine = jwt.sign(
      { userId: cuisine.id_utilisateur, role: "cuisine" },
      process.env.JWT_SECRET,
      { expiresIn: "11h" }
    );
  });

  it("rejette une requête sans token (401)", async () => {
    const res = await request(app).post("/api/commandes").send({});
    expect(res.status).toBe(401);
  });

  it("refuse la cuisine (403)", async () => {
    const res = await request(app)
      .post("/api/commandes")
      .set("Authorization", `Bearer ${tokenCuisine}`)
      .send({});
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "Accès refusé" });
  });
});

describe("POST /api/commandes - 400 champ requis manquant", () => {
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

  it("rejette une commande sans id_resident", async () => {
    const res = await request(app)
      .post("/api/commandes")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ type_repas: "diner", lignes: [1, 2] });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Champs obligatoires manquants" });
  });

  it("rejette une commande sans type_repas (né-vert, déjà couvert par la garde combinée)", async () => {
    const res = await request(app)
      .post("/api/commandes")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ id_resident: 1, lignes: [1] });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Champs obligatoires manquants" });
  });

  it("rejette une commande sans lignes (né-vert, déjà couvert par la garde combinée)", async () => {
    const res = await request(app)
      .post("/api/commandes")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ id_resident: 1, type_repas: "diner" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Champs obligatoires manquants" });
  });
});

describe("POST /api/commandes - 400 type_client hors enum", () => {
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

    it("rejette un type_client absent de l'enum", async () => {
    const res = await request(app)
        .post("/api/commandes")
        .set("Authorization", `Bearer ${tokenSecretaire}`)
        .send({ id_resident: 1, type_repas: "diner", lignes: [1], type_client: "relou" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Type de client invalide" });
    });
});

describe("POST /api/commandes - 400 type_repas hors enum", () => {
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

  it("rejette un type_repas absent de l'enum", async () => {
    const res = await request(app)
      .post("/api/commandes")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ id_resident: 1, type_repas: "relou", lignes: [1] });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Type de repas invalide" });
  });
});

describe("POST /api/commandes - 400 lignes non-tableau", () => {
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

  it("rejette un lignes qui n'est pas un tableau", async () => {
    // "abc" est truthy; id_resident et type_repas valides
    const res = await request(app)
      .post("/api/commandes")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ id_resident: 1, type_repas: "diner", lignes: "abc" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Lignes invalides" });
  });
});

describe("POST /api/commandes - 400 lignes vide", () => {
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

  it("rejette un lignes vide", async () => {
    // [] est truthy et bien un tableau 
    const res = await request(app)
      .post("/api/commandes")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ id_resident: 1, type_repas: "diner", lignes: [] });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Lignes vides" });
  });
});

describe("POST /api/commandes - 400 id_option non entier", () => {
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

  it("rejette un id_option non entier dans lignes", async () => {
    const res = await request(app)
      .post("/api/commandes")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ id_resident: 1, type_repas: "diner", lignes: [1, "abc", 3] });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Identifiant d'option invalide" });
  });
});

describe("POST /api/commandes - 400 lignes en double", () => {
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

  it("rejette des id_option en double dans lignes", async () => {
    const res = await request(app)
      .post("/api/commandes")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ id_resident: 1, type_repas: "diner", lignes: [5, 5] });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Lignes en double" });
  });
});

describe("POST /api/commandes - 400 id_resident non entier", () => {
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

  it("rejette un id_resident non entier", async () => {
    const res = await request(app)
      .post("/api/commandes")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ id_resident: "abc", type_repas: "diner", lignes: [1] });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Identifiant de résident invalide" });
  });
});

describe("POST /api/commandes - 404 résident absent", () => {
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

  it("rejette une commande sur un résident inexistant", async () => {
    const res = await request(app)
      .post("/api/commandes")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ id_resident: 999999, type_repas: "diner", lignes: [1] });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Résident introuvable" });
  });
});

describe("POST /api/commandes - 404 résident inactif", () => {
  let tokenSecretaire;
  let idBaudouin;

  beforeAll(async () => {
    const secretaire = await prisma.utilisateur.findUnique({
      where: { login: "secretaire1" },
    });
    tokenSecretaire = jwt.sign(
      { userId: secretaire.id_utilisateur, role: "secretaire" },
      process.env.JWT_SECRET,
      { expiresIn: "11h" }
    );

    // Baudouin Koning : inactif du seed (appart 6), résolu par prenom/nom
    const baudouin = await prisma.resident.findFirst({
      where: { prenom: "Baudouin", nom: "Koning" },
    });
    idBaudouin = baudouin.id_resident;
  });

  it("rejette une commande sur un résident inactif", async () => {
    const res = await request(app)
      .post("/api/commandes")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ id_resident: idBaudouin, type_repas: "diner", lignes: [1] });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Résident introuvable" });
  });
});

describe("POST /api/commandes - 404 option inexistante", () => {
  let tokenSecretaire;
  let idResident;
  let idOptionReelle;

  beforeAll(async () => {
    const secretaire = await prisma.utilisateur.findUnique({
      where: { login: "secretaire1" },
    });
    tokenSecretaire = jwt.sign(
      { userId: secretaire.id_utilisateur, role: "secretaire" },
      process.env.JWT_SECRET,
      { expiresIn: "11h" }
    );

    // résident actif du seed, résolu par clé métier (Hervé Raskin, appart 4, solo actif)
    const herve = await prisma.resident.findFirst({
      where: { prenom: "Hervé", nom: "Raskin" },
    });
    idResident = herve.id_resident;

    const menu = await prisma.menu.create({
      data: {
        date_menu: new Date("2026-08-10T00:00:00.000Z"),
        semaine: 33,
        annee: 2026,
        options: { create: [{ libelle: "Poulet rôti", categorie: "plat" }] },
      },
      select: { options: { select: { id_option: true } } },
    });
    idOptionReelle = menu.options[0].id_option;
  });

  it("rejette une commande avec un id_option inexistant", async () => {
    const res = await request(app)
      .post("/api/commandes")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ id_resident: idResident, type_repas: "diner", lignes: [idOptionReelle, 999999] });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Option(s) introuvable(s)" });
  });
});

describe("POST /api/commandes - 400 options de menus différents", () => {
  let tokenSecretaire;
  let idResident;
  let idOptionMenuA;
  let idOptionMenuB;

  beforeAll(async () => {
    const secretaire = await prisma.utilisateur.findUnique({
      where: { login: "secretaire1" },
    });
    tokenSecretaire = jwt.sign(
      { userId: secretaire.id_utilisateur, role: "secretaire" },
      process.env.JWT_SECRET,
      { expiresIn: "11h" }
    );

    // résident actif du seed
    const herve = await prisma.resident.findFirst({
      where: { prenom: "Hervé", nom: "Raskin" },
    });
    idResident = herve.id_resident;

    // menu A (2026-08-12) et menu B (2026-08-13) : dates distinctes entre elles
    // ET distinctes du 2026-08-10 du bloc existence (date_menu @unique, reseed par fichier)
    const menuA = await prisma.menu.create({
      data: {
        date_menu: new Date("2026-08-12T00:00:00.000Z"),
        semaine: 33,
        annee: 2026,
        options: { create: [{ libelle: "Poulet rôti", categorie: "plat" }] },
      },
      select: { options: { select: { id_option: true } } },
    });
    idOptionMenuA = menuA.options[0].id_option;

    const menuB = await prisma.menu.create({
      data: {
        date_menu: new Date("2026-08-13T00:00:00.000Z"),
        semaine: 33,
        annee: 2026,
        options: { create: [{ libelle: "Tarte maison", categorie: "dessert" }] },
      },
      select: { options: { select: { id_option: true } } },
    });
    idOptionMenuB = menuB.options[0].id_option;
  });

  it("rejette un panier qui mélange deux menus", async () => {
    const res = await request(app)
      .post("/api/commandes")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ id_resident: idResident, type_repas: "diner", lignes: [idOptionMenuA, idOptionMenuB] });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Options de menus différents" });
  });
});

describe("POST /api/commandes - 201 création (résident, dérivation, connects)", () => {
  let tokenSecretaire;
  let idSecretaire;
  let idResident;
  let idOptionPlat;
  let idOptionDessert;

  beforeAll(async () => {
    const secretaire = await prisma.utilisateur.findUnique({
      where: { login: "secretaire1" },
    });
    idSecretaire = secretaire.id_utilisateur;
    tokenSecretaire = jwt.sign(
      { userId: idSecretaire, role: "secretaire" },
      process.env.JWT_SECRET,
      { expiresIn: "11h" }
    );

    // résident actif du seed
    const herve = await prisma.resident.findFirst({
      where: { prenom: "Hervé", nom: "Raskin" },
    });
    idResident = herve.id_resident;

    // date 2026-08-14 : distincte des dates déjà prises dans ce fichier (10, 12, 13)
    const menu = await prisma.menu.create({
      data: {
        date_menu: new Date("2026-08-14T00:00:00.000Z"),
        semaine: 33,
        annee: 2026,
        options: {
          create: [
            { libelle: "Poulet rôti", categorie: "plat" },
            { libelle: "Tarte maison", categorie: "dessert" },
          ],
        },
      },
      select: { options: { select: { id_option: true, categorie: true } } },
    });
    idOptionPlat = menu.options.find((o) => o.categorie === "plat").id_option;
    idOptionDessert = menu.options.find((o) => o.categorie === "dessert").id_option;
  });

  it("crée la commande, dérive la date et connecte résident/auteur/options", async () => {
    // body minimal
    const res = await request(app)
      .post("/api/commandes")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ id_resident: idResident, type_repas: "diner", lignes: [idOptionPlat, idOptionDessert] });

    expect(res.status).toBe(201);
    expect(res.body.id_commande).toBeTypeOf("number");

    // relecture base : la création est réelle, la dérivation correcte, req.user traverse
    const enBase = await prisma.commande.findUnique({
      where: { id_commande: res.body.id_commande },
      select: {
        date_repas: true,
        created_by: true,
        statut: true,
        lignes: { select: { id_option: true } },
      },
    });
    // date dérivée = date du menu des options
    expect(enBase.date_repas.toISOString()).toBe("2026-08-14T00:00:00.000Z");
    expect(enBase.created_by).toBe(idSecretaire); 
    expect(enBase.statut).toBe("active"); // default
    expect(enBase.lignes).toHaveLength(2); // les deux lignes créées
  });
});

describe("POST /api/commandes - 201 forme exacte du corps", () => {
  let tokenSecretaire;
  let idResident;
  let idOptionPlat;
  let idOptionDessert;

  beforeAll(async () => {
    const secretaire = await prisma.utilisateur.findUnique({
      where: { login: "secretaire1" },
    });
    tokenSecretaire = jwt.sign(
      { userId: secretaire.id_utilisateur, role: "secretaire" },
      process.env.JWT_SECRET,
      { expiresIn: "11h" }
    );

    const herve = await prisma.resident.findFirst({
      where: { prenom: "Hervé", nom: "Raskin" },
    });
    idResident = herve.id_resident;

    const menu = await prisma.menu.create({
      data: {
        date_menu: new Date("2026-08-15T00:00:00.000Z"),
        semaine: 33,
        annee: 2026,
        options: {
          create: [
            { libelle: "Poulet rôti", categorie: "plat" },
            { libelle: "Tarte maison", categorie: "dessert" },
          ],
        },
      },
      select: { options: { select: { id_option: true, categorie: true } } },
    });
    idOptionPlat = menu.options.find((o) => o.categorie === "plat").id_option;
    idOptionDessert = menu.options.find((o) => o.categorie === "dessert").id_option;
  });

  it("renvoie l'enveloppe minimisée, lignes aplaties et ordonnées, sans champ interne", async () => {
    const res = await request(app)
      .post("/api/commandes")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ id_resident: idResident, type_repas: "diner", lignes: [idOptionPlat, idOptionDessert] });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id_commande: expect.any(Number),
      id_resident: idResident,
      date_repas: "2026-08-15T00:00:00.000Z",
      type_repas: "diner",
      statut: "active",
      type_client: "resident",
      en_appartement: false,
      note_invite: null,
      remarque: null,
      lignes: [
        { id_option: idOptionPlat, libelle: "Poulet rôti", categorie: "plat" },
        { id_option: idOptionDessert, libelle: "Tarte maison", categorie: "dessert" },
      ],
      allergies_detectees: [],
    });
  });
});

describe("POST /api/commandes - 409 doublon résident actif", () => {
  let tokenSecretaire;
  let idResident;
  let idOption;

  beforeAll(async () => {
    const secretaire = await prisma.utilisateur.findUnique({
      where: { login: "secretaire1" },
    });
    tokenSecretaire = jwt.sign(
      { userId: secretaire.id_utilisateur, role: "secretaire" },
      process.env.JWT_SECRET,
      { expiresIn: "11h" }
    );

    const herve = await prisma.resident.findFirst({
      where: { prenom: "Hervé", nom: "Raskin" },
    });
    idResident = herve.id_resident;

    const menu = await prisma.menu.create({
      data: {
        date_menu: new Date("2026-08-16T00:00:00.000Z"),
        semaine: 33,
        annee: 2026,
        options: { create: [{ libelle: "Poulet rôti", categorie: "plat" }] },
      },
      select: { options: { select: { id_option: true } } },
    });
    idOption = menu.options[0].id_option;
  });

  it("rejette une seconde commande identique pour un résident actif", async () => {
    const body = { id_resident: idResident, type_repas: "diner", lignes: [idOption] };

    const premier = await request(app)
      .post("/api/commandes")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send(body);
    expect(premier.status).toBe(201);

    const second = await request(app)
      .post("/api/commandes")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send(body);
    expect(second.status).toBe(409);
    expect(second.body).toEqual({ error: "Commande déjà existante" });
  });
});

describe("POST /api/commandes - 201 détection allergie (US-14, IT-02)", () => {
  let tokenSecretaire;
  let idResident;
  let idOptionArachide;

  beforeAll(async () => {
    const secretaire = await prisma.utilisateur.findUnique({
      where: { login: "secretaire1" },
    });
    tokenSecretaire = jwt.sign(
      { userId: secretaire.id_utilisateur, role: "secretaire" },
      process.env.JWT_SECRET,
      { expiresIn: "11h" }
    );

    const giselle = await prisma.resident.findFirst({
      where: { prenom: "Giselle", nom: "VanDenStraat" },
    });
    idResident = giselle.id_resident;

    const menu = await prisma.menu.create({
      data: {
        date_menu: new Date("2026-08-17T00:00:00.000Z"),
        semaine: 34,
        annee: 2026,
        options: {
          create: [{ libelle: "Salade", categorie: "plat", contient_allergenes: "arachides" }],
        },
      },
      select: { options: { select: { id_option: true } } },
    });
    idOptionArachide = menu.options[0].id_option;
  });

  it("crée la commande (201) et renvoie l'allergène détecté, sans bloquer", async () => {
    const res = await request(app)
      .post("/api/commandes")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ id_resident: idResident, type_repas: "diner", lignes: [idOptionArachide] });

    expect(res.status).toBe(201);
    expect(res.body.allergies_detectees).toEqual([
      { libelle: "Arachides", type: "allergie", option_concernee: "Salade" },
    ]);
  });
});

describe("POST /api/commandes - 201 allergène au menu mais non commandé (US-14, portée)", () => {
  let tokenSecretaire;
  let idResident;
  let idOptionNeutre;

  beforeAll(async () => {
    const secretaire = await prisma.utilisateur.findUnique({ where: { login: "secretaire1" } });
    tokenSecretaire = jwt.sign(
      { userId: secretaire.id_utilisateur, role: "secretaire" },
      process.env.JWT_SECRET,
      { expiresIn: "11h" }
    );

    const giselle = await prisma.resident.findFirst({
      where: { prenom: "Giselle", nom: "VanDenStraat" },
    });
    idResident = giselle.id_resident;

    const menu = await prisma.menu.create({
      data: {
        date_menu: new Date("2026-08-18T00:00:00.000Z"),
        semaine: 34,
        annee: 2026,
        options: {
          create: [
            { libelle: "Salade", categorie: "entree", contient_allergenes: "arachides" },
            { libelle: "Poulet rôti", categorie: "plat" },
          ],
        },
      },
      select: { options: { select: { id_option: true, categorie: true } } },
    });
    idOptionNeutre = menu.options.find((o) => o.categorie === "plat").id_option;
  });

  it("ne signale rien quand l'allergène est au menu mais absent de la commande (né-vert discriminant : vert sur l'itération des lignes commandées, rouge sur une impl qui parcourt le menu du jour)", async () => {
    const res = await request(app)
      .post("/api/commandes")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ id_resident: idResident, type_repas: "diner", lignes: [idOptionNeutre] });

    expect(res.status).toBe(201);
    expect(res.body.allergies_detectees).toEqual([]);
  });
});

describe("POST /api/commandes - 201 détection insensible aux accents (US-14)", () => {
  let tokenSecretaire;
  let idResident;
  let idOptionCeleri;

  beforeAll(async () => {
    const secretaire = await prisma.utilisateur.findUnique({ where: { login: "secretaire1" } });
    tokenSecretaire = jwt.sign(
      { userId: secretaire.id_utilisateur, role: "secretaire" },
      process.env.JWT_SECRET,
      { expiresIn: "11h" }
    );

    const pierrot = await prisma.resident.findFirst({
      where: { prenom: "Pierrot", nom: "VanDenStraat" },
    });
    idResident = pierrot.id_resident;
    await prisma.allergie.create({
      data: {
        id_resident: pierrot.id_resident,
        libelle: "Céleri",
        type: "allergie",
        created_by: secretaire.id_utilisateur,
      },
    });

    const menu = await prisma.menu.create({
      data: {
        date_menu: new Date("2026-08-19T00:00:00.000Z"),
        semaine: 34,
        annee: 2026,
        options: {
          create: [{ libelle: "Gratin", categorie: "plat", contient_allergenes: "celeri" }],
        },
      },
      select: { options: { select: { id_option: true } } },
    });
    idOptionCeleri = menu.options[0].id_option;
  });

  it("détecte l'allergène quand l'allergie est accentuée et le champ cuisine ne l'est pas", async () => {
    const res = await request(app)
      .post("/api/commandes")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ id_resident: idResident, type_repas: "diner", lignes: [idOptionCeleri] });

    expect(res.status).toBe(201);
    expect(res.body.allergies_detectees).toEqual([
      { libelle: "Céleri", type: "allergie", option_concernee: "Gratin" },
    ]);
  });
});

describe("POST /api/commandes - 201 détection accents symétrique (US-14, côté champ)", () => {
  let tokenSecretaire;
  let idResident;
  let idOptionCeleri;

  beforeAll(async () => {
    const secretaire = await prisma.utilisateur.findUnique({ where: { login: "secretaire1" } });
    tokenSecretaire = jwt.sign(
      { userId: secretaire.id_utilisateur, role: "secretaire" },
      process.env.JWT_SECRET,
      { expiresIn: "11h" }
    );

    const francis = await prisma.resident.findFirst({
      where: { prenom: "Francis", nom: "De Jonghe" },
    });
    idResident = francis.id_resident;
    await prisma.allergie.create({
      data: {
        id_resident: francis.id_resident,
        libelle: "Celeri",
        type: "allergie",
        created_by: secretaire.id_utilisateur,
      },
    });

    const menu = await prisma.menu.create({
      data: {
        date_menu: new Date("2026-08-20T00:00:00.000Z"),
        semaine: 34,
        annee: 2026,
        options: {
          create: [{ libelle: "Gratin", categorie: "plat", contient_allergenes: "Céleri" }],
        },
      },
      select: { options: { select: { id_option: true } } },
    });
    idOptionCeleri = menu.options[0].id_option;
  });

  it("détecte l'allergène quand l'allergie n'est pas accentuée et le champ cuisine l'est (né-vert discriminant : rouge sur une impl qui ne normalise pas le champ cuisine)", async () => {
    const res = await request(app)
      .post("/api/commandes")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ id_resident: idResident, type_repas: "diner", lignes: [idOptionCeleri] });

    expect(res.status).toBe(201);
    expect(res.body.allergies_detectees).toEqual([
      { libelle: "Celeri", type: "allergie", option_concernee: "Gratin" },
    ]);
  });
});

describe("POST /api/commandes - 201 allergène déclaré étranger au résident (US-14, négatif de matching)", () => {
  let tokenSecretaire;
  let idResident;
  let idOptionGluten;

  beforeAll(async () => {
    const secretaire = await prisma.utilisateur.findUnique({ where: { login: "secretaire1" } });
    tokenSecretaire = jwt.sign(
      { userId: secretaire.id_utilisateur, role: "secretaire" },
      process.env.JWT_SECRET,
      { expiresIn: "11h" }
    );

    // Giselle est allergique aux "Arachides" pas au "gluten"
    const giselle = await prisma.resident.findFirst({
      where: { prenom: "Giselle", nom: "VanDenStraat" },
    });
    idResident = giselle.id_resident;

    const menu = await prisma.menu.create({
      data: {
        date_menu: new Date("2026-08-21T00:00:00.000Z"),
        semaine: 34,
        annee: 2026,
        options: {
          create: [{ libelle: "Gratin", categorie: "plat", contient_allergenes: "gluten" }],
        },
      },
      select: { options: { select: { id_option: true } } },
    });
    idOptionGluten = menu.options[0].id_option;
  });

  it("ne signale rien quand le plat déclare un allergène qui n'est pas celui du résident (né-vert discriminant : rouge sur une impl qui alerte sur tout champ contient_allergenes rempli sans comparer au résident)", async () => {
    const res = await request(app)
      .post("/api/commandes")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ id_resident: idResident, type_repas: "diner", lignes: [idOptionGluten] });

    expect(res.status).toBe(201);
    expect(res.body.allergies_detectees).toEqual([]);
  });
});

describe("POST /api/commandes - 201 détection par le nom du plat (US-14, canal libelle)", () => {
  let tokenSecretaire;
  let idResident;
  let idOptionNommee;

  beforeAll(async () => {
    const secretaire = await prisma.utilisateur.findUnique({ where: { login: "secretaire1" } });
    tokenSecretaire = jwt.sign(
      { userId: secretaire.id_utilisateur, role: "secretaire" },
      process.env.JWT_SECRET,
      { expiresIn: "11h" }
    );

    const giselle = await prisma.resident.findFirst({
      where: { prenom: "Giselle", nom: "VanDenStraat" },
    });
    idResident = giselle.id_resident;

    const menu = await prisma.menu.create({
      data: {
        date_menu: new Date("2026-08-22T00:00:00.000Z"),
        semaine: 34,
        annee: 2026,
        options: {
          create: [{ libelle: "Tarte aux arachides", categorie: "dessert" }],
        },
      },
      select: { options: { select: { id_option: true } } },
    });
    idOptionNommee = menu.options[0].id_option;
  });

  it("détecte l'allergène quand il apparaît dans le nom du plat et que la liste dédiée est vide", async () => {
    const res = await request(app)
      .post("/api/commandes")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ id_resident: idResident, type_repas: "diner", lignes: [idOptionNommee] });

    expect(res.status).toBe(201);
    expect(res.body.allergies_detectees).toEqual([
      { libelle: "Arachides", type: "allergie", option_concernee: "Tarte aux arachides" },
    ]);
  });
});

describe("POST /api/commandes - 201 détection insensible à la ligature oe (US-14, invariant AT-02)", () => {
  let tokenSecretaire;
  let idResident;
  let idOptionOeufs;

  beforeAll(async () => {
    const secretaire = await prisma.utilisateur.findUnique({ where: { login: "secretaire1" } });
    tokenSecretaire = jwt.sign(
      { userId: secretaire.id_utilisateur, role: "secretaire" },
      process.env.JWT_SECRET,
      { expiresIn: "11h" }
    );

    const pierrot = await prisma.resident.findFirst({
      where: { prenom: "Pierrot", nom: "VanDenStraat" },
    });
    idResident = pierrot.id_resident;
    await prisma.allergie.create({
      data: {
        id_resident: pierrot.id_resident,
        libelle: "oeuf",
        type: "allergie",
        created_by: secretaire.id_utilisateur,
      },
    });

    const menu = await prisma.menu.create({
      data: {
        date_menu: new Date("2026-08-23T00:00:00.000Z"),
        semaine: 34,
        annee: 2026,
        options: {
          create: [{ libelle: "Salade", categorie: "entree", contient_allergenes: "Œufs" }],
        },
      },
      select: { options: { select: { id_option: true } } },
    });
    idOptionOeufs = menu.options[0].id_option;
  });

  it("détecte l'allergène quand le résident déclare 'oeuf' et la cuisine 'Œufs' avec la ligature", async () => {
    const res = await request(app)
      .post("/api/commandes")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ id_resident: idResident, type_repas: "diner", lignes: [idOptionOeufs] });

    expect(res.status).toBe(201);
    expect(res.body.allergies_detectees).toEqual([
      { libelle: "oeuf", type: "allergie", option_concernee: "Salade" },
    ]);
  });
});