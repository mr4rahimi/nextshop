import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/serialize";
import { can, requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";
import { saveInvoice } from "@/lib/accounting/invoices/service";
import { inputFromBody, permOf, type InvoiceBody } from "@/lib/accounting/invoices/query";
import { INVOICE_TYPE_LABELS } from "@/lib/accounting/invoices/calc";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";
import { actorOf, readJson } from "@/lib/accounting/api";
import { faNum } from "@/lib/accounting/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST — «یک فاکتور برای چند مشتری» (فاز ۱۰). بدنه همان فاکتور است بی `partyId`،
 * به‌علاوه‌ی `parties: [{ partyId, factor }]` — تعداد هر ردیف × ضریب همان شخص.
 * همه در یک تراکنش صادر می‌شوند: یکی خطا بدهد، هیچ‌کدام ثبت نمی‌شود.
 */
export async function POST(req: Request) {
  const guard = await requirePermission(["ACC_SALES", "ACC_PURCHASE"]);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const b = await readJson<InvoiceBody & { parties?: { partyId?: string; factor?: unknown }[] }>(req);
    const parties = (b.parties ?? []).filter((p) => p.partyId);
    if (!parties.length) throw new AccError("دست‌کم یک طرف‌حساب انتخاب کنید");
    if (parties.length > 200) throw new AccError("در هر صدور گروهی حداکثر ۲۰۰ فاکتور");
    if (new Set(parties.map((p) => p.partyId)).size !== parties.length) throw new AccError("یک شخص دو بار آمده است");
    const base = inputFromBody({ ...b, partyId: parties[0].partyId, refInvoiceId: null });
    if (!["SALES", "PURCHASE", "PROFORMA"].includes(base.type)) throw new AccError("صدور گروهی فقط برای فروش، خرید و پیش‌فاکتور است");
    if (!can(guard.access, permOf(base.type))) throw new AccError("به ثبت این نوع فاکتور دسترسی ندارید", 403);
    const actor = actorOf(guard.access);
    const batchId = randomUUID();

    const made = await prisma.$transaction(
      async (tx) => {
        const out: { id: string; number: number | null; partyName: string }[] = [];
        for (const [i, p] of parties.entries()) {
          const factor = Number(p.factor ?? 1);
          if (!Number.isInteger(factor) || factor < 1 || factor > 10_000) throw new AccError(`ضریب ردیف ${faNum(i + 1)} باید عدد صحیح مثبت باشد`);
          try {
            const inv = await saveInvoice(
              tx,
              null,
              { ...base, partyId: String(p.partyId), lines: base.lines.map((l) => ({ ...l, qty: l.qty * factor })) },
              { issue: true, allowOverCredit: !!(b as { overrideCredit?: boolean }).overrideCredit },
              actor,
            );
            await tx.accInvoice.update({ where: { id: inv.id }, data: { batchId } });
            out.push({ id: inv.id, number: inv.number, partyName: inv.partyName });
          } catch (e) {
            if (e instanceof AccError) {
              const party = await tx.accParty.findUnique({ where: { id: String(p.partyId) }, select: { name: true } });
              throw new AccError(`${party?.name ?? `ردیف ${faNum(i + 1)}`}: ${e.message}`, e.status);
            }
            throw e;
          }
        }
        return out;
      },
      { timeout: 300_000 },
    );
    const label = INVOICE_TYPE_LABELS[base.type];
    await logActivity({
      action: "CREATE",
      entity: "OTHER",
      entityId: batchId,
      entityTitle: `صدور گروهی ${label}`,
      summary: `صدور گروهی ${faNum(made.length)} ${label}: ${made.map((m) => `${faNum(m.number ?? 0)} ${m.partyName}`).join("، ").slice(0, 400)}`,
    });
    return NextResponse.json(serialize({ ok: true, batchId, invoices: made }));
  } catch (e) {
    return accErrorResponse(e, "[acc-invoice-batch]");
  }
}
