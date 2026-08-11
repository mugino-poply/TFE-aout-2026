import request from "supertest";
import jwt from "jsonwebtoken";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
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

  it("persiste le champ notes quand il est fourni", async () => {
    const res = await request(app)
      .post(`/api/residents/${idResident}/allergies`)
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ libelle: "Gluten", type: "intolerance", notes: "sauf dans la bière comme par hasard" });

    expect(res.status).toBe(201);

    // je relis en base : c'est la persistance que je prouve, pas l'écho du body
    const enBase = await prisma.allergie.findUnique({
      where: { id_allergie: res.body.id_allergie },
    });
    expect(enBase.notes).toBe("sauf dans la bière comme par hasard");
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

  it("rejette un libelle non textuel", async () => {
    const res = await request(app)
      .post(`/api/residents/${idResident}/allergies`)
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ libelle: 123, type: "allergie" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Champs obligatoires manquants" });
  });

  it("rejette un notes non textuel", async () => {
    const res = await request(app)
      .post(`/api/residents/${idResident}/allergies`)
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ libelle: "Arachides", type: "allergie", notes: 123 });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Notes invalides" });
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
    const cuisine = await prisma.utilisateur.findUnique({
      where: { login: "cuisine1" },
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
    const secretaire = await prisma.utilisateur.findUnique({
      where: { login: "secretaire1" },
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

    const secretaire = await prisma.utilisateur.findUnique({
      where: { login: "secretaire1" },
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

describe("GET /api/residents/:id/allergies", () => {
  let idResident;
  let tokenSecretaire;

  beforeAll(async () => {
    // résident 12 (appart 12, vide au seed), disjoint des fixtures POST
    const resident = await prisma.resident.create({
      data: {
        id_appartement: 12,
        prenom: "Test",
        nom: "Lecture",
        date_entree: new Date(),
      },
    });
    idResident = resident.id_resident;

    const secretaire = await prisma.utilisateur.findUnique({
      where: { login: "secretaire1" },
    });

    // deux allergies, notes explicite sur une pour prouver que le GET renvoie notes
    await prisma.allergie.createMany({
      data: [
        { id_resident: idResident, libelle: "Arachides", type: "allergie", notes: "sévère", created_by: secretaire.id_utilisateur },
        { id_resident: idResident, libelle: "Gluten", type: "intolerance", created_by: secretaire.id_utilisateur },
      ],
    });

    tokenSecretaire = jwt.sign(
      { userId: secretaire.id_utilisateur, role: "secretaire" },
      process.env.JWT_SECRET,
      { expiresIn: "11h" }
    );
  });

  it("renvoie les allergies du résident, enveloppées, sans created_by", async () => {
    const res = await request(app)
      .get(`/api/residents/${idResident}/allergies`)
      .set("Authorization", `Bearer ${tokenSecretaire}`);

    expect(res.status).toBe(200);
    expect(res.body.id_resident).toBe(idResident);
    expect(Array.isArray(res.body.allergies)).toBe(true);
    expect(res.body.allergies).toHaveLength(2);

    // forme d'un élément
    const a = res.body.allergies[0];
    expect(a).toHaveProperty("libelle");
    expect(a).toHaveProperty("type");
    expect(a).toHaveProperty("notes");
    expect(a).toHaveProperty("created_at");

    // minimisation : created_by dans aucun élément
    res.body.allergies.forEach((x) => {
      expect(x).not.toHaveProperty("created_by");
    });
  });
});

describe("GET /api/residents/:id/allergies - 404 résident absent", () => {
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

  it("retourne 404 quand le résident n'existe pas", async () => {
    const res = await request(app)
      .get("/api/residents/999999/allergies")
      .set("Authorization", `Bearer ${tokenSecretaire}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Résident introuvable" });
  });
});

describe("GET /api/residents/:id/allergies - résident sans allergie", () => {
  let idResident;
  let tokenSecretaire;

  beforeAll(async () => {
    // résident 13 (appart 13, vide au seed), aucune allergie créée
    const resident = await prisma.resident.create({
      data: {
        id_appartement: 13,
        prenom: "Test",
        nom: "Vide",
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

  it("renvoie une liste vide en 200, pas un 404", async () => {
    const res = await request(app)
      .get(`/api/residents/${idResident}/allergies`)
      .set("Authorization", `Bearer ${tokenSecretaire}`);

    expect(res.status).toBe(200);
    expect(res.body.id_resident).toBe(idResident);
    expect(res.body.allergies).toEqual([]);
  });
});

describe("DELETE /api/residents/:id/allergies/:id_allergie", () => {
  let idResident;
  let idAllergie;
  let tokenSecretaire;
 
  beforeAll(async () => {
    // résident 14 (appart 14, vide au seed), disjoint des autres fixtures
    const resident = await prisma.resident.create({
      data: {
        id_appartement: 14,
        prenom: "Test",
        nom: "Suppression",
        date_entree: new Date(),
      },
    });
    idResident = resident.id_resident;
 
    const secretaire = await prisma.utilisateur.findUnique({
      where: { login: "secretaire1" },
    });
 
    // create simple (pas createMany) pour récupérer l'id_allergie qui va dans l'URL du DELETE
    // created_by est NOT NULL, donc connect utilisateur obligatoire ici, pas de scalaire en create simple
    const allergie = await prisma.allergie.create({
      data: {
        libelle: "Arachides",
        type: "allergie",
        resident: { connect: { id_resident: idResident } },
        utilisateur: { connect: { id_utilisateur: secretaire.id_utilisateur } },
      },
    });
    idAllergie = allergie.id_allergie;
 
    tokenSecretaire = jwt.sign(
      { userId: secretaire.id_utilisateur, role: "secretaire" },
      process.env.JWT_SECRET,
      { expiresIn: "11h" }
    );
  });
 
  it("supprime l'allergie et renvoie 204 sans body", async () => {
    const res = await request(app)
      .delete(`/api/residents/${idResident}/allergies/${idAllergie}`)
      .set("Authorization", `Bearer ${tokenSecretaire}`);
 
    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
 
    // je relis en base : c'est la suppression que je prouve, pas le code de statut
    // hard delete, la ligne doit avoir disparu (art. 17, effacement réel d'une donnée de santé)
    const enBase = await prisma.allergie.findUnique({
      where: { id_allergie: idAllergie },
    });
    expect(enBase).toBeNull();
  });
});

describe("DELETE /api/residents/:id/allergies/:id_allergie - 400 forme", () => {
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
      .delete("/api/residents/xyz/allergies/1")
      .set("Authorization", `Bearer ${tokenSecretaire}`);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Identifiant de résident invalide" });
  });

  it("rejette un id_allergie non entier", async () => {
    const res = await request(app)
      .delete("/api/residents/14/allergies/abc")
      .set("Authorization", `Bearer ${tokenSecretaire}`);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Identifiant d'allergie invalide" });
  });
});

describe("DELETE /api/residents/:id/allergies/:id_allergie - 404 existence et appartenance", () => {
  let idResident15;
  let idResident16;
  let idAllergieDe15;
  let tokenSecretaire;

  beforeAll(async () => {
    const secretaire = await prisma.utilisateur.findUnique({
      where: { login: "secretaire1" },
    });

    const r15 = await prisma.resident.create({
      data: { id_appartement: 15, prenom: "Test", nom: "Proprio", date_entree: new Date() },
    });
    idResident15 = r15.id_resident;

    const r16 = await prisma.resident.create({
      data: { id_appartement: 16, prenom: "Test", nom: "Autre", date_entree: new Date() },
    });
    idResident16 = r16.id_resident;

    // allergie appartenant à 15
    const allergie = await prisma.allergie.create({
      data: {
        libelle: "Arachides",
        type: "allergie",
        resident: { connect: { id_resident: idResident15 } },
        utilisateur: { connect: { id_utilisateur: secretaire.id_utilisateur } },
      },
    });
    idAllergieDe15 = allergie.id_allergie;

    tokenSecretaire = jwt.sign(
      { userId: secretaire.id_utilisateur, role: "secretaire" },
      process.env.JWT_SECRET,
      { expiresIn: "11h" }
    );
  });

  it("retourne 404 quand l'allergie n'existe pas", async () => {
    const res = await request(app)
      .delete(`/api/residents/${idResident15}/allergies/999999`)
      .set("Authorization", `Bearer ${tokenSecretaire}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Allergie introuvable" });
  });

  it("retourne 404 quand l'allergie appartient à un autre résident", async () => {
    // allergie de 15 ciblée via l'URL de 16
    const res = await request(app)
      .delete(`/api/residents/${idResident16}/allergies/${idAllergieDe15}`)
      .set("Authorization", `Bearer ${tokenSecretaire}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Allergie introuvable" });
  });
});

describe("POST /api/residents/:id/allergies - 409 doublon sur forme normalisée (US-13, AT-02)", () => {
  let tokenSecretaire;
  let idResident;
  let idAppartement;

  beforeAll(async () => {
    const secretaire = await prisma.utilisateur.findUnique({ where: { login: "secretaire1" } });
    tokenSecretaire = jwt.sign(
      { userId: secretaire.id_utilisateur, role: "secretaire" },
      process.env.JWT_SECRET,
      { expiresIn: "11h" }
    );

    const appart = await prisma.appartement.create({
      data: { id_appartement: 9101, numero: 9101 },
    });
    idAppartement = appart.id_appartement;

    const resident = await prisma.resident.create({
      data: {
        id_appartement: 9101,
        prenom: "Test",
        nom: "Doublon",
        date_entree: new Date("2026-01-01T00:00:00.000Z"),
        actif: true,
      },
    });
    idResident = resident.id_resident;
  });

  afterAll(async () => {
    await prisma.allergie.deleteMany({ where: { id_resident: idResident } });
    if (idResident) await prisma.resident.deleteMany({ where: { id_resident: idResident } });
    if (idAppartement) await prisma.appartement.delete({ where: { id_appartement: idAppartement } });
  });

  it("refuse une seconde allergie de même forme normalisée, casse différente (Arachides / arachides)", async () => {
    const a = await request(app)
      .post(`/api/residents/${idResident}/allergies`)
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ libelle: "Arachides", type: "allergie" });
    expect(a.status).toBe(201);
    const b = await request(app)
      .post(`/api/residents/${idResident}/allergies`)
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ libelle: "arachides", type: "allergie" });
    expect(b.status).toBe(409);
  });

  it("refuse une seconde allergie de même forme normalisée, accent différent (Céleri / celeri)", async () => {
    const a = await request(app)
      .post(`/api/residents/${idResident}/allergies`)
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ libelle: "Céleri", type: "allergie" });
    expect(a.status).toBe(201);
    const b = await request(app)
      .post(`/api/residents/${idResident}/allergies`)
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ libelle: "celeri", type: "allergie" });
    expect(b.status).toBe(409);
  });

  it("refuse une seconde allergie de même forme normalisée, ligature (Œufs / oeufs)", async () => {
    const a = await request(app)
      .post(`/api/residents/${idResident}/allergies`)
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ libelle: "Œufs", type: "allergie" });
    expect(a.status).toBe(201);
    const b = await request(app)
      .post(`/api/residents/${idResident}/allergies`)
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ libelle: "oeufs", type: "allergie" });
    expect(b.status).toBe(409);
  });

  it("n'est pas un doublon quand les libellés diffèrent par un caractère non sanctionné (æ vs ae)", async () => {
    const a = await request(app)
      .post(`/api/residents/${idResident}/allergies`)
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ libelle: "Cæsar", type: "allergie" });
    expect(a.status).toBe(201);
    const b = await request(app)
      .post(`/api/residents/${idResident}/allergies`)
      .set("Authorization", `Bearer ${tokenSecretaire}`)
      .send({ libelle: "Caesar", type: "allergie" });
    expect(b.status).toBe(201);
  });
});