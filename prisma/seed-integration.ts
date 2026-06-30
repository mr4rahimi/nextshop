import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

const PLATFORMS = [
  { code: "hesaban",   name: "وب‌حسابان",  type: "ACCOUNTING" as const, logoUrl: null },
  { code: "basalam",   name: "باسلام",      type: "MARKETPLACE" as const, logoUrl: null },
  { code: "digikala",  name: "دیجیکالا",   type: "MARKETPLACE" as const, logoUrl: null },
  { code: "divar",     name: "دیوار",       type: "MARKETPLACE" as const, logoUrl: null },
  { code: "snappshop", name: "اسنپ‌شاپ",   type: "MARKETPLACE" as const, logoUrl: null },
  { code: "tapsi_shop",name: "تپسی‌شاپ",   type: "MARKETPLACE" as const, logoUrl: null },
];

async function main() {
  for (const p of PLATFORMS) {
    await prisma.integPlatform.upsert({
      where:  { code: p.code },
      update: { name: p.name, type: p.type },
      create: p,
    });
  }

  await prisma.integSettings.upsert({
    where:  { id: "singleton" },
    update: {},
    create: { id: "singleton", updatedAt: new Date() },
  });

  console.log("✓ Integration platforms seeded");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
