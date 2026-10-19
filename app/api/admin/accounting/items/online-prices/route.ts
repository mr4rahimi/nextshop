import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";
import { readJson } from "@/lib/accounting/api";
import { faNum } from "@/lib/accounting/money";
import { listGroups } from "@/lib/accounting/inventory/catalog";
import { applyOnlinePrices, checkPctBp, planOnlinePrices, ROUND_MODES, onlineRule, type PriceChange } from "@/lib/accounting/inventory/online-price";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PREVIEW_ROWS = 300;

/**
 * قیمت آنلاین — docs/plans/inventory-items.md بخش ۱۴.
 * GET — قاعده، درصد گروه‌ها، قیمت‌های دستی، و تغییرهای مانده (اگر قیمت سایت با قاعده فرق دارد)
 * PATCH `{enabled, pctBp, roundTo, roundMode, groups: [{id, pctBp|null}], commit}` —
 *   `commit: false` پیش‌نمایش در تراکنش برگشت‌خورده؛ `true` ذخیره و اعمال روی سایت
 */
export async function GET() {
  const guard = await requirePermission(["ACC_VIEW", "ACC_INVENTORY"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const [rule, groups, pcts, overrides, plan] = await Promise.all([
    onlineRule(),
    listGroups(),
    prisma.accItemGroup.findMany({ select: { id: true, onlinePctBp: true } }),
    prisma.accItem.findMany({
      where: { onlinePrice: { not: null } },
      orderBy: { code: "asc" },
      take: 500,
      select: { id: true, code: true, title: true, salePrice: true, onlinePrice: true },
    }),
    planOnlinePrices(prisma),
  ]);
  const pctOf = new Map(pcts.map((p) => [p.id, p.onlinePctBp]));
  return NextResponse.json(
    serialize({
      rule,
      groups: groups.map((g) => ({ id: g.id, parentId: g.parentId, path: g.path, items: g.items, pctBp: pctOf.get(g.id) ?? null })),
      overrides,
      pending: { total: plan.changes.length, products: plan.writes.length, rows: plan.changes.slice(0, PREVIEW_ROWS) },
      can: { manage: can(guard.access, "ACC_INVENTORY") },
    }),
  );
}

interface Body {
  enabled?: unknown;
  pctBp?: unknown;
  roundTo?: unknown;
  roundMode?: unknown;
  groups?: { id?: string; pctBp?: unknown }[];
  commit?: unknown;
}

class Preview extends Error {
  constructor(public readonly out: { total: number; products: number; rows: PriceChange[] }) {
    super("preview");
  }
}

export async function PATCH(req: Request) {
  const guard = await requirePermission("ACC_INVENTORY");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const b = await readJson<Body>(req);
    const data: { onlinePricing?: boolean; onlinePctBp?: number; onlineRoundTo?: number; onlineRoundMode?: string } = {};
    if (b.enabled !== undefined) data.onlinePricing = !!b.enabled;
    if (b.pctBp !== undefined) {
      const bp = Math.round(Number(b.pctBp));
      checkPctBp(bp);
      data.onlinePctBp = bp;
    }
    if (b.roundTo !== undefined) {
      const r = Math.floor(Number(b.roundTo) || 0);
      if (r < 0 || r > 1_000_000) throw new AccError("گرد کردن نامعتبر است");
      data.onlineRoundTo = r;
    }
    if (b.roundMode !== undefined) {
      if (!(ROUND_MODES as string[]).includes(String(b.roundMode))) throw new AccError("نوع گرد کردن نامعتبر است");
      data.onlineRoundMode = String(b.roundMode);
    }
    const groups = (b.groups ?? []).map((g) => {
      const bp = g.pctBp === null || g.pctBp === undefined || g.pctBp === "" ? null : Math.round(Number(g.pctBp));
      if (bp !== null) checkPctBp(bp);
      return { id: String(g.id ?? ""), bp };
    });

    const write = async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
      if (Object.keys(data).length) await tx.accSettings.upsert({ where: { id: "singleton" }, update: data, create: { id: "singleton", ...data } });
      for (const g of groups) await tx.accItemGroup.update({ where: { id: g.id }, data: { onlinePctBp: g.bp } });
    };

    if (b.commit !== true) {
      try {
        await prisma.$transaction(async (tx) => {
          await write(tx);
          const plan = await planOnlinePrices(tx);
          throw new Preview({ total: plan.changes.length, products: plan.writes.length, rows: plan.changes.slice(0, PREVIEW_ROWS) });
        });
      } catch (e) {
        if (e instanceof Preview) return NextResponse.json(serialize({ ok: true, preview: e.out }));
        throw e;
      }
    }

    const res = await prisma.$transaction(
      async (tx) => {
        await write(tx);
        return applyOnlinePrices(tx);
      },
      { timeout: 120_000 },
    );
    await logActivity({
      action: "UPDATE",
      entity: "OTHER",
      entityTitle: "قیمت آنلاین",
      summary: `قاعده‌ی قیمت آنلاین ذخیره شد — ${faNum(res.changed)} قیمت در ${faNum(res.products)} محصول عوض شد`,
    });
    return NextResponse.json(serialize({ ok: true, applied: res }));
  } catch (e) {
    return accErrorResponse(e, "[acc-online-price]");
  }
}
