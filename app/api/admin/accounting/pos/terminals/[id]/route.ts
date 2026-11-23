import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { logActivity } from "@/lib/activity";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";
import { readJson } from "@/lib/accounting/api";
import { posGuard } from "@/lib/accounting/pos/api";
import { saveTerminal, treasuryBook, type TerminalInput } from "@/lib/accounting/pos/setup";
import { shiftSummary } from "@/lib/accounting/pos/shifts";
import { posIssueOptions } from "@/lib/accounting/pos/club";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — راه‌اندازی صفحه‌ی صندوق: صندوق، شیفت باز با خلاصه، فروشنده‌ها، تنظیم مالیات */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await posGuard();
  if (!g.ok) return g.res;
  try {
    const { id } = await params;
    const terminal = await prisma.accPosTerminal.findUnique({ where: { id } });
    if (!terminal || (!terminal.isActive && !g.manage)) throw new AccError("صندوق پیدا نشد", 404);
    const [open, sellers, settings, treasuries, cashBook, lastShift] = await Promise.all([
      prisma.accPosShift.findFirst({ where: { terminalId: id, status: "OPEN" }, select: { id: true } }),
      prisma.accPosSeller.findMany({ where: { isActive: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
      prisma.accSettings.findUnique({ where: { id: "singleton" }, select: { vatEnabled: true, vatRateBp: true, serialRequired: true } }),
      prisma.accTreasury.findMany({
        where: { id: { in: [terminal.cashTreasuryId, terminal.cardTreasuryId, ...terminal.moreCardTreasuryIds, ...terminal.transferTreasuryIds].filter((x): x is string => !!x) } },
        select: { id: true, name: true, kind: true, bankName: true, cardNo: true, isActive: true },
      }),
      treasuryBook(prisma, terminal.cashTreasuryId),
      prisma.accPosShift.findFirst({ where: { terminalId: id, status: "CLOSED" }, orderBy: { number: "desc" }, select: { keptFloat: true } }),
    ]);
    const warehouse = await prisma.accWarehouse.findUnique({ where: { id: terminal.warehouseId }, select: { name: true } });
    return NextResponse.json(
      serialize({
        terminal: { ...terminal, warehouseName: warehouse?.name ?? "", cash: treasuries.find((t) => t.id === terminal.cashTreasuryId) ?? null, card: treasuries.find((t) => t.id === terminal.cardTreasuryId) ?? null,
          // کارتخوان‌ها (اولی پیش‌فرض) و حساب‌های کارت به کارت — برای انتخاب در پنجره‌ی پرداخت
          readers: [terminal.cardTreasuryId, ...terminal.moreCardTreasuryIds]
            .map((tid) => treasuries.find((t) => t.id === tid && t.isActive))
            .filter((t): t is NonNullable<typeof t> => !!t)
            .map((t) => ({ id: t.id, name: t.name })),
          transfers: terminal.transferTreasuryIds
            .map((tid) => treasuries.find((t) => t.id === tid && t.isActive))
            .filter((t): t is NonNullable<typeof t> => !!t)
            .map((t) => ({ id: t.id, name: t.name, bankName: t.bankName, cardNo: t.cardNo })),
        },
        shift: open ? await shiftSummary(prisma, open.id) : null,
        sellers,
        vat: { enabled: !!settings?.vatEnabled, rateBp: settings?.vatRateBp ?? 0 },
        cashBook,
        // سربرگ پیش‌فاکتور چاپی (همان منبع رسید: ticketView)
        store: await (async () => {
          const [st, acc] = await Promise.all([
            prisma.storeSettings.findUnique({ where: { id: "singleton" }, select: { storeName: true, sitePhone: true } }),
            prisma.accSettings.findUnique({ where: { id: "singleton" }, select: { sellerName: true, sellerPhone: true } }),
          ]);
          return { name: st?.storeName ?? acc?.sellerName ?? null, phone: acc?.sellerPhone ?? st?.sitePhone ?? null };
        })(),
        lastKeptFloat: lastShift?.keptFloat ?? null,
        // اقساط سازمانی: سازمان‌های فعال برای پنجره‌ی پرداخت (docs/plans/org-installments.md)
        orgs: await prisma.accInstallmentOrg.findMany({
          where: { isActive: true, selfPay: false },
          orderBy: { name: "asc" },
          select: { id: true, name: true, months: true, commissionBp: true, requireRef: true, color: true, capPerCustomer: true },
        }),
        cashier: g.access.name,
        serialRequired: !!settings?.serialRequired,
        ...(await (async () => {
          const on = (await prisma.storeSettings.findUnique({ where: { id: "singleton" }, select: { clubCardPosEnabled: true } }))?.clubCardPosEnabled ?? false;
          return { clubCards: on, clubIssue: on ? await posIssueOptions(g.manage) : null };
        })()),
        can: { manage: g.manage },
      }),
    );
  } catch (e) {
    return accErrorResponse(e, "[acc-pos-terminal]");
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await posGuard(["ACC_POS_MANAGE"]);
  if (!g.ok) return g.res;
  try {
    const { id } = await params;
    const body = await readJson<TerminalInput>(req);
    const t = await prisma.$transaction((tx) => saveTerminal(tx, id, body));
    await logActivity({ action: "UPDATE", entity: "OTHER", entityId: t.id, entityTitle: t.name, summary: `صندوق فروشگاه «${t.name}» ویرایش شد` });
    return NextResponse.json(serialize({ ok: true, terminal: t }));
  } catch (e) {
    return accErrorResponse(e, "[acc-pos-terminal]");
  }
}
