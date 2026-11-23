import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { logActivity } from "@/lib/activity";
import { AccError, accErrorResponse, toAmount } from "@/lib/accounting/errors";
import { actorOf, readJson } from "@/lib/accounting/api";
import { faNum, formatAmount } from "@/lib/accounting/money";
import { posGuard } from "@/lib/accounting/pos/api";
import { createTicket, quoteTicket, type TicketInput } from "@/lib/accounting/pos/tickets";
import { recomputePurchaseStatsMany } from "@/lib/club/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const strList = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);

const KIND_LABEL = { SALE: "فروش", RETURN: "مرجوعی", EXCHANGE: "تعویض" } as const;

/** GET ?shiftId — رسیدهای یک شیفت (تازه‌ترین اول) */
export async function GET(req: Request) {
  const g = await posGuard();
  if (!g.ok) return g.res;
  const shiftId = new URL(req.url).searchParams.get("shiftId");
  if (!shiftId) return NextResponse.json({ error: "شیفت را مشخص کنید" }, { status: 400 });
  const tickets = await prisma.accPosTicket.findMany({ where: { shiftId }, orderBy: { createdAt: "desc" }, take: 200 });
  return NextResponse.json(serialize({ tickets }));
}

interface Body {
  terminalId?: string;
  sellerId?: string | null;
  partyId?: string | null;
  invoiceDiscount?: unknown;
  sale?: { productId?: string; qty?: unknown; unitPrice?: unknown; discount?: unknown; serials?: unknown }[];
  ret?: { invoiceId?: string | null; lines?: { refLineId?: string | null; productId?: string | null; qty?: unknown; serials?: unknown }[] } | null;
  /** `cash: "rest"` = باقیِ بعد از کارت */
  pay?: {
    cash?: unknown;
    card?: unknown;
    cardTreasuryId?: unknown;
    transfer?: unknown;
    transferTreasuryId?: unknown;
    transferRef?: unknown;
    org?: { orgId?: unknown; amount?: unknown; employeeCode?: unknown; letterNo?: unknown } | null;
  };
  tendered?: unknown;
  overrideCredit?: boolean;
  clubSpend?: unknown;
  couponCode?: unknown;
  gifts?: { number?: unknown; amount?: unknown }[];
}

/** POST — ثبت رسید صندوق: فروش، مرجوعی یا تعویض. `?quote=1` فقط جمع دقیق (بی ثبت) */
export async function POST(req: Request) {
  const g = await posGuard();
  if (!g.ok) return g.res;
  try {
    const b = await readJson<Body>(req);
    const qty = (v: unknown, at: string) => {
      const n = Number(v);
      if (!Number.isInteger(n) || n <= 0) throw new AccError(`${at}: تعداد نامعتبر است`);
      return n;
    };
    const input: TicketInput = {
      terminalId: b.terminalId ?? "",
      sellerId: b.sellerId || null,
      partyId: b.partyId || null,
      invoiceDiscount: toAmount(b.invoiceDiscount, "تخفیف"),
      sale: (b.sale ?? []).map((l, i) => ({
        productId: l.productId ?? "",
        qty: qty(l.qty, `ردیف ${faNum(i + 1)}`),
        unitPrice: toAmount(l.unitPrice, `قیمت ردیف ${faNum(i + 1)}`),
        discount: toAmount(l.discount, `تخفیف ردیف ${faNum(i + 1)}`),
        serials: strList(l.serials),
      })),
      ret: b.ret?.lines?.length
        ? { invoiceId: b.ret.invoiceId || null, lines: b.ret.lines.map((l, i) => ({ refLineId: l.refLineId || null, productId: l.productId || null, qty: qty(l.qty, `مرجوعی ردیف ${faNum(i + 1)}`), serials: strList(l.serials) })) }
        : null,
      pay: {
        cash: b.pay?.cash === "rest" ? "rest" : toAmount(b.pay?.cash, "نقد"),
        card: toAmount(b.pay?.card, "کارت"),
        cardTreasuryId: typeof b.pay?.cardTreasuryId === "string" ? b.pay.cardTreasuryId : null,
        transfer: b.pay?.transfer ? toAmount(b.pay.transfer, "کارت به کارت") : 0n,
        transferTreasuryId: typeof b.pay?.transferTreasuryId === "string" ? b.pay.transferTreasuryId : null,
        transferRef: typeof b.pay?.transferRef === "string" ? b.pay.transferRef : null,
        org:
          b.pay?.org && typeof b.pay.org.orgId === "string" && b.pay.org.amount
            ? {
                orgId: b.pay.org.orgId,
                amount: toAmount(b.pay.org.amount, "اقساط"),
                employeeCode: typeof b.pay.org.employeeCode === "string" ? b.pay.org.employeeCode : null,
                letterNo: typeof b.pay.org.letterNo === "string" ? b.pay.org.letterNo : null,
              }
            : null,
      },
      tendered: b.tendered ? toAmount(b.tendered, "پول دریافتی") : null,
      overrideCredit: !!b.overrideCredit,
      clubSpend: b.clubSpend ? toAmount(b.clubSpend, "کارت اشتراک") : 0n,
      gifts: (Array.isArray(b.gifts) ? b.gifts : []).slice(0, 20).map((x, i) => ({ number: String(x.number ?? "").slice(0, 40), amount: toAmount(x.amount, `بن ${faNum(i + 1)}`) })),
      couponCode: typeof b.couponCode === "string" && b.couponCode.trim() ? b.couponCode.trim().slice(0, 40) : null,
    };
    if (new URL(req.url).searchParams.get("quote") === "1") {
      return NextResponse.json(serialize({ ok: true, quote: await quoteTicket(input, { manage: g.manage }, actorOf(g.access)) }));
    }
    const t = await prisma.$transaction((tx) => createTicket(tx, input, { manage: g.manage }, actorOf(g.access)), { timeout: 60_000 });
    const net = t.saleTotal - t.returnTotal;
    await logActivity({
      action: "CREATE",
      entity: "OTHER",
      entityId: t.id,
      entityTitle: `رسید صندوق ${t.number}`,
      summary: `${KIND_LABEL[t.kind]} صندوق — رسید ${faNum(t.number)} — ${t.partyName} — ${formatAmount(net < 0n ? -net : net)} تومان${net < 0n ? " پس داده شد" : ""}`,
    });
    // آمار خرید عضو باشگاه (جمع خرید، آخرین خرید) — بیرون از تراکنش، خطایش رسید را نمی‌خواباند
    const owner = await prisma.accParty.findUnique({ where: { id: t.partyId }, select: { userId: true } });
    if (owner?.userId) await recomputePurchaseStatsMany([owner.userId]).catch((e) => console.error("[acc-pos-ticket] آمار باشگاه", e));
    return NextResponse.json(serialize({ ok: true, ticket: t }));
  } catch (e) {
    return accErrorResponse(e, "[acc-pos-ticket]");
  }
}
