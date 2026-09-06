import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { getOrCreateReferralCode, applyReferral } from "@/lib/club/referral";
import { loadPointRules } from "@/lib/club/points";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** کد معرفی من + آمار معرفی‌هایم */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "احراز هویت نشده" }, { status: 401 });

  const profile = await prisma.clubProfile.findUnique({
    where: { userId: user.id },
    select: { id: true, referredById: true, orderCount: true },
  });
  if (!profile) return NextResponse.json({ error: "عضو باشگاه نیستید" }, { status: 404 });

  const rules = await loadPointRules();
  const enabled = rules.onReferrer > 0 || rules.onReferee > 0;

  if (!enabled) {
    return NextResponse.json({ enabled: false, code: null, invited: 0, purchased: 0 });
  }

  const code = await getOrCreateReferralCode(profile.id);

  const [invited, purchased] = await Promise.all([
    prisma.clubProfile.count({ where: { referredById: profile.id } }),
    // معرفی‌شده‌هایی که واقعاً خرید کرده‌اند — همان‌هایی که پاداش داده‌اند
    prisma.clubProfile.count({ where: { referredById: profile.id, orderCount: { gt: 0 } } }),
  ]);

  return NextResponse.json({
    enabled: true,
    code,
    invited,
    purchased,
    rewardReferrer: rules.onReferrer,
    rewardReferee: rules.onReferee,
    // آیا خودش با کد کسی عضو شده — و آیا هنوز فرصت وارد کردنش را دارد.
    // بعد از اولین خرید دیگر نمی‌شود کد معرف ثبت کرد، وگرنه هر کسی بعد از
    // خرید یک کد پیدا می‌کند و امتیاز می‌گیرد.
    referred: Boolean(profile.referredById),
    canEnterCode: !profile.referredById && profile.orderCount === 0,
  });
}

/** ثبت کد معرفی کسی که مرا دعوت کرده */
export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "احراز هویت نشده" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code : "";
  if (!code.trim()) {
    return NextResponse.json({ error: "کد معرفی را وارد کنید" }, { status: 400 });
  }

  const profile = await prisma.clubProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!profile) return NextResponse.json({ error: "عضو باشگاه نیستید" }, { status: 404 });

  const result = await applyReferral({ profileId: profile.id, code });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({ success: true });
}
