import { NextResponse } from "next/server";
import { serialize } from "@/lib/serialize";
import { logActivity } from "@/lib/activity";
import { adjustCredit, memberDetail } from "@/lib/club/cards";
import { cardsError, cardsGuard, toBig } from "@/lib/club/cards-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?profileId — کارت‌ها، شارژهای باز و گردش اعتبار یک عضو */
export async function GET(req: Request) {
  const g = await cardsGuard();
  if (!g.ok) return g.res;
  try {
    return NextResponse.json(serialize(await memberDetail(new URL(req.url).searchParams.get("profileId") ?? "")));
  } catch (e) {
    return cardsError(e, "[club-card-member]");
  }
}

/** POST — شارژ/کسر دستی: { profileId, amount (تومان، منفی = کسر), note, expiryDays? } */
export async function POST(req: Request) {
  const g = await cardsGuard();
  if (!g.ok) return g.res;
  try {
    const b = (await req.json().catch(() => ({}))) as { profileId?: string; amount?: unknown; note?: string; expiryDays?: unknown };
    let amount: bigint;
    try {
      amount = toBig(b.amount);
    } catch {
      return NextResponse.json({ error: "مبلغ عدد نیست" }, { status: 400 });
    }
    const days = b.expiryDays ? Number(b.expiryDays) : null;
    const row = await adjustCredit({ profileId: b.profileId ?? "", amount, note: b.note ?? "", expiryDays: days && days > 0 ? Math.floor(days) : null }, g.access.name);
    await logActivity({ action: "UPDATE", entity: "OTHER", entityId: b.profileId ?? "", entityTitle: "اعتبار کارت اشتراک", summary: `${amount < 0n ? "کسر" : "شارژ"} دستی کارت اشتراک: ${amount.toLocaleString("fa-IR")} تومان — ${b.note}` });
    return NextResponse.json(serialize({ ok: true, row }));
  } catch (e) {
    return cardsError(e, "[club-card-member]");
  }
}
