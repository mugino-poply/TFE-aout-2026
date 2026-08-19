// Charge le .env et refuse le démarrage si une variable attendue manque ou est invalide.
// Importé en premier dans index.js, donc la validation s'exécute avant l'évaluation d'app.js.
// Limite connue : plusieurs modules lisent encore process.env en direct plutôt que d'importer
// ce fichier, la garantie repose donc sur l'ordre des imports d'index.js et non sur la structure.
import "dotenv/config";

const required = ["JWT_SECRET", "DATABASE_URL", "PORT"];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`Variable d'environnement manquante : ${key}`);
    process.exit(1);
  }
}

export const PORT = Number(process.env.PORT);

if (!Number.isInteger(PORT) || PORT <= 0) {
  console.error(`Variable d'environnement invalide : PORT`);
  process.exit(1);
}
