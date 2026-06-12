import prisma from "../src/lib/prisma.js";
import bcrypt from "bcrypt";

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 12;

const utilisateurs = [
  { login: "secretaire1", prenom: "Olivia", code: "8181", role: "secretaire" as const },
  { login: "cuisine1", prenom: "Lionel", code: "0307", role: "cuisine" as const },
  { login: "serveur1", prenom: "Diego", code: "2120", role: "serveur" as const },
  { login: "admin1", prenom: "Hippolyte", code: "2911", role: "admin" as const },
];

async function main() {
  console.log("Seeding utilisateurs...");

  for (const u of utilisateurs) {
    const hash = await bcrypt.hash(u.code, BCRYPT_ROUNDS);

    await prisma.utilisateur.upsert({
      where: { login: u.login },
      update: {
        prenom: u.prenom,
        code_pin: hash,
        role: u.role,
        actif: true,
      },
      create: {
        login: u.login,
        prenom: u.prenom,
        code_pin: hash,
        role: u.role,
      },
    });

    console.log(`  ${u.role.padEnd(10)} ${u.prenom} (${u.login})`);
  }

  console.log("Seed terminé");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());