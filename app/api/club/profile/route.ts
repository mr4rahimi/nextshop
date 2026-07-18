import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { fromJalali, toJalali } from "@/lib/club/jalali";
import {
  ensureClubProfile,
  setBirthDate,
  setSmsConsent,
  getPointsBalance,
} from "@/lib/club/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** پروفایل باشگاه کاربر وارد شده */
export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "احراز هویت نشده" }, { status: 401 });
  }

  // اگر کاربر قدیمی است و هنوز پروفایل ندارد، همین‌جا ساخته می‌شود
  const profile = await ensureClubProfile(user.id, { source: "ONLINE" });

  const [points, tier, settings] = await Promise.all([
    getPointsBalance(profile.id),
    profile.tierId
      ? prisma.clubTier.findUnique({
          where: { id: profile.tierId },
          select: { title: true, color: true, benefits: true },
        })
      : null,
    prisma.storeSettings.findUnique({
      where: { id: "singleton" },
      select: { clubName: true, clubEnabled: true },
    }),
  ]);

  const birth = profile.birthDate ? toJalali(profile.birthDate) : null;

  return NextResponse.json({
    clubName: settings?.clubName ?? "باشگاه مشتریان",
    clubEnabled: settings?.clubEnabled ?? false,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    joinedAt: profile.joinedAt,
    source: profile.source,
    smsConsent: profile.smsConsent,
    birth: birth
      ? { year: birth.year, month: birth.month, day: birth.day }
      : null,
    points,
    tier,
    stats: {
      orderCount: profile.orderCount,
      totalSpent: profile.totalSpent.toString(),
      lastPurchaseAt: profile.lastPurchaseAt,
    },
  });
}

/** به‌روزرسانی اطلاعات باشگاه توسط خود کاربر */
export async function PATCH(req: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "احراز هویت نشده" }, { status: 401 });
  }

  let body: {
    firstName?: string;
    lastName?: string;
    smsConsent?: boolean;
    birthYear?: number | string | null;
    birthMonth?: number | string | null;
    birthDay?: number | string | null;
    clearBirthDate?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "بدنه درخواست نامعتبر است" }, { status: 400 });
  }

  await ensureClubProfile(user.id, { source: "ONLINE" });

  // ── نام ─────────────────────────────────────────────────────────
  const nameData: { firstName?: string; lastName?: string } = {};
  if (typeof body.firstName === "string") nameData.firstName = body.firstName.trim();
  if (typeof body.lastName === "string") nameData.lastName = body.lastName.trim();

  if (Object.keys(nameData).length > 0) {
    await prisma.user.update({ where: { id: user.id }, data: nameData });
  }

  // ── تاریخ تولد ──────────────────────────────────────────────────
  if (body.clearBirthDate) {
    await setBirthDate(user.id, null);
  } else if (body.birthYear && body.birthMonth && body.birthDay) {
    const date = fromJalali(
      Number(body.birthYear),
      Number(body.birthMonth),
      Number(body.birthDay)
    );
    if (!date) {
      return NextResponse.json({ error: "تاریخ تولد معتبر نیست" }, { status: 400 });
    }
    if (date > new Date()) {
      return NextResponse.json(
        { error: "تاریخ تولد نمی‌تواند در آینده باشد" },
        { status: 400 }
      );
    }
    await setBirthDate(user.id, date);
  }

  // ── رضایت پیامک ─────────────────────────────────────────────────
  if (typeof body.smsConsent === "boolean") {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      req.headers.get("x-real-ip") ??
      null;
    await setSmsConsent(user.id, body.smsConsent, ip);
  }

  return NextResponse.json({ success: true });
}
