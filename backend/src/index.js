// Importe l'app et fait le listen - démarré par la prod
import "dotenv/config";
import app from "./app.js";

// Empêche le démarrage s'il manque les variables JWT_SECRET et DATABASE_URL
const required = ["JWT_SECRET", "DATABASE_URL"];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Variable d'environnement manquante : ${key}`);
    process.exit(1);
  }
}

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Serveur démarré sur le port ${port}`);
});