import { Router } from "express";
import { parseISO, isValid, getISOWeek, getISOWeekYear } from "date-fns";
import { authenticateToken, requireRole } from "../middlewares/auth.js";
import prisma from "../lib/prisma.js";
import { CategorieOption } from "@prisma/client";

const menusRouter = Router();

menusRouter.post("/", authenticateToken, requireRole(["secretaire", "cuisine"]), async (req, res) => {
    const { date, options } = req.body;

    if (date === undefined) {
      return res.status(400).json({ error: "Champs obligatoires manquants" });
    }

    if (options === undefined) {
      return res.status(400).json({ error: "Champs obligatoires manquants" });
    }

    if (typeof date !== "string") {
      return res.status(400).json({ error: "Date invalide" });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "Date invalide" });
    }

    const dateObj = parseISO(date);

    if (!isValid(dateObj)) {
      return res.status(400).json({ error: "Date invalide" });
    }

    if (!Array.isArray(options)) {
      return res.status(400).json({ error: "Format des options invalide" });
    }

    if (options.length === 0) {
      return res.status(400).json({ error: "Au moins une option est requise" });
    }

    if (options.some((o) => typeof o.libelle !== "string" || o.libelle.trim() === "")) {
      return res.status(400).json({ error: "Libellé d'option invalide" });
    }

    if (options.some((o) => !Object.values(CategorieOption).includes(o.categorie))) {
      return res.status(400).json({ error: "Catégorie d'option invalide" });
    }

    const menu = await prisma.menu.create({
      data: {
        date_menu: dateObj,
        semaine: getISOWeek(dateObj),
        annee: getISOWeekYear(dateObj),
        options: {
          create: options.map((o) => ({
            libelle: o.libelle,
            categorie: o.categorie,
          })),
        },
      },
      select: {
        id_menu: true,
        options: {
          select: { id_option: true, libelle: true, categorie: true },
          orderBy: { id_option: "asc" },
        },
      },
    });

    return res.status(201).json(menu);
  }
);

export default menusRouter;