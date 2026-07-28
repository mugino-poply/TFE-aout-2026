import { seedDatabase } from "./prisma/seedData.js";

// setupFiles se ré-exécute avant chaque fichier de test : ce reseed tourne
// donc une fois par fichier. Chaque fichier repart de l'état seed connu,
// aucune création d'un fichier ne fuite dans un autre.
// Le compteur ci-dessous prouve la fréquence : autant de "[reseed]" que de fichiers.
console.log("[reseed]");
await seedDatabase();
