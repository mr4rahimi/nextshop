import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { convertProforma, deleteDraft, saveInvoice, voidInvoice } from "@/lib/accounting/invoices/service";
import { canSee, inputFromBody, invoiceDetail, permOf, type InvoiceBody } from "@/lib/accounting/invoices/query";
import { INVOICE_TYPE_LABELS } from "@/lib/accounting/invoices/calc";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";
import { actorOf, readJson } from "@/lib/accounting/api";
import { parseDay, todayKey } from "@/lib/accounting/dates";
import { faNum } from "@/lib/accounting/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function load(id: string) {
  const inv = await prisma.accInvoice.findUnique({ where: { id }, select: { id: true, type: true, number: true, partyName: true } });
  if (!inv) throw new AccError("فاکتور پیدا نشد", 404);
  return inv;
}

/** GET — جزئیات؛ `print=1` اطلاعات فروشنده و فروشگاه را هم برای قالب چاپ می‌دهد */
export async function GET(req: Request, { params }: Params) {
  const guard = await requirePermission(["ACC_VIEW", "ACC_SALES", "ACC_PURCHASE"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const { id } = await params;
    const d = await invoiceDetail(id, guard.access);
    if (!d || !canSee(guard.access, d.invoice.type)) throw new AccError("فاکتور پیدا نشد", 404);
    const write = can(guard.access, permOf(d.invoice.type));
    let print = null;
    if (new URL(req.url).searchParams.get("print") === "1") {
      const [acc, store] = await Promise.all([
        prisma.accSettings.findUnique({ where: { id: "singleton" } }),
        prisma.storeSettings.findUnique({ where: { id: "singleton" }, select: { storeName: true, storeLogo: true, sitePhone: true, siteAddress: true } }),
      ]);
      print = {
        seller: {
          name: acc?.sellerName ?? store?.storeName ?? null,
          nationalId: acc?.sellerNationalId ?? null,
          economicCode: acc?.sellerEconomicCode ?? null,
          regNo: acc?.sellerRegNo ?? null,
          postalCode: acc?.sellerPostalCode ?? null,
          address: acc?.sellerAddress ?? store?.siteAddress ?? null,
          phone: acc?.sellerPhone ?? store?.sitePhone ?? null,
          stampImage: acc?.stampImage ?? null,
          signatureImage: acc?.signatureImage ?? null,
          footerNote: acc?.invoiceFooterNote ?? null,
        },
        store: { name: store?.storeName ?? null, logo: store?.storeLogo ?? null },
        officialReady: !!(acc?.sellerName && acc?.sellerNationalId && acc?.sellerAddress && acc?.sellerPostalCode),
      };
    }
    return NextResponse.json(serialize({ ...d, print, can: { write, voucher: can(guard.access, "ACC_VOUCHER") } }));
  } catch (e) {
    return accErrorResponse(e, "[acc-invoice]");
  }
}

/** PUT — ویرایش پیش‌نویس یا فاکتور صادرشده (کاردکس و سند بازسازی، شماره ثابت) */
export async function PUT(req: Request, { params }: Params) {
  const guard = await requirePermission(["ACC_SALES", "ACC_PURCHASE"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const { id } = await params;
    const cur = await load(id);
    if (!can(guard.access, permOf(cur.type))) throw new AccError("به ویرایش این فاکتور دسترسی ندارید", 404);
    const b = await readJson<InvoiceBody>(req);
    const input = inputFromBody({ ...b, type: cur.type });
    const inv = await prisma.$transaction((tx) => saveInvoice(tx, id, input, { issue: !!b.issue }, actorOf(guard.access)), { timeout: 60_000 });
    await logActivity({
      action: "UPDATE",
      entity: "OTHER",
      entityId: inv.id,
      entityTitle: `${INVOICE_TYPE_LABELS[inv.type]}${inv.number ? ` ${inv.number}` : ""}`,
      summary: `ویرایش ${INVOICE_TYPE_LABELS[inv.type]}${inv.number ? ` ${faNum(inv.number)}` : ""} — ${inv.partyName}`,
    });
    return NextResponse.json(serialize({ ok: true, id: inv.id, number: inv.number, status: inv.status }));
  } catch (e) {
    return accErrorResponse(e, "[acc-invoice]");
  }
}

/**
 * POST { action }:
 *   issue            پیش‌نویس ← صادرشده
 *   void { reason }  ابطال
 *   convert { date?, warehouseId? }  پیش‌فاکتور ← فاکتور فروش
 */
export async function POST(req: Request, { params }: Params) {
  const guard = await requirePermission(["ACC_SALES", "ACC_PURCHASE"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const { id } = await params;
    const cur = await load(id);
    if (!can(guard.access, permOf(cur.type))) throw new AccError("به این فاکتور دسترسی ندارید", 404);
    const b = await readJson<{ action?: string; reason?: string; date?: string; warehouseId?: string }>(req);
    const actor = actorOf(guard.access);
    const label = INVOICE_TYPE_LABELS[cur.type];

    if (b.action === "issue") {
      const inv = await prisma.$transaction(async (tx) => {
        const full = await tx.accInvoice.findUniqueOrThrow({ where: { id }, include: { lines: { orderBy: { seq: "asc" } } } });
        if (full.status !== "DRAFT") throw new AccError("این فاکتور پیش‌نویس نیست");
        return saveInvoice(
          tx,
          id,
          {
            type: full.type,
            date: full.date,
            dueDate: full.dueDate,
            validUntil: full.validUntil,
            partyId: full.partyId,
            warehouseId: full.warehouseId,
            pricesIncludeVat: full.pricesIncludeVat,
            invoiceDiscount: full.invoiceDiscount,
            additions: full.additions,
            additionsTitle: full.additionsTitle,
            note: full.note,
            refInvoiceId: full.refInvoiceId,
            lines: full.lines.map((l) => ({ ...l, discount: l.discount })),
          },
          { issue: true },
          actor,
        );
      }, { timeout: 60_000 });
      await logActivity({ action: "UPDATE", entity: "OTHER", entityId: id, entityTitle: `${label} ${inv.number}`, summary: `صدور ${label} ${faNum(inv.number ?? 0)} — ${inv.partyName}` });
      return NextResponse.json(serialize({ ok: true, number: inv.number }));
    }

    if (b.action === "void") {
      const reason = String(b.reason ?? "");
      await prisma.$transaction((tx) => voidInvoice(tx, id, reason, actor), { timeout: 60_000 });
      await logActivity({ action: "UPDATE", entity: "OTHER", entityId: id, entityTitle: `${label} ${cur.number ?? ""}`, summary: `ابطال ${label} ${faNum(cur.number ?? 0)} — ${cur.partyName}: ${reason}` });
      return NextResponse.json({ ok: true });
    }

    if (b.action === "convert") {
      if (!can(guard.access, "ACC_SALES")) throw new AccError("به ثبت فاکتور فروش دسترسی ندارید", 404);
      const inv = await prisma.$transaction((tx) => convertProforma(tx, id, parseDay(b.date) ?? todayKey(), actor, b.warehouseId || null), { timeout: 60_000 });
      await logActivity({ action: "CREATE", entity: "OTHER", entityId: inv.id, entityTitle: `فاکتور فروش ${inv.number}`, summary: `تبدیل پیش‌فاکتور ${faNum(cur.number ?? 0)} به فاکتور فروش ${faNum(inv.number ?? 0)} — ${inv.partyName}` });
      return NextResponse.json(serialize({ ok: true, id: inv.id, number: inv.number }));
    }

    throw new AccError("اقدام نامعتبر است");
  } catch (e) {
    return accErrorResponse(e, "[acc-invoice]");
  }
}

/** DELETE — فقط پیش‌نویس */
export async function DELETE(_req: Request, { params }: Params) {
  const guard = await requirePermission(["ACC_SALES", "ACC_PURCHASE"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const { id } = await params;
    const cur = await load(id);
    if (!can(guard.access, permOf(cur.type))) throw new AccError("به این فاکتور دسترسی ندارید", 404);
    await prisma.$transaction((tx) => deleteDraft(tx, id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return accErrorResponse(e, "[acc-invoice]");
  }
}
