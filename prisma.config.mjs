import { config } from "dotenv";

// ترتیب مثل خود Next و `lib/load-env.ts`: `.env.local` اولویت دارد.
config({ path: ".env.local" });
config({ path: ".env" });

/** @type {import("prisma/config").PrismaConfig} */
export default {
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    seed: "tsx ./prisma/seed.ts",
  },
};
