import { PrismaPg } from "@prisma/adapter-pg"; // driver nécessaire depuis Prisma 7
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

export default prisma;