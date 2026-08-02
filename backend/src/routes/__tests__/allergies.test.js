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
});