import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import {
  addCount, fillWithBook, importIntoCount, openingBlocker, parseImportText, postCount, reviewCount,
  scanIntoCount, setCounted, startRecount, undoLast, voidCount,
} from "@/lib/accounting/inventory/counts";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";
import { actorOf, readJson } from "@/lib/accounting/api";
import type { StaffAccess } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * انبارگردانی — docs/plans/inventory-items.md بخش ۱۵.
 * `ACC_STOCK_COUNT` فقط می‌شمارد و عدد دفتری را نمی‌بیند (شمارش کور)؛ `ACC_INVENTORY` همه‌کار.
 */
const COUNTERS = ["ACC_INVENTORY", "ACC_STOCK_COUNT"];

function rights(access: StaffAccess) {
  const manage = can(access, "ACC_INVENTORY");
  return { manage, blind: !manage, costs: manage && can(access, "ACC_COST_VIEW") };
}

/** GET — برگه با بازبینی (`?entries=1` سابقه‌ی اسکن‌های اخیر همین کاربر هم) */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(["ACC_VIEW", ...COUNTERS]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const { id } = await params;
    const c = await prisma.accStockCount.findUnique({ where: { id } });
    if (!c) throw new AccError("انبارگردانی پیدا نشد", 404);
    const r = rights(guard.access);
    // دیدن بی مجوز شمارش (ACC_VIEW) هم کور نیست — فقط نمی‌شمارد
    const blind = r.blind && !can(guard.access, "ACC_VIEW");
    const [warehouse, group, review, entries, opening] = await Promise.all([
      prisma.accWarehouse.findUnique({ where: { id: c.warehouseId }, select: { id: true, name: true } }),
      c.groupId ? prisma.accItemGroup.findUnique({ where: { id: c.groupId }, select: { id: true, name: true } }) : null,
      reviewCount(prisma, id, { blind, costs: r.costs }),
      new URL(req.url).searchParams.get("entries") === "1"
        ? prisma.accStockCountEntry.findMany({ where: { countId: id, byName: actorOf(guard.access).name }, orderBy: { createdAt: "desc" }, take: 25 })
        : [],
      c.status === "DRAFT" && r.costs ? openingBlocker(prisma, c) : "—",
    ]);
    const titles = new Map(review.rows.map((x) => [x.productId, x.title]));
    return NextResponse.json(
      serialize({
        count: c,
        warehouse,
        group,
        ...review,
        entries: entries.map((e) => ({ ...e, title: titles.get(e.productId) ?? "" })),
        can: {
          count: c.status === "DRAFT" && (r.manage || can(guard.access, "ACC_STOCK_COUNT")),
          manage: r.manage,
          costs: r.costs,
          blind,
          opening: opening === null,
          openingWhy: typeof opening === "string" && opening !== "—" ? opening : null,
        },
      }),
    );
  } catch (e) {
    return accErrorResponse(e, "[acc-count]");
  }
}

/** PUT { lines: [{productId, countedQty|null}], zone? } — عدد مطلق مرحله‌ی جاری */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(COUNTERS);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const { id } = await params;
    const b = await readJson<{ lines?: { productId: string; countedQty: unknown }[]; zone?: string }>(req);
    const actor = actorOf(guard.access);
    const out = await prisma.$transaction(async (tx) => {
      const res = [];
      for (const l of b.lines ?? []) {
        const q = l.countedQty === null || l.countedQty === "" ? null : Number(l.countedQty);
        res.push(await setCounted(tx, id, String(l.productId), q, actor, b.zone));
      }
      return res;
    });
    return NextResponse.json(serialize({ ok: true, lines: out }));
  } catch (e) {
    return accErrorResponse(e, "[acc-count]");
  }
}

/**
 * POST { action, … }
 *   scan { code, qty?, zone? }      اسکن/کد — کالا ← افزوده؛ کد چندتنوعی/متن ← انتخاب
 *   add { productId, qty?, zone? }  افزودن ± (بعد از انتخاب)
 *   undo                            برگرداندن آخرین اسکن همین کاربر
 *   import { text, zone? }          متن اکسل/CSV — کد، تعداد اختیاری          (ACC_INVENTORY)
 *   fill                            شمرده‌نشده‌ها با عدد دفتری               (ACC_INVENTORY)
 *   recount                         شمارش دوم اختلاف‌ها                      (ACC_INVENTORY)
 *   post { applyTo?: ADJUST|OPENING }                                          (ACC_INVENTORY؛ OPENING + ACC_COST_VIEW)
 *   void { reason }                                                            (ACC_INVENTORY)
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(COUNTERS);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const { id } = await params;
    const b = await readJson<{ action?: string; code?: string; productId?: string; qty?: unknown; zone?: string; text?: string; applyTo?: string; reason?: string }>(req);
    const actor = actorOf(guard.access);
    const r = rights(guard.access);
    const qty = b.qty === undefined || b.qty === null || b.qty === "" ? 1 : Number(b.qty);

    if (b.action === "scan") return NextResponse.json(serialize({ ok: true, ...(await scanIntoCount(id, { code: String(b.code ?? ""), qty, zone: b.zone }, actor)) }));
    if (b.action === "add") {
      if (!b.productId) throw new AccError("کالا را انتخاب کنید");
      const line = await prisma.$transaction((tx) => addCount(tx, id, { productId: b.productId!, qty, zone: b.zone, source: "scan" }, actor));
      return NextResponse.json(serialize({ ok: true, line }));
    }
    if (b.action === "undo") return NextResponse.json(serialize({ ok: true, undone: await prisma.$transaction((tx) => undoLast(tx, id, actor)) }));

    if (!r.manage) throw new AccError("این کار مجوز «انبار» می‌خواهد؛ شمارنده فقط می‌شمارد", 403);
    if (b.action === "import") {
      const rows = parseImportText(String(b.text ?? ""));
      if (!rows.length) throw new AccError("ردیفی پیدا نشد — ستون اول کد کالا، ستون دوم تعداد (اختیاری)");
      return NextResponse.json(serialize({ ok: true, result: await importIntoCount(id, rows, b.zone?.trim() || null, actor) }));
    }
    if (b.action === "fill") return NextResponse.json({ ok: true, added: await prisma.$transaction((tx) => fillWithBook(tx, id, actor), { timeout: 300_000 }) });
    if (b.action === "recount") return NextResponse.json({ ok: true, lines: await prisma.$transaction((tx) => startRecount(tx, id)) });
    if (b.action === "post") {
      const applyTo = b.applyTo === "OPENING" ? "OPENING" : "ADJUST";
      if (applyTo === "OPENING" && !r.costs) throw new AccError("اعمال روی اول دوره دیدن بهای کالا را لازم دارد", 403);
      await prisma.$transaction((tx) => postCount(tx, id, actor, { applyTo }), { timeout: 300_000 });
      return NextResponse.json({ ok: true });
    }
    if (b.action === "void") {
      await prisma.$transaction((tx) => voidCount(tx, id, String(b.reason ?? ""), actor), { timeout: 300_000 });
      return NextResponse.json({ ok: true });
    }
    throw new AccError("اقدام نامعتبر است");
  } catch (e) {
    return accErrorResponse(e, "[acc-count]");
  }
}
