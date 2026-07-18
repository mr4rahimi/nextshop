import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { serialize } from "@/lib/serialize";
import { normalizePhone } from "@/lib/club/phone";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

const PAGE_SIZE = 20;

/** ساخت شرط فیلتر — بین لیست و خروجی Excel مشترک است */
export function buildMemberWhere(params: URLSearchParams): Prisma.ClubProfileWhereInput {
  const where: Prisma.ClubProfileWhereInput = {};
  const and: Prisma.ClubProfileWhereInput[] = [];

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
  const admin = await getAuthUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const where = buildMemberWhere(url.searchParams);

  const [items, total, stats] = await Promise.all([
    prisma.clubProfile.findMany({
      where,
      orderBy: { joinedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: MEMBER_SELECT,
    }),
    prisma.clubProfile.count({ where }),
    buildStats(),
  ]);

  return NextResponse.json(
    serialize({ items, total, page, pageSize: PAGE_SIZE, stats })
  );
}

/** آمار کلی — همیشه روی کل اعضا، مستقل از فیلتر فعلی */
async function buildStats() {
  const [all, consent, withBirth, buyers, bySource] = await Promise.all([
    prisma.clubProfile.count(),
    prisma.clubProfile.count({ where: { smsConsent: true } }),
    prisma.clubProfile.count({ where: { birthDate: { not: null } } }),
    prisma.clubProfile.count({ where: { orderCount: { gt: 0 } } }),
    prisma.clubProfile.groupBy({
      by: ["source"],
      _count: { _all: true },
    }),
  ]);

  return {
    all,
    consent,
    withBirth,
    buyers,
    bySource: Object.fromEntries(
      bySource.map((r) => [r.source, r._count._all])
    ) as Record<string, number>,
  };
}