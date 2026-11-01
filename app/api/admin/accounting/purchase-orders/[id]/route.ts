import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { accErrorResponse } from "@/lib/accounting/errors";
import { actorOf, readJson } from "@/lib/accounting/api";
import { deletePurchaseOrder, invoiceFromOrder, purchaseOrderDetail, savePurchaseOrder, setPoStatus } from "@/lib/accounting/purchases/orders";
import { poFromBody, seesPrice, VIEW } from "../body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET — سفارش با دریافت‌شده‌ی هر ردیف و فاکتورهایش؛ `print=1` نام و نشانی خریدار (خودمان) برای چاپ */
export async function GET(req: Request, { params }: Ctx) {
  const guard = await requirePermission([...VIEW]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const d = await purchaseOrderDetail(prisma, (await params).id);
  if (!d) return NextResponse.json({ error: "سفارش پیدا نشد" }, { status: 404 });
  const price = seesPrice(guard.access);
  const out = price
    ? d
    : { ...d, total: null, invoices: d.invoices.map((i) => ({ ...i, total: null })), order: { ...d.order, lines: d.order.lines.map((l) => ({ ...l, unitPrice: null })) } };
  let print = null;
  if (new URL(req.url).searchParams.get("print") === "1") {
    const [acc, store] = await Promise.all([
      prisma.accSettings.findUnique({ where: { id: "singleton" }, select: { sellerName: true, sellerAddress: true, sellerPhone: true } }),
      prisma.storeSettings.findUnique({ where: { id: "singleton" }, select: { storeName: true, storeLogo: true, sitePhone: true, siteAddress: true } }),
    ]);
    print = {
      name: acc?.sellerName ?? store?.storeName ?? null,
      address: acc?.sellerAddress ?? store?.siteAddress ?? null,
      phone: acc?.sellerPhone ?? store?.sitePhone ?? null,
      logo: store?.storeLogo ?? null,
    };
  }
  return NextResponse.json(serialize({ ...out, print, can: { write: can(guard.access, "ACC_PURCHASE"), price } }));
}

/** PUT — ویرایش (فقط سفارش باز؛ ردیف فاکتورشده کمتر از فاکتورشده نمی‌شود) */
export async function PUT(req: Request, { params }: Ctx) {
  const guard = await requirePermission("ACC_PURCHASE");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const input = poFromBody(await readJson(req));
    const id = (await params).id;
    await prisma.$transaction((tx) => savePurchaseOrder(tx, id, input, actorOf(guard.access)), { timeout: 30_000 });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return accErrorResponse(e, "[acc-po]");
  }
}

/** POST { action: "invoice" | "close" | "cancel" | "reopen", reason? } */
export async function POST(req: Request, { params }: Ctx) {
  const guard = await requirePermission("ACC_PURCHASE");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const id = (await params).id;
    const b = await readJson<{ action?: string; reason?: string }>(req);
    if (b.action === "invoice") {
      const r = await prisma.$transaction((tx) => invoiceFromOrder(tx, id, actorOf(guard.access)), { timeout: 30_000 });
      return NextResponse.json({ ok: true, ...r });
    }
    if (b.action !== "close" && b.action !== "cancel" && b.action !== "reopen") return NextResponse.json({ error: "کار نامعتبر" }, { status: 400 });
    const action = b.action;
    await prisma.$transaction((tx) => setPoStatus(tx, id, action, b.reason));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return accErrorResponse(e, "[acc-po]");
  }
}

/** DELETE — فقط سفارش بی‌فاکتور */
export async function DELETE(_req: Request, { params }: Ctx) {
  const guard = await requirePermission("ACC_PURCHASE");
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const id = (await params).id;
    await prisma.$transaction((tx) => deletePurchaseOrder(tx, id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return accErrorResponse(e, "[acc-po]");
  }
}
