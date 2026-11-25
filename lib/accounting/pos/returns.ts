/**
 * مرجوعی با مشتری — docs/plans/webhesab-parity.md بخش ۳۳.
 *
 * مشتری با موبایل یا نام پیدا می‌شود و همه‌ی خریدهایش (رسید صندوق، سفارش سایت، فاکتور
 * دستی، بازارگاه) با ردیف‌های قابل برگشت می‌آیند؛ صندوق یک فاکتور یا چند قلم از آن را
 * به سبد مرجوعی می‌برد (همان `ret` رسید — یک فاکتور مرجع در هر رسید).
 *
 * «خریدهای مشتری» = فاکتورهای فروش صادرشده‌ی:
 *   - خود شخص و هر شخص دیگری با **همان موبایل** (تکراری‌های ادغام‌نشده)
 *   - رسیدهای «مشتری حضوری» که کارت اشتراک همین عضو در آن خوانده شد (`clubProfileId`)
 * ⚠️ فقط خواندن؛ نوشتن مرجوعی همان `createTicket`.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AccError } from "../errors";
import { normalizeCardNumber } from "@/lib/club/credit-calc";
import { toLatinDigits } from "../money";
import { returnableOf } from "./tickets";

type Db = Prisma.TransactionClient | typeof prisma;

const MAX_INVOICES = 150;

const CHANNEL: Record<string, string> = { SHOP: "سایت", PHONE: "تلفنی", MARKETPLACE: "بازارگاه", WORKLIST: "کارتابل", MANUAL: "فاکتور دستی" };

export async function customerPurchases(db: Db, partyId: string) {
  const party = await db.accParty.findUnique({ where: { id: partyId }, select: { id: true, code: true, name: true, mobile: true, userId: true, platformCode: true } });
  if (!party) throw new AccError("مشتری پیدا نشد", 404);
  if (party.platformCode === "walk-in") throw new AccError("«مشتری حضوری» بی‌نام است؛ با رسید یا موبایل مشتری جستجو کنید");

  const same = party.mobile
    ? await db.accParty.findMany({ where: { mobile: party.mobile, platformCode: null }, select: { id: true } })
    : [];
  const partyIds = [...new Set([party.id, ...same.map((p) => p.id)])];

  // عضو باشگاه همین شخص ← رسیدهای حضوری که کارتش خوانده شد
  const userId = party.userId ?? (party.mobile ? (await db.user.findUnique({ where: { phone: party.mobile }, select: { id: true } }))?.id : null);
  const profile = userId ? await db.clubProfile.findUnique({ where: { userId }, select: { id: true } }) : null;
  const cardTickets = profile
    ? await db.accPosTicket.findMany({ where: { clubProfileId: profile.id, saleInvoiceId: { not: null }, voidedAt: null }, select: { saleInvoiceId: true } })
    : [];

  const invs = await db.accInvoice.findMany({
    where: {
      type: "SALES",
      status: "ISSUED",
      OR: [{ partyId: { in: partyIds } }, ...(cardTickets.length ? [{ id: { in: cardTickets.map((t) => t.saleInvoiceId!) } }] : [])],
    },
    include: { lines: { orderBy: { seq: "asc" } } },
    orderBy: [{ date: "desc" }, { number: "desc" }],
    take: MAX_INVOICES + 1,
  });
  const truncated = invs.length > MAX_INVOICES;
  const list = invs.slice(0, MAX_INVOICES);

  const ids = list.map((i) => i.id);
  const productIds = [...new Set(list.flatMap((i) => i.lines.map((l) => l.productId).filter((x): x is string => !!x)))];
  const [tickets, items, barcodes, products] = await Promise.all([
    db.accPosTicket.findMany({ where: { saleInvoiceId: { in: ids } }, select: { saleInvoiceId: true, number: true, createdAt: true, sellerName: true, terminal: { select: { name: true } } } }),
    db.accItem.findMany({
      where: { id: { in: productIds } },
      select: { id: true, code: true, attrs: { select: { axis: { select: { sortOrder: true } }, value: { select: { value: true } } } } },
    }),
    db.accItemBarcode.findMany({ where: { itemId: { in: productIds } }, select: { itemId: true, barcode: true } }),
    db.product.findMany({ where: { id: { in: productIds } }, select: { id: true, mainImage: true } }),
  ]);
  const ticketOf = new Map(tickets.map((t) => [t.saleInvoiceId!, t]));
  const itemOf = new Map(items.map((i) => [i.id, i]));
  const imageOf = new Map(products.map((p) => [p.id, p.mainImage]));
  const codesOf = new Map<string, string[]>();
  for (const b of barcodes) codesOf.set(b.itemId, [...(codesOf.get(b.itemId) ?? []), b.barcode]);

  const base = await returnableOf(db, list, new Map(tickets.map((t) => [t.saleInvoiceId!, t.number])));
  const purchases = base.map((r, k) => {
    const inv = list[k];
    const t = ticketOf.get(inv.id);
    return {
      ...r,
      at: t?.createdAt ?? inv.date,
      source: t ? `صندوق${t.terminal?.name ? ` ${t.terminal.name}` : ""}` : CHANNEL[inv.channel] ?? inv.channel,
      seller: t?.sellerName ?? null,
      total: inv.total,
      lines: r.lines.map((l) => {
        const it = itemOf.get(l.productId);
        return {
          ...l,
          code: it?.code ?? null,
          attrs: it ? [...it.attrs].sort((a, b) => a.axis.sortOrder - b.axis.sortOrder).map((a) => a.value.value).join(" · ") : "",
          barcodes: codesOf.get(l.productId) ?? [],
          image: imageOf.get(l.productId) ?? null,
        };
      }),
    };
  });

  const bought = purchases.reduce((s, p) => s + p.total, 0n);
  const settings = await db.accSettings.findUnique({ where: { id: "singleton" }, select: { returnWindowDays: true } });
  return {
    /** مهلت مرجوعی (روز)، ۰ = خاموش — فقط هشدار */
    windowDays: settings?.returnWindowDays ?? 0,
    party: { id: party.id, code: party.code, name: party.name, mobile: party.mobile },
    purchases,
    truncated,
    summary: {
      count: purchases.length,
      total: bought,
      items: purchases.reduce((s, p) => s + p.lines.reduce((a, l) => a + l.qty, 0), 0),
      returnable: purchases.reduce((s, p) => s + p.lines.reduce((a, l) => a + l.left, 0), 0),
    },
  };
}

/**
 * مشتری برای مرجوعی: موبایل (۰۹…، ۹۸…، +۹۸…، بخشی از شماره)، نام، کد شخص یا شماره‌ی کارت
 * اشتراک. با تعداد خرید و تاریخ آخرین خرید تا صندوقدار بی باز کردن هر کدام درست انتخاب کند.
 */
export async function findCustomers(db: Db, raw: string) {
  const term = toLatinDigits(raw).trim();
  if (term.length < 2) return [];
  const digits = term.replace(/\D/g, "");
  const isNum = digits.length > 0 && /^[+\d\s-]+$/.test(term);
  // ۰۹۱۲… / ۹۸۹۱۲… / ۹۱۲… ← ده رقم آخر
  const mobile = isNum && digits.length >= 10 ? digits.slice(-10) : isNum ? digits.replace(/^0/, "") : null;

  const or: Prisma.AccPartyWhereInput[] = isNum
    ? [{ mobile: { contains: mobile! } }, ...(digits.length <= 7 ? [{ code: Number(digits) }] : [])]
    : [{ name: { contains: term, mode: "insensitive" } }];
  if (isNum && digits.length >= 4) {
    const card = await db.clubCard.findUnique({ where: { number: normalizeCardNumber(term) }, select: { profile: { select: { userId: true, user: { select: { phone: true } } } } } });
    if (card) or.push({ userId: card.profile.userId }, { mobile: card.profile.user.phone });
  }
  const parties = await db.accParty.findMany({
    where: { OR: or, platformCode: null, isActive: true },
    select: { id: true, code: true, name: true, mobile: true },
    orderBy: { name: "asc" },
    take: 12,
  });
  if (!parties.length) return [];
  const stats = await db.accInvoice.groupBy({
    by: ["partyId"],
    where: { partyId: { in: parties.map((p) => p.id) }, type: "SALES", status: "ISSUED" },
    _count: true,
    _max: { date: true },
  });
  const st = new Map(stats.map((s) => [s.partyId, s]));
  return parties
    .map((p) => ({ ...p, purchases: st.get(p.id)?._count ?? 0, lastAt: st.get(p.id)?._max.date ?? null }))
    .sort((a, b) => (b.lastAt?.getTime() ?? 0) - (a.lastAt?.getTime() ?? 0));
}
