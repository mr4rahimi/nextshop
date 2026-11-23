import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { logActivity } from "@/lib/activity";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";
import { readJson } from "@/lib/accounting/api";
import { posGuard } from "@/lib/accounting/pos/api";
import { posMemberForParty } from "@/lib/accounting/pos/club";
import { updateParty, type PartyInput } from "@/lib/accounting/parties";
import { balanceOf, PARTY_BALANCE } from "@/lib/accounting/ledger/balances";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * پرونده‌ی مشتری در صندوق — docs/plans/inventory-items.md بخش ۱۳.۱.
 * GET ?partyId: مشخصات کامل، مانده‌ی حساب، کارت اشتراک و اعتبار، خلاصه‌ی خریدهای حضوری و چند رسید آخر.
 */
export async function GET(req: Request) {
  const g = await posGuard();
  if (!g.ok) return g.res;
  try {
    const id = new URL(req.url).searchParams.get("partyId") ?? "";
    const party = await prisma.accParty.findUnique({ where: { id } });
    if (!party) throw new AccError("مشتری پیدا نشد", 404);
    const where = { partyId: party.id };
    const [bal, member, agg, last, recent, orders] = await Promise.all([
      balanceOf(prisma, { partyId: party.id, ...PARTY_BALANCE }),
      posMemberForParty(party.id),
      prisma.accPosTicket.aggregate({ where, _count: true, _sum: { saleTotal: true, returnTotal: true, saleQty: true } }),
      prisma.accPosTicket.findFirst({ where, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      prisma.accPosTicket.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, number: true, kind: true, createdAt: true, saleTotal: true, returnTotal: true, saleQty: true, returnQty: true, terminal: { select: { name: true } } },
      }),
      party.userId ? prisma.order.count({ where: { userId: party.userId } }) : Promise.resolve(0),
    ]);
    return NextResponse.json(
      serialize({
        party: {
          id: party.id,
          code: party.code,
          name: party.name,
          firstName: party.firstName,
          lastName: party.lastName,
          mobile: party.mobile,
          phone: party.phone,
          nationalId: party.nationalId,
          city: party.city,
          address: party.address,
          postalCode: party.postalCode,
          note: party.note,
          creditLimit: party.creditLimit,
          externalCode: party.externalCode,
          isSiteUser: !!party.userId,
          createdAt: party.createdAt,
        },
        balance: bal.balance,
        member,
        stats: {
          tickets: agg._count,
          sales: agg._sum.saleTotal ?? 0n,
          returns: agg._sum.returnTotal ?? 0n,
          qty: agg._sum.saleQty ?? 0,
          lastAt: last?.createdAt ?? null,
          onlineOrders: orders,
        },
        recent,
      }),
    );
  } catch (e) {
    return accErrorResponse(e, "[acc-pos-customer]");
  }
}

/** PATCH ?partyId — اصلاح مشخصات تماسی مشتری از صندوق (نام کامل، نام و نام خانوادگی، موبایل، تلفن، کد ملی، شهر، نشانی، کد پستی، یادداشت) */
export async function PATCH(req: Request) {
  const g = await posGuard();
  if (!g.ok) return g.res;
  try {
    const id = new URL(req.url).searchParams.get("partyId") ?? "";
    const b = await readJson<Record<string, unknown>>(req);
    const s = (k: string) => (typeof b[k] === "string" ? (b[k] as string) : undefined);
    const input: PartyInput = {
      name: s("name"),
      firstName: s("firstName"),
      lastName: s("lastName"),
      mobile: s("mobile"),
      phone: s("phone"),
      nationalId: s("nationalId"),
      city: s("city"),
      address: s("address"),
      postalCode: s("postalCode"),
      note: s("note"),
    };
    for (const k of Object.keys(input) as (keyof PartyInput)[]) if (input[k] === undefined) delete input[k];
    const party = await prisma.$transaction((tx) => updateParty(tx, id, input));
    await logActivity({ action: "UPDATE", entity: "OTHER", entityId: party.id, entityTitle: party.name, summary: `اصلاح مشخصات مشتری «${party.name}» در صندوق` }).catch(() => {});
    return NextResponse.json(serialize({ ok: true, party: { id: party.id, code: party.code, name: party.name, mobile: party.mobile } }));
  } catch (e) {
    return accErrorResponse(e, "[acc-pos-customer]");
  }
}
