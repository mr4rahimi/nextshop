import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function toInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// ─── GET /api/admin/guaranty?page=&pageSize=&search=&sort=remaining_asc|remaining_desc ──
export async function GET(req: Request) {
  const url = new URL(req.url);
  const page     = Math.max(1, toInt(url.searchParams.get("page"), 1));
  const pageSize = Math.min(100, Math.max(1, toInt(url.searchParams.get("pageSize"), 20)));
  const search   = url.searchParams.get("search")?.trim();
  const sort     = url.searchParams.get("sort") || "newest";

  const where: any = {};
  if (search) {
    where.OR = [
      { serialNumber: { contains: search, mode: "insensitive" } },
      { productTitle: { contains: search, mode: "insensitive" } },
      { user: { phone: { contains: search } } },
      { user: { firstName: { contains: search, mode: "insensitive" } } },
      { user: { lastName: { contains: search, mode: "insensitive" } } },
    ];
  }

  let orderBy: any = { createdAt: "desc" };
  if (sort === "remaining_asc")  orderBy = { endDate: "asc" };
  if (sort === "remaining_desc") orderBy = { endDate: "desc" };

  const [items, total] = await Promise.all([
    prisma.guaranty.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { firstName: true, lastName: true, phone: true } },
        _count: { select: { requests: true } },
      },
    }),
    prisma.guaranty.count({ where }),
  ]);

  return NextResponse.json(serialize({ items, total, page, pageSize }));
}

// ─── POST /api/admin/guaranty ──────────────────────────────────────────────
export async function POST(req: Request) {
  const body = await req.json();
  const { phone, firstName, lastName, serialNumber, productTitle, durationDays } = body;

  if (!phone || !serialNumber || !productTitle || !durationDays) {
    return NextResponse.json({ error: "تمام فیلدهای ضروری را وارد کنید" }, { status: 400 });
  }

  // پیدا کردن یا ساختن کاربر
  let user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        phone,
        firstName: firstName || null,
        lastName:  lastName  || null,
        passwordHash: "", // کاربر بدون پسورد - فقط برای ثبت گارانتی توسط ادمین
        role: "CUSTOMER",
      },
    });
  } else if (firstName || lastName) {
    // اگه کاربر موجود بود ولی نام نداشت، آپدیت کن
    if (!user.firstName && !user.lastName) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { firstName: firstName || user.firstName, lastName: lastName || user.lastName },
      });
    }
  }

  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + Number(durationDays) * 24 * 60 * 60 * 1000);

  try {
    const guaranty = await prisma.guaranty.create({
      data: {
        userId: user.id,
        serialNumber,
        productTitle,
        durationDays: Number(durationDays),
        startDate,
        endDate,
        notes: body.notes || null,
      },
      include: { user: { select: { firstName: true, lastName: true, phone: true } } },
    });
    return NextResponse.json(serialize(guaranty));
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ error: "این شماره ستومان قبلاً ثبت شده است" }, { status: 409 });
    }
    throw e;
  }
}