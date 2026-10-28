/**
 * فهرست شماره‌های ورود به دمو برای تماس و بازاریابی — docs/plans/demo.md
 *
 *   npx tsx scripts/demo/leads.ts > leads.csv          # همه
 *   npx tsx scripts/demo/leads.ts --since=7 > leads.csv # هفت روز اخیر
 *
 * CSV با BOM تا اکسل فارسی را درست باز کند. بخش‌ها همان مسیرهای پنل‌اند که آن
 * شماره باز کرده — مثلاً `/admin/integration` یعنی یکپارچه‌سازی را دیده.
 */
import "../../lib/load-env";
import { prisma } from "../../lib/prisma";

const since = Number(process.argv.find((a) => a.startsWith("--since="))?.split("=")[1] ?? 0);
const fa = (d: Date) =>
  new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-latn", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Tehran" }).format(d);
const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

async function main() {
  const rows = await prisma.demoLead.findMany({
    where: since > 0 ? { lastAt: { gte: new Date(Date.now() - since * 86_400_000) } } : undefined,
    orderBy: { lastAt: "desc" },
  });
  const out = ["شماره,اولین ورود,آخرین فعالیت,دفعات ورود,ورود از,بخش‌های دیده‌شده"];
  for (const r of rows) {
    out.push([r.phone, fa(r.firstAt), fa(r.lastAt), r.visits, r.source === "shop" ? "سایت" : "پنل", r.sections.join(" ")].map(cell).join(","));
  }
  process.stdout.write("﻿" + out.join("\n") + "\n");
  console.error(`${rows.length} شماره`);
}

main().finally(() => prisma.$disconnect());
