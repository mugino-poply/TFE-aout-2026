import prisma from "../src/lib/prisma.js";
import { seedDatabase, ENVIRONNEMENT } from "./seedData.js";

// seedDatabase() vide toutes les tables avant de recréer le jeu de démonstration.
// Comportement attendu en développement et en test, destructeur en production.
// La garde vit dans le wrapper CLI et non dans seedData.ts : le setup de test
// appelle seedDatabase() directement et ne doit jamais la traverser.
async function verifierDestructionAutorisee() {
  if (ENVIRONNEMENT !== "production") return;

  const [residents, commandes] = await Promise.all([
    prisma.resident.count(),
    prisma.commande.count(),
  ]);

  if (residents === 0 && commandes === 0) return;

  if (process.env.SEED_FORCE === "1") {
    console.warn(
      `SEED_FORCE actif : ${residents} résidents et ${commandes} commandes vont être supprimés`
    );
    return;
  }

  console.error(
    `Refus de seeder : la base contient ${residents} résidents et ${commandes} commandes que le seed supprimerait.`
  );
  console.error("Relancer avec SEED_FORCE=1 uniquement si cette suppression est voulue.");
  process.exit(1);
}

// Wrapper CLI mince pour `prisma db seed` : garde, source unique, fermeture
// de la connexion. Toute la logique de données vit dans seedData.ts.
verifierDestructionAutorisee()
  .then(() => seedDatabase())
  .then(() => console.log(`Seed terminé (${ENVIRONNEMENT})`))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
