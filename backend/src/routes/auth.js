import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from '../lib/prisma.js'


const router = Router();

router.post("/login", async (req, res) => {  // async sur le handler
  const { id_utilisateur, code } = req.body;

  // Vérification de la longueut du code (>= 4 chiffres)
  if (typeof code !== "string" || !/^\d{4,}$/.test(code)) {
    return res.status(400).json({ error: "Code invalide" });
  }

  const id = Number(id_utilisateur);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Identifiant invalide" });
  }

  try {
    const utilisateur = await prisma.utilisateur.findUnique({
      where: { id_utilisateur: id },
    });

    // Même message si user inexistant, inactif ou mauvais code
    if (!utilisateur || !utilisateur.actif) {
      return res.status(401).json({ error: "Identifiants incorrects" });  // user inexistant / inactif
    }

    const codeValide = await bcrypt.compare(code, utilisateur.code_pin);  // await sur la comparaison
    if (!codeValide) {
      return res.status(401).json({ error: "Identifiants incorrects" });  // mauvais code pin
    }

    const token = jwt.sign(
      { userId: utilisateur.id_utilisateur, role: utilisateur.role },
      process.env.JWT_SECRET,
      { expiresIn: "11h" }
    );

    return res.json({ token });
  } catch (err) {
    console.error("Erreur login:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
