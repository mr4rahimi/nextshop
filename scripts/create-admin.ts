import { prisma } from "../lib/prisma";

async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password + "mymonta-salt");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function main() {
  const phone = "09999936488";
  const password = "535318193@Mr";

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { phone },
    update: { passwordHash, role: "ADMIN", isActive: true },
    create: { phone, passwordHash, role: "ADMIN", isActive: true },
  });

  console.log("✅ ادمین ساخته شد:", user.id, user.phone, user.role);
}

main().catch(console.error).finally(() => prisma.$disconnect());
