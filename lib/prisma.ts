import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pgPool?: Pool;
};

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not set");

// یک Pool مشترک (برای dev/hmr)
const pool =
  globalForPrisma.pgPool ??
  new Pool({
    connectionString: databaseUrl,
    // اگر بعداً خطای SSL گرفتی، این را باز می‌کنیم:
    // ssl: { rejectUnauthorized: false },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.pgPool = pool;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg(pool),
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
