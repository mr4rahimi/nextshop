import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { logActivity } from "@/lib/activity";
import { issueCard, listCards } from "@/lib/club/cards";
import { cardsError, cardsGuard } from "@/lib/club/cards-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — فهرست کارت‌های اشتراک با اعتبار هر عضو (webhesab-parity.md بخش ۲۳) */
export async function GET(req: Request) {
  const g = await cardsGuard();
  if (!g.ok) return g.res;
  try {
    const sp = new URL(req.url).searchParams;
    const status = sp.get("status");
    const sort = sp.get("sort");
    const [data, tiers] = await Promise.all([
      listCards({
        q: sp.get("q") ?? undefined,
        tierId: sp.get("tier") || undefined,
        status: status === "inactive" || status === "all" ? status : "active",
        sort: sort === "name" || sort === "expiry" || sort === "recent" ? sort : "credit",
      }),
      prisma.clubTier.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, title: true, cardChargeBp: true, posDiscountBp: true, manualOnly: true } }),
    ]);
    const s = await prisma.storeSettings.findUnique({ where: { id: "singleton" }, select: { pointRedeemEnabled: true, pointExpiryDays: true, pointRedeemRate: true } });
    return NextResponse.json(serialize({ ...data, tiers, redeemOnline: !!s?.pointRedeemEnabled, expiryDays: s?.pointExpiryDays ?? 0, rate: s?.pointRedeemRate ?? 1 }));
  } catch (e) {
    return cardsError(e, "[club-cards]");
  }
}

/** POST — صدور یا تعویض کارت: { mobile, name?, number, tierId? } */
export async function POST(req: Request) {
  const g = await cardsGuard();
  if (!g.ok) return g.res;
  try {
    const b = (await req.json().catch(() => ({}))) as { mobile?: string; name?: string; number?: string; tierId?: string; note?: string };
    const r = await issueCard({ mobile: b.mobile ?? "", name: b.name, number: b.number ?? "", tierId: b.tierId || null, note: b.note });
    await logActivity({ action: "CREATE", entity: "OTHER", entityId: r.card.id, entityTitle: `کارت اشتراک ${r.card.number}`, summary: `صدور کارت اشتراک ${r.card.number} برای ${b.mobile}` });
    return NextResponse.json(serialize({ ok: true, ...r }));
  } catch (e) {
    return cardsError(e, "[club-cards]");
  }
}

/** PATCH — کلیدهای کارت در صندوق و اعمال انقضا: { clubCardPosEnabled?, pointExpiryEnforced?, pointExpiryDays? } */
export async function PATCH(req: Request) {
  const g = await cardsGuard();
  if (!g.ok) return g.res;
  try {
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const data: { clubCardPosEnabled?: boolean; pointExpiryEnforced?: boolean; pointExpiryDays?: number } = {};
    if (typeof b.clubCardPosEnabled === "boolean") data.clubCardPosEnabled = b.clubCardPosEnabled;
    if (typeof b.pointExpiryEnforced === "boolean") data.pointExpiryEnforced = b.pointExpiryEnforced;
    if (b.pointExpiryDays !== undefined) {
      const d = Number(b.pointExpiryDays);
      if (!Number.isInteger(d) || d < 0 || d > 10_000) return NextResponse.json({ error: "مدت اعتبار شارژ نامعتبر است" }, { status: 400 });
      data.pointExpiryDays = d;
    }
    await prisma.storeSettings.update({ where: { id: "singleton" }, data });
    await logActivity({ action: "UPDATE", entity: "SETTINGS", entityId: "singleton", entityTitle: "کارت اشتراک", summary: `تنظیم کارت اشتراک: ${JSON.stringify(data)}` });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return cardsError(e, "[club-cards]");
  }
}
