import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import type { Prisma, UserRole } from "@prisma/client";

export const runtime = "nodejs";

const VALID_ROLES: UserRole[] = ["CUSTOMER", "ADMIN", "SELLER"];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const page = parseInt(url.searchParams.get("page") ?? "1");
  const PAGE_SIZE = 20;

  const where: Prisma.UserWhereInput = {};

  // ⚠️ این فیلتر تا امروز خوانده نمی‌شد. صفحه‌ی «مدیریت ادمین‌ها»
  // `?role=ADMIN` می‌فرستاد و صفحه‌ی اولِ **همه‌ی** کاربران برمی‌گشت، بعد
  // سمت کلاینت بینشان دنبال ادمین می‌گشت. روی فروشگاهی با چند هزار مشتری،
  // صفحه‌ی اول هیچ ادمینی نداشت و صفحه خالی می‌ماند.
  const role = url.searchParams.get("role");
  if (role && VALID_ROLES.includes(role as UserRole)) {
    where.role = role as UserRole;
  }

  if (q) {
    where.OR = [
      { phone: { contains: q } },
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, firstName: true, lastName: true, phone: true,
        email: true, avatarUrl: true, role: true, isActive: true,
        createdAt: true,
        // نقش کارتابل — صفحه‌ی مدیریت ادمین‌ها با همین نقش می‌دهد
        staffRoleId: true,
        staffRole: { select: { id: true, title: true } },
        _count: { select: { orders: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json(serialize({ users, total, page, pageSize: PAGE_SIZE }));
}
