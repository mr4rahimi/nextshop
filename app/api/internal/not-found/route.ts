import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePath, shouldSkip } from "@/lib/redirects";

export const dynamic = "force-dynamic";

/**
 * ثبت یک بازدید ۴۰۴.
 *
 * از `not-found.tsx` صدا زده می‌شود، یعنی جایی که واقعاً می‌دانیم صفحه پیدا
 * نشده — نه از middleware که هنوز خبر ندارد.
 *
 * عمداً بدون احراز هویت است چون از سمت کاربر عادی صدا زده می‌شود، ولی سه
 * محافظ دارد تا به جدول زباله تبدیل نشود:
 *   ۱. مسیرهای استاتیک و داخلی رد می‌شوند
 *   ۲. مسیرهای خیلی بلند بریده می‌شوند
 *   ۳. سقف تعداد ردیف — بعد از رسیدن به سقف فقط شمارنده‌ی موارد موجود بالا می‌رود
 */
const MAX_ROWS = 5000;
const MAX_PATH = 512;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const raw = body?.path;
  if (typeof raw !== "string" || !raw) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const path = normalizePath(raw).slice(0, MAX_PATH);
  if (shouldSkip(path)) return NextResponse.json({ ok: true, skipped: true });

  const referer = (body.referer || req.headers.get("referer") || "").slice(0, 512) || null;
  const userAgent = (req.headers.get("user-agent") || "").slice(0, 256) || null;

  try {
    const existing = await prisma.notFoundLog.findUnique({ where: { path }, select: { id: true } });

    if (existing) {
      await prisma.notFoundLog.update({
        where: { id: existing.id },
        data: { hits: { increment: 1 }, referer: referer ?? undefined },
      });
    } else {
      const count = await prisma.notFoundLog.count();
      if (count >= MAX_ROWS) {
        // سقف پر است — مسیر جدید ثبت نمی‌شود تا جدول بی‌نهایت رشد نکند
        return NextResponse.json({ ok: true, atCapacity: true });
      }
      await prisma.notFoundLog.create({ data: { path, referer, userAgent } });
    }
  } catch {
    // ثبت آمار هرگز نباید صفحه‌ی ۴۰۴ کاربر را بشکند
    return NextResponse.json({ ok: false });
  }

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
