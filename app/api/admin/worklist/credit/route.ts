import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { creditScope, creditTabWhere, INSTALLMENT_SELECT, type CreditTab } from "@/lib/worklist/credit";
import { dayKeyOf } from "@/lib/worklist/attendance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TABS: CreditTab[] = ["today", "tomorrow", "overdue", "week", "paid", "all"];

/**
 * موعدهای پرداخت اعتباری — کارمند موعدهای مشتریان خودش، مدیر همه (بخش ۲۴.۴).
 *
 * بالای صفحه: جمع مانده و جمع معوق **در همان دامنه‌ی دسترسی**، شمارش هر تب،
 * و برای مدیر تعداد «بی‌مسئول» (مشتری بی‌صاحب و سفارشِ بی‌ثبت‌کننده) که کار
 * پیگیری نمی‌گیرند.
 */
export async function GET(req: Request) {
  const guard = await requirePermission(["CREDIT_VIEW_OWN", "CREDIT_VIEW_ALL"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const url = new URL(req.url);
  const tabParam = url.searchParams.get("tab") as CreditTab | null;
  const tab: CreditTab = tabParam && TABS.includes(tabParam) ? tabParam : "overdue";
  const q = url.searchParams.get("q")?.trim() ?? "";

  const scope = creditScope(guard.access);
  const alive: Prisma.OrderCreditInstallmentWhereInput = { order: { status: { notIn: ["CANCELED", "REFUNDED"] } } };
  const base: Prisma.OrderCreditInstallmentWhereInput = { AND: [alive, ...(scope ? [scope] : [])] };

  const search: Prisma.OrderCreditInstallmentWhereInput | null = q
    ? {
        OR: [
          { order: { orderNumber: { contains: q, mode: "insensitive" } } },
          { order: { user: { firstName: { contains: q, mode: "insensitive" } } } },
          { order: { user: { lastName: { contains: q, mode: "insensitive" } } } },
          { order: { user: { phone: { contains: q.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))) } } } },
        ],
      }
    : null;

  const where: Prisma.OrderCreditInstallmentWhereInput = {
    AND: [base, creditTabWhere(tab), ...(search ? [search] : [])],
  };

  const today = dayKeyOf(new Date());
  const [items, counts, outstanding, overdue, unowned] = await Promise.all([
    prisma.orderCreditInstallment.findMany({
      where,
      orderBy: tab === "paid" ? { paidAt: "desc" } : { dueDate: "asc" },
      take: 200,
      select: {
        ...INSTALLMENT_SELECT,
        order: {
          select: {
            ...INSTALLMENT_SELECT.order.select,
            createdByStaffId: true,
            _count: { select: { installments: true } },
          },
        },
      },
    }),
    Promise.all(
      TABS.map((t) => prisma.orderCreditInstallment.count({ where: { AND: [base, creditTabWhere(t)] } })),
    ),
    prisma.orderCreditInstallment.aggregate({ where: { AND: [base, { status: "DUE" }] }, _sum: { amount: true } }),
    prisma.orderCreditInstallment.aggregate({
      where: { AND: [base, { status: "DUE", dueDate: { lt: today } }] },
      _sum: { amount: true },
    }),
    can(guard.access, "CREDIT_VIEW_ALL")
      ? prisma.orderCreditInstallment.count({
          where: {
            AND: [
              alive,
              { status: "DUE" },
              { order: { createdByStaffId: null, user: { OR: [{ clubProfile: null }, { clubProfile: { ownerId: null } }] } } },
            ],
          },
        })
      : Promise.resolve(0),
  ]);

  return NextResponse.json(
    serialize({
      items,
      counts: Object.fromEntries(TABS.map((t, i) => [t, counts[i]])),
      outstanding: outstanding._sum.amount ?? 0n,
      overdue: overdue._sum.amount ?? 0n,
      unowned,
      can: { manage: can(guard.access, "CREDIT_MANAGE"), viewAll: can(guard.access, "CREDIT_VIEW_ALL") },
    }),
  );
}
