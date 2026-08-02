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
    // pas de appartement.create : le seed force les id d'appart, la séquence est désync, ça collisionne
    // je réutilise un appart vide du seed (le 8) et je crée juste mon résident dessus, comme US-06
    const resident = await prisma.resident.create({
        data: {
        id_appartement: 8,
        prenom: "Test",
        nom: "Allergie",
        date_entree: new Date(),
        },
    });
    idResident = resident.id_resident;

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
    // c'est la preuve que req.user.userId a fait tout le chemin jusqu'à la colonne
    const enBase = await prisma.allergie.findUnique({
      where: { id_allergie: res.body.id_allergie },
    });
    expect(enBase.created_by).toBe(idSecretaire);
  });
});