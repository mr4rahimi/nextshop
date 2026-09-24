import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { requirePermission } from "@/lib/permissions";
import { openInvoicesOf } from "@/lib/accounting/cash/allocation";
import { nextChequeSerial } from "@/lib/accounting/cash/cheques";
import { balanceOf, balancesBy } from "@/lib/accounting/ledger/balances";
import { dayValue, todayKey } from "@/lib/accounting/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET ?kind&partyId — پیش‌فرض‌های فرم دریافت/پرداخت/انتقال: صندوق‌ها با موجودی،
 * فاکتورهای باز شخص، چک‌های دریافتیِ نزد ما (برای خرج)، شماره‌ی بعدی دسته‌چک هر بانک.
 */
export async function GET(req: Request) {
  const guard = await requirePermission("ACC_TREASURY");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  const partyId = url.searchParams.get("partyId");

  const [treasuries, bal] = await Promise.all([
    prisma.accTreasury.findMany({ where: { isActive: true }, orderBy: [{ kind: "asc" }, { code: "asc" }], select: { id: true, name: true, kind: true, bankName: true, settleToId: true } }),
    balancesBy(prisma, "treasuryId"),
  ]);
  const nextSerial: Record<string, { serial: string; bookId: string } | null> = {};
  if (kind === "PAYMENT") {
    for (const t of treasuries.filter((t) => t.kind === "BANK")) nextSerial[t.id] = await nextChequeSerial(prisma, t.id);
  }
  const [open, cheques, partyBalance] = partyId
    ? await Promise.all([
        kind === "RECEIPT" || kind === "PAYMENT" ? openInvoicesOf(prisma, partyId, kind === "RECEIPT" ? "sales" : "purchase") : Promise.resolve([]),
        kind === "PAYMENT"
          ? prisma.accCheque.findMany({ where: { direction: "RECEIVED", status: "IN_HAND", partyId: { not: partyId } }, orderBy: { dueDate: "asc" }, include: { party: { select: { name: true } } }, take: 100 })
          : Promise.resolve([]),
        balanceOf(prisma, { partyId }),
      ])
    : [[], kind === "PAYMENT" ? await prisma.accCheque.findMany({ where: { direction: "RECEIVED", status: "IN_HAND" }, orderBy: { dueDate: "asc" }, include: { party: { select: { name: true } } }, take: 100 }) : [], null];

  return NextResponse.json(
    serialize({
      today: dayValue(todayKey()),
      treasuries: treasuries.map((t) => ({ ...t, balance: bal.get(t.id)?.balance ?? 0n })),
      open,
      cheques,
      partyBalance: partyBalance?.balance ?? null,
      // تسویه‌ی بازارگاه: فرم دریافت فیلد «کارمزد کسرشده» را نشان می‌دهد
      isMarketplace: partyId ? !!(await prisma.accParty.findUnique({ where: { id: partyId }, select: { isMarketplace: true } }))?.isMarketplace : false,
      nextSerial,
    }),
  );
}
