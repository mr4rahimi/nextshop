import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";
import { actorOf, readJson } from "@/lib/accounting/api";
import { faNum } from "@/lib/accounting/money";
import { listAxes, listGroups } from "@/lib/accounting/inventory/catalog";
import { ROUND_MODES } from "@/lib/accounting/inventory/online-price";
import {
  applyPriceRows,
  listBatches,
  opSummary,
  planBulk,
  planSheet,
  undoBatch,
  type BulkOp,
  type PriceFilter,
  type Rounding,
} from "@/lib/accounting/inventory/store-price";
import type { RoundMode } from "@/lib/accounting/inventory/online-price-calc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PREVIEW_ROWS = 300;

/**
 * قیمت فروشگاه — docs/plans/webhesab-parity.md بخش ۱۰.
 * GET — گروه‌ها، ویژگی‌ها و عرضه‌کننده‌ها برای فیلتر + آخرین تغییرهای گروهی
 * POST `{action}`:
 *   `bulk`  `{filter, op: {kind, pctBp|amount|price}, round: {roundTo, mode}, exclude, commit}`
 *   `sheet` `{rows: [{code, price, line}], commit}` — ورود با اکسل (فایل را `import/parse` می‌خواند)
 *   `undo`  `{batchId}`
 * `commit` نباشد ← فقط پیش‌نمایش (چیزی نوشته نمی‌شود)
 */
export async function GET() {
  const guard = await requirePermission(["ACC_VIEW", "ACC_INVENTORY"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const [groups, axes, supplierIds, batches] = await Promise.all([
    listGroups(),
    listAxes(),
    prisma.accItem.findMany({ where: { supplierId: { not: null } }, distinct: ["supplierId"], select: { supplierId: true } }),
    listBatches(prisma),
  ]);
  const suppliers = await prisma.accParty.findMany({
    where: { id: { in: supplierIds.map((s) => s.supplierId!) } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(
    serialize({
      groups: groups.map((g) => ({ id: g.id, path: g.path, items: g.items })),
      axes: axes.map((a) => ({ id: a.id, name: a.name, values: a.values.map((v) => ({ id: v.id, value: v.value })) })),
      suppliers,
      batches,
      can: { manage: can(guard.access, "ACC_INVENTORY") },
    }),
  );
}

interface Body {
  action?: string;
  filter?: Record<string, unknown>;
  op?: { kind?: unknown; pctBp?: unknown; amount?: unknown; price?: unknown };
  round?: { roundTo?: unknown; mode?: unknown };
  exclude?: unknown;
  rows?: { code?: unknown; price?: unknown; line?: unknown }[];
  batchId?: unknown;
  commit?: unknown;
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

function parseOp(b: Body): { op: BulkOp; round: Rounding } {
  const k = String(b.op?.kind ?? "");
  const big = (v: unknown, label: string) => {
    const t = String(v ?? "").replace(/[,٬\s]/g, "");
    if (!/^-?\d+$/.test(t)) throw new AccError(`${label} را درست بنویسید`);
    return BigInt(t);
  };
  const op: BulkOp =
    k === "PERCENT"
      ? { kind: "PERCENT", pctBp: Math.round(Number(b.op?.pctBp)) }
      : k === "AMOUNT"
        ? { kind: "AMOUNT", amount: big(b.op?.amount, "مبلغ") }
        : k === "SET"
          ? { kind: "SET", price: big(b.op?.price, "قیمت") }
          : (() => {
              throw new AccError("نوع تغییر را انتخاب کنید");
            })();
  const mode = String(b.round?.mode ?? "nearest");
  if (!(ROUND_MODES as string[]).includes(mode)) throw new AccError("نوع گرد کردن نامعتبر است");
  return { op, round: { roundTo: Math.floor(Number(b.round?.roundTo) || 0), mode: mode as RoundMode } };
}

async function scopeText(f: PriceFilter): Promise<string> {
  const parts: string[] = [];
  if (f.groupId) parts.push(`گروه ${(await prisma.accItemGroup.findUnique({ where: { id: f.groupId }, select: { name: true } }))?.name ?? "؟"}`);
  if (f.supplierId) parts.push(`عرضه‌کننده ${(await prisma.accParty.findUnique({ where: { id: f.supplierId }, select: { name: true } }))?.name ?? "؟"}`);
  if (f.valueId) {
    const v = await prisma.accAxisValue.findUnique({ where: { id: f.valueId }, select: { value: true, axis: { select: { name: true } } } });
    if (v) parts.push(`${v.axis.name} ${v.value}`);
  }
  if (f.q) parts.push(`«${f.q}»`);
  return parts.length ? parts.join("، ") : "همه‌ی کالاها";
}

export async function POST(req: Request) {
  const guard = await requirePermission("ACC_INVENTORY");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const b = await readJson<Body>(req);
    const actor = actorOf(guard.access);
    const commit = b.commit === true;

    if (b.action === "undo") {
      const id = str(b.batchId);
      if (!id) throw new AccError("تغییر را انتخاب کنید");
      const res = await prisma.$transaction((tx) => undoBatch(tx, id, actor), { timeout: 120_000 });
      await logActivity({ action: "UPDATE", entity: "OTHER", entityTitle: "قیمت فروشگاه", summary: `تغییر گروهی قیمت برگردانده شد — ${faNum(res.count)} کالا` });
      return NextResponse.json(serialize({ ok: true, undone: res }));
    }

    if (b.action === "bulk") {
      const filter: PriceFilter = {
        q: str(b.filter?.q),
        groupId: str(b.filter?.groupId),
        supplierId: str(b.filter?.supplierId),
        valueId: str(b.filter?.valueId),
        includeInactive: b.filter?.includeInactive === true,
      };
      const { op, round } = parseOp(b);
      const exclude = Array.isArray(b.exclude) ? b.exclude.map(String) : [];
      if (!commit) {
        const plan = await planBulk(prisma, filter, op, round, exclude);
        return NextResponse.json(serialize({ ok: true, preview: { ...plan, total: plan.rows.length, rows: plan.rows.slice(0, PREVIEW_ROWS) } }));
      }
      const summary = opSummary(op, round, await scopeText(filter));
      const res = await prisma.$transaction(
        async (tx) => applyPriceRows(tx, (await planBulk(tx, filter, op, round, exclude)).rows, { kind: op.kind, summary, source: "BULK", actor }),
        { timeout: 180_000 },
      );
      await logActivity({ action: "UPDATE", entity: "OTHER", entityTitle: "قیمت فروشگاه", summary: `تغییر گروهی قیمت (${summary}) — ${faNum(res.count)} کالا` });
      return NextResponse.json(serialize({ ok: true, applied: res }));
    }

    if (b.action === "sheet") {
      const rows = (Array.isArray(b.rows) ? b.rows : []).map((r, k) => ({ code: String(r.code ?? ""), price: String(r.price ?? ""), line: Number(r.line) || k + 1 }));
      if (!rows.some((r) => r.code.trim())) throw new AccError("ردیفی با کد کالا پیدا نشد");
      if (!commit) {
        const plan = await planSheet(prisma, rows);
        return NextResponse.json(serialize({ ok: true, preview: { ...plan, total: plan.rows.length, rows: plan.rows.slice(0, PREVIEW_ROWS) } }));
      }
      const res = await prisma.$transaction(
        async (tx) => {
          const plan = await planSheet(tx, rows);
          return applyPriceRows(tx, plan.rows, { kind: "EXCEL", summary: `ورود با اکسل · ${faNum(plan.rows.length)} کالا`, source: "EXCEL", actor });
        },
        { timeout: 180_000 },
      );
      await logActivity({ action: "UPDATE", entity: "OTHER", entityTitle: "قیمت فروشگاه", summary: `قیمت فروشگاه با اکسل — ${faNum(res.count)} کالا` });
      return NextResponse.json(serialize({ ok: true, applied: res }));
    }

    throw new AccError("درخواست نامعتبر است");
  } catch (e) {
    return accErrorResponse(e, "[acc-store-price]");
  }
}
