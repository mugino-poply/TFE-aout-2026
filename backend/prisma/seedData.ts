import prisma from "../src/lib/prisma.js";
import bcrypt from "bcrypt";

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 12;

const ENVIRONNEMENTS = ["development", "test", "production"] as const;
type Environnement = (typeof ENVIRONNEMENTS)[number];

// Le seed doit savoir explicitement où il tourne. Une valeur absente n'est pas
// interprétée comme "développement" : elle arrête le processus. Sans cette
// inversion, oublier NODE_ENV sur le serveur poserait silencieusement les codes
// du dépôt en base, alors qu'ici l'oubli produit un arrêt net et un message.
function lireEnvironnement(): Environnement {
  const valeur = process.env.NODE_ENV;

  if (!valeur) {
    console.error("NODE_ENV non défini : le seed refuse de tourner sans connaître son contexte.");
    console.error(`Valeurs acceptées : ${ENVIRONNEMENTS.join(", ")}`);
    process.exit(1);
  }

  if (!ENVIRONNEMENTS.includes(valeur as Environnement)) {
    console.error(`NODE_ENV inconnu : ${valeur}`);
    console.error(`Valeurs acceptées : ${ENVIRONNEMENTS.join(", ")}`);
    process.exit(1);
  }

  return valeur as Environnement;
}

export const ENVIRONNEMENT = lireEnvironnement();

// Codes PIN de développement. Versionnés, donc publics : ils n'ouvrent qu'une base
// jetable et locale. En production chaque code vient de l'environnement.
const PINS_DEV = {
  secretaire1: "8181",
  cuisine1: "0307",
  serveur1: "2120",
  admin1: "2911",
};

// En production, l'absence de la variable est fatale : on ne crée jamais un compte
// dont le code est lisible dans le dépôt. Hors production, repli sur la valeur de
// développement pour que la suite de tests reste exécutable après un simple clone.
function lirePin(login: keyof typeof PINS_DEV, variable: string): string {
  const valeur = process.env[variable];

  if (!valeur) {
    if (ENVIRONNEMENT === "production") {
      console.error(`Variable d'environnement manquante : ${variable} (code du compte ${login})`);
      process.exit(1);
    }
    return PINS_DEV[login];
  }

  if (!/^\d{4}$/.test(valeur)) {
    console.error(`${variable} doit contenir exactement 4 chiffres`);
    process.exit(1);
  }

  return valeur;
}

const utilisateurs = [
  {
    login: "secretaire1",
    prenom: "Olivia",
    code: lirePin("secretaire1", "SEED_PIN_SECRETAIRE"),
    role: "secretaire" as const,
  },
  {
    login: "cuisine1",
    prenom: "Lionel",
    code: lirePin("cuisine1", "SEED_PIN_CUISINE"),
    role: "cuisine" as const,
  },
  {
    login: "serveur1",
    prenom: "Diego",
    code: lirePin("serveur1", "SEED_PIN_SERVEUR"),
    role: "serveur" as const,
  },
  {
    login: "admin1",
    prenom: "Hippolyte",
    code: lirePin("admin1", "SEED_PIN_ADMIN"),
    role: "admin" as const,
  },
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

// Source de vérité unique du seed. Utilisée par le CLI (seed.ts, pour
// `prisma db seed`) ET par le setup de test (reset à l'état connu avant
// chaque fichier). Ne gère PAS la connexion : pas de $disconnect ici, le
// client est partagé (CLI le ferme, les tests le réutilisent d'un fichier à l'autre).
export async function seedDatabase() {
  // Reset : suppression dans l'ordre des FK (enfants -> parents),
  // sinon une contrainte violée ferait planter le wipe.
  await prisma.ligneCommande.deleteMany({});
  await prisma.boisson.deleteMany({});
  await prisma.allergie.deleteMany({});
  await prisma.commande.deleteMany({});
  await prisma.optionMenu.deleteMany({});
  await prisma.resident.deleteMany({});
  await prisma.menu.deleteMany({});
  await prisma.boissonCatalogue.deleteMany({});
  await prisma.appartement.deleteMany({});
  await prisma.utilisateur.deleteMany({});

  // Utilisateurs (hash bcrypt). create suffit : on vient de tout vider.
  for (const u of utilisateurs) {
    const hash = await bcrypt.hash(u.code, BCRYPT_ROUNDS);
    await prisma.utilisateur.create({
      data: { login: u.login, prenom: u.prenom, code_pin: hash, role: u.role },
    });
  }

  // Appartements 3 à 90 (id_appartement = numero).
  const apparts = Array.from({ length: 88 }, (_, i) => ({
    id_appartement: i + 3,
    numero: i + 3,
  }));
  await prisma.appartement.createMany({ data: apparts });

  // Résidents du seed.
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

  // Allergie de Giselle : lookup car id_resident est autoincrement
  // (inconnu à l'avance après un createMany).
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
}
