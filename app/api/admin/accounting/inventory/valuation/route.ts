import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";
import { actorOf, readJson } from "@/lib/accounting/api";
import { formatAmount } from "@/lib/accounting/money";
import { commitValuation, planValuation, releaseSold, releaseSummary, valuationStatus, type ValuationOpts } from "@/lib/accounting/inventory/valuation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ارزیابی موجودی پایان دوره — webhesab-parity.md بخش ۳۴.۴. بها دیده می‌شود ← ACC_COST_VIEW هم لازم است.
 * GET  وضعیت: ارزیابی فعال، ذخیره در دفتر، تاریخچه
 * POST {action:"preview", ...opts}   محاسبه بی‌نوشتن
 * POST {action:"commit", ...opts}    ثبت ارزیابی و سند تفاوت — ACC_SETTINGS
 * POST {action:"release"}            برگشت سهم فروش‌رفته‌ها همین حالا — ACC_SETTINGS
 */
type Body = { action?: string; sellCostPct?: unknown; staleDays?: unknown; staleDiscountPct?: unknown; overrides?: Record<string, string>; exclude?: string[]; note?: string };

const num = (v: unknown, def: number) => {
  if (v === undefined || v === null || v === "") return def;
  const n = Number(String(v).replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace("٫", "."));
  if (!Number.isFinite(n)) throw new AccError("عدد نامعتبر است");
  return n;
};
const optsOf = (b: Body): ValuationOpts => ({
  sellCostPct: num(b.sellCostPct, 5),
  staleDays: Math.round(num(b.staleDays, 180)),
  staleDiscountPct: num(b.staleDiscountPct, 30),
  overrides: b.overrides && typeof b.overrides === "object" ? b.overrides : {},
  exclude: Array.isArray(b.exclude) ? b.exclude.filter((x) => typeof x === "string") : [],
});

async function guardCost() {
  const guard = await requirePermission(["ACC_REPORTS", "ACC_INVENTORY", "ACC_SETTINGS"]);
  if (!guard.ok) return { res: NextResponse.json({ error: guard.error }, { status: guard.status }) };
  if (!can(guard.access, "ACC_COST_VIEW")) return { res: NextResponse.json({ error: "دیدن بهای تمام‌شده مجوز می‌خواهد" }, { status: 403 }) };
  return { guard };
}

export async function GET() {
  const g = await guardCost();
  if (g.res) return g.res;
  try {
    const status = await valuationStatus(prisma);
    return NextResponse.json(serialize({ ...status, can: { settings: can(g.guard.access, "ACC_SETTINGS") } }));
  } catch (e) {
    return accErrorResponse(e, "[acc-inv-valuation]");
  }
}

export async function POST(req: Request) {
  const g = await guardCost();
  if (g.res) return g.res;
  try {
    const b = await readJson<Body>(req);
    if (b.action === "preview") return NextResponse.json(serialize({ ok: true, result: await planValuation(prisma, optsOf(b)) }));
    if (!can(g.guard.access, "ACC_SETTINGS")) return NextResponse.json({ error: "ثبت ارزیابی مجوز «تنظیمات حسابداری» می‌خواهد" }, { status: 403 });
    const actor = actorOf(g.guard.access);
    if (b.action === "commit") {
      const r = await prisma.$transaction((tx) => commitValuation(tx, { ...optsOf(b), note: b.note ?? null }, actor), { timeout: 180_000 });
      await logActivity({ action: "CREATE", entity: "SETTINGS", entityTitle: "ارزیابی موجودی", summary: `ارزیابی موجودی ${r.number}: ذخیره‌ی ${formatAmount(r.total)} تومان برای ${r.count} کالا` });
      return NextResponse.json(serialize({ ok: true, result: r }));
    }
    if (b.action === "release") {
      const r = await prisma.$transaction((tx) => releaseSold(tx, actor, { now: true }), { timeout: 120_000 });
      return NextResponse.json(serialize({ ok: true, result: { ...(r ?? {}), message: releaseSummary(r) } }));
    }
    throw new AccError("درخواست نامعتبر است");
  } catch (e) {
    return accErrorResponse(e, "[acc-inv-valuation]");
  }
}
