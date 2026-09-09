import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { normalizePhone, toEnglishDigits } from "@/lib/club/phone";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * تکمیل خودکار مخاطب برای فرم ثبت سریع.
 *
 * تایپ نام مشتری بزرگ‌ترین منبع اصطکاک و غلط‌املایی است، پس شماره یا بخشی از
 * نام کافی است. شماره‌ها با `lib/club/phone.ts` نرمال می‌شوند — نسخه‌ی تازه
 * ننویسید، وگرنه شماره‌ی یک مشتری در دو جا دو شکل ذخیره می‌شود.
 */
export async function GET(req: Request) {
  const guard = await requirePermission(["WORK_CREATE", "CALL_LOG", "WORK_VIEW_ALL"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ items: [] });

  const digits = toEnglishDigits(q);
  const normalized = normalizePhone(q);

  const or: Prisma.UserWhereInput[] = [
    { firstName: { contains: q, mode: "insensitive" } },
    { lastName: { contains: q, mode: "insensitive" } },
  ];
  if (/\d/.test(digits)) or.push({ phone: { contains: digits } });
  if (normalized) or.push({ phone: normalized });

  const users = await prisma.user.findMany({
    where: { OR: or },
    take: 8,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      clubProfile: { select: { id: true, orderCount: true, lastPurchaseAt: true } },
      _count: { select: { orders: true } },
    },
  });

  return NextResponse.json({
    items: users.map((u) => ({
      id: u.id,
      name: [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || "بدون نام",
      phone: u.phone,
      isClubMember: !!u.clubProfile,
      orderCount: u._count.orders,
      lastPurchaseAt: u.clubProfile?.lastPurchaseAt ?? null,
    })),
  });
}
