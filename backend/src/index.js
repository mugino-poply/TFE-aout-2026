// Importe l'app et fait le listen - démarré par la prod
import { PORT } from "./config/env.js";
import app from "./app.js";
import prisma from "./lib/prisma.js";

// Empêche le démarrage si la base ne répond pas : un serveur en ligne implique une base joignable.
// Le message reste générique : l'erreur brute de Prisma peut contenir l'URL de connexion,
// et ce log part dans les journaux de PM2 à chaque tentative de redémarrage.
try {
  await prisma.$queryRaw`SELECT 1`;
} catch (erreur) {
  console.error(`Base de données injoignable au démarrage (code ${erreur.code ?? "inconnu"})`);
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
