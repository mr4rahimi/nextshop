import { NextResponse } from "next/server";
import type { AccInvoiceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { saveInvoice } from "@/lib/accounting/invoices/service";
import { inputFromBody, listInvoices, parseType, permOf, PURCHASE_TYPES, SALES_TYPES, type InvoiceBody } from "@/lib/accounting/invoices/query";
import { INVOICE_TYPE_LABELS } from "@/lib/accounting/invoices/calc";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";
import { actorOf, rangeFrom, readJson } from "@/lib/accounting/api";
import { faNum } from "@/lib/accounting/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = ["DRAFT", "ISSUED", "VOID", "OPEN_PROFORMA"];

/**
 * GET ?side=sales|purchases&type=&status=&q=&partyId=&from=&to= — فهرست فاکتورها.
 * هر کاربر فقط سمتی را می‌بیند که مجوزش را دارد (ACC_VIEW هر دو).
 */
export async function GET(req: Request) {
  const guard = await requirePermission(["ACC_VIEW", "ACC_SALES", "ACC_PURCHASE"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const url = new URL(req.url);
    const side = url.searchParams.get("side") === "purchases" ? "purchases" : "sales";
    const typeParam = url.searchParams.get("type");
    const types = typeParam ? [parseType(typeParam)] : side === "sales" ? SALES_TYPES : PURCHASE_TYPES;
    const perm = side === "sales" ? "ACC_SALES" : "ACC_PURCHASE";
    if (!can(guard.access, "ACC_VIEW") && !can(guard.access, perm)) throw new AccError("به این فاکتورها دسترسی ندارید", 404);
    const status = url.searchParams.get("status");
    const { from, to } = rangeFrom(url);
    const data = await listInvoices({
      types,
      status: status && STATUSES.includes(status) ? (status as AccInvoiceStatus | "OPEN_PROFORMA") : null,
      q: url.searchParams.get("q"),
      partyId: url.searchParams.get("partyId"),
      from,
      to,
      take: Math.min(Number(url.searchParams.get("take")) || 100, 300),
    });
    return NextResponse.json(
      serialize({ ...data, can: { sales: can(guard.access, "ACC_SALES"), purchase: can(guard.access, "ACC_PURCHASE") } }),
    );
  } catch (e) {
    return accErrorResponse(e, "[acc-invoices]");
  }
}

/** POST — فاکتور تازه. `issue: true` همان لحظه صادر می‌کند، وگرنه پیش‌نویس. */
export async function POST(req: Request) {
  const guard = await requirePermission(["ACC_SALES", "ACC_PURCHASE"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const b = await readJson<InvoiceBody>(req);
    const input = inputFromBody(b);
    if (!can(guard.access, permOf(input.type))) throw new AccError("به ثبت این نوع فاکتور دسترسی ندارید", 404);
    const inv = await prisma.$transaction((tx) => saveInvoice(tx, null, input, { issue: !!b.issue }, actorOf(guard.access)), { timeout: 60_000 });
    const label = INVOICE_TYPE_LABELS[inv.type];
    await logActivity({
      action: "CREATE",
      entity: "OTHER",
      entityId: inv.id,
      entityTitle: `${label}${inv.number ? ` ${inv.number}` : ""}`,
      summary: `${inv.status === "DRAFT" ? "پیش‌نویس " : ""}${label}${inv.number ? ` ${faNum(inv.number)}` : ""} — ${inv.partyName}`,
    });
    return NextResponse.json(serialize({ ok: true, id: inv.id, number: inv.number, status: inv.status }));
  } catch (e) {
    return accErrorResponse(e, "[acc-invoices]");
  }
}
