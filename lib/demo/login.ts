/**
 * ورود به دموی عمومی — docs/plans/demo.md بخش «چرا حساب مشترک».
 *
 * شماره‌ی بازدیدکننده (که کد پیامکی‌اش تأیید شده) در `DemoLead` می‌ماند و خودش
 * با حساب مشترک «مدیر نمایشی» وارد می‌شود؛ پس هیچ شماره‌ای در پنل دمو دیده نمی‌شود.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { signToken, setAuthCookie } from "@/lib/auth";
import { clearAdminGateCache } from "@/lib/admin-gate";
import { clientIp, demoAdminPhone } from "@/lib/demo";

export const DEMO_LEAD_COOKIE = "demo_lead";

/** حساب مشترک — هر بار مدیرِ فعالِ بی‌نقش (دسترسی کامل) برگردانده می‌شود */
async function demoAdmin() {
  const phone = demoAdminPhone();
  const user = await prisma.user.upsert({
    where: { phone },
    update: { role: "ADMIN", isActive: true, staffRole: { disconnect: true } },
    create: { phone, role: "ADMIN", isActive: true, firstName: "مدیر", lastName: "نمایشی" },
    select: { id: true, phone: true, role: true },
  });
  clearAdminGateCache(user.id);
  return user;
}

/**
 * منبع ورود به پنل گردانوس — کوکی‌های `.gardanos.ir` (g_src، g_ft، g_ref، g_vid) که
 * gardanos.ir و لینک‌های ردیابی گذاشته‌اند، با شماره جلو می‌رود تا ادمین گردانوس ببیند
 * ورود به دمو از کدام بنر یا پیک بوده (gardanos-panel/docs/marketing.md).
 * فقط با `GARDANOS_TRACK_KEY` در .env؛ هر خطا بی‌صدا — ورود به دمو نباید بشکند.
 */
async function reportToGardanos(phone: string, req: Request) {
  const key = process.env.GARDANOS_TRACK_KEY;
  if (!key) return;
  const raw = req.headers.get("cookie") ?? "";
  const cookies: Record<string, string> = {};
  for (const name of ["g_src", "g_ft", "g_ref", "g_vid"]) {
    const m = raw.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
    if (m) cookies[name] = m[1].slice(0, 1000);
  }
  try {
    await fetch(process.env.GARDANOS_TRACK_URL || "http://127.0.0.1:3040/api/track/demo", {
      method: "POST",
      headers: { "content-type": "application/json", "x-track-key": key },
      body: JSON.stringify({ phone, cookies }),
      signal: AbortSignal.timeout(3_000),
    });
  } catch {
    /* پنل در دسترس نیست — شماره در DemoLead خود دمو هست */
  }
}

export async function demoSignIn(phone: string, req: Request, source: "admin" | "shop") {
  const ip = clientIp(req.headers);
  const userAgent = req.headers.get("user-agent")?.slice(0, 300) ?? null;
  const lead = await prisma.demoLead.upsert({
    where: { phone },
    update: { visits: { increment: 1 }, lastAt: new Date(), ip, userAgent },
    create: { phone, source, ip, userAgent },
    select: { id: true },
  });

  await reportToGardanos(phone, req);

  const user = await demoAdmin();
  const token = await signToken({ userId: user.id, phone: user.phone, role: user.role });
  await setAuthCookie(token);
  // حساب مشترک است؛ این کوکی می‌گوید کدام شماره پشت مرورگر است (`/api/demo/visit`)
  (await cookies()).set(DEMO_LEAD_COOKIE, lead.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return NextResponse.json({ success: true, isNewUser: false });
}
