import { rateLimit, ipKeyGenerator, MemoryStore } from "express-rate-limit";
import { LOGIN_MAX_ECHECS, LOGIN_FENETRE_MS } from "../config/rateLimit.js";

// une seule instance de store, créée au chargement du module
// le limiteur ferme dessus (option store), le reset ferme sur la même référence
const loginStore = new MemoryStore();

export const loginRateLimit = rateLimit({
  windowMs: LOGIN_FENETRE_MS,
  limit: LOGIN_MAX_ECHECS,
  store: loginStore,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = ipKeyGenerator(req.ip);
    const id = req.body?.id_utilisateur;
    // id absent : requête malformée (400 en aval), clé IP seule
    // plutôt qu'un bucket partagé "ip:undefined"
    return id === undefined || id === null ? ip : `${ip}:${id}`;
  },
  handler: (req, res) => {
    res.status(429).json({ error: "Trop de tentatives de connexion, réessayez plus tard" });
  },
});

// table rase du store entier (pas de reset par clé), donc pas besoin
// de reconstruire IP:id_utilisateur ni de deviner l'IP de Supertest
export function resetLoginRateLimit() {
  loginStore.resetAll();
}