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

  const coupons = await prisma.coupon.findMany({
    where: q
      ? { OR: [{ code: { contains: q, mode: "insensitive" } }, { title: { contains: q, mode: "insensitive" } }] }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { _count: { select: { redemptions: true } } },
  });

  return NextResponse.json(serialize({ coupons }));
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
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

  const id = new URL(req.url).searchParams.get("id") ?? "";
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

function parse(body: unknown) {
  const b = (body ?? {}) as Record<string, unknown>;

  const code = String(b.code ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (!code) return { error: "کد تخفیف الزامی است" };
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
    return { error: "کد باید ۳ تا ۳۲ کاراکتر انگلیسی، عدد، خط تیره یا زیرخط باشد" };
  }

  const type = TYPES.includes(b.type as CouponType) ? (b.type as CouponType) : "PERCENT";

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
    note: typeof b.note === "string" && b.note.trim() ? b.note.trim() : null,
  };
}
