/**
 * داده‌ی نمونه‌ی کارتابل — **فقط برای توسعه‌ی محلی**
 *
 *   npx tsx scripts/seed-worklist-demo.ts
 *
 * چهار کارمند (مثل مهام‌پرینت)، چند مشتری و کارهای نمونه در وضعیت‌های مختلف
 * می‌سازد تا بشود کارتابل را واقعاً دید و تست کرد.
 *
 * ⚠️ روی دیتابیس واقعی اجرا نکنید. اسکریپت اگر `DATABASE_URL` به `localhost`
 * یا `127.0.0.1` اشاره نکند، خودش جلوی اجرا را می‌گیرد.
 *
 * idempotent است: کاربرها upsert می‌شوند و کارهای نمونه فقط یک بار ساخته
 * می‌شوند (با `title` نشان‌دار شده).
 */

import "../lib/load-env";
import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/auth";

const DEMO_TAG = "[نمونه]";
const PASSWORD = "Test@12345";

const STAFF = [
  { phone: "09120000001", firstName: "مریم", lastName: "کریمی", role: "sales" },
  { phone: "09120000002", firstName: "سعید", lastName: "نوری", role: "support" },
  { phone: "09120000003", firstName: "الهام", lastName: "رستمی", role: "content" },
  { phone: "09120000004", firstName: "حسین", lastName: "دادگر", role: "procurement" },
];

const CUSTOMERS = [
  { phone: "09121110001", firstName: "احمد", lastName: "رضایی" },
  { phone: "09121110002", firstName: "زهرا", lastName: "موسوی" },
  { phone: "09121110003", firstName: "شرکت", lastName: "آریا صنعت" },
];

function guardLocal() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
    throw new Error(
      "این اسکریپت فقط روی دیتابیس محلی اجرا می‌شود. DATABASE_URL به localhost اشاره نمی‌کند.",
    );
  }
}

async function main() {
  guardLocal();

  const passwordHash = await hashPassword(PASSWORD);

  // ── مدیر ──────────────────────────────────────────────────────
  const managerRole = await prisma.staffRole.findUnique({ where: { slug: "manager" } });
  if (!managerRole) {
    throw new Error("نقش‌ها سید نشده‌اند. اول scripts/seed-staff-roles.ts را اجرا کنید.");
  }

  const manager = await prisma.user.upsert({
    where: { phone: "09120000000" },
    update: { role: "ADMIN", isActive: true, staffRoleId: managerRole.id },
    create: {
      phone: "09120000000",
      firstName: "مدیر",
      lastName: "سیستم",
      passwordHash,
      role: "ADMIN",
      isActive: true,
      staffRoleId: managerRole.id,
    },
  });

  // ── کارکنان ───────────────────────────────────────────────────
  const staff = [];
  for (const s of STAFF) {
    const role = await prisma.staffRole.findUnique({ where: { slug: s.role } });
    const user = await prisma.user.upsert({
      where: { phone: s.phone },
      update: { role: "ADMIN", isActive: true, staffRoleId: role?.id ?? null },
      create: {
        phone: s.phone,
        firstName: s.firstName,
        lastName: s.lastName,
        passwordHash,
        role: "ADMIN",
        isActive: true,
        staffRoleId: role?.id ?? null,
      },
    });
    staff.push({ ...user, name: `${s.firstName} ${s.lastName}` });
  }

  // ── مشتری‌ها ──────────────────────────────────────────────────
  const customers = [];
  for (const c of CUSTOMERS) {
    const user = await prisma.user.upsert({
      where: { phone: c.phone },
      update: {},
      create: { phone: c.phone, firstName: c.firstName, lastName: c.lastName, role: "CUSTOMER" },
    });
    customers.push({ ...user, name: `${c.firstName} ${c.lastName}` });
  }

  // ── کارهای نمونه ──────────────────────────────────────────────
  const already = await prisma.staffTask.count({ where: { title: { startsWith: DEMO_TAG } } });
  if (already > 0) {
    console.log(`\n${already} کار نمونه از قبل هست؛ کار تازه‌ای ساخته نشد.`);
    await report(manager.id);
    return;
  }

  const types = await prisma.staffTaskType.findMany({
    where: { slug: { in: [
      "sales-consult", "payment-followup", "supplier-quote",
      "dispatch-courier", "social-post", "install-support",
    ] } },
  });
  const byslug = Object.fromEntries(types.map((t) => [t.slug, t]));

  const hour = 3600_000;
  const now = Date.now();

  const plan = [
    // باز، مهلت امروز
    { slug: "sales-consult", owner: 0, customer: 0, due: now + 3 * hour, outcome: null,
      note: "درباره‌ی دستگاه برش پرسید، قیمت را فرستادم." },
    // عقب‌افتاده
    { slug: "payment-followup", owner: 0, customer: 1, due: now - 5 * hour, outcome: null,
      amount: 4_500_000n, note: "قرار بود دیروز واریز کند." },
    // بسته‌شده با نتیجه‌ی موفق
    { slug: "sales-consult", owner: 0, customer: 2, due: null, outcome: "ordered",
      note: "سفارش ده عددی ثبت شد." },
    // تأمین، باز
    { slug: "supplier-quote", owner: 3, customer: null, due: now + 20 * hour, outcome: null,
      amount: 1_200_000n, supplier: "پخش تهران", note: "منتظر لیست قیمت جدید." },
    // ارسال با SLA سه‌ساعته، عقب‌افتاده
    { slug: "dispatch-courier", owner: 1, customer: 0, due: now - 1 * hour, outcome: null,
      note: "پیک هنوز نرفته." },
    // محتوا، انجام‌شده
    { slug: "social-post", owner: 2, customer: null, due: null, outcome: "published",
      link: "https://t.me/example/123", note: "استوری و پست کانال منتشر شد." },
    // پشتیبانی، باز بدون مهلت
    { slug: "install-support", owner: 1, customer: 1, due: null, outcome: null,
      note: "راهنمای نصب را فرستادم، منتظر تماس." },
  ];

  let made = 0;
  for (const p of plan) {
    const type = byslug[p.slug];
    if (!type) continue;
    const owner = staff[p.owner];
    const customer = p.customer !== null ? customers[p.customer] : null;

    await prisma.staffTask.create({
      data: {
        typeId: type.id,
        domain: type.domain,
        channel: type.channel,
        source: "MANUAL",
        title: `${DEMO_TAG} ${type.title}`,
        ownerId: owner.id,
        ownerName: owner.name,
        createdById: manager.id,
        createdByName: "مدیر سیستم",
        status: p.outcome ? "DONE" : "OPEN",
        customerId: customer?.id ?? null,
        contactName: customer?.name ?? null,
        contactPhone: customer?.phone ?? null,
        supplierName: p.supplier ?? null,
        amount: p.amount ?? null,
        linkUrl: p.link ?? null,
        outcome: p.outcome,
        note: p.note,
        dueAt: p.due ? new Date(p.due) : null,
        occurredAt: new Date(now - 2 * hour),
        doneAt: p.outcome ? new Date() : null,
      },
    });
    made++;
  }

  // ── یک ارجاع فوری، برای دیدن پاپ‌آپ ───────────────────────────
  const toRefer = await prisma.staffTask.findFirst({
    where: { title: { startsWith: DEMO_TAG }, ownerId: staff[0].id, status: "OPEN" },
  });
  if (toRefer) {
    await prisma.$transaction([
      prisma.staffTaskReferral.create({
        data: {
          taskId: toRefer.id,
          fromId: manager.id,
          fromName: "مدیر سیستم",
          toId: staff[1].id,
          toName: staff[1].name,
          note: "مشتری عصبانی است، همین الان تماس بگیر.",
          isUrgent: true,
        },
      }),
      prisma.staffTask.update({
        where: { id: toRefer.id },
        data: { ownerId: staff[1].id, ownerName: staff[1].name, status: "IN_PROGRESS" },
      }),
    ]);
  }

  console.log(`\n${made} کار نمونه و یک ارجاع فوری ساخته شد.`);
  await report(manager.id);
}

async function report(managerId: string) {
  const [tasks, refs, staffCount] = await Promise.all([
    prisma.staffTask.count(),
    prisma.staffTaskReferral.count(),
    prisma.user.count({ where: { role: "ADMIN" } }),
  ]);
  console.log(`\nکار ${tasks} · ارجاع ${refs} · ادمین ${staffCount}`);
  console.log(`\nورود با هر کدام از این شماره‌ها، رمز: ${PASSWORD}`);
  console.log(`  09120000000  مدیر سیستم (نقش مدیر)  id=${managerId}`);
  for (const s of STAFF) console.log(`  ${s.phone}  ${s.firstName} ${s.lastName}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
