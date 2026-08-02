import request from "supertest";
import jwt from "jsonwebtoken";
import { describe, it, expect, beforeAll } from "vitest";
import app from "../../app.js";
import prisma from "../../lib/prisma.js";

describe("POST /api/residents/:id/allergies", () => {
  let idResident;
  let idSecretaire;
  let tokenSecretaire;

  beforeAll(async () => {
    // résident jetable sur appart 8 (vide au seed), aucun autre test le lit
    const resident = await prisma.resident.create({
      data: {
        id_appartement: 8,
        prenom: "Test",
        nom: "Allergie",
        date_entree: new Date(),
      },
    });
    idResident = resident.id_resident;

    // token forgé mais avec le vrai id du secrétaire du seed
    // parce que le POST fait un connect dessus, id bidon = ça pète au create (FK)
    const secretaire = await prisma.utilisateur.findUnique({
      where: { login: "secretaire1" },
    });
    idSecretaire = secretaire.id_utilisateur;
    tokenSecretaire = jwt.sign(
      { userId: idSecretaire, role: "secretaire" },
      process.env.JWT_SECRET,
      { expiresIn: "11h" }
    );
  });

  it("cree l'allergie et renvoie 201 avec la ressource", async () => {
    const res = await request(app)
      .post(`/api/residents/${idResident}/allergies`)
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ libelle: "Arachides", type: "allergie" });

    // je check le body, pas juste le 201 : un 201 tout seul laisserait passer un green qui crée rien
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ libelle: "Arachides", type: "allergie" });
    expect(res.body.id_allergie).toBeTypeOf("number");

    // et je relis en base pour vérifier que created_by est bien le secrétaire du token
    const enBase = await prisma.allergie.findUnique({
      where: { id_allergie: res.body.id_allergie },
    });
    expect(enBase.created_by).toBe(idSecretaire);
  });
});

describe("POST /api/residents/:id/allergies - 400 forme", () => {
  let idResident;
  let tokenSecretaire;

  beforeAll(async () => {
    // fixture sur appart 9 (vide au seed), juste pour avoir un :id valide
    // comme ça le rouge vient bien du libelle manquant, pas d'un résident absent
    const resident = await prisma.resident.create({
      data: {
        id_appartement: 9,
        prenom: "Test",
        nom: "Forme",
        date_entree: new Date(),
      },
    });
    idResident = resident.id_resident;

    const secretaire = await prisma.utilisateur.findUnique({
      where: { login: "secretaire1" },
    });
    tokenSecretaire = jwt.sign(
      { userId: secretaire.id_utilisateur, role: "secretaire" },
      process.env.JWT_SECRET,
      { expiresIn: "11h" }
    );
  });

  it("rejette une allergie sans libelle", async () => {
    const res = await request(app)
      .post(`/api/residents/${idResident}/allergies`)
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ type: "allergie" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Champs obligatoires manquants" });
  });

  it("rejette un libelle composé uniquement d'espaces", async () => {
    const res = await request(app)
      .post(`/api/residents/${idResident}/allergies`)
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ libelle: "   ", type: "allergie" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Champs obligatoires manquants" });
  });

  it("rejette une allergie sans type", async () => {
    const res = await request(app)
      .post(`/api/residents/${idResident}/allergies`)
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ libelle: "Arachides" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Champs obligatoires manquants" });
  });
});

describe("POST /api/residents/:id/allergies - 403 rôle", () => {
  let idResident;
  let tokenCuisine;

  beforeAll(async () => {
    // fixture sur appart 10 (vide au seed) pour que le body valide crée bien (201)
    // sinon un résident absent ferait tomber le create en 500 et fausserait le motif
    const resident = await prisma.resident.create({
      data: {
        id_appartement: 10,
        prenom: "Test",
        nom: "Role",
        date_entree: new Date(),
      },
    });
    idResident = resident.id_resident;

    // token cuisine forgé sur un vrai user cuisine du seed
    // (le connect sur utilisateur exige un id valide, sinon FK -> 500 au lieu de 201)
    const cuisine = await prisma.utilisateur.findFirst({
      where: { role: "cuisine" },
    });
    tokenCuisine = jwt.sign(
      { userId: cuisine.id_utilisateur, role: "cuisine" },
      process.env.JWT_SECRET,
      { expiresIn: "11h" }
    );
  });

  it("refuse la cuisine sur la création d'allergie", async () => {
    // body volontairement valide : le rouge doit venir du rôle, pas d'un 400 de forme
    const res = await request(app)
      .post(`/api/residents/${idResident}/allergies`)
      .set("Authorization", `Bearer ${tokenCuisine}`)
      .send({ libelle: "Arachides", type: "allergie" });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "Accès refusé" });
  });
});

describe("POST /api/residents/:id/allergies - 404 résident absent", () => {
  let tokenSecretaire;

  beforeAll(async () => {
    const secretaire = await prisma.utilisateur.findFirst({
      where: { role: "secretaire" },
    });
    tokenSecretaire = jwt.sign(
      { userId: secretaire.id_utilisateur, role: "secretaire" },
      process.env.JWT_SECRET,
      { expiresIn: "11h" }
    );
  });

  it("rejette une allergie sur un résident inexistant", async () => {
    // id 999999 bien formé mais absent, body valide : le rouge doit venir de l'existence
    const res = await request(app)
      .post("/api/residents/999999/allergies")
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ libelle: "Arachides", type: "allergie" });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Résident introuvable" });
  });
});

describe("POST /api/residents/:id/allergies - 400 type hors enum", () => {
  let idResident;
  let tokenSecretaire;

  beforeAll(async () => {
    // fixture sur appart 11 (vide au seed) pour un :id valide
    // le rouge doit venir du type invalide, pas d'un résident absent
    const resident = await prisma.resident.create({
      data: {
        id_appartement: 11,
        prenom: "Test",
        nom: "Enum",
        date_entree: new Date(),
      },
    });
    idResident = resident.id_resident;

    const secretaire = await prisma.utilisateur.findFirst({
      where: { role: "secretaire" },
    });
    tokenSecretaire = jwt.sign(
      { userId: secretaire.id_utilisateur, role: "secretaire" },
      process.env.JWT_SECRET,
      { expiresIn: "11h" }
    );
  });

  it("rejette un type absent de l'enum", async () => {
    const res = await request(app)
      .post(`/api/residents/${idResident}/allergies`)
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ libelle: "Arachides", type: "banane" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Type d'allergie invalide" });
  });
});