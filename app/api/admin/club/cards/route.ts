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
    const s = await prisma.storeSettings.findUnique({ where: { id: "singleton" }, select: { pointRedeemEnabled: true, pointExpiryDays: true, pointRedeemRate: true, clubCardDefaultTierId: true } });
    return NextResponse.json(serialize({ ...data, tiers, redeemOnline: !!s?.pointRedeemEnabled, expiryDays: s?.pointExpiryDays ?? 0, rate: s?.pointRedeemRate ?? 1, defaultTierId: s?.clubCardDefaultTierId ?? null }));
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

/**
 * PATCH — کلیدهای کارت در صندوق و اعمال انقضا: { clubCardPosEnabled?, pointExpiryEnforced?, pointExpiryDays?, clubCardDefaultTierId? }
 * کش‌بک (بخش ۳۴.۲): { clubChargeOnProfit?, clubChargeDelayHours?, tierCharge?: { id, pct } } — pct خالی = بی درصد شارژ
 */
export async function PATCH(req: Request) {
  const g = await cardsGuard();
  if (!g.ok) return g.res;
  try {
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const data: { clubCardPosEnabled?: boolean; pointExpiryEnforced?: boolean; pointExpiryDays?: number; clubCardDefaultTierId?: string | null; clubChargeOnProfit?: boolean; clubChargeDelayHours?: number } = {};
    if (typeof b.clubChargeOnProfit === "boolean") data.clubChargeOnProfit = b.clubChargeOnProfit;
    if (b.clubChargeDelayHours !== undefined) {
      const h = Number(String(b.clubChargeDelayHours).replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c))));
      if (!Number.isInteger(h) || h < 0 || h > 24 * 90) return NextResponse.json({ error: "ساعت آزاد شدن کش‌بک باید بین ۰ تا ۲۱۶۰ باشد" }, { status: 400 });
      data.clubChargeDelayHours = h;
    }
    const tc = b.tierCharge as { id?: unknown; pct?: unknown } | undefined;
    if (tc && typeof tc.id === "string") {
      const raw = String(tc.pct ?? "").replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c))).replace(/[٫]/g, ".").trim();
      const bp = raw === "" ? null : Math.round(Number(raw) * 100);
      if (bp !== null && (!Number.isFinite(bp) || bp < 0 || bp > 10_000)) return NextResponse.json({ error: "درصد شارژ باید بین ۰ تا ۱۰۰ باشد" }, { status: 400 });
      const t = await prisma.clubTier.update({ where: { id: tc.id }, data: { cardChargeBp: bp }, select: { title: true } });
      await logActivity({ action: "UPDATE", entity: "SETTINGS", entityId: tc.id, entityTitle: "کارت اشتراک", summary: `درصد کش‌بک سطح «${t.title}»: ${bp === null ? "خاموش" : `${bp / 100}٪`}` });
    }
    if (b.clubCardDefaultTierId !== undefined) {
      const id = typeof b.clubCardDefaultTierId === "string" && b.clubCardDefaultTierId ? b.clubCardDefaultTierId : null;
      if (id && !(await prisma.clubTier.findUnique({ where: { id }, select: { id: true } }))) return NextResponse.json({ error: "سطح پیدا نشد" }, { status: 400 });
      data.clubCardDefaultTierId = id;
    }
    if (typeof b.clubCardPosEnabled === "boolean") data.clubCardPosEnabled = b.clubCardPosEnabled;
    if (typeof b.pointExpiryEnforced === "boolean") data.pointExpiryEnforced = b.pointExpiryEnforced;
    if (b.pointExpiryDays !== undefined) {
      const d = Number(b.pointExpiryDays);
      if (!Number.isInteger(d) || d < 0 || d > 10_000) return NextResponse.json({ error: "مدت اعتبار شارژ نامعتبر است" }, { status: 400 });
      data.pointExpiryDays = d;
    }
    if (Object.keys(data).length) await prisma.storeSettings.update({ where: { id: "singleton" }, data });
    await logActivity({ action: "UPDATE", entity: "SETTINGS", entityId: "singleton", entityTitle: "کارت اشتراک", summary: `تنظیم کارت اشتراک: ${JSON.stringify(data)}` });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return cardsError(e, "[club-cards]");
  }
}
