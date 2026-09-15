import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { normalizePhone } from "@/lib/club/phone";
import { requirePermission, can, type StaffAccess } from "@/lib/permissions";
import { addCustomer, ownershipScope } from "@/lib/club/ownership";
import { logActivityAsync } from "@/lib/activity";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

const PAGE_SIZE = 20;

/**
 * ساخت شرط فیلتر — بین لیست و خروجی Excel مشترک است.
 *
 * ⚠️ مرز مالکیت (`access`) همیشه در همان آرایه‌ی `and` می‌نشیند که فیلترها؛
 * هیچ فیلتری نمی‌تواند آن را جایگزین کند (تله‌ی ۱۶).
 */
export function buildMemberWhere(
  params: URLSearchParams,
  access: StaffAccess,
): Prisma.ClubProfileWhereInput {
  const where: Prisma.ClubProfileWhereInput = {};
  const and: Prisma.ClubProfileWhereInput[] = [];

  const scope = ownershipScope(access);
  if (scope) and.push(scope);

  // صاحب: me = خودم، none = بی‌صاحب، یا شناسه‌ی کارمند
  const owner = params.get("owner");
  if (owner === "me") and.push({ ownerId: access.userId });
  else if (owner === "none") and.push({ ownerId: null });
  else if (owner) and.push({ ownerId: owner });

  const category = params.get("category");
  if (category === "none") and.push({ categoryId: null });
  else if (category) and.push({ categoryId: category });

  const q = params.get("q")?.trim();
  if (q) {
    // اگر ورودی شبیه شماره است، نرمال‌شده هم جستجو شود
    const asPhone = normalizePhone(q);
    and.push({
      user: {
        OR: [
          { phone: { contains: asPhone ?? q } },
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
        ],
      },
    });
  }

  const source = params.get("source");
  if (source) and.push({ source: source as Prisma.EnumClubSourceFilter["equals"] });

  const platform = params.get("platform");
  if (platform) and.push({ sourcePlatform: platform });

  const consent = params.get("consent");
  if (consent === "yes") and.push({ smsConsent: true });
  if (consent === "no") and.push({ smsConsent: false });

  const birth = params.get("birth");
  if (birth === "yes") and.push({ birthDate: { not: null } });
  if (birth === "no") and.push({ birthDate: null });

  const birthMonth = params.get("birthMonth");
  if (birthMonth) and.push({ birthMonth: Number(birthMonth) });

  const buyer = params.get("buyer");
  if (buyer === "yes") and.push({ orderCount: { gt: 0 } });
  if (buyer === "no") and.push({ orderCount: 0 });

  if (params.get("blocked") === "yes") and.push({ isBlocked: true });

  if (and.length > 0) where.AND = and;
  return where;
}

export const MEMBER_SELECT = {
  id: true,
  source: true,
  sourcePlatform: true,
  smsConsent: true,
  consentAt: true,
  // آخرین رویداد رضایت — ادمین باید ببیند رضایت از کجا آمده، نه فقط اینکه هست
  consentEvents: {
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { granted: true, source: true, ip: true, createdAt: true },
  },
  birthDate: true,
  birthMonth: true,
  birthDay: true,
  gender: true,
  totalSpent: true,
  orderCount: true,
  lastPurchaseAt: true,
  isBlocked: true,
  tags: true,
  note: true,
  joinedAt: true,
  ownerId: true,
  ownerName: true,
  claimedVia: true,
  claimedAt: true,
  categoryId: true,
  category: { select: { id: true, title: true, color: true } },
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      isActive: true,
    },
  },
} satisfies Prisma.ClubProfileSelect;

export async function GET(req: Request) {
  const guard = await requirePermission(["CUSTOMER_VIEW_OWN", "CUSTOMER_VIEW_ALL"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { access } = guard;

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const where = buildMemberWhere(url.searchParams, access);
  const viewAll = can(access, "CUSTOMER_VIEW_ALL");
  const canAssign = can(access, "CUSTOMER_ASSIGN");

  const [items, total, stats, categories, staff] = await Promise.all([
    prisma.clubProfile.findMany({
      where,
      orderBy: { joinedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: MEMBER_SELECT,
    }),
    prisma.clubProfile.count({ where }),
    buildStats(ownershipScope(access) ?? {}),
    prisma.clubCustomerCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      select: { id: true, title: true, color: true },
    }),
    // فهرست کارکنان فقط برای فیلتر صاحب و جابه‌جایی لازم است
    viewAll || canAssign
      ? prisma.user.findMany({
          where: { isActive: true, role: { in: ["ADMIN", "SELLER"] } },
          orderBy: [{ firstName: "asc" }, { phone: "asc" }],
          select: { id: true, firstName: true, lastName: true, phone: true },
        })
      : [],
  ]);

  return NextResponse.json(
    serialize({
      items,
      total,
      page,
      pageSize: PAGE_SIZE,
      stats,
      categories,
      staff: staff.map((u) => ({
        id: u.id,
        name: [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.phone,
      })),
      me: { id: access.userId, name: access.name },
      can: {
        viewAll,
        create: can(access, "CUSTOMER_CREATE"),
        edit: can(access, "CUSTOMER_EDIT"),
        assign: canAssign,
        manageCategories: can(access, "CUSTOMER_CATEGORY_MANAGE"),
        // پیام انبوه و خروجی کل فهرست هنوز مسیرهای مدیریتیِ باشگاه‌اند
        bulkMessage: viewAll && can(access, "PANEL_CLUB"),
      },
    })
  );
}

/** ثبت دستی مشتری — فرم سه‌فیلدی: شماره، نام، دسته (بخش ۲۱.۵) */
export async function POST(req: Request) {
  const guard = await requirePermission("CUSTOMER_CREATE");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.phone !== "string") {
    return NextResponse.json({ error: "شماره‌ی موبایل لازم است" }, { status: 400 });
  }

  try {
    const result = await addCustomer(
      {
        phone: body.phone,
        firstName: typeof body.firstName === "string" ? body.firstName : null,
        lastName: typeof body.lastName === "string" ? body.lastName : null,
        categoryId: typeof body.categoryId === "string" && body.categoryId ? body.categoryId : null,
      },
      guard.access,
    );
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });

    if (!result.alreadyMine) {
      logActivityAsync({
        action: "CREATE",
        entity: "USER",
        entityId: result.profileId,
        summary: `ثبت مشتری ${normalizePhone(body.phone)} در فهرست ${guard.access.name}`,
      });
    }
    return NextResponse.json(result, { status: result.alreadyMine ? 200 : 201 });
  } catch (e) {
    console.error("[club] ثبت مشتری شکست خورد:", e);
    return NextResponse.json({ error: "ثبت مشتری ناموفق بود" }, { status: 500 });
  }
}

/**
 * آمار کلی — همیشه روی کل اعضا، مستقل از فیلتر فعلی
 *
 * ⚠️ «قابل دسترس» با «رضایت پیامک» یکی نیست: عضوی که در ربات بله عضو است
 *    بدون رضایت پیامک هم پیام می‌گیرد. نمایش تنها نرخ رضایت پیامک، با آمدن
 *    کانال‌های پیام‌رسان تصویر غلط می‌دهد.
 */
async function buildStats(scope: Prisma.ClubProfileWhereInput) {
  const since = new Date(Date.now() - 30 * 86_400_000);
  // کارمندی که فقط مشتریان خودش را می‌بیند، آمار همان‌ها را هم می‌بیند
  const w = (extra: Prisma.ClubProfileWhereInput = {}): Prisma.ClubProfileWhereInput => ({ AND: [scope, extra] });

  const [all, consent, withBirth, buyers, bySource, messenger, reachable, recentConsent] =
    await Promise.all([
      prisma.clubProfile.count({ where: w() }),
      prisma.clubProfile.count({ where: w({ smsConsent: true }) }),
      prisma.clubProfile.count({ where: w({ birthDate: { not: null } }) }),
      prisma.clubProfile.count({ where: w({ orderCount: { gt: 0 } }) }),
      prisma.clubProfile.groupBy({
        by: ["source"],
        where: w(),
        _count: { _all: true },
      }),
      prisma.clubProfile.count({
        where: w({ identities: { some: { isActive: true, channel: { not: "SMS" } } } }),
      }),
      prisma.clubProfile.count({
        where: w({
          isBlocked: false,
          OR: [
            { smsConsent: true },
            { identities: { some: { isActive: true, channel: { not: "SMS" } } } },
          ],
        }),
      }),
      prisma.clubConsentEvent.groupBy({
        by: ["source"],
        where: { granted: true, createdAt: { gte: since }, profile: w() },
        _count: { _all: true },
      }),
    ]);

  return {
    all,
    consent,
    withBirth,
    buyers,
    messenger,
    reachable,
    bySource: Object.fromEntries(
      bySource.map((r) => [r.source, r._count._all])
    ) as Record<string, number>,
    consentBySource: Object.fromEntries(
      recentConsent.map((r) => [r.source, r._count._all])
    ) as Record<string, number>,
  };
}