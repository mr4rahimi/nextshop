import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateOtp, saveOtp, sendSms, checkOtpRateLimit, verifyOtp } from "@/lib/otp";
import { upsertClubCustomer } from "@/lib/club/profile";
import { setClubConsent } from "@/lib/club/consent";
import { loadPointRules } from "@/lib/club/points";
import type { ClubSource } from "@prisma/client";

export const runtime = "nodejs";

/**
 * عضویت عمومی در باشگاه — صفحه‌ی فرود و QR فروش حضوری
 *
 * ⚠️ **تأیید با کد پیامکی اجباری است.** ثبت حضوری توسط فروشنده بدون OTP انجام
 *    می‌شود چون پشت لاگین فروشنده است و مسئولیتش با اوست؛ این صفحه عمومی است.
 *    بدون OTP هر کسی می‌تواند برای شماره‌ی دیگران «رضایت» ثبت کند و آنچه
 *    به‌عنوان سند رضایت نگه می‌داریم بی‌ارزش می‌شود.
 */

/** از کجا اسکن شده — روی خود QR در آدرس می‌آید */
function sourceFor(via: unknown): ClubSource {
  return via === "qr" ? "IN_STORE" : "ONLINE";
}

export async function GET() {
  const [settings, rules] = await Promise.all([
    prisma.storeSettings.findUnique({
      where: { id: "singleton" },
      select: { clubEnabled: true, clubName: true, storeName: true },
    }),
    loadPointRules(),
  ]);

  return NextResponse.json({
    enabled: settings?.clubEnabled ?? false,
    clubName: settings?.clubName ?? null,
    storeName: settings?.storeName ?? null,
    // امتیازی که همین حالا می‌گیرد — انگیزه‌ی اصلی عضویت است و باید دیده شود
    points: {
      signup: rules.onSignup,
      consent: rules.onConsent,
    },
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const phone = String(body.phone ?? "").trim();

  if (!/^09[0-9]{9}$/.test(phone)) {
    return NextResponse.json({ error: "شماره موبایل نامعتبر است" }, { status: 400 });
  }

  const settings = await prisma.storeSettings.findUnique({
    where: { id: "singleton" },
    select: { clubEnabled: true },
  });

  if (!settings?.clubEnabled) {
    return NextResponse.json({ error: "باشگاه مشتریان فعال نیست" }, { status: 400 });
  }

  // ── مرحله ۱: ارسال کد ───────────────────────────────────────────
  if (body.action !== "verify") {
    let code: string;

    try {
      await checkOtpRateLimit(phone);
      code = generateOtp();
      await saveOtp(phone, code);
      await sendSms(phone, code);
    } catch (err) {
      if (err instanceof Error && err.message === "RATE_LIMIT") {
        return NextResponse.json(
          { error: "تعداد درخواست بیش از حد مجاز است. ۱۰ دقیقه دیگر تلاش کنید." },
          { status: 429 }
        );
      }
      console.error("[club:join] ارسال کد ناموفق:", err);
      return NextResponse.json({ error: "ارسال پیامک ناموفق بود" }, { status: 500 });
    }

    return NextResponse.json({
      step: "verify",
      // مثل مسیر ورود؛ فقط در توسعه‌ی لوکال که کلید پنل پیامک وجود ندارد
      ...(process.env.NODE_ENV !== "production" && { devCode: code }),
    });
  }

  // ── مرحله ۲: تأیید و ثبت ────────────────────────────────────────
  const code = String(body.code ?? "").replace(/\D/g, "");
  if (!(await verifyOtp(phone, code))) {
    return NextResponse.json({ error: "کد وارد شده درست نیست" }, { status: 400 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    null;

  const firstName = String(body.firstName ?? "").trim().slice(0, 60) || null;

  const result = await upsertClubCustomer({
    phone,
    firstName,
    source: sourceFor(body.via),
  });

  // ⚠️ رضایت جدا از عضویت ثبت می‌شود: کسی که فقط عضو شده ولی تیک نزده،
  //    نباید پیام تبلیغاتی بگیرد.
  const consent = body.consent === true
    ? await setClubConsent({
        profileId: result.profileId,
        granted: true,
        source: "LANDING",
        ip,
        userAgent: req.headers.get("user-agent"),
      })
    : null;

  return NextResponse.json({
    step: "done",
    isNew: result.isNewProfile,
    consentGiven: consent?.changed ?? false,
    pointsGranted: consent?.pointsGranted ?? 0,
  });
}
