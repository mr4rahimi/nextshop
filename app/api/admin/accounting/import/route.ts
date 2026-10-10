import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { runImport, type ImportRow } from "@/lib/accounting/import/run";
import { IMPORT_KINDS, type ImportKind } from "@/lib/accounting/import/kinds";
import { firstYear } from "@/lib/accounting/ledger/fiscal-year";
import { readOpening } from "@/lib/accounting/setup";
import { OPENING_INV_SOURCE } from "@/lib/accounting/inventory/docs";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";
import { actorOf, readJson } from "@/lib/accounting/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** مجوز هر نوع — موجودی بها می‌خواهد، مانده و چک «اول دوره» تنظیمات (مثل صفحه‌ی اول دوره) */
const PERMS: Record<ImportKind, string[]> = {
  items: ["ACC_INVENTORY"],
  stock: ["ACC_INVENTORY", "ACC_COST_VIEW"],
  parties: ["ACC_PARTY_MANAGE"],
  cheques: ["ACC_SETTINGS"],
};

/**
 * GET — گزارش تطبیق (بخش ۶ ردیف ۷): جمع‌هایی که با نرم‌افزار قبلی مقایسه می‌شوند،
 * + ویژگی‌های کالا برای ستون‌های رنگ/سایز.
 */
export async function GET() {
  const guard = await requirePermission(["ACC_VIEW", "ACC_INVENTORY", "ACC_PARTY_MANAGE", "ACC_SETTINGS"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const withCost = can(guard.access, "ACC_COST_VIEW");
  const year = await firstYear();
  const [items, bare, axes, opening, moves, received, issued] = await Promise.all([
    prisma.accItem.count({ where: { isActive: true } }),
    prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*)::bigint n FROM "AccItem" i WHERE i."isActive" AND NOT EXISTS (SELECT 1 FROM "Product" p WHERE p.id = i.id)`,
    prisma.accAxis.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    year ? readOpening(prisma, year.id) : null,
    year ? prisma.accStockMove.aggregate({ where: { sourceType: OPENING_INV_SOURCE, sourceId: year.id }, _sum: { qty: true, totalCost: true }, _count: { _all: true } }) : null,
    prisma.accCheque.aggregate({ where: { direction: "RECEIVED", status: { in: ["IN_HAND", "IN_COLLECTION"] } }, _sum: { amount: true }, _count: { _all: true } }),
    prisma.accCheque.aggregate({ where: { direction: "ISSUED", status: "ISSUED" }, _sum: { amount: true }, _count: { _all: true } }),
  ]);
  const ar = opening?.parties.filter((p) => p.amount > 0n).reduce((s, p) => s + p.amount, 0n) ?? 0n;
  const ap = opening?.parties.filter((p) => p.amount < 0n).reduce((s, p) => s - p.amount, 0n) ?? 0n;
  return NextResponse.json(
    serialize({
      year: year ? { id: year.id, title: year.title, startDate: year.startDate } : null,
      axes,
      summary: {
        items,
        itemsWithoutProduct: Number(bare[0]?.n ?? 0),
        stockLines: moves?._count._all ?? 0,
        stockQty: moves?._sum.qty ?? 0,
        stockValue: withCost ? (moves?._sum.totalCost ?? 0n) : null,
        parties: opening?.parties.length ?? 0,
        receivable: ar,
        payable: ap,
        treasury: opening?.treasuries.reduce((s, t) => s + t.amount, 0n) ?? 0n,
        chequesReceived: { count: received._count._all, amount: received._sum.amount ?? 0n },
        chequesIssued: { count: issued._count._all, amount: issued._sum.amount ?? 0n },
      },
      can: Object.fromEntries((Object.keys(PERMS) as ImportKind[]).map((k) => [k, PERMS[k].every((p) => can(guard.access, p))])),
    }),
  );
}

/** POST { kind, rows: [{field: text}], opts: {update, rial}, commit } — پیش‌نمایش یا ثبت همه‌یاهیچ */
export async function POST(req: Request) {
  try {
    const b = await readJson<{ kind?: string; rows?: unknown; opts?: { update?: boolean; rial?: boolean }; commit?: boolean }>(req);
    const kind = b.kind as ImportKind;
    if (!IMPORT_KINDS[kind]) throw new AccError("نوع ورود نامعتبر است");
    const guard = await requirePermission(PERMS[kind][0]);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
    for (const p of PERMS[kind].slice(1)) if (!can(guard.access, p)) return NextResponse.json({ error: "ورود موجودی اول دوره دیدن بهای کالا را لازم دارد" }, { status: 403 });
    if (!Array.isArray(b.rows)) throw new AccError("ردیف‌ها نامعتبر است");
    const rows: ImportRow[] = (b.rows as Record<string, unknown>[]).map((r) => Object.fromEntries(Object.entries(r ?? {}).map(([k, x]) => [k, x == null ? "" : String(x)])));
    // مانده‌ی اشخاص سند اول دوره می‌سازد — همان مجوز صفحه‌ی اول دوره
    if (kind === "parties" && rows.some((r) => r.balance || r.debit || r.credit) && !can(guard.access, "ACC_SETTINGS"))
      return NextResponse.json({ error: "ثبت مانده‌ی اول دوره مجوز تنظیمات حسابداری می‌خواهد — ستون مانده را خالی بگذارید یا از مدیر بخواهید" }, { status: 403 });
    const opts = { update: b.opts?.update !== false, rial: !!b.opts?.rial };
    const actor = actorOf(guard.access);
    const result = await prisma.$transaction((tx) => runImport(tx, kind, rows, opts, !!b.commit, actor), { timeout: 600_000, maxWait: 20_000 });
    return NextResponse.json(serialize(result));
  } catch (e) {
    return accErrorResponse(e, "[acc-import]");
  }
}
