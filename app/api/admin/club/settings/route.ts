import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { getProvider } from "@/lib/club/sms";

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
  pointPerToman: true,
  pointExpiryDays: true,
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

  // اعتبار پنل — اگر در دسترس نبود، صفحه نباید بشکند
  let balance: { amount: number; count?: number } | null = null;
  let balanceError: string | null = null;

  try {
    balance = await getProvider().getBalance();
    if (!balance) balanceError = "پاسخ پنل نامعتبر بود";
  } catch (err) {
    balanceError = err instanceof Error ? err.message : "خطای نامشخص";
  }

  return NextResponse.json({ settings, balance, balanceError });
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