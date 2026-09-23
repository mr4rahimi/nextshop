import { NextResponse } from "next/server";
import type { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * «سفارش‌های من» در کارتابل — سفارش‌های تلفنیِ ثبت‌شده به نام همین کارمند.
 *
 * تا پیش از این، کارمند برای دیدن سفارش خودش باید در فهرست همه‌ی سفارش‌های سایت
 * (`PANEL_ORDERS`) می‌گشت؛ کارمند فروشی که آن بخش را ندارد اصلاً راهی نداشت.
 *
 * ⚠️ «سفارش من» یعنی `createdByStaffId` — همان تعریفِ سفارش تلفنی و صاحبِ سود.
 * سفارش سایتِ مشتریِ خودش اینجا نمی‌آید؛ آن در «سود معاملات» هست.
 *
 * ⚠️ `staff=all` فقط با `DEAL_VIEW_ALL`: هر ردیف قیمت خرید و سود را هم دارد و
 * سود بقیه حساس است (بخش ۲۲.۹).
 */

const TABS: Record<string, OrderStatus[] | null> = {
  all: null,
  pending: ["PENDING_PAYMENT"],
  active: ["PAID", "CONFIRMED", "PROCESSING", "PACKAGING", "SHIPPED"],
  done: ["DELIVERED", "COMPLETED"],
  canceled: ["CANCELED", "REFUNDED"],
};

const PAGE = 30;

export async function GET(req: Request) {
  const guard = await requirePermission("ORDER_CREATE");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const url = new URL(req.url);
  const tab = url.searchParams.get("tab") ?? "all";
  const q = url.searchParams.get("q")?.trim() ?? "";
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const viewAll = can(guard.access, "DEAL_VIEW_ALL");
  const staff = viewAll ? url.searchParams.get("staff") ?? "me" : "me";

  const where: Prisma.OrderWhereInput = {
    createdByStaffId: staff === "me" ? guard.access.userId : staff === "all" ? { not: null } : staff,
  };
  const statuses = TABS[tab] ?? null;
  if (statuses) where.status = { in: statuses };
  if (q) {
    const digits = q.replace(/[^\d۰-۹]/g, "").replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
    where.OR = [
      { orderNumber: { contains: q, mode: "insensitive" } },
      { user: { firstName: { contains: q, mode: "insensitive" } } },
      { user: { lastName: { contains: q, mode: "insensitive" } } },
      ...(digits.length >= 3 ? [{ user: { phone: { contains: digits } } }] : []),
    ];
  }

  const [orders, total, counts] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        isReferral: true,
        paymentTerm: true,
        installments: { where: { status: "DUE" }, select: { amount: true, dueDate: true }, orderBy: { dueDate: "asc" } },
        itemsTotal: true,
        shippingFee: true,
        discountTotal: true,
        grandTotal: true,
        note: true,
        createdAt: true,
        createdByStaff: { select: { firstName: true, lastName: true, phone: true } },
        user: { select: { firstName: true, lastName: true, phone: true } },
        items: {
          orderBy: { id: "asc" },
          select: {
            id: true,
            titleSnapshot: true,
            qty: true,
            unitPrice: true,
            unitSalePrice: true,
            cost: { select: { cost: true } },
          },
        },
        staffDeal: { select: { id: true, status: true, cost: true, profit: true, commission: true, payoutId: true } },
      },
    }),
    prisma.order.count({ where }),
    prisma.order.groupBy({
      by: ["status"],
      where: { createdByStaffId: where.createdByStaffId },
      _count: { _all: true },
    }),
  ]);

  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count._all]));
  const tabCounts = Object.fromEntries(
    Object.entries(TABS).map(([k, list]) => [
      k,
      list ? list.reduce((s, st) => s + (byStatus[st] ?? 0), 0) : counts.reduce((s, c) => s + c._count._all, 0),
    ]),
  );

  const staffList = viewAll
    ? await prisma.user.findMany({
        where: { isActive: true, role: { in: ["ADMIN", "SELLER"] } },
        orderBy: [{ firstName: "asc" }, { phone: "asc" }],
        select: { id: true, firstName: true, lastName: true, phone: true },
      })
    : [];
  const name = (u: { firstName: string | null; lastName: string | null; phone: string } | null) =>
    u ? [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.phone : null;

  return NextResponse.json(
    serialize({
      items: orders.map((o) => ({
        ...o,
        customerName: name(o.user),
        customerPhone: o.user.phone,
        staffName: name(o.createdByStaff),
        user: undefined,
        createdByStaff: undefined,
        installments: undefined,
        // بدهی باز اعتباری — `null` یعنی نقدی یا تسویه‌شده
        creditDue: o.installments.length ? o.installments.reduce((s, i) => s + i.amount, 0n) : null,
        creditNext: o.installments[0]?.dueDate ?? null,
        items: o.items.map((i) => ({
          id: i.id,
          title: i.titleSnapshot,
          qty: i.qty,
          unitPrice: i.unitSalePrice ?? i.unitPrice,
          cost: i.cost?.cost ?? null,
        })),
      })),
      total,
      pages: Math.max(1, Math.ceil(total / PAGE)),
      tabCounts,
      staff: staffList.map((u) => ({ id: u.id, name: name(u) })),
      can: {
        viewAll,
        openOrder: can(guard.access, "PANEL_ORDERS"),
      },
    }),
  );
}
