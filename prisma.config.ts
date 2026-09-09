import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// ترتیب مثل خود Next و `lib/load-env.ts`: `.env.local` اولویت دارد.
// dotenv متغیر موجود را بازنویسی نمی‌کند، پس اولین مقدار برنده است.
config({ path: ".env.local" });
config({ path: ".env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL!,
  },
  migrations: {
    seed: "tsx ./prisma/seed.ts",
  },
});
