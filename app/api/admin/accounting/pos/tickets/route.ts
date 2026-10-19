import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { logActivity } from "@/lib/activity";
import { AccError, accErrorResponse, toAmount } from "@/lib/accounting/errors";
import { actorOf, readJson } from "@/lib/accounting/api";
import { faNum, formatAmount } from "@/lib/accounting/money";
import { posGuard } from "@/lib/accounting/pos/api";
import { createTicket, quoteTicket, type TicketInput } from "@/lib/accounting/pos/tickets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  sale?: { productId?: string; qty?: unknown; unitPrice?: unknown; discount?: unknown }[];
  ret?: { invoiceId?: string | null; lines?: { refLineId?: string | null; productId?: string | null; qty?: unknown }[] } | null;
  /** `cash: "rest"` = باقیِ بعد از کارت */
  pay?: { cash?: unknown; card?: unknown };
  tendered?: unknown;
  overrideCredit?: boolean;
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
      })),
      ret: b.ret?.lines?.length
        ? { invoiceId: b.ret.invoiceId || null, lines: b.ret.lines.map((l, i) => ({ refLineId: l.refLineId || null, productId: l.productId || null, qty: qty(l.qty, `مرجوعی ردیف ${faNum(i + 1)}`) })) }
        : null,
      pay: { cash: b.pay?.cash === "rest" ? "rest" : toAmount(b.pay?.cash, "نقد"), card: toAmount(b.pay?.card, "کارت") },
      tendered: b.tendered ? toAmount(b.tendered, "پول دریافتی") : null,
      overrideCredit: !!b.overrideCredit,
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
    return NextResponse.json(serialize({ ok: true, ticket: t }));
  } catch (e) {
    return accErrorResponse(e, "[acc-pos-ticket]");
  }
}
