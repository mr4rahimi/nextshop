import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { requirePermission } from "@/lib/permissions";
import { currentYear } from "@/lib/accounting/ledger/fiscal-year";
import { dayValue, todayKey } from "@/lib/accounting/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET — پیش‌فرض‌های فرم فاکتور: مالیات، انبارها، حساب‌های ردیف خدمت (درآمد
 * برای فروش، هزینه برای خرید). یک بار در باز شدن فرم خوانده می‌شود.
 */
export async function GET() {
  const guard = await requirePermission(["ACC_SALES", "ACC_PURCHASE"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const [settings, warehouses, accounts, year] = await Promise.all([
    prisma.accSettings.findUnique({ where: { id: "singleton" }, select: { mode: true, vatEnabled: true, vatRateBp: true, pricesIncludeVat: true } }),
    prisma.accWarehouse.findMany({ where: { isActive: true }, orderBy: { code: "asc" }, select: { id: true, name: true, isDefault: true, sellable: true } }),
    prisma.accAccount.findMany({
      where: { level: "SUBLEDGER", isActive: true, detailKind: "NONE", class: { in: ["REVENUE", "EXPENSE", "ASSET"] }, systemKey: { notIn: ["SALES", "SALES_RETURN", "SALES_DISCOUNT", "ROUNDING", "COGS", "INVENTORY", "INVENTORY_ADJUSTMENT", "VAT_PURCHASE"] } },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, class: true, systemKey: true },
    }),
    currentYear(),
  ]);
  return NextResponse.json(
    serialize({
      mode: settings?.mode ?? "NONE",
      vatEnabled: settings?.vatEnabled ?? false,
      vatRateBp: settings?.vatRateBp ?? 0,
      pricesIncludeVat: settings?.pricesIncludeVat ?? false,
      warehouses,
      revenueAccounts: accounts.filter((a) => a.class === "REVENUE"),
      expenseAccounts: accounts.filter((a) => a.class !== "REVENUE"),
      today: dayValue(todayKey()),
      year: year ? { id: year.id, title: year.title } : null,
    }),
  );
}
