import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { normalizePhone } from "@/lib/club/phone";
import { fromJalali } from "@/lib/club/jalali";
import { upsertClubCustomer } from "@/lib/club/profile";

export const runtime = "nodejs";

/**
 * ثبت مشتری حضوری توسط فروشنده — بدون OTP
 *
 * امنیت: middleware مسیر را قفل کرده، ولی نقش را اینجا هم بررسی می‌کنیم
 * (دفاع لایه‌ای — اگر روزی matcher تغییر کند این مسیر باز نمی‌شود).
 */
export async function POST(req: Request) {
  const seller = await getAuthUser();
  if (!seller || (seller.role !== "SELLER" && seller.role !== "ADMIN")) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  let body: {
    phone?: string;
    firstName?: string;
    lastName?: string;
    smsConsent?: boolean;
    birthYear?: number | string;
    birthMonth?: number | string;
    birthDay?: number | string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "بدنه درخواست نامعتبر است" }, { status: 400 });
  }

  const phone = normalizePhone(body.phone);
  if (!phone) {
    return NextResponse.json(
      { error: "شماره موبایل معتبر نیست — باید ۱۱ رقم و با ۰۹ شروع شود" },
      { status: 400 }
    );
  }

  // ── تاریخ تولد شمسی → میلادی ────────────────────────────────────
  let birthDate: Date | null = null;
  const y = Number(body.birthYear);
  const m = Number(body.birthMonth);
  const d = Number(body.birthDay);

  if (y && m && d) {
    birthDate = fromJalali(y, m, d);
    if (!birthDate) {
      return NextResponse.json({ error: "تاریخ تولد معتبر نیست" }, { status: 400 });
    }
  } else if (m || d || y) {
    return NextResponse.json(
      { error: "تاریخ تولد باید کامل وارد شود یا خالی بماند" },
      { status: 400 }
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    null;

  try {
    const result = await upsertClubCustomer({
      phone,
      firstName: clean(body.firstName),
      lastName: clean(body.lastName),
      source: "IN_STORE",
      registeredById: seller.id,
      birthDate,
      smsConsent: body.smsConsent === true,
      consentIp: ip,
    });

    // شمارش ثبت‌های امروزِ همین فروشنده — بازخورد برای پیشخوان
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todayCount = await prisma.clubProfile.count({
      where: { registeredById: seller.id, joinedAt: { gte: startOfDay } },
    });

    return NextResponse.json({
      success: true,
      phone: result.phone,
      fullName: result.fullName,
      isNewUser: result.isNewUser,
      isNewProfile: result.isNewProfile,
      alreadyMember: !result.isNewProfile,
      todayCount,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_PHONE") {
      return NextResponse.json({ error: "شماره موبایل معتبر نیست" }, { status: 400 });
    }
    console.error("[seller/register]", err);
    return NextResponse.json({ error: "ثبت انجام نشد. دوباره تلاش کنید" }, { status: 500 });
  }
}

function clean(v?: string): string | null {
  const t = v?.trim();
  return t ? t : null;
}