import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { accErrorResponse } from "@/lib/accounting/errors";
import { posGuard } from "@/lib/accounting/pos/api";
import { validatePosCoupon } from "@/lib/club/coupons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET ?code&partyId&total — بررسی کد تخفیف در صندوق (webhesab-parity.md بخش ۲۶).
 * فقط قاعده‌های کد را برمی‌گرداند تا صندوق مبلغ را با هر تغییر سبد خودش حساب کند؛
 * ثبت رسید دوباره همه را می‌سنجد. `ok: false` با پیام، نه خطای HTTP (اسکن ناموفق عادی است).
 */
export async function GET(req: Request) {
  const g = await posGuard();
  if (!g.ok) return g.res;
  try {
    const url = new URL(req.url);
    const code = (url.searchParams.get("code") ?? "").slice(0, 40);
    const partyId = url.searchParams.get("partyId");
    const total = /^\d+$/.test(url.searchParams.get("total") ?? "") ? BigInt(url.searchParams.get("total")!) : 0n;
    const party = partyId ? await prisma.accParty.findUnique({ where: { id: partyId }, select: { userId: true, mobile: true, platformCode: true } }) : null;
    const userId =
      !party || party.platformCode === "walk-in"
        ? null
        : (party.userId ?? (party.mobile ? (await prisma.user.findUnique({ where: { phone: party.mobile }, select: { id: true } }))?.id : null) ?? null);
    // جمع سبد هنوز ممکن است کمتر از حداقل باشد — بقیه‌ی قاعده‌ها با جمع بزرگ سنجیده می‌شوند و حداقل جدا گزارش می‌شود
    const v = await validatePosCoupon(prisma, { code, userId, itemsTotal: 10n ** 15n });
    if (!v.ok || !v.coupon) return NextResponse.json({ ok: false, error: v.error, code: v.code });
    const c = v.coupon;
    return NextResponse.json(
      serialize({
        ok: true,
        coupon: { code: c.code, title: c.title, type: c.type, value: c.value, maxDiscount: c.maxDiscount, minOrderTotal: c.minOrderTotal },
        belowMin: total < c.minOrderTotal,
      }),
    );
  } catch (e) {
    return accErrorResponse(e, "[acc-pos-coupon]");
  }
}
