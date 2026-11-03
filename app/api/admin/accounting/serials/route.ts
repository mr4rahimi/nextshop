import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";
import { actorOf, readJson } from "@/lib/accounting/api";
import { parseDay, todayKey } from "@/lib/accounting/dates";
import { faNum } from "@/lib/accounting/money";
import {
  availableSerials,
  cleanSerialList,
  deleteRegistered,
  listSerials,
  registerSerials,
  sequentialSerials,
  serialHistory,
  serialSummary,
} from "@/lib/accounting/inventory/serials";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VIEW = ["ACC_VIEW", "ACC_INVENTORY", "ACC_SALES", "ACC_PURCHASE", "ACC_STOCK_COUNT"] as const;

/**
 * شماره سریال کالا — docs/plans/webhesab-parity.md بخش ۱۴.
 * GET ?available=1&itemId&warehouseId — سریال‌های در انبار (فرم فاکتور، حواله، خروج)
 * GET ?id — سابقه‌ی یک سریال
 * GET ?q&itemId&warehouseId&status — فهرست، شمارش هر وضعیت، و با `itemId` خلاصه‌ی کالا
 * POST `{action: "register", itemId, warehouseId, date?, serials? | seq: {prefix, from, to}}` — ثبت برای موجودی بی‌سریال
 * POST `{action: "delete", id}` — فقط سریالِ «ثبت برای موجودی» بی‌گردش دیگر
 */
export async function GET(req: Request) {
  const guard = await requirePermission([...VIEW]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const sp = new URL(req.url).searchParams;
    const itemId = sp.get("itemId") || null;
    const warehouseId = sp.get("warehouseId") || null;
    if (sp.get("available") === "1") {
      if (!itemId || !warehouseId) return NextResponse.json({ serials: [] });
      return NextResponse.json({ serials: await availableSerials(prisma, itemId, warehouseId) });
    }
    const id = sp.get("id");
    if (id) return NextResponse.json(serialize(await serialHistory(prisma, id)));

    const [warehouses, item, res, summary] = await Promise.all([
      prisma.accWarehouse.findMany({ where: { isActive: true }, orderBy: [{ isDefault: "desc" }, { code: "asc" }], select: { id: true, name: true } }),
      itemId ? prisma.accItem.findUnique({ where: { id: itemId }, select: { id: true, code: true, title: true, hasSerial: true, warrantyDays: true } }) : null,
      listSerials(prisma, { q: sp.get("q"), itemId, warehouseId, status: sp.get("status") }),
      itemId ? serialSummary(prisma, itemId) : null,
    ]);
    const whName = new Map(warehouses.map((w) => [w.id, w.name]));
    return NextResponse.json(
      serialize({
        warehouses,
        item,
        summary,
        ...res,
        rows: res.rows.map((r) => ({ ...r, warehouseName: r.warehouseId ? whName.get(r.warehouseId) ?? null : null })),
        can: { edit: can(guard.access, "ACC_INVENTORY") },
      }),
    );
  } catch (e) {
    return accErrorResponse(e, "[acc-serials]");
  }
}

interface Body {
  action?: string;
  id?: unknown;
  itemId?: unknown;
  warehouseId?: unknown;
  date?: unknown;
  serials?: unknown;
  seq?: { prefix?: unknown; from?: unknown; to?: unknown };
}

export async function POST(req: Request) {
  const guard = await requirePermission("ACC_INVENTORY");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const b = await readJson<Body>(req);
    const actor = actorOf(guard.access);
    if (b.action === "register") {
      const itemId = String(b.itemId ?? "");
      const item = await prisma.accItem.findUnique({ where: { id: itemId }, select: { title: true, hasSerial: true } });
      if (!item) throw new AccError("کالا را انتخاب کنید");
      const serials = b.seq ? sequentialSerials(String(b.seq.prefix ?? ""), String(b.seq.from ?? ""), String(b.seq.to ?? "")) : cleanSerialList(b.serials);
      const date = (b.date ? parseDay(b.date) : null) ?? todayKey();
      const res = await prisma.$transaction((tx) => registerSerials(tx, { itemId, warehouseId: String(b.warehouseId ?? ""), date, serials }, actor), { timeout: 120_000 });
      await logActivity({ action: "CREATE", entity: "OTHER", entityId: itemId, entityTitle: "شماره سریال", summary: `ثبت ${faNum(res.count)} شماره سریال برای «${item.title}»` });
      return NextResponse.json({ ok: true, ...res });
    }
    if (b.action === "delete") {
      await prisma.$transaction((tx) => deleteRegistered(tx, String(b.id ?? ""), actor));
      return NextResponse.json({ ok: true });
    }
    throw new AccError("درخواست نامعتبر است");
  } catch (e) {
    return accErrorResponse(e, "[acc-serials]");
  }
}
