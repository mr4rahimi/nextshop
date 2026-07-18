import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { NextResponse } from "next/server";
import { buildMemberWhere } from "../route";
import { formatJalaliShort } from "@/lib/club/jalali";

export const runtime = "nodejs";

const SOURCE_FA: Record<string, string> = {
  ONLINE: "سایت",
  IN_STORE: "حضوری",
  CALLER_ID: "شماره‌گیر",
  IMPORT: "ورود فایل",
  MARKETPLACE: "مارکت‌پلیس",
};

/**
 * خروجی CSV اعضای باشگاه با همان فیلترهای صفحه لیست
 *
 * نکته مهم: فایل با BOM شروع می‌شود (`\uFEFF`) وگرنه اکسل فارسی را
 * به‌صورت کاراکترهای درهم نمایش می‌دهد.
 */
export async function GET(req: Request) {
  const admin = await getAuthUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  const url = new URL(req.url);
  const where = buildMemberWhere(url.searchParams);

  const rows = await prisma.clubProfile.findMany({
    where,
    orderBy: { joinedAt: "desc" },
    take: 50_000, // سقف ایمن
    select: {
      source: true,
      sourcePlatform: true,
      smsConsent: true,
      birthDate: true,
      gender: true,
      totalSpent: true,
      orderCount: true,
      lastPurchaseAt: true,
      isBlocked: true,
      tags: true,
      note: true,
      joinedAt: true,
      user: {
        select: { firstName: true, lastName: true, phone: true, email: true },
      },
    },
  });

  const headers = [
    "نام",
    "نام خانوادگی",
    "موبایل",
    "ایمیل",
    "منبع عضویت",
    "پلتفرم",
    "رضایت پیامک",
    "تاریخ تولد",
    "تعداد خرید",
    "مجموع خرید (تومان)",
    "آخرین خرید",
    "مسدود",
    "برچسب‌ها",
    "یادداشت",
    "تاریخ عضویت",
  ];

  const lines = [headers.map(csv).join(",")];

  for (const r of rows) {
    lines.push(
      [
        r.user.firstName ?? "",
        r.user.lastName ?? "",
        // پیشوند ' تا اکسل صفر ابتدای شماره را حذف نکند
        `'${r.user.phone}`,
        r.user.email ?? "",
        SOURCE_FA[r.source] ?? r.source,
        r.sourcePlatform ?? "",
        r.smsConsent ? "بله" : "خیر",
        r.birthDate ? formatJalaliShort(r.birthDate) : "",
        String(r.orderCount),
        r.totalSpent.toString(),
        r.lastPurchaseAt ? formatJalaliShort(r.lastPurchaseAt) : "",
        r.isBlocked ? "بله" : "خیر",
        r.tags.join(" | "),
        r.note ?? "",
        formatJalaliShort(r.joinedAt),
      ]
        .map(csv)
        .join(",")
    );
  }

  const body = "\uFEFF" + lines.join("\r\n");
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="club-members-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

/** فرار دادن مقادیر CSV */
function csv(value: string): string {
  const v = String(value ?? "").replace(/\r?\n/g, " ");
  return /[",]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}