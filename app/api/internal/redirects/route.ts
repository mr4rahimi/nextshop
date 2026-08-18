import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { INTERNAL_HEADER, internalToken } from "@/lib/redirectCache";

export const dynamic = "force-dynamic";

/**
 * مسیر داخلی مخصوص middleware.
 *
 * middleware نمی‌تواند مستقیم Prisma صدا بزند (ممکن است روی edge اجرا شود)،
 * پس قواعد را از اینجا می‌گیرد و در حافظه کش می‌کند.
 *
 * دسترسی با یک توکن مشترک محدود شده تا از بیرون قابل صدا زدن نباشد. اگر
 * `REDIRECT_CACHE_TOKEN` در .env تنظیم نشده باشد، فقط درخواست‌های بدون هدر
 * پذیرفته می‌شوند و عملاً همان رفتار قبلی است — یعنی نبودِ توکن سایت را
 * نمی‌شکند، ولی برای production باید تنظیم شود.
 */
function authorized(req: Request): boolean {
  const expected = internalToken();
  if (!expected) return true; // توکن تنظیم نشده — رفتار سازگار
  return req.headers.get(INTERNAL_HEADER) === expected;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rows = await prisma.redirect.findMany({
    where: { isActive: true },
    select: {
      id: true,
      source: true,
      destination: true,
      statusCode: true,
      matchType: true,
    },
  });

  return NextResponse.json(
    { rules: rows },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** شمارش بازدید یک قاعده. از middleware صدا زده می‌شود، بدون await. */
export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await req.json().catch(() => ({ id: null }));
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });

  await prisma.redirect
    .update({
      where: { id },
      data: { hits: { increment: 1 }, lastHitAt: new Date() },
    })
    .catch(() => {}); // قاعده ممکن است همین الان حذف شده باشد

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
