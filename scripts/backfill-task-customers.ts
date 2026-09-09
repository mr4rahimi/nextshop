/**
 * وصل‌کردن کارهای بی‌مشتری به کاربر، از روی شماره‌ی تلفن
 *
 *   npx tsx scripts/backfill-task-customers.ts --dry
 *   npx tsx scripts/backfill-task-customers.ts
 *
 * چرا لازم است: تماس با کسی که هنوز در سیستم نیست هم ثبت می‌شود، پس
 * `contactPhone` پر می‌شود ولی `customerId` خالی می‌ماند. وقتی همان شخص
 * بعداً عضو شد، این اسکریپت تاریخچه‌ی قبلی‌اش را به پرونده‌اش وصل می‌کند.
 *
 * ⚠️ با `--dry` فقط گزارش می‌دهد و چیزی نمی‌نویسد. **همیشه اول با `--dry`.**
 *
 * شماره‌ها با `lib/club/phone.ts` نرمال می‌شوند — همان تابعی که همه‌جای
 * پروژه استفاده می‌شود. نسخه‌ی تازه ننویسید، وگرنه شماره‌ی یک نفر در دو جا
 * دو شکل ذخیره می‌شود.
 */

import "../lib/load-env";
import { prisma } from "../lib/prisma";
import { normalizePhone } from "../lib/club/phone";

const DRY = process.argv.includes("--dry");

async function main() {
  const orphans = await prisma.staffTask.findMany({
    where: { customerId: null, contactPhone: { not: null } },
    select: { id: true, contactPhone: true, contactName: true, title: true },
  });

  if (orphans.length === 0) {
    console.log("هیچ کارِ بی‌مشتری با شماره‌ی تلفن پیدا نشد.");
    return;
  }

  console.log(`${orphans.length} کار بدون مشتری ولی با شماره پیدا شد.\n`);

  // شماره‌های یکتا را یک بار نگاه می‌کنیم، نه یک کوئری به‌ازای هر کار
  const phones = new Set<string>();
  for (const t of orphans) {
    const p = normalizePhone(t.contactPhone);
    if (p) phones.add(p);
  }

  const users = await prisma.user.findMany({
    where: { phone: { in: [...phones] } },
    select: { id: true, phone: true, firstName: true, lastName: true },
  });
  const byPhone = new Map(users.map((u) => [u.phone, u]));

  let matched = 0;
  let unmatched = 0;

  for (const t of orphans) {
    const p = normalizePhone(t.contactPhone);
    const user = p ? byPhone.get(p) : undefined;

    if (!user) {
      unmatched++;
      continue;
    }

    const name =
      [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.phone;

    if (DRY) {
      console.log(`  ${t.title.slice(0, 40)} → ${name} (${user.phone})`);
    } else {
      await prisma.staffTask.update({
        where: { id: t.id },
        data: {
          customerId: user.id,
          // نام ثبت‌شده دست نمی‌خورد اگر کارمند چیزی نوشته بود
          contactName: t.contactName ?? name,
        },
      });
    }
    matched++;
  }

  console.log(
    `\n${DRY ? "[آزمایشی] " : ""}وصل‌شده ${matched} · بدون تطبیق ${unmatched}`,
  );
  if (DRY && matched > 0) {
    console.log("برای اعمال واقعی، بدون --dry اجرا کنید.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
