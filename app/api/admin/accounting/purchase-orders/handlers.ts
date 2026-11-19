/**
 * مسیرهای API سفارش خرید و سفارش فروش — یک کد برای هر دو (webhesab-parity.md بخش‌های ۱۳ و ۳۱).
 * `purchase-orders/*` و `sales-orders/*` فقط همین‌ها را با نوعشان صادر می‌کنند.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { accErrorResponse } from "@/lib/accounting/errors";
import { actorOf, readJson } from "@/lib/accounting/api";
import { deletePurchaseOrder, invoiceFromOrder, listPurchaseOrders, purchaseOrderDetail, savePurchaseOrder, setPoStatus, type PoFilter } from "@/lib/accounting/purchases/orders";
import { ORDER_KINDS, type OrderKind } from "@/lib/accounting/purchases/order-kind";
import { poFromBody, seesPrice } from "./body";

type Ctx = { params: Promise<{ id: string }> };

export function orderListRoutes(kind: OrderKind) {
  const K = ORDER_KINDS[kind];
  const VIEW = [...K.viewPerms];
  const tag = `[acc-${kind === "SALES" ? "so" : "po"}]`;

  /** GET ?state=open|overdue|done|all&partyId&productId&q — فهرست با دریافت/تحویل‌شده */
  async function GET(req: Request) {
    const guard = await requirePermission(VIEW);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
    const sp = new URL(req.url).searchParams;
    const rows = await listPurchaseOrders(prisma, {
      kind,
      state: (sp.get("state") as PoFilter["state"]) ?? "open",
      partyId: sp.get("partyId"),
      productId: sp.get("productId"),
      q: sp.get("q"),
    });
    const price = seesPrice(guard.access, kind);
    const [warehouses, product] = await Promise.all([
      prisma.accWarehouse.findMany({ select: { id: true, name: true } }),
      sp.get("productId") ? prisma.accItem.findUnique({ where: { id: sp.get("productId")! }, select: { id: true, title: true, code: true } }) : null,
    ]);
    return NextResponse.json(
      serialize({
        items: rows.map((r) => (price ? r : { ...r, total: null })),
        warehouses,
        product,
        can: { write: can(guard.access, K.writePerm), price },
      }),
    );
  }

  /** POST — سفارش تازه */
  async function POST(req: Request) {
    const guard = await requirePermission(K.writePerm);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
    try {
      const input = poFromBody(await readJson(req), kind);
      const po = await prisma.$transaction((tx) => savePurchaseOrder(tx, null, input, actorOf(guard.access)), { timeout: 30_000 });
      return NextResponse.json(serialize({ ok: true, id: po.id, number: po.number }));
    } catch (e) {
      return accErrorResponse(e, tag);
    }
  }
  return { GET, POST };
}

export function orderItemRoutes(kind: OrderKind) {
  const K = ORDER_KINDS[kind];
  const VIEW = [...K.viewPerms];
  const tag = `[acc-${kind === "SALES" ? "so" : "po"}]`;
  const notFound = () => NextResponse.json({ error: "سفارش پیدا نشد" }, { status: 404 });
  /** سفارش نوع دیگر از این مسیر دست نمی‌خورد */
  const mine = async (id: string) => (await prisma.accPurchaseOrder.findUnique({ where: { id }, select: { kind: true } }))?.kind === kind;

  /** GET — سفارش با دریافت/تحویل‌شده‌ی هر ردیف و فاکتورهایش؛ `print=1` نام و نشانی خودمان برای چاپ */
  async function GET(req: Request, { params }: Ctx) {
    const guard = await requirePermission(VIEW);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
    const d = await purchaseOrderDetail(prisma, (await params).id, kind);
    if (!d) return notFound();
    const price = seesPrice(guard.access, kind);
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
    return NextResponse.json(serialize({ ...out, print, can: { write: can(guard.access, K.writePerm), price } }));
  }

  /** PUT — ویرایش (فقط سفارش باز؛ ردیف فاکتورشده کمتر از فاکتورشده نمی‌شود) */
  async function PUT(req: Request, { params }: Ctx) {
    const guard = await requirePermission(K.writePerm);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
    try {
      const input = poFromBody(await readJson(req), kind);
      const id = (await params).id;
      if (!(await mine(id))) return notFound();
      await prisma.$transaction((tx) => savePurchaseOrder(tx, id, input, actorOf(guard.access)), { timeout: 30_000 });
      return NextResponse.json({ ok: true, id });
    } catch (e) {
      return accErrorResponse(e, tag);
    }
  }

  /** POST { action: "invoice" | "close" | "cancel" | "reopen", reason? } */
  async function POST(req: Request, { params }: Ctx) {
    const guard = await requirePermission(K.writePerm);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
    try {
      const id = (await params).id;
      if (!(await mine(id))) return notFound();
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
      return accErrorResponse(e, tag);
    }
  }

  /** DELETE — فقط سفارش بی‌فاکتور */
  async function DELETE(_req: Request, { params }: Ctx) {
    const guard = await requirePermission(K.writePerm);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
    try {
      const id = (await params).id;
      if (!(await mine(id))) return notFound();
      await prisma.$transaction((tx) => deletePurchaseOrder(tx, id));
      return NextResponse.json({ ok: true });
    } catch (e) {
      return accErrorResponse(e, tag);
    }
  }
  return { GET, PUT, POST, DELETE };
}
