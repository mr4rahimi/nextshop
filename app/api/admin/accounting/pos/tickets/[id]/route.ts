import { NextResponse } from "next/server";
import { serialize } from "@/lib/serialize";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { AccError, accErrorResponse } from "@/lib/accounting/errors";
import { actorOf } from "@/lib/accounting/api";
import { faNum } from "@/lib/accounting/money";
import { rejectVoid, requestVoid, voidTicket } from "@/lib/accounting/pos/void";
import { posGuard } from "@/lib/accounting/pos/api";
import { ticketView } from "@/lib/accounting/pos/tickets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — رسید صندوق برای چاپ */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await posGuard(["ACC_POS", "ACC_POS_MANAGE", "ACC_SALES", "ACC_VIEW"]);
  if (!g.ok) return g.res;
  try {
    const { id } = await params;
    return NextResponse.json(serialize(await ticketView(id)));
  } catch (e) {
    return accErrorResponse(e, "[acc-pos-ticket]");
  }
}

/**
 * POST { action, reason } — ابطال رسید (docs/plans/inventory-items.md بخش ۱۳.۳):
 *   void    مدیر صندوق: ابطال کامل (یا تأیید درخواست)
 *   request صندوقدار/فروش: درخواست برای تأیید مدیر — مدیر با همین action مستقیم باطل می‌کند
 *   reject  مدیر: رد درخواست
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await posGuard(["ACC_POS", "ACC_POS_MANAGE", "ACC_SALES"]);
  if (!g.ok) return g.res;
  try {
    const { id } = await params;
    const b = (await req.json().catch(() => ({}))) as { action?: string; reason?: string };
    const actor = actorOf(g.access);
    const reason = String(b.reason ?? "");
    const action = b.action === "request" && g.manage ? "void" : b.action;
    if ((action === "void" || action === "reject") && !g.manage) throw new AccError("ابطال رسید با تأیید مدیر صندوق است؛ «درخواست ابطال» بفرستید", 403);
    if (action === "void") {
      const t = await prisma.$transaction((tx) => voidTicket(tx, id, reason, actor), { timeout: 120_000 });
      await logActivity({ action: "UPDATE", entity: "OTHER", entityId: t.id, entityTitle: `رسید صندوق ${t.number}`, summary: `ابطال رسید صندوق ${faNum(t.number)} — ${t.partyName}: ${t.voidReason}` });
      return NextResponse.json(serialize({ ok: true, voided: true, ticket: { id: t.id, number: t.number } }));
    }
    if (action === "request") {
      const t = await prisma.$transaction((tx) => requestVoid(tx, id, reason, actor));
      await logActivity({ action: "UPDATE", entity: "OTHER", entityId: t.id, entityTitle: `رسید صندوق ${t.number}`, summary: `درخواست ابطال رسید صندوق ${faNum(t.number)} — ${reason}` });
      return NextResponse.json(serialize({ ok: true, requested: true }));
    }
    if (action === "reject") {
      const t = await prisma.$transaction((tx) => rejectVoid(tx, id, reason, actor));
      await logActivity({ action: "UPDATE", entity: "OTHER", entityId: t.id, entityTitle: `رسید صندوق ${t.number}`, summary: `رد درخواست ابطال رسید صندوق ${faNum(t.number)}${reason ? ` — ${reason}` : ""}` });
      return NextResponse.json(serialize({ ok: true, rejected: true }));
    }
    throw new AccError("اقدام نامعتبر است");
  } catch (e) {
    return accErrorResponse(e, "[acc-pos-ticket-void]");
  }
}
