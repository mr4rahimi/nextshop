import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { serialize } from "@/lib/serialize";
import type { CouponType } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES: CouponType[] = ["PERCENT", "FIXED", "FREE_SHIP"];

async function requireAdmin() {
  const u = await getAuthUser();
  return u && u.role === "ADMIN" ? u : null;
}

export async function GET(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const batch = url.searchParams.get("batch");

  // کدهای یک دسته (برای خروجی چاپ) — webhesab-parity.md بخش ۲۶
  if (batch) {
    const coupons = await prisma.coupon.findMany({ where: { batch }, orderBy: { code: "asc" }, take: 5000, include: { _count: { select: { redemptions: true } } } });
    return NextResponse.json(serialize({ coupons }));
  }

  const [coupons, batches] = await Promise.all([
    prisma.coupon.findMany({
      where: {
        // کدهای دسته‌ای جدا جمع می‌شوند، مگر جستجو
        ...(q ? { OR: [{ code: { contains: q, mode: "insensitive" } }, { title: { contains: q, mode: "insensitive" } }] } : { batch: null }),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { _count: { select: { redemptions: true } } },
    }),
    prisma.coupon.groupBy({ by: ["batch"], where: { batch: { not: null } }, _count: true, _sum: { usedCount: true }, _min: { createdAt: true, expiresAt: true } }),
  ]);
  const batchInfo = await Promise.all(
    batches.map(async (b) => {
      const sample = await prisma.coupon.findFirst({ where: { batch: b.batch }, select: { type: true, value: true, title: true, posEnabled: true, onlineEnabled: true } });
      const active = await prisma.coupon.count({ where: { batch: b.batch, isActive: true } });
      return { batch: b.batch!, count: b._count, used: b._sum.usedCount ?? 0, active, createdAt: b._min.createdAt, expiresAt: b._min.expiresAt, ...sample };
    }),
  );
  batchInfo.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));

  return NextResponse.json(serialize({ coupons, batches: batchInfo }));
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const bulk = (body as { bulk?: { count?: unknown; prefix?: unknown; batch?: unknown } } | null)?.bulk;
  if (bulk) return createBulk(body, bulk);

  const parsed = parse(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const exists = await prisma.coupon.findUnique({ where: { code: parsed.code } });
  if (exists) return NextResponse.json({ error: "این کد از قبل وجود دارد" }, { status: 400 });

  const coupon = await prisma.coupon.create({ data: parsed });
  return NextResponse.json(serialize({ coupon }));
}

export async function PUT(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "شناسه کد لازم است" }, { status: 400 });

  const parsed = parse(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const clash = await prisma.coupon.findFirst({
    where: { code: parsed.code, NOT: { id } },
    select: { id: true },
  });
  if (clash) return NextResponse.json({ error: "کد دیگری همین عنوان را دارد" }, { status: 400 });

  const coupon = await prisma.coupon.update({ where: { id }, data: parsed });
  return NextResponse.json(serialize({ coupon }));
}

export async function DELETE(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  const sp = new URL(req.url).searchParams;
  // غیرفعال کردن یک دسته‌ی کامل (کارت‌های چاپی گم‌شده یا تمام‌شده)
  if (sp.get("batch")) {
    const r = await prisma.coupon.updateMany({ where: { batch: sp.get("batch")!, isActive: true }, data: { isActive: false } });
    return NextResponse.json({ success: true, deactivated: true, message: `${r.count.toLocaleString("fa-IR")} کد این دسته غیرفعال شد` });
  }
  const id = sp.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "شناسه کد لازم است" }, { status: 400 });

  const used = await prisma.couponRedemption.count({ where: { couponId: id } });
  if (used > 0) {
    // حذف کدی که روی سفارش‌ها نشسته، تاریخچه را خراب می‌کند — غیرفعالش می‌کنیم
    await prisma.coupon.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({
      success: true,
      deactivated: true,
      message: "این کد روی سفارش‌ها استفاده شده، پس به‌جای حذف غیرفعال شد",
    });
  }

  await prisma.coupon.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * ساخت دسته‌ای — معادل «تعداد کارت، طول قسمت ثابت/متغیر» کارت تخفیف وب حساب (webhesab-parity.md بخش ۲۶).
 * هر کد = پیشوند + ۶ نویسه‌ی تصادفی (بی ۰/O و ۱/I)؛ همه‌ی تنظیمات فرم روی همه می‌نشیند.
 */
async function createBulk(body: unknown, bulk: { count?: unknown; prefix?: unknown; batch?: unknown }) {
  const count = Math.floor(Number(bulk.count));
  if (!Number.isFinite(count) || count < 1 || count > 2000) return NextResponse.json({ error: "تعداد کارت باید ۱ تا ۲٬۰۰۰ باشد" }, { status: 400 });
  const prefix = String(bulk.prefix ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
  const batch = String(bulk.batch ?? "").trim().slice(0, 60);
  if (!batch) return NextResponse.json({ error: "برای دسته نامی بنویسید؛ مثلاً «کارت تخفیف نوروز»" }, { status: 400 });
  if (await prisma.coupon.findFirst({ where: { batch }, select: { id: true } })) return NextResponse.json({ error: "دسته‌ای با همین نام هست؛ نام دیگری بنویسید" }, { status: 400 });
  const parsed = parse({ ...(body as object), code: `${prefix || "CARD"}000` });
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const codes = new Set<string>();
  const rnd = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
  for (let guard = 0; codes.size < count && guard < count * 20; guard++) {
    const want = [...Array(Math.min(500, count - codes.size))].map(() => `${prefix}${rnd()}`);
    const taken = new Set((await prisma.coupon.findMany({ where: { code: { in: want } }, select: { code: true } })).map((c) => c.code));
    for (const c of want) if (!taken.has(c)) codes.add(c);
  }
  const { code: _ignored, ...rest } = parsed;
  void _ignored;
  await prisma.coupon.createMany({ data: [...codes].slice(0, count).map((code) => ({ ...rest, code, batch })), skipDuplicates: true });
  const created = await prisma.coupon.count({ where: { batch } });
  return NextResponse.json({ success: true, batch, count: created });
}

function parse(body: unknown) {
  const b = (body ?? {}) as Record<string, unknown>;

  const code = String(b.code ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (!code) return { error: "کد تخفیف الزامی است" };
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
    return { error: "کد باید ۳ تا ۳۲ کاراکتر انگلیسی، عدد، خط تیره یا زیرخط باشد" };
  }

  const type = TYPES.includes(b.type as CouponType) ? (b.type as CouponType) : "PERCENT";
  const onlineEnabled = b.onlineEnabled !== false;
  const posEnabled = b.posEnabled === true;
  if (!onlineEnabled && !posEnabled) return { error: "دست‌کم یکی از «در سایت» یا «در صندوق فروشگاه» را تیک بزنید" };
  if (type === "FREE_SHIP" && !onlineEnabled) return { error: "ارسال رایگان فقط برای خرید از سایت معنا دارد" };

  const value = Number(b.value);
  if (type !== "FREE_SHIP") {
    if (!Number.isFinite(value) || value <= 0) return { error: "مقدار تخفیف نامعتبر است" };
    if (type === "PERCENT" && value > 100) return { error: "درصد تخفیف نمی‌تواند بیش از ۱۰۰ باشد" };
  }

  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? BigInt(Math.floor(n)) : 0n;
  };
  const int = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  };
  const date = (v: unknown) => {
    if (!v || typeof v !== "string") return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  return {
    code,
    title: typeof b.title === "string" && b.title.trim() ? b.title.trim() : null,
    type,
    value: type === "FREE_SHIP" ? 0n : BigInt(Math.floor(value)),
    maxDiscount: num(b.maxDiscount),
    minOrderTotal: num(b.minOrderTotal),
    startsAt: date(b.startsAt),
    expiresAt: date(b.expiresAt),
    usageLimit: int(b.usageLimit),
    perUserLimit: int(b.perUserLimit),
    userId: typeof b.userId === "string" && b.userId.trim() ? b.userId.trim() : null,
    tierIds: Array.isArray(b.tierIds) ? b.tierIds.map(String).filter(Boolean) : [],
    clubOnly: b.clubOnly === true,
    isActive: b.isActive !== false,
    showInChat: b.showInChat === true,
    onlineEnabled,
    posEnabled,
    note: typeof b.note === "string" && b.note.trim() ? b.note.trim() : null,
  };
}
