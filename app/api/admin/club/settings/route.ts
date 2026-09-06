import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SELECT = {
  clubEnabled: true,
  clubName: true,
  smsLineNumber: true,
  smsMarketingLine: true,
  smsAllowedHourStart: true,
  smsAllowedHourEnd: true,
  smsMonthlyCapPerUser: true,
  smsOptOutText: true,
  smsOptInText: true,
  pointPerToman: true,
  pointExpiryDays: true,
  pointOnSignup: true,
  pointOnBirthday: true,
  pointOnReview: true,
  pointOnConsent: true,
  pointOnReferrer: true,
  pointOnReferee: true,
  pointRedeemEnabled: true,
  pointRedeemRate: true,
  pointRedeemMin: true,
  pointRedeemMaxPct: true,
  channelPriority: true,
  storeName: true,
} as const;

async function requireAdmin() {
  const u = await getAuthUser();
  return u && u.role === "ADMIN" ? u : null;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  const settings = await prisma.storeSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
    select: SELECT,
  });

  // اعتبار پنل از `/api/admin/sms/account` گرفته می‌شود — جداگانه، تا کندی یا
  // خرابی پنل پیامک بارگذاری تنظیمات را عقب نیندازد
  return NextResponse.json({ settings });
}

export async function PATCH(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "بدنه نامعتبر" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  if (typeof body.clubEnabled === "boolean") data.clubEnabled = body.clubEnabled;
  if (typeof body.clubName === "string") data.clubName = body.clubName.trim() || null;

  if (typeof body.smsMarketingLine === "string") {
    const line = body.smsMarketingLine.replace(/\D/g, "");
    data.smsMarketingLine = line || null;
  }

  if (typeof body.smsOptOutText === "string") {
    data.smsOptOutText = body.smsOptOutText.trim() || null;
  }

  if (typeof body.smsOptInText === "string") {
    data.smsOptInText = body.smsOptInText.trim() || null;
  }

  // ── ساعت مجاز ───────────────────────────────────────────────────
  const start = intOrNull(body.smsAllowedHourStart);
  const end = intOrNull(body.smsAllowedHourEnd);

  if (start !== null) {
    if (start < 0 || start > 23) {
      return NextResponse.json({ error: "ساعت شروع باید بین ۰ تا ۲۳ باشد" }, { status: 400 });
    }
    data.smsAllowedHourStart = start;
  }
  if (end !== null) {
    if (end < 1 || end > 24) {
      return NextResponse.json({ error: "ساعت پایان باید بین ۱ تا ۲۴ باشد" }, { status: 400 });
    }
    data.smsAllowedHourEnd = end;
  }

  const finalStart = start ?? (await currentHour("smsAllowedHourStart"));
  const finalEnd = end ?? (await currentHour("smsAllowedHourEnd"));
  if (finalStart >= finalEnd) {
    return NextResponse.json(
      { error: "ساعت پایان باید بعد از ساعت شروع باشد" },
      { status: 400 }
    );
  }

  // ── سقف ماهانه ──────────────────────────────────────────────────
  const cap = intOrNull(body.smsMonthlyCapPerUser);
  if (cap !== null) {
    if (cap < 0 || cap > 100) {
      return NextResponse.json({ error: "سقف ماهانه باید بین ۰ تا ۱۰۰ باشد" }, { status: 400 });
    }
    data.smsMonthlyCapPerUser = cap;
  }

  // ── امتیاز ──────────────────────────────────────────────────────
  if (body.pointPerToman !== undefined) {
    const rate = Number(body.pointPerToman);
    if (!Number.isFinite(rate) || rate < 0) {
      return NextResponse.json({ error: "نرخ امتیاز نامعتبر است" }, { status: 400 });
    }
    data.pointPerToman = rate;
  }

  const expiry = intOrNull(body.pointExpiryDays);
  if (expiry !== null) {
    if (expiry < 0) {
      return NextResponse.json({ error: "مدت انقضا نامعتبر است" }, { status: 400 });
    }
    data.pointExpiryDays = expiry;
  }

  // ── امتیاز رویدادها ─────────────────────────────────────────────
  // ⚠️ همه اختیاری‌اند و ۰ یعنی «آن رویداد امتیاز نمی‌دهد» — نه «تنظیم نشده».
  const EVENT_POINTS = [
    ["pointOnSignup", "امتیاز عضویت"],
    ["pointOnBirthday", "امتیاز تولد"],
    ["pointOnReview", "امتیاز ثبت نظر"],
    ["pointOnConsent", "امتیاز رضایت دریافت پیام"],
    ["pointOnReferrer", "امتیاز معرف"],
    ["pointOnReferee", "امتیاز معرفی‌شده"],
    ["pointRedeemMin", "حداقل امتیاز قابل استفاده"],
  ] as const;

  for (const [field, label] of EVENT_POINTS) {
    const v = intOrNull(body[field]);
    if (v === null) continue;
    if (v < 0 || v > 1_000_000) {
      return NextResponse.json({ error: `${label} نامعتبر است` }, { status: 400 });
    }
    data[field] = v;
  }

  // ── خرج کردن امتیاز ─────────────────────────────────────────────
  if (typeof body.pointRedeemEnabled === "boolean") {
    data.pointRedeemEnabled = body.pointRedeemEnabled;
  }

  if (body.pointRedeemRate !== undefined) {
    const rate = Number(body.pointRedeemRate);
    if (!Number.isFinite(rate) || rate < 0) {
      return NextResponse.json({ error: "ارزش هر امتیاز نامعتبر است" }, { status: 400 });
    }
    data.pointRedeemRate = rate;
  }

  const maxPct = intOrNull(body.pointRedeemMaxPct);
  if (maxPct !== null) {
    if (maxPct < 0 || maxPct > 100) {
      return NextResponse.json(
        { error: "سقف درصدی باید بین ۰ تا ۱۰۰ باشد" },
        { status: 400 }
      );
    }
    data.pointRedeemMaxPct = maxPct;
  }

  // ── اولویت کانال‌ها ─────────────────────────────────────────────
  if (Array.isArray(body.channelPriority)) {
    const VALID = ["SMS", "TELEGRAM", "BALE"];
    const clean = body.channelPriority
      .map((v) => String(v).toUpperCase())
      .filter((v, i, a) => VALID.includes(v) && a.indexOf(v) === i);
    if (clean.length > 0) data.channelPriority = clean;
  }

  const settings = await prisma.storeSettings.update({
    where: { id: "singleton" },
    data,
    select: SELECT,
  });

  return NextResponse.json({ success: true, settings });
}

function intOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

async function currentHour(field: "smsAllowedHourStart" | "smsAllowedHourEnd") {
  const s = await prisma.storeSettings.findUnique({
    where: { id: "singleton" },
    select: { [field]: true } as Record<string, true>,
  });
  return (s as unknown as Record<string, number>)?.[field] ?? (field === "smsAllowedHourStart" ? 9 : 21);
}