// Charge les variables d'environnement et refuse le démarrage si l'une manque.
// Importé avant app.js dans index.js : aucun module applicatif ne peut lire une variable absente.
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
