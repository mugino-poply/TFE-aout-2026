import prisma from "../src/lib/prisma.js";
import bcrypt from "bcrypt";

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 12;

const utilisateurs = [
  { login: "secretaire1", prenom: "Olivia", code: "8181", role: "secretaire" as const },
  { login: "cuisine1", prenom: "Lionel", code: "0307", role: "cuisine" as const },
  { login: "serveur1", prenom: "Diego", code: "2120", role: "serveur" as const },
  { login: "admin1", prenom: "Hippolyte", code: "2911", role: "admin" as const },
];

// Invariants du seed pour US-04.
// Toute modif ici doit être répercutée dans les tests qui en dépendent.
//
// 88 apparts, numéros 3 à 90, id_appartement = numero.
// Appart 3 : couple actif, Giselle + Pierrot VanDenStraat.
//   Giselle a une allergie : "Arachides" (type allergie).
// Appart 4 : occupant unique actif, Hervé Raskin.
// Appart 5 : vacant.
// Appart 6 : occupant unique inactif, Baudouin Koning.
// Appart 7 : mixte, Francis De Jonghe actif + Leopold Oud inactif.
// Apparts 8 à 90 : vides.
// Invariant modèle : actif = false => date_sortie renseignée ; actif = true => date_sortie = null.

const residents = [
  { id_appartement: 3, prenom: "Giselle", nom: "VanDenStraat", actif: true, date_sortie: null },
  { id_appartement: 3, prenom: "Pierrot", nom: "VanDenStraat", actif: true, date_sortie: null },
  { id_appartement: 4, prenom: "Hervé", nom: "Raskin", actif: true, date_sortie: null },
  { id_appartement: 6, prenom: "Baudouin", nom: "Koning", actif: false, date_sortie: new Date("2024-06-15") },
  { id_appartement: 7, prenom: "Francis", nom: "De Jonghe", actif: true, date_sortie: null },
  { id_appartement: 7, prenom: "Leopold", nom: "Oud", actif: false, date_sortie: new Date("2024-09-01") },
];

async function main() {
  console.log("Seeding utilisateurs...");

  for (const u of utilisateurs) {
    const hash = await bcrypt.hash(u.code, BCRYPT_ROUNDS);

    await prisma.utilisateur.upsert({
      where: { login: u.login },
      update: {
        prenom: u.prenom,
        code_pin: hash,
        role: u.role,
        actif: true,
      },
      create: {
        login: u.login,
        prenom: u.prenom,
        code_pin: hash,
        role: u.role,
      },
    });

    console.log(`  ${u.role.padEnd(10)} ${u.prenom} (${u.login})`);
  }

  console.log("Seeding appartements, résidents et allergies...");

  // Ordre imposé par les FK : Allergie -> Resident -> Appartement.
  await prisma.allergie.deleteMany({});
  await prisma.resident.deleteMany({});
  await prisma.appartement.deleteMany({});

  const apparts = Array.from({ length: 88 }, (_, i) => ({
    id_appartement: i + 3,
    numero: i + 3,
  }));
  await prisma.appartement.createMany({ data: apparts });

  const now = new Date();
  await prisma.resident.createMany({
    data: residents.map((r) => ({
      id_appartement: r.id_appartement,
      prenom: r.prenom,
      nom: r.nom,
      actif: r.actif,
      date_entree: now,
      date_sortie: r.date_sortie,
    })),
  });

  // Allergie de Giselle : lookup nécessaire parce que id_resident est
  // autoincrement (pas connu à l'avance après un createMany).
  const giselle = await prisma.resident.findFirst({
    where: { prenom: "Giselle", nom: "VanDenStraat" },
  });
  const admin = await prisma.utilisateur.findUnique({
    where: { login: "admin1" },
  });

  await prisma.allergie.create({
    data: {
      id_resident: giselle!.id_resident,
      libelle: "Arachides",
      type: "allergie",
      created_by: admin!.id_utilisateur,
    },
  });

  console.log(`  ${apparts.length} appartements, ${residents.length} résidents, 1 allergie`);
  console.log("Seed terminé");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());