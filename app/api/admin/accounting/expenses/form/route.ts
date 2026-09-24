import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { requirePermission } from "@/lib/permissions";
import { nextChequeSerial } from "@/lib/accounting/cash/cheques";
import { balancesBy } from "@/lib/accounting/ledger/balances";
import { dayValue, todayKey } from "@/lib/accounting/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** سرفصل‌هایی که هزینه نیستند (بهای تمام‌شده و کسری انبار مسیر خودشان را دارند) */
const NOT_EXPENSE_KEYS = ["COGS", "INVENTORY_ADJUSTMENT"];

/**
 * GET — پیش‌فرض‌های فرم هزینه: سرفصل‌های هزینه (پرکاربردها اول)، صندوق و بانک
 * با موجودی، شماره‌ی بعدی دسته‌چک، و روشن بودن ارزش افزوده.
 */
export async function GET() {
  const guard = await requirePermission("ACC_EXPENSE");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const [accounts, used, treasuries, bal, settings] = await Promise.all([
    prisma.accAccount.findMany({
      where: { class: "EXPENSE", level: "SUBLEDGER", isActive: true, detailKind: { not: "TREASURY" }, OR: [{ systemKey: null }, { systemKey: { notIn: NOT_EXPENSE_KEYS } }] },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, detailKind: true, parent: { select: { name: true } } },
    }),
    prisma.accMoneyLine.groupBy({ by: ["accountId"], where: { moneyDoc: { status: "POSTED" } }, _count: true }),
    prisma.accTreasury.findMany({ where: { isActive: true, kind: { in: ["CASH", "BANK"] } }, orderBy: [{ kind: "asc" }, { code: "asc" }], select: { id: true, name: true, kind: true } }),
    balancesBy(prisma, "treasuryId"),
    prisma.accSettings.findUnique({ where: { id: "singleton" }, select: { vatEnabled: true } }),
  ]);
  const uses = new Map(used.map((u) => [u.accountId, u._count]));
  const nextSerial: Record<string, { serial: string; bookId: string } | null> = {};
  for (const t of treasuries.filter((t) => t.kind === "BANK")) nextSerial[t.id] = await nextChequeSerial(prisma, t.id);

  return NextResponse.json(
    serialize({
      today: dayValue(todayKey()),
      accounts: accounts
        .map((a) => ({ id: a.id, code: a.code, name: a.name, group: a.parent?.name ?? "", needsParty: a.detailKind === "PARTY", uses: uses.get(a.id) ?? 0 }))
        .sort((a, b) => b.uses - a.uses || a.code.localeCompare(b.code)),
      treasuries: treasuries.map((t) => ({ ...t, balance: bal.get(t.id)?.balance ?? 0n })),
      nextSerial,
      vatEnabled: !!settings?.vatEnabled,
    }),
  );
}
