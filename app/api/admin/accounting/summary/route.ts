import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { requirePermission } from "@/lib/permissions";
import { balancesBy } from "@/lib/accounting/ledger/balances";
import { currentYear } from "@/lib/accounting/ledger/fiscal-year";
import { openingKey } from "@/lib/accounting/setup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** داشبورد حسابداری داخلی — نقد، طلب، بدهی، بدهکاران اصلی و فهرست «شروع کار» */
export async function GET() {
  const guard = await requirePermission(["ACC_VIEW", "ACC_SETTINGS"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const [settings, year, treasuries, tBal, pBal, voucherCount] = await Promise.all([
    prisma.accSettings.findUnique({ where: { id: "singleton" } }),
    currentYear(),
    prisma.accTreasury.findMany({ where: { isActive: true }, orderBy: [{ kind: "asc" }, { code: "asc" }] }),
    balancesBy(prisma, "treasuryId"),
    balancesBy(prisma, "partyId"),
    prisma.accVoucher.count({ where: { status: "POSTED" } }),
  ]);

  let cash = 0n;
  const treasuryRows = treasuries.map((t) => {
    const b = tBal.get(t.id)?.balance ?? 0n;
    cash += b;
    return { id: t.id, name: t.name, kind: t.kind, balance: b };
  });

  let receivable = 0n;
  let payable = 0n;
  const debtorIds: { id: string; balance: bigint }[] = [];
  for (const [id, b] of pBal) {
    if (b.balance > 0n) {
      receivable += b.balance;
      debtorIds.push({ id, balance: b.balance });
    } else payable -= b.balance;
  }
  debtorIds.sort((a, b) => (b.balance > a.balance ? 1 : -1));
  const top = debtorIds.slice(0, 5);
  const names = new Map(
    (await prisma.accParty.findMany({ where: { id: { in: top.map((t) => t.id) } }, select: { id: true, name: true } })).map((p) => [p.id, p.name]),
  );

  const hasOpening = year
    ? !!(await prisma.accVoucher.findFirst({ where: { source: "OPENING", sourceId: openingKey(year.id), status: "POSTED" }, select: { id: true } }))
    : false;

  return NextResponse.json(
    serialize({
      mode: settings?.mode ?? "NONE",
      year,
      lockDate: settings?.lockDate ?? null,
      cash,
      treasuries: treasuryRows,
      receivable,
      payable,
      topDebtors: top.map((t) => ({ id: t.id, name: names.get(t.id) ?? "—", balance: t.balance })),
      checklist: {
        bank: treasuries.some((t) => t.kind === "BANK"),
        opening: hasOpening,
        seller: !!settings?.sellerName,
        parties: (await prisma.accParty.count()) > 0,
      },
      voucherCount,
    }),
  );
}
