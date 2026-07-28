import prisma from "../src/lib/prisma.js";
import { seedDatabase } from "./seedData.js";

// Wrapper CLI mince pour `prisma db seed` : appelle la source unique
// puis ferme la connexion. Toute la logique vit dans seedData.ts.
seedDatabase()
  .then(() => console.log("Seed terminé"))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
